/**
 * Source-controlled filing-requirement pack registry.
 * Production list is immutable. Tests may pass a parameterized registry.
 * No HTTP injection. No env override to activate draft packs.
 */
import { US_WY_LLC_REQUIREMENT_PACK_V1 } from './requirementPacks/usWyLlcV1.js';
import { resolveRequirementPack, validateRequirementPackDefinition } from './requirementPackContract.js';

export const productionRequirementPackRegistry = Object.freeze({
  packs: Object.freeze([US_WY_LLC_REQUIREMENT_PACK_V1]),
});

for (const pack of productionRequirementPackRegistry.packs) {
  const errors = validateRequirementPackDefinition(pack);
  if (errors.length) throw new Error(`requirement_pack_invalid:${pack.packId}:${errors.join(',')}`);
}

export function resolveProductionRequirementPack(key) {
  return resolveRequirementPack({ ...key, registry: productionRequirementPackRegistry });
}

export function registryWithPacks(packs) {
  return Object.freeze({ packs: Object.freeze([...(packs || [])]) });
}
