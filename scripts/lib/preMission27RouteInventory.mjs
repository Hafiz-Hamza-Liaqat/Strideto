import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '..', '..');
const require = createRequire(path.join(repoRoot, 'client', 'package.json'));
const parser = require('@babel/parser');
const clientRoot = path.join(repoRoot, 'client', 'src');
const routeFile = path.join(clientRoot, 'routes', 'index.jsx');
const constantsFile = path.join(clientRoot, 'constants', 'index.js');

function parseFile(file) {
  return parser.parse(fs.readFileSync(file, 'utf8'), {
    sourceType: 'module',
    plugins: ['jsx', 'optionalChaining', 'nullishCoalescingOperator'],
  });
}

function objectProperty(node, name) {
  return node?.properties?.find((property) =>
    property.type === 'ObjectProperty' &&
    ((property.key.type === 'Identifier' && property.key.name === name) ||
      (property.key.type === 'StringLiteral' && property.key.value === name)))?.value;
}

function constantRoutes() {
  const ast = parseFile(constantsFile);
  const declarator = ast.program.body
    .flatMap((entry) => entry.type === 'ExportNamedDeclaration' ? [entry.declaration] : [entry])
    .flatMap((entry) => entry?.declarations || [])
    .find((entry) => entry.id?.name === 'ROUTES');
  const result = {};
  for (const property of declarator?.init?.properties || []) {
    if (property.type !== 'ObjectProperty' || property.value.type !== 'StringLiteral') continue;
    result[property.key.name || property.key.value] = property.value.value;
  }
  return result;
}

function evaluateString(node, routeConstants, bindings = {}) {
  if (!node) return null;
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'Identifier') return bindings[node.name] ?? null;
  if (node.type === 'MemberExpression' && node.object?.name === 'ROUTES') {
    return routeConstants[node.property?.name || node.property?.value] ?? null;
  }
  if (node.type === 'TemplateLiteral') {
    let value = '';
    for (let index = 0; index < node.quasis.length; index += 1) {
      value += node.quasis[index].value.cooked;
      if (index < node.expressions.length) {
        const expression = evaluateString(node.expressions[index], routeConstants, bindings);
        if (expression == null) return null;
        value += expression;
      }
    }
    return value;
  }
  return null;
}

function jsxNames(node, names = []) {
  if (!node || typeof node !== 'object') return names;
  if (node.type === 'JSXElement') {
    const nameNode = node.openingElement?.name;
    if (nameNode?.type === 'JSXIdentifier') names.push(nameNode.name);
    for (const child of node.children || []) jsxNames(child, names);
    return names;
  }
  if (node.type === 'JSXFragment') {
    for (const child of node.children || []) jsxNames(child, names);
  }
  return names;
}

function joinRoute(parent, child) {
  if (!child) return parent || '/';
  if (child.startsWith('/')) return child.replace(/\/{2,}/g, '/');
  const base = parent && parent !== '/' ? parent.replace(/\/$/, '') : '';
  return `${base}/${child}`.replace(/\/{2,}/g, '/') || '/';
}

function normalizePattern(route) {
  return route.replace(/:[^/]+/g, ':param').replace(/\/$/, '') || '/';
}

function inferRealm(route, guards) {
  if (guards.includes('ProtectedInstitutionRoute')) return 'INSTITUTION';
  if (guards.includes('ProtectedAgentRoute')) return 'AGENT';
  if (guards.includes('ProtectedEmployerRoute')) return 'EMPLOYER';
  if (route === '/admin' || route.startsWith('/admin/')) return 'ADMIN';
  if (guards.includes('ProtectedRoute')) return 'STUDENT';
  return 'PUBLIC';
}

function inferGuard(guards, route) {
  if (guards.includes('ProtectedInstitutionRoute')) return 'ProtectedInstitutionRoute';
  if (guards.includes('ProtectedAgentRoute')) return 'ProtectedAgentRoute';
  if (guards.includes('ProtectedEmployerRoute')) return 'ProtectedEmployerRoute';
  if (guards.includes('ProtectedRoute')) return route.startsWith('/admin') ? 'ProtectedRoute(requireStaff)' : 'ProtectedRoute';
  return 'public';
}

