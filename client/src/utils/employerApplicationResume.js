import { employerApi } from '../services/employerService.js';

/**
 * Open an employer-authorized application resume via authenticated API (no raw URL in state).
 * @param {string} applicationId
 */
export async function openEmployerApplicationResume(applicationId) {
  const { data } = await employerApi.fetchApplicationResume(applicationId);
  const blobUrl = URL.createObjectURL(data);
  const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (!opened) {
    URL.revokeObjectURL(blobUrl);
    throw new Error('popup_blocked');
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
