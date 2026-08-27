/**
 * Business Services provider private workspace feature gate.
 * Combines legacy GBS env flags with the staged workspace launch gate.
 */
import { isBusinessServicesProviderEnabled } from '../../../shared/gbs/constants.js';
import {
  WORKSPACE_LAUNCH_IDS,
  isWorkspaceLaunched,
  workspaceComingSoonBody,
} from '../../../shared/launch/workspaceLaunchGates.js';

export function requireBusinessServicesEnabled(req, res, next) {
  if (!isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES, process.env)) {
    return res.status(403).json(workspaceComingSoonBody(WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES));
  }
  if (!isBusinessServicesProviderEnabled(process.env)) {
    return res.status(403).json({ error: 'business_services_feature_disabled' });
  }
  return next();
}
