import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'path';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
function read(rel) {
  return readFileSync(path.join(clientSrc, rel), 'utf8');
}

{
  const css = read('index.css');
  check(/\.nav-item\[aria-current="page"\]/.test(css), 'public navbar current page is styled independently of hover');
  check(/html\.dark input\[type='date'\]::-webkit-calendar-picker-indicator/.test(css), 'dark theme inverts native calendar indicators');
  check(/html\.dark input\[type='search'\]::-webkit-search-cancel-button/.test(css), 'dark theme inverts native search indicators');
}

{
  const layout = read('layouts/MainLayout.jsx');
  check(/hidePublicChrome/.test(layout), 'MainLayout keeps a stable shell');
  check(/isAdminShellPath\(pathname\)/.test(layout) && /hideStudentNav/.test(layout), 'admin hides public chrome; auth keeps public navbar/footer');
}

{
  const auth = read('layouts/AuthLayout.jsx');
  check(/referrer/.test(auth) && /same-origin/.test(auth), 'auth shell sets same-origin referrer policy');
  const routes = read('routes/index.jsx');
  check(/withAuthLayout\(<Login \/>/.test(routes), 'Student login uses AuthLayout');
  check(/withAuthLayout\(<EmployerLogin \/>/.test(routes), 'Employer login uses AuthLayout');
  check(/withAuthLayout\(<AgentLogin \/>/.test(routes), 'Agent login uses AuthLayout');
  check(/withAuthLayout\(<InstitutionLogin \/>/.test(routes), 'Institution login uses AuthLayout');
}

{
  const employer = read('pages/Employer/EmployerLayout.jsx');
  const agent = read('pages/Agent/AgentLayout.jsx');
  const institution = read('pages/Institution/InstitutionLayout.jsx');
  const admin = read('components/admin/AdminSidebar.jsx');
  const student = read('components/student/StudentPortalNav.jsx');
  for (const [name, src] of [
    ['employer', employer],
    ['agent', agent],
    ['institution', institution],
    ['admin', admin],
    ['student', student],
  ]) {
    check(/aria-current=\{/.test(src), `${name} nav marks the current page`);
  }
}

{
  const profile = read('pages/Public/EmployerPublicProfile.jsx');
  check(!/addressCountry: 'PK'/.test(profile), 'Employer JSON-LD does not hardcode Pakistan');
  check(/profile\.countryCode \? \{ addressCountry:/.test(profile), 'JSON-LD country is omitted unless a stored ISO code exists');
}

{
  for (const [name, rel] of [
    ['employer', 'pages/Employer/EmployerLogin.jsx'],
    ['agent', 'pages/Agent/AgentLogin.jsx'],
    ['institution', 'pages/Institution/InstitutionLogin.jsx'],
  ]) {
    const src = read(rel);
    check(/PasswordInput/.test(src), `${name} login uses shared PasswordInput`);
    check(!/console\.(log|debug|info)\(.*password/.test(src), `${name} login does not log password values`);
  }
}

{
  const authCtx = read('context/AuthContext.jsx');
  check(/if \(!alreadyHydrated\) setLoading\(true\)/.test(authCtx), 'student auth does not flip loading=true on already-hydrated navigation');
}

console.log(`phase17cPlatformClient.test.js: ${count} assertions passed`);
