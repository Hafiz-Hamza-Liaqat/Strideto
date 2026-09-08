import readline from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { stdin as input, stdout as output } from 'node:process';

const DEFAULT_BASE = 'https://api.strideto.com/api';
const ORIGIN = 'https://www.strideto.com';

const promptSecurePassword = () => new Promise((resolve, reject) => {
  const script = "$s=Read-Host 'Production admin password' -AsSecureString; $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}";
  const child = spawn('powershell.exe', ['-NoProfile', '-Command', script], { stdio: ['inherit', 'pipe', 'inherit'], windowsHide: true });
  let value = '';
  child.stdout.on('data', (chunk) => { value += chunk.toString(); });
  child.on('error', reject);
  child.on('close', (code) => code === 0 ? resolve(value.trimEnd()) : reject(new Error('Secure password prompt failed.')));
});

export function extractAccessToken(body) {
  return String(body?.accessToken || '');
}

function extractCookies(headers) {
  const values = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  return values.map((value) => value.split(';', 1)[0]).filter(Boolean).join('; ');
}

export function buildReadHeaders({ token = '', cookie = '' } = {}) {
  return {
    accept: 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(cookie ? { cookie } : {}),
    origin: ORIGIN,
    referer: `${ORIGIN}/`,
  };
}

export async function authenticateProductionAdmin(base, token, requestAudit, { probePath = '/admin/jobs?limit=1&page=1' } = {}) {
  if (token) return { mode: 'env-token', token, cookie: '' };
  const rl = readline.createInterface({ input, output });
  let email;
  try {
    email = (await rl.question('Production admin email: ')).trim();
  } finally {
    rl.close();
  }
  if (!email) throw new Error('Production admin email is required.');
  let password = await promptSecurePassword();
  try {
    const probe = await fetch(`${base}${probePath}`, { headers: { accept: 'application/json', origin: ORIGIN, referer: `${ORIGIN}/` } });
    requestAudit.push({ method: 'GET', path: probePath, purpose: 'unauthenticated auth-contract probe', status: probe.status });
    if (probe.status !== 401) throw new Error(`Unauthenticated admin probe returned HTTP ${probe.status}; refusing to continue.`);
    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', origin: ORIGIN, referer: `${ORIGIN}/` },
      body: JSON.stringify({ email, password }),
    });
    requestAudit.push({ method: 'POST', path: '/auth/login', purpose: 'authentication only', status: login.status });
    if (!login.ok) throw new Error(`Production login failed with HTTP ${login.status}.`);
    const body = await login.json();
    token = extractAccessToken(body);
    if (!token) throw new Error('Login response did not contain an access token.');
    return { mode: 'secure-email-password', token, cookie: extractCookies(login.headers) };
  } finally {
    password = '';
  }
}

export async function createProductionReadClient({
  base = DEFAULT_BASE,
  allowedPrefixes = ['/admin/jobs', '/jobs'],
  probePath = '/admin/jobs?limit=1&page=1',
} = {}) {
  const normalizedBase = base.replace(/\/$/, '');
  let token = process.env.STRIDETO_ADMIN_TOKEN || '';
  const requestAudit = [];
  const authentication = await authenticateProductionAdmin(normalizedBase, token, requestAudit, { probePath });
  token = authentication.token;
  const cookie = authentication.cookie;
  const get = async (path) => {
    if (!allowedPrefixes.some((prefix) => path.startsWith(prefix))) throw new Error(`Read-only endpoint allowlist rejected: ${path}`);
    const response = await fetch(`${normalizedBase}${path}`, { headers: buildReadHeaders({ token, cookie }) });
    requestAudit.push({ method: 'GET', path, purpose: 'read-only diagnostic', status: response.status });
    if (!response.ok) {
      const authDiagnostics = {
        tokenFieldPath: token ? 'accessToken' : 'none',
        tokenPresent: Boolean(token),
        authorizationAttached: Boolean(token),
        cookieAttached: Boolean(cookie),
        originAttached: true,
        refererAttached: true,
        status: response.status,
      };
      throw new Error(`${path} returned HTTP ${response.status}; auth diagnostics: ${JSON.stringify(authDiagnostics)}`);
    }
    return response.json();
  };
  return {
    get,
    authenticationMode: authentication.mode,
    authDiagnostics: {
      tokenFieldPath: token ? 'accessToken' : 'none',
      tokenPresent: Boolean(token),
      authorizationAttached: Boolean(token),
      cookieAttached: Boolean(cookie),
      originAttached: true,
      refererAttached: true,
    },
    requestAudit,
  };
}
