/**
 * Dry-run only. Does not write Provider Domain enrollments.
 * Existing Agents without initialization remain legacy (education_mobility effective).
 *
 * Usage:
 *   node server/scripts/providerDomainLegacyDryRun.js
 */
import { resolveProviderDomainInitializationState } from '../../shared/provider/providerDomainSelection.js';

export function planLegacyCompatibility(profiles = []) {
  const plan = [];
  for (const profile of profiles) {
    const state = resolveProviderDomainInitializationState(profile.providerDomainInitializationState);
    if (state === 'legacy') {
      plan.push({
        agentAccountId: String(profile.agentAccountId || ''),
        action: 'none',
        effectiveDomains: ['education_mobility'],
        persist: false,
      });
    }
  }
  return { dryRun: true, executed: false, rows: plan };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('providerDomainLegacyDryRun.js')) {
  console.log(JSON.stringify({ dryRun: true, executed: false, note: 'No live backfill. Legacy agents stay compatibility-education only.' }, null, 2));
}
