import Swal from 'sweetalert2';
import { ONBOARDING_GOALS } from './goals.js';
import { trackOnboarding } from './analytics.js';
import { PRIMARY } from './welcomePopup.js';

/**
 * Optional goal selection (SweetAlert2). Skip allowed.
 * @returns {Promise<string|null>} goal id or null if skipped
 */
export async function showGoalSelection() {
  const optionsHtml = ONBOARDING_GOALS.map(
    (g) => `
      <button type="button" class="strideto-goal-option" data-goal="${g.id}" aria-label="${g.label}">
        <span aria-hidden="true">${g.emoji}</span>
        <span>${g.label}</span>
      </button>
    `
  ).join('');

  let selected = null;

  const result = await Swal.fire({
    title: 'What brings you to Strideto today?',
    html: `
      <p style="margin:0 0 1rem;color:#64748B;font-size:0.95rem;font-family:Inter,system-ui,sans-serif;">
        Optional — helps us suggest the best next step after the tour.
      </p>
      <div class="strideto-goal-grid" role="group" aria-label="Goal options">
        ${optionsHtml}
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Continue',
    cancelButtonText: 'Skip',
    reverseButtons: true,
    focusConfirm: true,
    allowEscapeKey: true,
    allowOutsideClick: false,
    buttonsStyling: false,
    customClass: {
      popup: 'strideto-onboarding-swal',
      confirmButton: 'strideto-onboarding-btn-primary',
      cancelButton: 'strideto-onboarding-btn-secondary',
      title: 'strideto-onboarding-title',
      htmlContainer: 'strideto-onboarding-html',
    },
    didOpen: (popup) => {
      popup.querySelectorAll('.strideto-goal-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          popup.querySelectorAll('.strideto-goal-option').forEach((b) => b.classList.remove('is-selected'));
          btn.classList.add('is-selected');
          selected = btn.getAttribute('data-goal');
        });
      });
    },
    preConfirm: () => selected,
  });

  if (!result.isConfirmed) {
    return null;
  }

  if (selected) {
    trackOnboarding('Goal Selected', { goal: selected });
  }
  return selected;
}

export { PRIMARY };
