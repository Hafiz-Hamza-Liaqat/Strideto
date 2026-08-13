import { Employer } from '../models/Employer.js';
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { InstitutionAccount } from '../models/institution/InstitutionAccount.js';
import { isB2bEmailVerificationRequired } from '../services/auth/realmEmailVerification.js';

function denied(res) {
  return res.status(403).json({
    error: 'Verify your email before this action',
    code: 'email_verification_required',
  });
}

export function requireEmployerEmailVerified() {
  return async function employerEmailVerified(req, res, next) {
    const id = req.employer?.employerId;
    if (!id) return denied(res);
    const account = await Employer.findById(id).select('emailVerified createdAt').lean();
    if (isB2bEmailVerificationRequired(account)) return denied(res);
    return next();
  };
}

export function requireAgentEmailVerified() {
  return async function agentEmailVerified(req, res, next) {
    const id = req.agent?.agentAccountId;
    if (!id) return denied(res);
    const account = await AgentAccount.findById(id).select('emailVerified createdAt').lean();
    if (isB2bEmailVerificationRequired(account)) return denied(res);
    return next();
  };
}

export function requireInstitutionEmailVerified() {
  return async function institutionEmailVerified(req, res, next) {
    const id = req.institution?.institutionAccountId;
    if (!id) return denied(res);
    const account = await InstitutionAccount.findById(id).select('emailVerified createdAt').lean();
    if (isB2bEmailVerificationRequired(account)) return denied(res);
    return next();
  };
}