function componentImportMap(ast) {
  const imports = new Map();
  for (const entry of ast.program.body) {
    if (entry.type !== 'VariableDeclaration') continue;
    for (const declaration of entry.declarations) {
      if (declaration.id?.type !== 'Identifier') continue;
      let found = null;
      const visit = (node) => {
        if (!node || found || typeof node !== 'object') return;
        if (node.type === 'Import' && node.parentPath) return;
        if (node.type === 'CallExpression' && node.callee?.type === 'Import' && node.arguments[0]?.type === 'StringLiteral') {
          found = node.arguments[0].value;
          return;
        }
        for (const value of Object.values(node)) {
          if (Array.isArray(value)) value.forEach(visit);
          else if (value && typeof value === 'object') visit(value);
        }
      };
      visit(declaration.init);
      if (found) imports.set(declaration.id.name, found);
    }
  }
  return imports;
}

function resolveModule(importPath) {
  if (!importPath?.startsWith('.')) return null;
  const base = path.resolve(path.dirname(routeFile), importPath);
  for (const suffix of ['', '.jsx', '.js', path.sep + 'index.jsx', path.sep + 'index.js']) {
    const candidate = base + suffix;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function apiDependencies(pageFile) {
  if (!pageFile) return [];
  const dependencies = new Set();
  let ast;
  try { ast = parseFile(pageFile); } catch { return []; }
  for (const entry of ast.program.body) {
    if (entry.type !== 'ImportDeclaration') continue;
    const source = entry.source.value;
    if (/api|service|Api|Service/.test(source)) dependencies.add(source);
  }
  const source = fs.readFileSync(pageFile, 'utf8');
  for (const match of source.matchAll(/['"`]((?:\/api\/|api\/)[^'"`?\s]*)/g)) dependencies.add(match[1]);
  return [...dependencies].sort();
}

function navigationReferences(routeConstants) {
  const references = new Map();
  const candidates = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (/\.(jsx|js)$/.test(entry.name) && target !== routeFile) candidates.push(target);
    }
  };
  walk(clientRoot);
  const add = (value, file, line) => {
    if (!value?.startsWith('/') || value.startsWith('//')) return;
    const clean = value.split(/[?#]/)[0] || '/';
    const list = references.get(clean) || [];
    list.push(`${path.relative(repoRoot, file).replaceAll('\\', '/')}:${line}`);
    references.set(clean, list);
  };
  for (const file of candidates) {
    const source = fs.readFileSync(file, 'utf8');
    const lineAt = (index) => source.slice(0, index).split('\n').length;
    for (const match of source.matchAll(/(?:to|href)\s*=\s*["'](\/[^"']*)["']/g)) add(match[1], file, lineAt(match.index));
    for (const match of source.matchAll(/(?:to|href)\s*=\s*\{ROUTES\.([A-Z0-9_]+)\}/g)) add(routeConstants[match[1]], file, lineAt(match.index));
    for (const match of source.matchAll(/(?:to|href)\s*=\s*\{`\$\{ROUTES\.([A-Z0-9_]+)\}([^`]*)`\}/g)) {
      add(`${routeConstants[match[1]] || ''}${match[2].replace(/\$\{[^}]+\}/g, ':param')}`, file, lineAt(match.index));
    }
  }
  return references;
}

function acceptedRouteForLink(link, routePatterns) {
  const normalized = normalizePattern(link);
  return routePatterns.some((pattern) => {
    const expression = '^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:param/g, '[^/]+') + '$';
    return new RegExp(expression).test(link) || pattern === normalized;
  });
}

export function buildRouteInventory() {
  const ast = parseFile(routeFile);
  const routeConstants = constantRoutes();
  const importMap = componentImportMap(ast);
  const routesDeclaration = ast.program.body
    .flatMap((entry) => entry.type === 'ExportNamedDeclaration' ? [entry.declaration] : [entry])
    .flatMap((entry) => entry?.declarations || [])
    .find((entry) => entry.id?.name === 'routes');
  const records = [];

  const consumeObject = (object, parent = '', inheritedGuards = [], bindings = {}) => {
    const index = objectProperty(object, 'index')?.value === true;
    const ownPath = index ? '' : evaluateString(objectProperty(object, 'path'), routeConstants, bindings);
    if (!index && ownPath == null) return;
    const route = joinRoute(parent, ownPath);
    const names = jsxNames(objectProperty(object, 'element'));
    const guards = [...new Set([...inheritedGuards, ...names.filter((name) => name.startsWith('Protected'))])];
    const children = objectProperty(object, 'children');
    if (!children || index) {
      const component = [...names].reverse().find((name) => !name.startsWith('Protected') && !['MainLayout', 'MainLayoutWrapper', 'LocaleMainLayout'].includes(name)) || 'unknown';
      const importPath = importMap.get(component) || null;
      const pageFile = resolveModule(importPath);
      records.push({
        route,
        pattern: normalizePattern(route),
        realm: inferRealm(route, guards),
        guard: inferGuard(guards, route),
        component,
        page: pageFile ? path.relative(repoRoot, pageFile).replaceAll('\\', '/') : importPath,
        pageExists: Boolean(pageFile),
        primaryApiDependencies: apiDependencies(pageFile),
      });
    }
    if (children?.type === 'ArrayExpression') consumeArray(children, route, guards, bindings);
  };

  const consumeArray = (array, parent = '', guards = [], bindings = {}) => {
    for (const item of array.elements || []) {
      if (!item) continue;
      if (item.type === 'ObjectExpression') consumeObject(item, parent, guards, bindings);
      if (item.type === 'SpreadElement') {
        const callback = item.argument?.callee?.property?.name === 'map' ? item.argument.arguments?.[0] : null;
        const returned = callback?.body?.type === 'ObjectExpression' ? callback.body : callback?.body?.type === 'ParenthesizedExpression' ? callback.body.expression : null;
        if (returned?.type === 'ObjectExpression') {
          for (const locale of ['ur']) consumeObject(returned, parent, guards, { ...bindings, [callback.params[0]?.name]: locale });
        }
      }
    }
  };
  consumeArray(routesDeclaration.init);

  const references = navigationReferences(routeConstants);
  const patterns = records.map((record) => record.pattern);
  for (const record of records) {
    const sources = [];
    for (const [link, files] of references) {
      if (normalizePattern(link) === record.pattern) sources.push(...files);
    }
    record.navigationSource = [...new Set(sources)].sort();
    record.reachability = record.navigationSource.length ? 'navigation' : 'route-declaration/contextual';
    record.browserEvidence = [];
    record.mobileEvidence = [];
    record.desktopEvidence = [];
  }
  const duplicatePatterns = [...new Set(patterns.filter((pattern, index) => patterns.indexOf(pattern) !== index))];
  const staleNavigation = [];
  for (const [link, files] of references) {
    if (!acceptedRouteForLink(link, patterns)) staleNavigation.push({ link, sources: [...new Set(files)].sort() });
  }
  return {
    generatedFrom: path.relative(repoRoot, routeFile).replaceAll('\\', '/'),
    records,
    findings: {
      missingPages: records.filter((record) => !record.pageExists).map((record) => ({ route: record.route, component: record.component, page: record.page })),
      duplicatePatterns,
      staleNavigation,
    },
  };
}

export function materializeRoute(route) {
  if (route === '/*') return '/targeted-not-found-route';
  const replacements = {
    slug: 'fixture', country: 'pakistan', id: '507f1f77bcf86cd799439011', idOrSlug: 'fixture',
    jobId: '507f1f77bcf86cd799439012', postId: '507f1f77bcf86cd799439013', caseId: '507f1f77bcf86cd799439014',
    consultationId: '507f1f77bcf86cd799439015', quizId: '507f1f77bcf86cd799439016', programId: '507f1f77bcf86cd799439017',
    scholarshipId: '507f1f77bcf86cd799439018', planId: '507f1f77bcf86cd799439019',
  };
  return route.replace(/:([A-Za-z0-9_]+)/g, (_, name) => replacements[name] || 'fixture');
}

export function highRiskRoute(record) {
  return /dashboard|jobs?|applications?|candidates?|vault|consultations?|cases?|trust|programs?|data-quality|admin|commerce|verification|pipeline|forms?|payments?|institutions?/i.test(record.route);
}
