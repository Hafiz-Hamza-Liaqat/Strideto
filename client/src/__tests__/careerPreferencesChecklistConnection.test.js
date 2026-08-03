import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * PF-A — Career Preferences checklist connection. Same convention as
 * secureAuthClientContract.test.js: the repository has no jsdom/DOM test
 * runner, so these checks prove the required contract directly against
 * the shipped source text rather than rendering the component tree.
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const repoRoot = path.resolve(clientSrc, '..', '..');

function read(relPath) {
  return readFileSync(path.join(clientSrc, relPath), 'utf8');
}

function readShared(relPath) {
  return readFileSync(path.join(repoRoot, relPath), 'utf8');
}

const profile = read('pages/Profile/Profile.jsx');
const profilingWizard = read('onboarding/ProfilingWizard.jsx');
const completionCard = read('components/profile/ProfileCompletionCard.jsx');
const completionWeights = readShared('shared/profile/profileCompletionWeights.js');

// --- 1/12. Checklist control is a real, keyboard-accessible Link, not a dead handler ---
{
  check(
    /<Link\s*\n?\s*to=\{itemHref\(item\)\}/.test(completionCard),
    'ProfileCompletionCard.jsx: incomplete items render a semantic react-router Link (keyboard-focusable by default)'
  );
  check(
    !/onClick=\{[^}]*\}\s*>\s*<span aria-hidden/.test(completionCard),
    'ProfileCompletionCard.jsx: checklist rows are not div/span onClick handlers'
  );
}

// --- Checklist item now targets the deep-link query contract, not a bare dead route ---
{
  check(
    /key: 'careerPreferences',[\s\S]{0,120}href: '\/profile\?section=career-preferences'/.test(
      completionWeights
    ),
    "profileCompletionWeights.js: careerPreferences item href is '/profile?section=career-preferences'"
  );
}

// --- 2/3/4. Profile.jsx opens ProfilingWizard directly at the career-preferences step, prefilled ---
{
  check(
    /import \{ openProfilingWizard \} from '\.\.\/\.\.\/onboarding\/ProfilingWizard\.jsx'/.test(profile),
    'Profile.jsx: imports openProfilingWizard from the existing onboarding wizard module'
  );
  check(
    /searchParams\.get\('section'\) !== 'career-preferences'/.test(profile),
    "Profile.jsx: gates wizard opening on the '?section=career-preferences' query contract"
  );
  check(
    /initialPrefs:\s*user\?\.careerPreferences\s*\|\|\s*undefined/.test(profile),
    'Profile.jsx: passes the existing user.careerPreferences as initialPrefs (prefill)'
  );
  check(
    /initialStep:\s*1/.test(profile),
    'Profile.jsx: opens the wizard directly at step 1 (skips the onboarding welcome screen)'
  );
  check(
    /editMode:\s*true/.test(profile),
    'Profile.jsx: opens the wizard in editMode (Save/Cancel semantics, not tour/explore)'
  );
}

// --- 5/6. Saving reuses the existing profile-update service and sends only careerPreferences ---
{
  check(
    /authApi\.updateProfile\(\{\s*careerPreferences:\s*prefs\s*\}\)/.test(profile),
    'Profile.jsx: persists via the existing authApi.updateProfile service, sending only careerPreferences'
  );
  check(
    !/authApi\.updateProfile\(\{\s*careerPreferences:\s*prefs,\s*(name|province|interests|notifications)/.test(
      profile
    ),
    'Profile.jsx: career-preferences save does not bundle unrelated profile fields'
  );
}

// --- 7. Successful save (and cancel) both close the wizard section and clean up the URL ---
{
  check(
    /closeWizardSection/.test(profile) && /setSearchParams\(next, \{ replace: true \}\)/.test(profile),
    'Profile.jsx: removes the section query param via a replace navigation after the wizard resolves'
  );
  check(
    /\.finally\(\(\) => \{\s*careerWizardOpenRef\.current = false;\s*closeWizardSection\(\);/.test(profile),
    'Profile.jsx: URL cleanup runs unconditionally (save or cancel) in a finally block'
  );
}

// --- 9. Cancel performs no mutation ---
{
  check(
    /if \(action === 'cancel'\) return;/.test(profile),
    'Profile.jsx: a cancel action returns before any authApi.updateProfile call'
  );
}

// --- 8/11. Completion signal formula is untouched: still reads user.careerPreferences ---
{
  check(
    /prefsReady = Boolean\(/.test(completionWeights) && /prefs\.profilingCompleted/.test(completionWeights),
    'profileCompletionWeights.js: existing careerPreferences completion formula was not modified'
  );
  check(
    /updateUser\(data\.user\)/.test(profile),
    'Profile.jsx: refreshes AuthContext user after save so completion % recalculates from real data'
  );
}

// --- 10. Deep-link opening guards on both loading state and a re-entrancy ref ---
{
  check(
    /if \(loading\) return;/.test(profile) && /careerWizardOpenRef\.current/.test(profile),
    'Profile.jsx: wizard-opening effect waits for profile load and guards against double-open'
  );
}

// --- ProfilingWizard.jsx: initialStep/editMode support exists without altering onboarding defaults ---
{
  check(
    /export function ProfilingWizard\(\{ onDone, initialPrefs, initialStep = 0, editMode = false \}\)/.test(
      profilingWizard
    ),
    'ProfilingWizard.jsx: initialStep defaults to 0 and editMode defaults to false (onboarding behavior unchanged)'
  );
  check(
    /const \[step, setStep\] = useState\(initialStep\)/.test(profilingWizard),
    'ProfilingWizard.jsx: wizard opens directly at the requested step (no forced welcome screen in edit mode)'
  );
  check(
    /Math\.max\(s - 1, initialStep\)/.test(profilingWizard),
    'ProfilingWizard.jsx: Back navigation cannot go below the requested initial step'
  );
  check(
    /const closeAction = editMode \? 'cancel' : 'tour'/.test(profilingWizard),
    "ProfilingWizard.jsx: closing (overlay/Escape/×) resolves as 'cancel' in edit mode, not the onboarding 'tour' action"
  );
  check(
    /finish\('save'\)/.test(profilingWizard) && /Save changes/.test(profilingWizard),
    'ProfilingWizard.jsx: edit mode ends with an explicit Save changes action, distinct from onboarding Explore/Tour'
  );
}

// --- 13. No authentication token storage or legacy-auth behavior introduced by this change ---
{
  for (const [name, src] of [
    ['Profile.jsx', profile],
    ['ProfilingWizard.jsx', profilingWizard],
  ]) {
    check(!/localStorage\.(set|get|remove)Item\(\s*['"`]?(edurozgaar-token|edurozgaar-refresh-token)/.test(src),
      `${name}: introduces no auth-token localStorage access`);
    check(!/sessionStorage\./.test(src), `${name}: introduces no sessionStorage usage`);
    check(!/STRIDETO_SECURE_AUTH_ENABLED/.test(src), `${name}: introduces no legacy-auth selector`);
  }
}

console.log(`careerPreferencesChecklistConnection.test.js: ${count} assertions passed`);
