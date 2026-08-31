/**
 * Test Acceptance Explorer — shared contract (Mission 6).
 *
 * Client- and server-safe: pure JS, no Node/DOM globals.
 *
 * Defines:
 *   - Acceptance statuses (accepted/conditional/not_accepted/case_by_case/unknown)
 *   - Acceptance scopes (country/institution/program/program_intake)
 *   - Deterministic scope precedence hierarchy
 *   - Conflict detection for contradictory active claims
 *   - Structural score check boundary (deterministic, no AI, read-only)
 *   - Public projection helper (strips adminNotes)
 *   - Fallback scope label (UX truthfulness)
 */

// ── Acceptance statuses ───────────────────────────────────────────────────────

export const ACCEPTANCE_STATUSES = Object.freeze({
  ACCEPTED: 'accepted',
  CONDITIONAL: 'conditional',
  NOT_ACCEPTED: 'not_accepted',
  CASE_BY_CASE: 'case_by_case',
  UNKNOWN: 'unknown',
});

const ACCEPTANCE_STATUS_SET = new Set(Object.values(ACCEPTANCE_STATUSES));

export function isValidAcceptanceStatus(v) {
  return typeof v === 'string' && ACCEPTANCE_STATUS_SET.has(v);
}

// ── Acceptance scopes ─────────────────────────────────────────────────────────

export const ACCEPTANCE_SCOPES = Object.freeze({
  COUNTRY: 'country',
  INSTITUTION: 'institution',
  PROGRAM: 'program',
  PROGRAM_INTAKE: 'program_intake',
});

const ACCEPTANCE_SCOPE_SET = new Set(Object.values(ACCEPTANCE_SCOPES));

export function isValidAcceptanceScope(v) {
  return typeof v === 'string' && ACCEPTANCE_SCOPE_SET.has(v);
}

// ── Scope precedence ──────────────────────────────────────────────────────────
//
// Higher number = higher precedence (wins over lower-precedence claims).
//
//   program_intake (4)  >  program (3)  >  institution (2)  >  country (1)
//
// A program-level claim is specific; a country-level claim is general guidance.
// Program-specific requirements OVERRIDE broader institution or country guidance.

export const SCOPE_PRECEDENCE = Object.freeze({
  country: 1,
  institution: 2,
  program: 3,
  program_intake: 4,
});

/**
 * Given a list of acceptance claims for the same test+destination combination,
 * return the single highest-precedence claim, or null if the list is empty.
 *
 * Ties (same scope) favour the most recently updated record.
 */
export function resolvePrecedence(claims) {
  if (!Array.isArray(claims) || claims.length === 0) return null;
  return claims.reduce((best, current) => {
    const bp = SCOPE_PRECEDENCE[best.acceptanceScope] ?? 0;
    const cp = SCOPE_PRECEDENCE[current.acceptanceScope] ?? 0;
    if (cp > bp) return current;
    if (cp === bp) {
      // Same scope — prefer more recently updated
      const bt = best.updatedAt ? new Date(best.updatedAt).getTime() : 0;
      const ct = current.updatedAt ? new Date(current.updatedAt).getTime() : 0;
      return ct > bt ? current : best;
    }
    return best;
  });
}

/**
 * Keep program-specific claims authoritative per test while exposing
 * institution claims for tests with no program-specific evidence.
 * The returned fallback list must be labelled as institution-level by callers.
 */
export function mergeProgramAcceptanceWithInstitutionFallback(programClaims = [], institutionClaims = []) {
  const programTestIds = new Set(programClaims.map((claim) => String(claim.testId?._id || claim.testId || '')));
  return {
    programClaims,
    institutionFallback: institutionClaims.filter(
      (claim) => !programTestIds.has(String(claim.testId?._id || claim.testId || ''))
    ),
  };
}

// ── Conflict detection ────────────────────────────────────────────────────────
//
// Two published claims conflict when they occupy the same "slot":
//   same testId + scope + scopeEntity (institutionId/programId/countryCode) + intake
// AND one says "accepted" while the other says "not_accepted".
//
// "unknown" and "case_by_case" are not contradictions — they coexist.

const CONTRADICTORY_PAIRS = new Set([
  'accepted::not_accepted',
  'not_accepted::accepted',
]);

/**
 * Build the canonical scope-slot key used to identify which slot a claim occupies.
 * Two claims with the same key occupy the same slot and can potentially conflict.
 */
export function buildScopeKey(claim) {
  return [
    String(claim.testId || ''),
    String(claim.acceptanceScope || ''),
    String(claim.institutionId || ''),
    String(claim.programId || ''),
    (claim.countryCode || '').toUpperCase(),
    (claim.intake || '').trim().toLowerCase(),
  ].join('::');
}

/**
 * Check whether a proposed claim contradicts any of the existing published claims.
 *
 * @param {object[]} existingPublished  Already-published acceptance claims
 * @param {object}   proposed           The new/updated claim being evaluated
 * @param {string}   [excludeId]        Id of a claim to skip (when updating it)
 * @returns {{ conflict: boolean, reason?: string }}
 */
