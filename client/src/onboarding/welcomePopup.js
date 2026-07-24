import Swal from 'sweetalert2';
import { trackOnboarding } from './analytics.js';

const PRIMARY = '#2563EB';
const ACCENT = '#F97316';

/**
 * Stage 1 — login success welcome (SweetAlert2).
 * @returns {Promise<'start'|'skip'>}
 */
export async function showWelcomePopup() {
  const result = await Swal.fire({
    icon: 'success',
    title: 'Welcome to Strideto!',
    html: `
      <p style="margin:0 0 0.5rem;font-weight:600;color:${ACCENT};font-family:Manrope,system-ui,sans-serif;">
        Every Step Toward Success.
      </p>
      <p style="margin:0;color:#475569;line-height:1.55;font-family:Inter,system-ui,sans-serif;">
        We're excited to have you here.<br/>
        Let's take a quick 2-minute tour to help you discover jobs, scholarships,
        admissions, career tools, and much more.
      </p>
    `,
    showCancelButton: true,
    confirmButtonText: 'Start Tour',
    cancelButtonText: 'Skip for Now',
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
    didOpen: () => {
      const confirm = Swal.getConfirmButton();
      if (confirm) confirm.focus();
    },
  });

  if (result.isConfirmed) {
    trackOnboarding('Tour Started', { source: 'welcome_popup' });
    return 'start';
  }

  trackOnboarding('Tour Skipped', { source: 'welcome_popup' });
  return 'skip';
}

export { PRIMARY, ACCENT };
