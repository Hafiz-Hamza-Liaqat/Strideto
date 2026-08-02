/**
 * RefreshSession index readiness utility.
 *
 * Verification is the default. Index creation requires both --apply and the
 * explicit STRIDETO_INDEX_PROVISION_CONFIRM=1 operator confirmation.
 */
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import mongoose from 'mongoose';
import { RefreshSession } from '../models/RefreshSession.js';

export const REQUIRED_REFRESH_SESSION_INDEX_NAMES = Object.freeze([
  'refresh_session_ttl',
  'refresh_session_active_by_subject',
  'refresh_session_current_token_hash_unique',
  'refresh_session_previous_token_hash',
]);

const IMPLICIT_ID_INDEX_NAME = '_id_';

export class IndexReadinessError extends Error {
  constructor(code) {
    super(code);
    this.name = 'IndexReadinessError';
    this.code = code;
  }
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeKey(key = {}) {
  return Object.entries(key).map(([field, direction]) => [field, direction]);
}

function normalizeRelevantOptions(options = {}) {
  return {
    unique: options.unique === true,
    sparse: options.sparse === true,
    expireAfterSeconds: hasOwn(options, 'expireAfterSeconds')
      ? Number(options.expireAfterSeconds)
      : null,
  };
}

function normalizedDefinition({ name, key, options = {}, implicit = false }) {
  return {
    name,
    key: normalizeKey(key),
    options: normalizeRelevantOptions(options),
    implicit,
  };
}

export function expectedRefreshSessionIndexes(schema = RefreshSession.schema) {
  const schemaDefinitions = schema.indexes().map(([key, options]) => {
    if (!options?.name) {
      throw new IndexReadinessError('SCHEMA_INDEX_NAME_MISSING');
    }

    return normalizedDefinition({ name: options.name, key, options });
  });

  const schemaNames = schemaDefinitions.map(({ name }) => name);
  if (new Set(schemaNames).size !== schemaNames.length) {
    throw new IndexReadinessError('SCHEMA_INDEX_NAME_DUPLICATED');
  }

  for (const requiredName of REQUIRED_REFRESH_SESSION_INDEX_NAMES) {
    if (!schemaNames.includes(requiredName)) {
      throw new IndexReadinessError('REQUIRED_SCHEMA_INDEX_MISSING');
    }
  }

  return [
    normalizedDefinition({
      name: IMPLICIT_ID_INDEX_NAME,
      key: { _id: 1 },
      implicit: true,
    }),
    ...schemaDefinitions,
  ];
}

function actualIndexDefinition(index) {
  return normalizedDefinition({
    name: index?.name,
    key: index?.key,
    options: index,
    implicit: index?.name === IMPLICIT_ID_INDEX_NAME,
  });
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function compareRefreshSessionIndexes(expected, actual) {
  const actualByName = new Map(
    actual.map((index) => {
      const normalized = actualIndexDefinition(index);
      return [normalized.name, normalized];
    })
  );
  const matched = [];
  const missing = [];
  const mismatched = [];

  for (const expectedIndex of expected) {
    const actualIndex = actualByName.get(expectedIndex.name);
    if (!actualIndex) {
      missing.push(expectedIndex);
      continue;
    }

    const differences = [];
    if (!sameValue(expectedIndex.key, actualIndex.key)) differences.push('key');
    if (expectedIndex.options.unique !== actualIndex.options.unique) {
      differences.push('unique');
    }
    if (expectedIndex.options.sparse !== actualIndex.options.sparse) {
      differences.push('sparse');
    }
    if (
      expectedIndex.options.expireAfterSeconds !==
      actualIndex.options.expireAfterSeconds
    ) {
      differences.push('expireAfterSeconds');
    }

    if (differences.length > 0) {
      mismatched.push({ expected: expectedIndex, differences });
    } else {
      matched.push(expectedIndex);
    }
  }

  return {
    ok: missing.length === 0 && mismatched.length === 0,
    matched,
    missing,
    mismatched,
  };
}

export function buildSafeApplyPlan(
  comparison,
  { collectionExists = true } = {}
) {
  if (comparison.mismatched.length > 0) {
    throw new IndexReadinessError('MISMATCHED_INDEX_REQUIRES_OPERATOR_REVIEW');
  }
  if (
    collectionExists &&
    comparison.missing.some(({ implicit }) => implicit)
  ) {
    throw new IndexReadinessError('IMPLICIT_ID_INDEX_MISSING');
  }

  return comparison.missing.filter(({ implicit }) => !implicit);
}

export function isNamespaceNotFoundError(error) {
  if (!error || typeof error !== 'object') return false;
  const candidates = [error, error.errorResponse, error.cause].filter(
    (candidate) => candidate && typeof candidate === 'object'
  );

  return candidates.some(
    (candidate) =>
      Number(candidate.code) === 26 ||
      candidate.code === 'NamespaceNotFound' ||
      candidate.codeName === 'NamespaceNotFound'
  );
}

export async function inspectIndexesSafely(readIndexes) {
  try {
    return {
      collectionExists: true,
      indexes: await readIndexes(),
    };
  } catch (error) {
    if (!isNamespaceNotFoundError(error)) throw error;
    return {
      collectionExists: false,
      indexes: [],
    };
  }
}

export function assertApplyConfirmation(mode, environment = process.env) {
  if (mode === 'apply' && environment.STRIDETO_INDEX_PROVISION_CONFIRM !== '1') {
    throw new IndexReadinessError('APPLY_CONFIRMATION_REQUIRED');
  }
}

export function parseCliMode(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--verify')) {
    return 'verify';
  }
  if (args.length === 1 && args[0] === '--apply') return 'apply';
  if (args.length === 1 && args[0] === '--help') return 'help';
  throw new IndexReadinessError('INVALID_ARGUMENTS');
}

export function helpText() {
  return [
    'RefreshSession index readiness',
    'Usage:',
    '  node src/scripts/provisionRefreshSessionIndexes.js --verify',
    '  STRIDETO_INDEX_PROVISION_CONFIRM=1 node src/scripts/provisionRefreshSessionIndexes.js --apply',
    '  node src/scripts/provisionRefreshSessionIndexes.js --help',
    'Default mode: --verify',
  ].join('\n');
}

export function comparisonOutput(comparison) {
  const lines = [];
  for (const index of comparison.matched) lines.push(`MATCH ${index.name}`);
  for (const index of comparison.missing) lines.push(`MISSING ${index.name}`);
  for (const { expected } of comparison.mismatched) {
    lines.push(`MISMATCH ${expected.name}`);
  }
  lines.push(comparison.ok ? 'STATUS READY' : 'STATUS NOT_READY');
  return lines.join('\n');
}

async function inspectCurrentIndexes() {
  return inspectIndexesSafely(() => RefreshSession.collection.indexes());
}

export async function executeIndexReadiness({
  mode,
  expected,
  inspectIndexes,
  createSchemaIndexes,
  output,
}) {
  let inspection = await inspectIndexes();
  let comparison = compareRefreshSessionIndexes(expected, inspection.indexes);
  output(comparisonOutput(comparison));

  if (mode === 'verify') {
    return { exitCode: comparison.ok ? 0 : 1, comparison };
  }

  const applyPlan = buildSafeApplyPlan(comparison, {
    collectionExists: inspection.collectionExists,
  });
  if (applyPlan.length > 0) {
    for (const index of applyPlan) output(`CREATE ${index.name}`);
    await createSchemaIndexes();
    inspection = await inspectIndexes();
    comparison = compareRefreshSessionIndexes(expected, inspection.indexes);
    output(comparisonOutput(comparison));
  }

  return { exitCode: comparison.ok ? 0 : 1, comparison };
}

async function executeDatabaseMode(mode, environment, output) {
  assertApplyConfirmation(mode, environment);
  if (!environment.MONGO_URI) {
    throw new IndexReadinessError('MONGO_URI_REQUIRED');
  }

  const expected = expectedRefreshSessionIndexes();
  try {
    await mongoose.connect(environment.MONGO_URI);
    const result = await executeIndexReadiness({
      mode,
      expected,
      inspectIndexes: inspectCurrentIndexes,
      createSchemaIndexes: () => RefreshSession.createIndexes(),
      output,
    });
    return result.exitCode;
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
}

export async function runCli({
  args = process.argv.slice(2),
  environment = process.env,
  output = console.log,
  errorOutput = console.error,
} = {}) {
  try {
    const mode = parseCliMode(args);
    if (mode === 'help') {
      output(helpText());
      return 0;
    }
    return await executeDatabaseMode(mode, environment, output);
  } catch (error) {
    const code =
      error instanceof IndexReadinessError
        ? error.code
        : 'INDEX_READINESS_OPERATION_FAILED';
    errorOutput(`ERROR ${code}`);
    return 1;
  }
}

const isDirectExecution =
  Boolean(process.argv[1]) &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  const exitCode = await runCli();
  process.exitCode = exitCode;
}