export function detectConflict(existingPublished, proposed, excludeId = null) {
  const proposedKey = buildScopeKey(proposed);

  for (const existing of existingPublished) {
    if (excludeId && String(existing._id) === String(excludeId)) continue;
    if (buildScopeKey(existing) !== proposedKey) continue;

    const pair = `${existing.acceptanceStatus}::${proposed.acceptanceStatus}`;
    if (CONTRADICTORY_PAIRS.has(pair)) {
      return {
        conflict: true,
        reason: `contradictory_active_claims: existing claim ${existing._id} has status="${existing.acceptanceStatus}", proposed status="${proposed.acceptanceStatus}" for the same scope slot`,
      };
    }
  }

  return { conflict: false };
}

// ── Structural score check (read-only boundary) ───────────────────────────────
//
// Deterministically checks whether a user's scores structurally satisfy an
// acceptance requirement. No AI. No recommendation.
// Returns a boolean result plus a machine-readable reason string.
//
// Caller decides what to do with the result. This function does not match
// users to tests (that is Mission 8 eligibility).

/**
 * @param {{ overall?: number|null, sections?: Record<string, number> }} userScore
 * @param {{ minimumOverallScore?: number|null, sectionMinimums?: Array<{sectionName: string, minimum: number}> }} requirement
 * @returns {{ satisfies: boolean, reason: string }}
 */
export function structuralScoreCheck(userScore = {}, requirement = {}) {
  if (!userScore || typeof userScore !== 'object') {
    return { satisfies: false, reason: 'invalid_user_score_input' };
  }
  if (!requirement || typeof requirement !== 'object') {
    return { satisfies: false, reason: 'invalid_requirement_input' };
  }

  // Overall minimum
  if (requirement.minimumOverallScore != null) {
    const overall = userScore.overall;
    if (overall == null || typeof overall !== 'number') {
      return { satisfies: false, reason: 'overall_score_not_provided' };
    }
    if (overall < requirement.minimumOverallScore) {
      return {
        satisfies: false,
        reason: `overall_score_below_minimum:provided=${overall},required=${requirement.minimumOverallScore}`,
      };
    }
  }

  // Section minimums
  const sectionMins = Array.isArray(requirement.sectionMinimums) ? requirement.sectionMinimums : [];
  const providedSections = (userScore.sections && typeof userScore.sections === 'object')
    ? userScore.sections
    : {};

  for (const { sectionName, minimum } of sectionMins) {
    if (minimum == null) continue;
    const sectionScore = providedSections[sectionName];
    if (sectionScore == null || typeof sectionScore !== 'number') {
      return { satisfies: false, reason: `section_score_not_provided:${sectionName}` };
    }
    if (sectionScore < minimum) {
      return {
        satisfies: false,
        reason: `section_score_below_minimum:${sectionName}:provided=${sectionScore},required=${minimum}`,
      };
    }
  }

  return { satisfies: true, reason: 'all_structural_requirements_met' };
}

// ── Section minimum normalization / validation ────────────────────────────────

/**
 * Normalize optional section score requirements.
 * Rejects duplicate section names (case-insensitive) and non-numeric minima.
 *
 * Accepts either `{ sectionName, minimum }` or `{ section, minimumScore }`.
 *
 * @returns {{ ok: true, value: Array<{sectionName: string, minimum: number, scale: string}> } | { ok: false, error: string }}
 */
export function normalizeSectionMinimums(raw) {
  if (raw == null || raw === '') return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: 'sectionMinimums must be an array' };

  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false, error: 'invalid section requirement entry' };
    }
    const sectionName = String(entry.sectionName || entry.section || '').trim();
    if (!sectionName) return { ok: false, error: 'section name is required' };
    const key = sectionName.toLowerCase();
    if (seen.has(key)) {
      return { ok: false, error: `duplicate section requirement: ${sectionName}` };
    }
    seen.add(key);
    const minimumRaw = entry.minimum ?? entry.minimumScore;
    const minimum = typeof minimumRaw === 'number' ? minimumRaw : Number(minimumRaw);
    if (!Number.isFinite(minimum)) {
      return { ok: false, error: `invalid minimum score for section: ${sectionName}` };
    }
    out.push({
      sectionName,
      minimum,
      scale: String(entry.scale || '').trim(),
    });
  }
  return { ok: true, value: out };
}

// ── Effective period / result validity ────────────────────────────────────────

/**
 * Validate institution policy effective window.
 * Distinct from resultValidityMonths (test-result age).
 */
export function validateEffectivePeriod(from, until) {
  const parse = (v, label) => {
    if (v == null || v === '') return { ok: true, value: null };
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return { ok: false, error: `invalid ${label}` };
    return { ok: true, value: d };
  };
  const fromResult = parse(from, 'effectiveFrom');
  if (!fromResult.ok) return fromResult;
  const untilResult = parse(until, 'effectiveUntil');
  if (!untilResult.ok) return untilResult;
  if (fromResult.value && untilResult.value && untilResult.value < fromResult.value) {
    return { ok: false, error: 'effectiveUntil must be on or after effectiveFrom' };
  }
  return { ok: true, effectiveFrom: fromResult.value, effectiveUntil: untilResult.value };
}

