/**
 * Deterministic Business Services claim-risk classifier (Phase 17D-3).
 * Not AI. Conservative: uncertain → flag for review. Does not auto-ban.
 */
const DISCLAIMER_RE =
  /\b(do\s+not|don't|does\s+not|doesn't|no|not|never|without)\b[\s\S]{0,40}\bguarantee/i;

const POSITIVE_GUARANTEE_RE =
  /\b(guaranteed?|we\s+guarantee|100%\s+approval|approval\s+guaranteed)\b/i;

const HIGH_RISK_PATTERNS = [
  { code: 'government_affiliation', re: /\b(official\s+government|irs\s+authorized|companies\s+house\s+official\s+partner|government[\s-]*affiliated|authorized\s+by\s+the\s+irs)\b/i },
  { code: 'guaranteed_registration', re: /\bguaranteed?\s+(registration|incorporation|approval|formation)\b/i },
  { code: 'guaranteed_bank', re: /\bguaranteed?\s+(bank|banking)\s+account\b/i },
  { code: 'guaranteed_processor', re: /\bguaranteed?\s+(stripe|paypal|payment\s+processor)\b/i },
  { code: 'guaranteed_marketplace', re: /\bguaranteed?\s+(amazon|ecommerce|seller)\s+(approval|account)\b/i },
  { code: 'guaranteed_visa', re: /\bguaranteed?\s+(visa|residency|passport|citizenship)\b/i },
  { code: 'zero_tax_guaranteed', re: /\b(tax[\s-]*free|zero\s+tax|0%\s+tax)\b.{0,24}\bguaranteed?\b/i },
  { code: 'government_processing_claim', re: /\bgovernment\s+(approval|processing)\s+in\s+\d+\s+(hour|day|week)/i },
];

function haystack(input = {}) {
  return [
    input.title,
    input.shortDescription,
    input.description,
    ...(Array.isArray(input.includedItems) ? input.includedItems : []),
    ...(Array.isArray(input.excludedItems) ? input.excludedItems : []),
    input.providerTurnaroundEstimate != null ? String(input.providerTurnaroundEstimate) : '',
    input.turnaroundLabel,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * @returns {{ flagged: boolean, codes: string[], reviewRequired: boolean }}
 */
export function classifyGbsListingRisk(input = {}) {
  const text = haystack(input);
  const codes = [];
  const disclaimer = DISCLAIMER_RE.test(text);

  for (const rule of HIGH_RISK_PATTERNS) {
    if (disclaimer && rule.code.startsWith('guaranteed_')) continue;
    if (rule.re.test(text)) codes.push(rule.code);
  }

  if (POSITIVE_GUARANTEE_RE.test(text) && !disclaimer) {
    if (!codes.includes('guaranteed_registration')) codes.push('positive_guarantee');
  }

  if (Array.isArray(input.providerFeeLines)) {
    for (const line of input.providerFeeLines) {
      if (line?.ownership === 'government' || line?.feeKind === 'government') {
        codes.push('provider_fee_labelled_government');
        break;
      }
    }
  }

  if (input.capabilityId !== 'registered_agent' && /\blicensed\s+registered\s+agent\b/i.test(text)) {
    codes.push('unsupported_licensed_ra_claim');
  }

  return {
    flagged: codes.length > 0,
    codes,
    reviewRequired: codes.length > 0,
  };
}

export function isDisclaimerNotGuarantee(text) {
  return DISCLAIMER_RE.test(String(text || ''));
}
