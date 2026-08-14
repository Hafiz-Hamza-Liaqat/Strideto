/**
 * Feature flags for Business Services foundation (Phase 17D-1).
 * Default OFF. No public GBS routes exist in this phase.
 */
export function isBusinessServicesEnabled() {
  return process.env.BUSINESS_SERVICES_ENABLED === '1';
}