/**
 * Validate optional test-result age limit in months (positive integer).
 */
export function validateResultValidityMonths(raw) {
  if (raw == null || raw === '') return { ok: true, value: null };
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return { ok: false, error: 'resultValidityMonths must be a positive integer' };
  }
  return { ok: true, value: n };
}

/**
 * Extract human-readable test identity from a raw or populated testId.
 * Does not fabricate missing catalog fields.
 */
export function extractTestIdentity(testId) {
  if (testId == null || testId === '') return null;
  if (typeof testId === 'object') {
    const provider = testId.providerId;
    const providerName = provider && typeof provider === 'object'
      ? (provider.name || null)
      : null;
    return {
      id: String(testId._id || testId.id || ''),
      name: testId.name || null,
      shortName: testId.shortName || null,
      slug: testId.slug || null,
      providerName,
    };
  }
  return {
    id: String(testId),
    name: null,
    shortName: null,
    slug: null,
    providerName: null,
  };
}

// ── Public-safe projection ────────────────────────────────────────────────────
//
// Strips adminNotes and other internal-only fields before sending to clients.
// Sources are included (display label + officialUrl) but internal identifiers
// and audit notes are excluded.

/**
 * Project a TestAcceptance document to its public-safe shape.
 * Never exposes adminNotes.
 *
 * @param {object} claim  TestAcceptance lean document
 * @returns {object|null}
 */
export function projectPublicAcceptance(claim) {
  if (!claim) return null;
  const {
    _id, testId, institutionId, programId, countryCode,
    acceptanceStatus, acceptanceScope,
    minimumOverallScore, sectionMinimums, scoreNotes,
    degreeLevels, studyModes, intake, effectiveFrom, effectiveUntil,
    resultValidityMonths,
    conditions, waiverNotes,
    sources, verificationStatus, freshnessState, lastVerifiedAt,
    status, createdAt, updatedAt,
    // adminNotes intentionally NOT destructured — excluded from projection
  } = claim;

  const testIdentity = extractTestIdentity(testId);

  return {
    _id,
    testId,
    testIdentity,
    testScoreScale: testId && typeof testId === 'object' ? (testId.scoreScale || null) : null,
    institutionId: institutionId ?? null,
    programId: programId ?? null,
    countryCode: countryCode ?? null,
    acceptanceStatus,
    acceptanceScope,
    minimumOverallScore: minimumOverallScore ?? null,
    sectionMinimums: Array.isArray(sectionMinimums) ? sectionMinimums : [],
    scoreNotes: scoreNotes ?? null,
    degreeLevels: Array.isArray(degreeLevels) ? degreeLevels : [],
    studyModes: Array.isArray(studyModes) ? studyModes : [],
    intake: intake ?? null,
    effectiveFrom: effectiveFrom ?? null,
    effectiveUntil: effectiveUntil ?? null,
    resultValidityMonths: resultValidityMonths ?? null,
    conditions: conditions ?? null,
    waiverNotes: waiverNotes ?? null,
    sources: Array.isArray(sources)
      ? sources.filter((s) => s && s.sourceUrl).map(({ sourceType, sourceUrl, publisher, retrievedAt, verifiedAt, evidenceRef }) => ({
          sourceType, sourceUrl, publisher, retrievedAt, verifiedAt, evidenceRef,
        }))
      : [],
    verificationStatus: verificationStatus ?? 'unverified',
    freshnessState: freshnessState ?? 'unknown',
    lastVerifiedAt: lastVerifiedAt ?? null,
    status,
    createdAt,
    updatedAt,
  };
}

// ── Fallback scope label (UX truthfulness) ────────────────────────────────────
//
// When a narrower claim is unavailable and a broader claim is shown as fallback,
// the UI MUST display this label to prevent the user from mistaking general
// guidance for a program-specific fact.

const FALLBACK_LABELS = Object.freeze({
  country: 'Country-level guidance — verify institution and program-specific requirements',
  institution: 'Institution-level guidance — verify program-specific requirements',
  program: 'Program-level requirement — verify current intake-specific details',
  program_intake: 'Program intake requirement',
});

/**
 * Returns the UX truthfulness label for the given acceptance scope.
 * Always returns a string; never returns an empty value.
 */
export function fallbackScopeLabel(scope) {
  return FALLBACK_LABELS[scope] ?? 'General guidance — verify specific requirements with the institution';
}

// ── "Unknown" guard ───────────────────────────────────────────────────────────
//
// "unknown" must NEVER be presented as "not_accepted" in the UI.
// Callers can use this guard.

export function isUnknown(acceptanceStatus) {
  return acceptanceStatus === ACCEPTANCE_STATUSES.UNKNOWN;
}

export function isNotAccepted(acceptanceStatus) {
  return acceptanceStatus === ACCEPTANCE_STATUSES.NOT_ACCEPTED;
}
