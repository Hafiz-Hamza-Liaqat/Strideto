/**
 * Verified Data Launch — launch pack location and loading (Mission 25).
 *
 * The real launch pack lives in ONE place: <repo>/data/verified-launch/.
 * Test fixtures live under server/src/__tests__/fixtures/ and are structurally
 * incapable of being loaded as a launch pack — the loader refuses any path that
 * escapes the launch root or that sits under a test/fixture directory.
 *
 * Read-only. This module never writes and never connects to a database.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ManifestStructureError,
  parseManifestJson,
  validateManifest,
} from './verifiedLaunchManifest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** <repo>/data/verified-launch */
export const LAUNCH_PACK_ROOT = path.resolve(__dirname, '../../../../data/verified-launch');

/** Path segments that can never contain a real launch pack. */
const FORBIDDEN_PATH_SEGMENTS = Object.freeze([
  '__tests__',
  'fixtures',
  'fixture',
  'test',
  'tests',
  'spec',
  'mock',
  'mocks',
  'sample',
  'demo',
]);

export class LaunchPackError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'LaunchPackError';
    this.code = code;
  }
}

/**
 * Resolve a manifest path inside the launch root, refusing anything that
 * escapes it or that lives in a test/fixture location.
 */
export function resolveLaunchPackPath(candidate, { root = LAUNCH_PACK_ROOT } = {}) {
  if (typeof candidate !== 'string' || !candidate.trim()) {
    throw new LaunchPackError('launch_pack_path_required', 'a manifest path is required');
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, candidate);

  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new LaunchPackError(
      'launch_pack_path_outside_root',
      'manifest must live inside data/verified-launch'
    );
  }

  const segments = resolved.split(/[\\/]/).map((s) => s.toLowerCase());
  for (const segment of segments) {
    if (FORBIDDEN_PATH_SEGMENTS.includes(segment)) {
      throw new LaunchPackError(
        'launch_pack_path_is_test_fixture',
        `test/fixture path segment "${segment}" cannot be loaded as a verified launch pack`
      );
    }
  }

  if (path.extname(resolved).toLowerCase() !== '.json') {
    throw new LaunchPackError('launch_pack_not_json', 'manifest must be a .json file');
  }

  return resolved;
}

/** List available launch pack manifests (filenames only). */
export function listLaunchPacks({ root = LAUNCH_PACK_ROOT } = {}) {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort();
}

/**
 * Read + validate a launch pack manifest from disk.
 *
 * @returns {{ filePath: string, manifest: object, validation: object }}
 */
export function loadLaunchPack(candidate, { root = LAUNCH_PACK_ROOT, now = new Date() } = {}) {
  const filePath = resolveLaunchPackPath(candidate, { root });
  if (!fs.existsSync(filePath)) {
    throw new LaunchPackError('launch_pack_not_found', 'manifest file does not exist');
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new LaunchPackError('launch_pack_not_a_file', 'manifest path is not a file');
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const manifest = parseManifestJson(raw);
  const validation = validateManifest(manifest, { now });
  return { filePath, manifest, validation };
}

export { ManifestStructureError };
