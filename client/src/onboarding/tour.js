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
 * Build Driver.js steps. Employer dashboard step only when isEmployer.
 */
export function buildTourSteps({ isEmployer = false } = {}) {
  const steps = [
    {
      popover: {
        title: 'Welcome to Strideto',
        description:
          'Every Step Toward Success.\n\nDiscover jobs, scholarships, admissions, internships, resume tools, career guidance, and more—all in one place.',
        side: 'over',
        align: 'center',
      },
    },
  ];

  const pushTargeted = (selector, popover) => {
    if (!elExists(selector)) return;
    const placement = popoverPlacement({ side: popover.side, align: popover.align });
    if (isHighlightable(selector)) {
      steps.push({
        element: selector,
        popover: { ...popover, ...placement },
      });
    } else {
      // Keep the educational step as a centered card when the anchor is off-screen/hidden.
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

  pushTargeted(TOUR_SELECTORS.search, {
    title: 'Search',
    description: 'Search thousands of opportunities instantly.',
    side: 'bottom',
    align: 'start',
  });

  pushTargeted(TOUR_SELECTORS.nav, {
    title: 'Navigation',
    description:
      'Browse:\n• Jobs\n• Scholarships\n• Admissions\n• Internships\n• Career Guidance\n• Foreign Studies\n• Resume Builder',
    side: 'bottom',
    align: 'start',
  });

  pushTargeted(TOUR_SELECTORS.resume, {
    title: 'Resume Builder',
    description: 'Create a professional resume using guided templates.\n\nTip: use “Try Resume Builder” on the final step.',
    side: 'bottom',
    align: 'end',
  });

  pushTargeted(TOUR_SELECTORS.dashboard, {
    title: 'Dashboard',
    description:
      'Track:\nApplications\nSaved Opportunities\nAchievements\nProfile Progress\nRecommendations',
    side: 'bottom',
    align: 'end',
  });

  pushTargeted(TOUR_SELECTORS.career, {
    title: 'Career Guidance',
    description: 'Explore career paths, articles, and personalized recommendations.',
    side: 'bottom',
    align: 'end',
  });

  if (isEmployer) {
    pushTargeted(TOUR_SELECTORS.employer, {
      title: 'Employer Dashboard',
      description: 'Manage job posts.\nReview applicants.\nTrack hiring.',
      side: 'bottom',
      align: 'end',
    });
  }

  pushTargeted(TOUR_SELECTORS.notifications, {
    title: 'Notifications',
    description:
      'Receive updates about:\nJobs\nScholarships\nAdmissions\nDeadlines\nAnnouncements',
    side: 'bottom',
    align: 'end',
  });

  pushTargeted(TOUR_SELECTORS.profile, {
    title: 'Your Profile',
    description: 'Complete your profile for better recommendations and visibility.',
    side: 'bottom',
    align: 'end',
  });

  steps.push({
    popover: {
      title: "You're ready! 🎉",
      description: 'Explore opportunities, build your resume, or finish the tour whenever you like.',
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
