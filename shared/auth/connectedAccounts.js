/**
 * Provider-neutral Connected Accounts foundation.
 * No provider is launch-configured. External identity never grants Trust,
 * organization verification, canonical authority, or verified skills.
 */
export const CONNECTED_ACCOUNT_PROVIDERS = Object.freeze([
  'google',
  'apple',
  'microsoft',
  'github',
  'linkedin',
  'discord',
  'telegram',
  'facebook',
  'x',
]);

export const CONNECTED_ACCOUNT_STATE = Object.freeze({
  NOT_CONFIGURED: 'not_configured',
  CONFIGURED: 'configured',
  LINKED: 'linked',
  REVOKED: 'revoked',
});

export function connectedAccountCatalog(env = process.env) {
  return CONNECTED_ACCOUNT_PROVIDERS.map((provider) => {
    const flag = String(env[`OAUTH_${provider.toUpperCase()}_ENABLED`] || '').trim();
    const configured = flag === '1';
    return {
      provider,
      state: configured ? CONNECTED_ACCOUNT_STATE.CONFIGURED : CONNECTED_ACCOUNT_STATE.NOT_CONFIGURED,
      linked: false,
      canAuthenticate: false,
      confersTrust: false,
      confersVerification: false,
      confersCanonicalAuthority: false,
    };
  });
}

export function anyConnectedAccountConfigured(env = process.env) {
  return connectedAccountCatalog(env).some((row) => row.state === CONNECTED_ACCOUNT_STATE.CONFIGURED);
}
