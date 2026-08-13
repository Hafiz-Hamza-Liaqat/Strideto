import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { TOUR_SELECTORS } from './constants.js';
import { trackOnboarding } from './analytics.js';
import { routeForGoal } from './goals.js';
import { ROUTES } from '../constants';

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function elExists(selector) {
  try {
    return Boolean(document.querySelector(selector));
  } catch {
    return false;
  }
}

/** Prefer attaching a highlight only when the target is actually visible. */
function isHighlightable(selector) {
  try {
    const el = document.querySelector(selector);
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  } catch {
    return false;
  }
}

function isNarrowViewport() {
  try {
    return window.matchMedia('(max-width: 640px)').matches;
  } catch {
    return false;
  }
}

function popoverPlacement(preferred = { side: 'bottom', align: 'start' }) {
  if (isNarrowViewport()) {
    return { side: preferred.side === 'over' ? 'over' : 'bottom', align: 'center' };
  }
  return preferred;
}

/**
 * Build Driver.js steps for the current product.
 * Role sequences follow Phase 15 product-tour IA.
 */
export function buildTourSteps({ isEmployer = false, role = null } = {}) {
  const resolvedRole = role || (isEmployer ? 'employer' : 'student');
  const steps = [
    {
      popover: {
        title: 'Welcome to Strideto',
        description:
          'Every Step Toward Success.\n\nDiscover jobs, scholarships, admissions, internships, programs, and career tools worldwide.',
        side: 'over',
        align: 'center',
      },
    },
  ];

  const pushTargeted = (selector, popover) => {
    if (!elExists(selector)) {
      steps.push({
        popover: {
          ...popover,
          side: 'over',
          align: 'center',
        },
      });
      return;
    }
    const placement = popoverPlacement({ side: popover.side, align: popover.align });
    if (isHighlightable(selector)) {
      steps.push({
        element: selector,
        popover: { ...popover, ...placement },
      });
    } else {
      steps.push({
        popover: {
          ...popover,
          side: 'over',
          align: 'center',
          description: `${popover.description}\n\n(Open this area from the header or menu when you are ready.)`,
        },
      });
    }
  };

  if (resolvedRole === 'employer') {
    pushTargeted(TOUR_SELECTORS.employer, {
      title: 'Verify',
      description: 'Complete organization verification before privileged hiring actions.',
      side: 'bottom',
      align: 'end',
    });
    steps.push({
      popover: {
        title: 'Job draft → Submit',
        description: 'Create a job draft, then submit it for review. Free quota and 24h rules still apply.',
        side: 'over',
        align: 'center',
      },
    });
    steps.push({
      popover: {
        title: 'Applicants → Pipeline → Interviews',
        description: 'Employer controls received, screening, interview, offer, hired, and rejected. Students cannot change those stages.',
        side: 'over',
        align: 'center',
      },
    });
    steps.push({
      popover: {
        title: 'Usage',
        description: 'Plans & Usage shows the same entitlement snapshot as Admin. Paid products remain not_configured until live commerce is accepted.',
        side: 'over',
        align: 'center',
      },
    });
  } else if (resolvedRole === 'agent') {
    steps.push({
      popover: {
        title: 'Profile → Verify',
        description: 'Complete the six onboarding stages, then submit verification. Status never claims under_review unless the server says so.',
        side: 'over',
        align: 'center',
      },
    });
    steps.push({
      popover: {
        title: 'Services → Availability → Consultations',
        description: 'Publish services, set IANA timezone availability, then receive consultation requests.',
        side: 'over',
        align: 'center',
      },
    });
    steps.push({
      popover: {
        title: 'Cases → Trust',
        description: 'Manage cases and trust reports. Commerce remains not_configured at launch.',
        side: 'over',
        align: 'center',
      },
    });
  } else if (resolvedRole === 'institution') {
    steps.push({
      popover: {
        title: 'Verify → Canonical Claim',
        description: 'Organization verification and canonical claim are separate. Publishing stays blocked until both are approved.',
        side: 'over',
        align: 'center',
      },
    });
    steps.push({
      popover: {
        title: 'Programs → Intakes → Applications',
        description: 'Publish source-backed programs, manage intakes, and review institution-authoritative applications.',
        side: 'over',
        align: 'center',
      },
    });
    steps.push({
      popover: {
        title: 'Data Quality',
        description: 'Keep official facts current. Completeness is not verification.',
        side: 'over',
        align: 'center',
      },
    });
  } else if (resolvedRole === 'admin') {
    steps.push({
      popover: {
        title: 'Overview → Verification',
        description: 'Review organization verification. Same-state needs_information updates do not invent a transition.',
        side: 'over',
        align: 'center',
      },
    });
    steps.push({
      popover: {
        title: 'Trust / Data Quality',
        description: 'Trust and data-quality queues stay separate from announcements and alerts.',
        side: 'over',
        align: 'center',
      },
    });
    steps.push({
      popover: {
        title: 'Announcements → Operations',
        description: 'Announcements are durable dashboard communication. Alerts are multi-channel operational distribution. Unavailable channels stay labelled not configured.',
        side: 'over',
        align: 'center',
      },
    });
  } else {
    pushTargeted(TOUR_SELECTORS.profile, {
      title: 'Profile',
      description: 'Complete your profile so recommendations and applications stay accurate.',
      side: 'bottom',
      align: 'end',
    });
    pushTargeted(TOUR_SELECTORS.search, {
      title: 'Discover',
      description: 'Search jobs, internships, scholarships, admissions, and programs worldwide. Country is international — not a Pakistan-only default.',
      side: 'bottom',
      align: 'start',
    });
    pushTargeted(TOUR_SELECTORS.dashboard, {
      title: 'Save / Journey → Apply → Track',
      description: 'Save opportunities, apply where supported, then track Employer or Institution status as read-only truth. External tracking is labelled My tracking status.',
      side: 'bottom',
      align: 'end',
    });
    steps.push({
      popover: {
        title: 'Vault → Services → Privacy',
        description: 'Keep documents in Vault, use professional services when you need them, and review privacy controls in Account.',
        side: 'over',
        align: 'center',
      },
    });
  }

  pushTargeted(TOUR_SELECTORS.notifications, {
    title: 'Notifications',
    description: 'In-app updates for applications, deadlines, and announcements.',
    side: 'bottom',
    align: 'end',
  });

  steps.push({
    popover: {
      title: "You're ready",
      description: 'Explore opportunities, finish your profile, or leave the tour whenever you like.',
      side: 'over',
      align: 'center',
    },
  });

  return steps;
}

