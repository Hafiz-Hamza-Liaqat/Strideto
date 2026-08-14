/**
 * Feature flags for Business Services foundation (Phase 17D-1 / 17D-3R).
 * Default OFF. No public GBS marketplace routes exist.
 */
import {
  isBusinessServicesEnabled as sharedEnabled,
  isBusinessServicesProviderEnabled as sharedProviderEnabled,
  isBusinessServicesPublicMarketplaceEnabled as sharedMarketplaceEnabled,
} from '../../../shared/gbs/constants.js';

export function isBusinessServicesEnabled() {
  return sharedEnabled(process.env);
}

export function isBusinessServicesProviderEnabled() {
  return sharedProviderEnabled(process.env);
}

export function isBusinessServicesPublicMarketplaceEnabled() {
  return sharedMarketplaceEnabled(process.env);
}
