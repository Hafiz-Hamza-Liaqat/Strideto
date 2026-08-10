import axiosInstance from './axiosBase';

/**
 * Skill claim / evidence API.
 *
 * Note what is absent: there is no client method that sets a verification
 * status, score, verifier or badge. Those are server-only, and the server
 * rejects a body that mentions them — so no client bug can mint trust.
 */
export const skillClaimsApi = {
  /** The signed-in applicant's own claims, with their evidence. */
  listMine: () => axiosInstance.get('/skill-claims'),

  /** Create a claim. Starts as `claimed` — self-reported and unchecked. */
  create: (body) => axiosInstance.post('/skill-claims', body),

  /** Attach one evidence link. Submitting evidence is not verification. */
  addEvidence: (claimId, body) =>
    axiosInstance.post(`/skill-claims/${claimId}/evidence`, body),

  /** Ask for review. Moves the claim to `verification_pending`. */
  submitForReview: (claimId) => axiosInstance.post(`/skill-claims/${claimId}/submit`),

  /** Append-only transition history for one claim. */
  history: (claimId) => axiosInstance.get(`/skill-claims/${claimId}/history`),
};

/**
 * Reviewer (staff) surface. Note what is still absent even here: no method
 * sets a score, a verifier or a badge. A decision states an outcome, a method,
 * a reason and the evidence it rests on — the server computes everything else
 * and takes the reviewer's identity from the session, not from this payload.
 */
export const skillVerificationAdminApi = {
  /** Claims awaiting a decision. Read-only; seeing them grants no authority. */
  listForReview: (params) => axiosInstance.get('/admin/skill-claims', { params }),

  /** Enabled verification methods and reviewable outcomes. */
  options: () => axiosInstance.get('/admin/skill-verification/options'),

  /** Record one audited decision. Rejected server-side without method/reason. */
  recordDecision: (claimId, body) =>
    axiosInstance.post(`/admin/skill-claims/${claimId}/verification`, body),
};

/*
 * The employer read of an applicant's skills is deliberately NOT here: that
 * route is Employer-realm and needs the employer access token, so it lives on
 * `employerApi.applicantSkills` in employerService.js. Calling it through this
 * User-realm instance would send the wrong token and 401.
 */

export default skillClaimsApi;