function injectFinalCtas(d, { goal, onComplete, settle }) {
  const footer = document.querySelector('.driver-popover-footer');
  if (!footer || footer.querySelector('[data-strideto-final-cta]')) return;

  const wrap = document.createElement('div');
  wrap.setAttribute('data-strideto-final-cta', 'true');
  wrap.className = 'strideto-tour-final-ctas';
  wrap.innerHTML = `
    <button type="button" class="strideto-onboarding-btn-primary" data-action="explore">Explore Opportunities</button>
    <button type="button" class="strideto-onboarding-btn-secondary" data-action="resume">Build My Resume</button>
  `;
  footer.prepend(wrap);

  wrap.querySelector('[data-action="explore"]')?.addEventListener('click', () => {
    trackOnboarding('Explore CTA Clicked', { goal: goal || null });
    settle('complete');
    trackOnboarding('Tour Completed', { goal: goal || null, via: 'explore' });
    d.destroy();
    onComplete?.('explore', goal);
  });
  wrap.querySelector('[data-action="resume"]')?.addEventListener('click', () => {
    trackOnboarding('Resume CTA Clicked', { source: 'final_step' });
    settle('complete');
    trackOnboarding('Tour Completed', { goal: goal || null, via: 'resume' });
    d.destroy();
    onComplete?.('resume', goal);
  });
}

function patchFirstStepSkip(d, { settle, onSkip }) {
  const prev = document.querySelector('.driver-popover-prev-btn');
  if (!prev || d.getActiveIndex() !== 0) return;
  prev.textContent = 'Skip Tour';
  prev.setAttribute('aria-label', 'Skip Tour');
  prev.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    settle('skip');
    trackOnboarding('Tour Skipped', { source: 'tour_skip_button' });
    onSkip?.();
    d.destroy();
  };
}

/**
 * @returns {import('driver.js').Driver}
 */
export function startGuidedTour({ isEmployer = false, goal = null, onComplete, onSkip } = {}) {
  const reduced = prefersReducedMotion();
  const steps = buildTourSteps({ isEmployer });
  /** @type {'pending'|'complete'|'skip'} */
  let outcome = 'pending';

  const settle = (next) => {
    if (outcome !== 'pending') return;
    outcome = next;
  };

  const d = driver({
    showProgress: true,
    progressText: 'Step {{current}} of {{total}}',
    animate: !reduced,
    smoothScroll: !reduced,
    allowClose: true,
    overlayOpacity: 0.55,
    stagePadding: 8,
    stageRadius: 10,
    popoverClass: 'strideto-driver-theme',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Finish',
    showButtons: ['next', 'previous', 'close'],
    steps,
    onHighlightStarted: (element) => {
      if (!element || typeof element.scrollIntoView !== 'function') return;
      try {
        element.scrollIntoView({
          block: 'center',
          inline: 'nearest',
          behavior: reduced ? 'auto' : 'smooth',
        });
      } catch {
        /* ignore */
      }
    },
    onPopoverRender: () => {
      const closeBtn = document.querySelector('.driver-popover-close-btn');
      if (closeBtn) {
        closeBtn.setAttribute('aria-label', 'Skip Tour');
        closeBtn.title = 'Skip Tour';
      }
      patchFirstStepSkip(d, { settle, onSkip });
      if (d.isLastStep()) {
        injectFinalCtas(d, { goal, onComplete, settle });
      }
    },
    onDestroyStarted: () => {
      if (outcome === 'pending') {
        if (d.isLastStep()) {
          settle('complete');
          trackOnboarding('Tour Completed', { goal: goal || null, via: 'finish' });
          onComplete?.('finish', goal);
        } else {
          settle('skip');
          trackOnboarding('Tour Skipped', {
            source: 'tour_close',
            step: (d.getActiveIndex?.() ?? 0) + 1,
            total: steps.length,
          });
          onSkip?.();
        }
      }
      d.destroy();
    },
  });

  d.drive();
  return d;
}

export function landingRouteForAction(action, goal) {
  if (action === 'resume') return ROUTES.RESUME_BUILDER;
  if (action === 'explore') return goal ? routeForGoal(goal) : ROUTES.JOBS;
  if (goal) return routeForGoal(goal);
  return ROUTES.HOME;
}
