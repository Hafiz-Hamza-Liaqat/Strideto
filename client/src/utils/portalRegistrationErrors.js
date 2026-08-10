function safeApiMessage(error) {
  const body = error?.response?.data;
  if (!body || typeof body !== 'object') return '';
  for (const candidate of [body.error, body.message, body.details?.[0]]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

export function getAgentRegistrationError(error) {
  const apiMessage = safeApiMessage(error);
  if (apiMessage) return apiMessage;
  if (error?.response?.status === 409) {
    return 'An Agent account with this email already exists. Sign in or use another email.';
  }
  return 'Registration failed. Please try again.';
}

export function getInstitutionRegistrationError(error) {
  const apiMessage = safeApiMessage(error);
  if (apiMessage) return apiMessage;
  if (error?.response?.status === 409) {
    return 'An Institution account with this email already exists. Sign in or use another email.';
  }
  return 'Institution registration failed. Please try again.';
}
