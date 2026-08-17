/**
 * Workspace notification projection.
 *
 * UserNotification has no domainId. Classification uses the existing `link`
 * path plus account-wide categories. Unclassified operational events are
 * omitted rather than guessed.
 *
 * Shared categories (system / payment / support) may appear in both
 * Education and Business inboxes as account-security events.
 */

const SHARED_CATEGORIES = new Set(['system', 'payment', 'support']);

function notificationPath(link) {
  return String(link || '').split('?')[0].split('#')[0];
}

export function notificationWorkspace(item = {}) {
  const path = notificationPath(item.link);
  if (path.includes('/agent/business-services') || path.startsWith('/business/')) {
    return 'business';
  }
  if (
    path.startsWith('/agent/education')
    || path.startsWith('/agent/consultations')
    || path.startsWith('/agent/leads')
    || path.startsWith('/agent/marketplace')
    || path.startsWith('/agent/availability')
    || path.startsWith('/agent/services')
    || path.startsWith('/agent/reviews')
    || path.startsWith('/agent/verification')
    || /^\/agent\/cases(\/|$)/.test(path)
  ) {
    return 'education';
  }
  if (SHARED_CATEGORIES.has(item.category)) return 'shared';
  return 'unclassified';
}

export function filterNotificationsForWorkspace(items, workspace) {
  return (Array.isArray(items) ? items : []).filter((item) => {
    const bucket = notificationWorkspace(item);
    return bucket === workspace || bucket === 'shared';
  });
}

const EDUCATION_LINK_REWRITES = [
  [/^\/agent\/consultations(\/|$)/, '/agent/education/consultations$1'],
  [/^\/agent\/cases(\/|$)/, '/agent/education/cases$1'],
  [/^\/agent\/leads(\/|$)/, '/agent/education/leads$1'],
  [/^\/agent\/marketplace(\/|$)/, '/agent/education/marketplace$1'],
  [/^\/agent\/availability(\/|$)/, '/agent/education/availability$1'],
  [/^\/agent\/services(\/|$)/, '/agent/education/services$1'],
  [/^\/agent\/reviews(\/|$)/, '/agent/education/reviews$1'],
  [/^\/agent\/verification(\/|$)/, '/agent/education/verification$1'],
  [/^\/agent\/profile(\/|$)/, '/agent/education/profile$1'],
  [/^\/agent\/messages(\/|$)/, '/agent/education/messages$1'],
  [/^\/agent\/notifications(\/|$)/, '/agent/education/notifications$1'],
];

export function rewriteNotificationLinkForWorkspace(link, workspace) {
  if (!link || workspace !== 'education') return link;
  const hashIndex = link.indexOf('#');
  const hash = hashIndex >= 0 ? link.slice(hashIndex) : '';
  const withoutHash = hashIndex >= 0 ? link.slice(0, hashIndex) : link;
  const qIndex = withoutHash.indexOf('?');
  const pathname = qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash;
  const search = qIndex >= 0 ? withoutHash.slice(qIndex) : '';
  let nextPath = pathname;
  for (const [pattern, replacement] of EDUCATION_LINK_REWRITES) {
    if (pattern.test(nextPath)) {
      nextPath = nextPath.replace(pattern, replacement);
      break;
    }
  }
  return `${nextPath}${search}${hash}`;
}
