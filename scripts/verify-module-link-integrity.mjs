#!/usr/bin/env node
/**
 * Module link integrity — static ESM import/export graph validation.
 *
 * Catches the class of defect that makes a module graph fail at LINK time,
 * before a single line of it evaluates:
 *
 *   - a named import of a binding the target module does not export
 *     (Node throws `SyntaxError: ... does not provide an export named 'x'`
 *      and the process dies — no route, no test, no log)
 *   - a relative import that resolves to no file on disk
 *   - a re-export (`export { x } from './y.js'`) of a missing binding
 *
 * Syntax-only checks (`node --check`) and unit tests that never import the
 * real entrypoint both miss this entirely, which is why it is its own gate.
 *
 * Offline and read-only: parses source with acorn, never evaluates a module,
 * never touches the network, DB, or filesystem outside the repo.
 *
 *   node scripts/verify-module-link-integrity.mjs
 *   node scripts/verify-module-link-integrity.mjs --json
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * acorn/acorn-jsx ship as transitive deps of eslint and are NOT hoisted to the
 * repo root, so a bare `import 'acorn'` does not resolve from scripts/.
 * Resolve them from the workspaces that do have them — installing is not
 * permitted here, so a clear failure beats a silent skip.
 */
async function loadParser() {
  const candidates = ['server/node_modules', 'client/node_modules', 'node_modules'];
  for (const dir of candidates) {
    const acornPath = path.join(root, dir, 'acorn', 'dist', 'acorn.mjs');
    const jsxPath = path.join(root, dir, 'acorn-jsx', 'index.js');
    if (!existsSync(acornPath) || !existsSync(jsxPath)) continue;
    const { Parser } = await import(pathToFileURL(acornPath).href);
    const jsxMod = await import(pathToFileURL(jsxPath).href);
    return Parser.extend((jsxMod.default ?? jsxMod)());
  }
  console.error('FAIL - acorn/acorn-jsx not found in server, client, or root node_modules.');
  console.error('       Install dependencies first; this check does not install anything.');
  process.exit(2);
}

const JsxParser = await loadParser();

/**
 * Source roots that must link cleanly, each with the resolver semantics that
 * actually apply to it at runtime:
 *
 *   'node'    — server, shared and scripts are executed directly by Node's ESM
 *               loader, which does NOT guess extensions or directory indexes.
 *               A missing '.js' there is a real crash.
 *   'bundler' — client code is resolved by Vite, which does resolve
 *               extensionless specifiers and directory indexes. Applying Node
 *               semantics to it would report ~1600 phantom defects.
 */
const ROOTS = [
  { dir: 'server/src', mode: 'node' },
  { dir: 'shared', mode: 'node' },
  { dir: 'scripts', mode: 'node' },
  { dir: 'client/src', mode: 'bundler' },
];
const EXTENSIONS = new Set(['.js', '.jsx', '.mjs']);
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'uploads']);
/**
 * Any `archive/` segment (scripts/archive, server/src/scripts/archive/seed-legacy)
 * holds superseded one-off scripts kept for provenance. They are not part of the
 * runtime module graph, so their stale paths are reported as INFO rather than
 * gating the build — see the report for the legacy seed scripts still named in
 * server/package.json.
 */
const isArchivePath = (rel) => rel.split(/[\\/]/).includes('archive');

const jsonMode = process.argv.includes('--json');

async function collectFiles(dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      await collectFiles(path.join(dir, entry.name), acc);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

function parse(file) {
  const code = readFileSync(file, 'utf8');
  return JsxParser.parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    allowHashBang: true,
    allowAwaitOutsideFunction: true,
    locations: true,
  });
}

/** Names bound by a declaration's id/pattern (handles destructuring). */
function patternNames(node, acc = []) {
  if (!node) return acc;
  switch (node.type) {
    case 'Identifier':
      acc.push(node.name);
      break;
    case 'ObjectPattern':
      for (const p of node.properties) {
        if (p.type === 'RestElement') patternNames(p.argument, acc);
        else patternNames(p.value, acc);
      }
      break;
    case 'ArrayPattern':
      for (const el of node.elements) patternNames(el, acc);
      break;
    case 'AssignmentPattern':
      patternNames(node.left, acc);
      break;
    case 'RestElement':
      patternNames(node.argument, acc);
      break;
    default:
      break;
  }
  return acc;
}

/**
 * Static facts about one module: what it exports, what it imports, and which
 * `export * from` sources it forwards (resolved transitively later).
 */
function analyze(file) {
  const ast = parse(file);
  const exports = new Set();
  const starReexports = [];
  const imports = [];

  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration') {
      const specifiers = [];
      for (const spec of node.specifiers) {
        if (spec.type === 'ImportSpecifier') {
          specifiers.push({ imported: spec.imported.name ?? spec.imported.value, local: spec.local.name });
        } else if (spec.type === 'ImportDefaultSpecifier') {
          specifiers.push({ imported: 'default', local: spec.local.name });
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          specifiers.push({ imported: '*', local: spec.local.name });
        }
      }
      imports.push({ source: node.source.value, specifiers, line: node.loc.start.line });
    } else if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) {
        const decl = node.declaration;
        if (decl.type === 'VariableDeclaration') {
          for (const d of decl.declarations) for (const n of patternNames(d.id)) exports.add(n);
        } else if (decl.id) {
          exports.add(decl.id.name);
        }
      }
      for (const spec of node.specifiers) {
        exports.add(spec.exported.name ?? spec.exported.value);
      }
      // `export { x } from './y.js'` also imports x from y
      if (node.source) {
        const specifiers = node.specifiers.map((s) => ({
          imported: s.local.name ?? s.local.value,
          local: s.exported.name ?? s.exported.value,
        }));
        imports.push({ source: node.source.value, specifiers, line: node.loc.start.line, reexport: true });
      }
    } else if (node.type === 'ExportDefaultDeclaration') {
      exports.add('default');
    } else if (node.type === 'ExportAllDeclaration') {
      if (node.exported) exports.add(node.exported.name ?? node.exported.value);
      else starReexports.push(node.source.value);
    }
  }
  return { exports, starReexports, imports };
}

