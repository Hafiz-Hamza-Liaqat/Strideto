import { isValidHttpUrl, isValidEmail } from './employerProfileValidation.js';

const LINK_MESSAGE = 'Application link must use http or https.';
const EMAIL_MESSAGE = 'Application email must be a valid email address.';

// ASCII control characters (code points 0-31) and DEL (127) — checked by
// character code rather than a regex escape sequence, to avoid any
// ambiguity in how control-character escapes are represented in this file.
function hasControlCharacters(value) {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function linkError() {
  return { ok: false, field: 'applicationLink', message: LINK_MESSAGE };
}

function emailError() {
  return { ok: false, field: 'applyEmail', message: EMAIL_MESSAGE };
}

/**
 * Canonical server-side validator for a Job's external application URL.
 * Reuses the same http(s)-only contract already enforced for Employer
 * profile website/logoUrl fields (employerProfileValidation.js), and
 * additionally rejects embedded URL credentials and control characters —
 * neither of which any Job write path checked before this phase. Call only
 * when the caller has already confirmed the field was actually supplied
 * (this function does not special-case `undefined`/omission — that
 * distinction belongs to the controller, so an explicit clear can never be
 * blocked merely because it wasn't yet reachable client-side).
 *
 * @returns {{ ok: true, value: string|null } | { ok: false, field: string, message: string }}
 */
export function validateApplicationLink(rawValue) {
  if (rawValue === null) return { ok: true, value: null };
  if (typeof rawValue !== 'string') return linkError();

  const trimmed = rawValue.trim();
  if (!trimmed) return { ok: true, value: null };
  if (hasControlCharacters(trimmed)) return linkError();
  if (!isValidHttpUrl(trimmed)) return linkError();

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return linkError();
  }
  if (parsed.username || parsed.password) return linkError();

  return { ok: true, value: parsed.href };
}

/**
 * Canonical server-side validator for a Job's application email. Reuses the
 * same email-format contract already enforced for Employer profile fields
 * (employerProfileValidation.js); its local-part pattern already excludes
 * whitespace, so newline/header-injection characters are already rejected.
 *
 * @returns {{ ok: true, value: string|null } | { ok: false, field: string, message: string }}
 */
export function validateApplyEmail(rawValue) {
  if (rawValue === null) return { ok: true, value: null };
  if (typeof rawValue !== 'string') return emailError();

  const trimmed = rawValue.trim();
  if (!trimmed) return { ok: true, value: null };
  if (hasControlCharacters(trimmed)) return emailError();
  if (!isValidEmail(trimmed)) return emailError();

  return { ok: true, value: trimmed };
}
