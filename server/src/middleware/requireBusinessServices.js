import { isBusinessServicesProviderEnabled } from '../../../shared/gbs/constants.js';

export function requireBusinessServicesEnabled(req, res, next) {
  if (!isBusinessServicesProviderEnabled(process.env)) {
    return res.status(403).json({ error: 'business_services_feature_disabled' });
  }
  return next();
}