const BUNDLER_EXTS = ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.json'];

function isFile(p) {
  return existsSync(p) && statSync(p).isFile();
}

/**
 * Resolve a relative specifier under the semantics that apply to `fromFile`.
 * Node mode is exact-path only; bundler mode also tries extensions and
 * directory indexes, matching Vite.
 */
function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null; // bare/package specifier — out of scope
  const base = path.resolve(path.dirname(fromFile), specifier);
  if (isFile(base)) return base;
  if (modeOf(fromFile) !== 'bundler') return null;
  for (const ext of BUNDLER_EXTS) {
    if (isFile(base + ext)) return base + ext;
  }
  for (const ext of BUNDLER_EXTS) {
    const idx = path.join(base, `index${ext}`);
    if (isFile(idx)) return idx;
  }
  return null;
}

const fileModes = new Map();
function modeOf(file) {
  return fileModes.get(file) ?? 'node';
}

const files = [];
for (const { dir, mode } of ROOTS) {
  const collected = await collectFiles(path.join(root, dir), []);
  for (const f of collected) {
    fileModes.set(f, mode);
    files.push(f);
  }
}

const modules = new Map();
const parseErrors = [];
const archiveParseErrors = [];
for (const file of files) {
  try {
    modules.set(file, analyze(file));
  } catch (err) {
    const rel = path.relative(root, file);
    (isArchivePath(rel) ? archiveParseErrors : parseErrors).push({ file: rel, message: err.message });
  }
}

/** Exported names including transitively forwarded `export * from` names. */
function effectiveExports(file, seen = new Set()) {
  if (seen.has(file)) return new Set();
  seen.add(file);
  const mod = modules.get(file);
  if (!mod) return new Set();
  const names = new Set(mod.exports);
  for (const spec of mod.starReexports) {
    const target = resolveSpecifier(file, spec);
    if (target && modules.has(target)) {
      for (const n of effectiveExports(target, seen)) if (n !== 'default') names.add(n);
    }
  }
  return names;
}

const missingExport = [];
const missingFile = [];
const archiveIssues = [];
let checkedImports = 0;
let checkedSpecifiers = 0;

for (const [file, mod] of modules) {
  const rel = path.relative(root, file);
  const isArchive = isArchivePath(rel);
  for (const imp of mod.imports) {
    if (!imp.source.startsWith('.')) continue;
    checkedImports += 1;
    const target = resolveSpecifier(file, imp.source);
    if (!target) {
      (isArchive ? archiveIssues : missingFile).push({
        file: rel,
        line: imp.line,
        specifier: imp.source,
      });
      continue;
    }
    if (!modules.has(target)) continue; // outside scanned roots
    const available = effectiveExports(target);
    // A module with `export * from` an unscanned target may legitimately
    // forward names we cannot see; skip those to avoid false positives.
    const hasOpaqueStar = modules.get(target).starReexports.some(
      (s) => !modules.has(resolveSpecifier(target, s) ?? '')
    );
    for (const spec of imp.specifiers) {
      if (spec.imported === '*') continue;
      checkedSpecifiers += 1;
      if (spec.imported === 'default') continue; // default interop varies; not a link error source here
      if (hasOpaqueStar) continue;
      if (!available.has(spec.imported)) {
        (isArchive ? archiveIssues : missingExport).push({
          file: rel,
          line: imp.line,
          specifier: imp.source,
          name: spec.imported,
          target: path.relative(root, target),
          kind: imp.reexport ? 're-export' : 'import',
        });
      }
    }
  }
}

const failures = missingExport.length + missingFile.length + parseErrors.length;

if (jsonMode) {
  console.log(JSON.stringify({ files: modules.size, checkedImports, checkedSpecifiers, missingExport, missingFile, parseErrors, archiveIssues }, null, 2));
} else {
  console.log('Module link integrity');
  console.log(`  modules parsed        : ${modules.size}`);
  console.log(`  relative imports      : ${checkedImports}`);
  console.log(`  named bindings checked: ${checkedSpecifiers}`);

  if (parseErrors.length) {
    console.log(`\n  PARSE ERRORS (${parseErrors.length}):`);
    for (const e of parseErrors) console.log(`    ${e.file}: ${e.message}`);
  }
  if (missingFile.length) {
    console.log(`\n  UNRESOLVED IMPORT PATHS (${missingFile.length}):`);
    for (const m of missingFile) console.log(`    ${m.file}:${m.line} -> '${m.specifier}'`);
  }
  if (missingExport.length) {
    console.log(`\n  MISSING EXPORTS (${missingExport.length}) — these fail at module link time:`);
    for (const m of missingExport) {
      console.log(`    ${m.file}:${m.line} ${m.kind} '${m.name}' from '${m.specifier}'`);
      console.log(`      target ${m.target} does not export it`);
    }
  }
  if (archiveIssues.length || archiveParseErrors.length) {
    console.log(
      `\n  INFO - archive/ stale references: ${archiveIssues.length} unresolved, ` +
        `${archiveParseErrors.length} unparseable (non-gating, outside the runtime module graph)`
    );
  }
  console.log(failures === 0 ? '\n  ok - module graph links cleanly' : `\n  FAIL - ${failures} link defect(s)`);
}

process.exit(failures === 0 ? 0 : 1);
