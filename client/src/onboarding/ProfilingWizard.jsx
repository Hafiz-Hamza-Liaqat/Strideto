import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  CAREER_GOAL_OPTIONS,
  EDUCATION_LEVELS,
  EXPERIENCE_OPTIONS,
  FIELD_OF_INTEREST_OPTIONS,
  LOCATION_OPTIONS,
  LOOKING_FOR_OPTIONS,
  NOTIFICATION_PREF_OPTIONS,
  PERSONA_OPTIONS,
  createEmptyCareerPreferences,
  normalizeCareerPreferences,
} from '../preferences/careerPreferences.js';
import './profilingWizard.css';
import './onboarding.css';
import { useOverlayA11y } from '../a11y/useOverlayA11y';

const TOTAL_STEPS = 10; // welcome + 8 questions + final

function OptionChip({ selected, onClick, children, multi = false }) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      className={`strideto-profile-chip ${selected ? 'is-selected' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * Optional LinkedIn-style first-time profiling wizard. Also reused
 * post-onboarding (e.g. from the profile-completion checklist) to let a
 * user revisit the same career-preferences questions via `initialStep` +
 * `editMode`, without a second data model or persistence path.
 * @param {{ initialPrefs?: object, initialStep?: number, editMode?: boolean }} [options]
 * @returns {Promise<{ prefs: object, action: 'tour'|'explore'|'skip'|'save'|'cancel' }>}
 */
export function openProfilingWizard(options = {}) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.id = 'strideto-profiling-host';
    document.body.appendChild(host);

    let root;
    const cleanup = (result) => {
      try {
        root?.unmount?.();
      } catch {
        /* ignore */
      }
      host.remove();
      resolve(result);
    };

    import('react-dom/client').then(({ createRoot }) => {
      root = createRoot(host);
      root.render(
        <ProfilingWizard
          initialPrefs={options.initialPrefs}
          initialStep={options.initialStep}
          editMode={options.editMode}
          onDone={(result) => cleanup(result)}
        />
      );
    });
  });
}

export function ProfilingWizard({ onDone, initialPrefs, initialStep = 0, editMode = false }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const [step, setStep] = useState(initialStep);
  const [fieldQuery, setFieldQuery] = useState('');
  const [prefs, setPrefs] = useState(() =>
    normalizeCareerPreferences(initialPrefs || createEmptyCareerPreferences())
  );

  const reducedMotion = useMemo(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }, []);

  const finish = useCallback(
    (action, skipped = false) => {
      const next = normalizeCareerPreferences({
        ...prefs,
        profilingCompleted: !skipped || Boolean(prefs.persona || prefs.careerGoal || prefs.lookingFor?.length),
        profilingSkipped: skipped && !prefs.persona && !prefs.careerGoal,
        updatedAt: new Date().toISOString(),
      });
      onDone({ prefs: next, action });
    },
    [onDone, prefs]
  );

  const closeAction = editMode ? 'cancel' : 'tour';

  useOverlayA11y({ open: true, onClose: () => finish(closeAction, true), containerRef: dialogRef, trapFocus: true });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const stepsInView = TOTAL_STEPS - initialStep;
  const progress = Math.round(((step - initialStep + 1) / stepsInView) * 100);

  const filteredFields = FIELD_OF_INTEREST_OPTIONS.filter((f) =>
    f.toLowerCase().includes(fieldQuery.trim().toLowerCase())
  );

  const toggleMulti = (key, value) => {
    setPrefs((p) => {
      const list = new Set(p[key] || []);
      if (list.has(value)) list.delete(value);
      else list.add(value);
      return { ...p, [key]: [...list] };
    });
  };

  const toggleNotif = (id) => {
    setPrefs((p) => ({
      ...p,
      notificationPrefs: {
        ...p.notificationPrefs,
        [id]: !p.notificationPrefs?.[id],
      },
    }));
  };

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, initialStep));

  let body = null;
  if (step === 0) {
    body = (
      <>
        <h2 id={titleId} className="strideto-profile-title">Let&apos;s personalize your experience.</h2>
        <p className="strideto-profile-sub">
          Answer a few quick questions so we can recommend the most relevant opportunities.
          You can skip any step.
        </p>
        <div className="strideto-profile-actions">
          <button type="button" className="strideto-onboarding-btn-secondary" onClick={() => finish('tour', true)}>
            Skip
          </button>
          <button type="button" className="strideto-onboarding-btn-primary" onClick={goNext} autoFocus>
            Continue
          </button>
        </div>
      </>
    );
  } else if (step === 1) {
    body = (
      <>
        <h2 id={titleId} className="strideto-profile-title">What best describes you?</h2>
        <div className="strideto-profile-grid" role="radiogroup" aria-label="Persona">
          {PERSONA_OPTIONS.map((o) => (
            <OptionChip
              key={o.id}
              selected={prefs.persona === o.id}
              onClick={() => setPrefs((p) => ({ ...p, persona: o.id }))}
            >
              <span aria-hidden="true">{o.emoji}</span> {o.label}
            </OptionChip>
          ))}
        </div>
      </>
    );
  } else if (step === 2) {
    body = (
      <>
        <h2 id={titleId} className="strideto-profile-title">What are you looking for?</h2>
        <p className="strideto-profile-hint">Select all that apply.</p>
        <div className="strideto-profile-grid" role="group" aria-label="Looking for">
          {LOOKING_FOR_OPTIONS.map((o) => (
            <OptionChip key={o} multi selected={prefs.lookingFor.includes(o)} onClick={() => toggleMulti('lookingFor', o)}>
              {o}
            </OptionChip>
          ))}
        </div>
      </>
    );
  } else if (step === 3) {
    body = (
      <>
        <h2 id={titleId} className="strideto-profile-title">Education Level</h2>
        <div className="strideto-profile-grid" role="radiogroup" aria-label="Education level">
          {EDUCATION_LEVELS.map((o) => (
            <OptionChip
              key={o}
              selected={prefs.educationLevel === o}
              onClick={() => setPrefs((p) => ({ ...p, educationLevel: o }))}
            >
              {o}
            </OptionChip>
          ))}
        </div>
      </>
    );
  } else if (step === 4) {
    body = (
      <>
        <h2 id={titleId} className="strideto-profile-title">Field of Interest</h2>
        <label className="strideto-profile-search-label" htmlFor="strideto-field-search">
          Search fields
        </label>
        <input
          id="strideto-field-search"
          type="search"
          className="strideto-profile-search"
          placeholder="Search e.g. Data Science"
          value={fieldQuery}
          onChange={(e) => setFieldQuery(e.target.value)}
        />
        <div className="strideto-profile-grid" role="group" aria-label="Fields of interest">
          {filteredFields.map((o) => (
            <OptionChip
              key={o}
              multi
              selected={prefs.fieldsOfInterest.includes(o)}
              onClick={() => toggleMulti('fieldsOfInterest', o)}
            >
              {o}
            </OptionChip>
          ))}
          {filteredFields.length === 0 && (
            <p className="strideto-profile-hint">No matches. Try another search.</p>
          )}
        </div>
      </>
    );
  } else if (step === 5) {
    body = (
      <>
        <h2 id={titleId} className="strideto-profile-title">Preferred Location</h2>
        <p className="strideto-profile-hint">Allow multiple selections.</p>
        <div className="strideto-profile-grid" role="group" aria-label="Preferred locations">
          {LOCATION_OPTIONS.map((o) => (
            <OptionChip
              key={o}
              multi
              selected={prefs.preferredLocations.includes(o)}
              onClick={() => toggleMulti('preferredLocations', o)}
            >
              {o}
            </OptionChip>
          ))}
        </div>
      </>
    );
  } else if (step === 6) {
    body = (
      <>
        <h2 id={titleId} className="strideto-profile-title">Experience</h2>
        <div className="strideto-profile-grid" role="radiogroup" aria-label="Experience">
          {EXPERIENCE_OPTIONS.map((o) => (
            <OptionChip
              key={o}
              selected={prefs.experience === o}
              onClick={() => setPrefs((p) => ({ ...p, experience: o }))}
            >
              {o}
            </OptionChip>
          ))}
        </div>
      </>
    );
  } else if (step === 7) {
    body = (
      <>
        <h2 id={titleId} className="strideto-profile-title">Career Goal</h2>
        <p className="strideto-profile-hint">Choose one primary goal.</p>
        <div className="strideto-profile-grid" role="radiogroup" aria-label="Career goal">
          {CAREER_GOAL_OPTIONS.map((o) => (
            <OptionChip
              key={o.id}
              selected={prefs.careerGoal === o.id}
              onClick={() => setPrefs((p) => ({ ...p, careerGoal: o.id }))}
            >
              {o.label}
            </OptionChip>
          ))}
        </div>
      </>
    );
  } else if (step === 8) {
    body = (
      <>
        <h2 id={titleId} className="strideto-profile-title">Notification Preferences</h2>
        <p className="strideto-profile-hint">Choose updates you want to receive.</p>
        <div className="strideto-profile-grid" role="group" aria-label="Notification preferences">
          {NOTIFICATION_PREF_OPTIONS.map((o) => (
            <OptionChip
              key={o.id}
              multi
              selected={Boolean(prefs.notificationPrefs?.[o.id])}
              onClick={() => toggleNotif(o.id)}
            >
              {o.label}
            </OptionChip>
          ))}
        </div>
      </>
    );
  } else if (editMode) {
    body = (
      <>
        <h2 id={titleId} className="strideto-profile-title">Career preferences updated</h2>
        <p className="strideto-profile-sub">
          Save to update your profile and recommendations, or cancel to discard these changes.
        </p>
        <div className="strideto-profile-actions">
          <button type="button" className="strideto-onboarding-btn-secondary" onClick={() => finish('cancel', true)}>
            Cancel
          </button>
          <button type="button" className="strideto-onboarding-btn-primary" onClick={() => finish('save')} autoFocus>
            Save changes
          </button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <h2 id={titleId} className="strideto-profile-title">You&apos;re all set! 🎉</h2>
        <p className="strideto-profile-sub">
          We&apos;ll personalize Strideto based on your interests.
        </p>
        <div className="strideto-profile-actions">
          <button type="button" className="strideto-onboarding-btn-secondary" onClick={() => finish('explore')}>
            Explore Platform
          </button>
          <button type="button" className="strideto-onboarding-btn-primary" onClick={() => finish('tour')} autoFocus>
            Start Guided Tour
          </button>
        </div>
      </>
    );
  }

  const showNav = step > 0 && step < TOTAL_STEPS - 1;

  return (
    <div
      className={`strideto-profile-overlay ${reducedMotion ? 'reduce-motion' : ''}`}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="strideto-profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="strideto-profile-progress" aria-hidden="true">
          <div className="strideto-profile-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <p className="strideto-profile-step-label" aria-live="polite">
          Step {step - initialStep + 1} of {stepsInView}
        </p>
        <div className="strideto-profile-body">{body}</div>
        {showNav && (
          <div className="strideto-profile-actions strideto-profile-actions-footer">
            <button type="button" className="strideto-onboarding-btn-secondary" onClick={goBack}>
              Back
            </button>
            <button type="button" className="strideto-onboarding-btn-secondary" onClick={goNext}>
              Skip
            </button>
            <button type="button" className="strideto-onboarding-btn-primary" onClick={goNext}>
              Next
            </button>
          </div>
        )}
        <button
          type="button"
          className="strideto-profile-close"
          aria-label={editMode ? 'Cancel career preferences' : 'Close setup'}
          onClick={() => finish(closeAction, true)}
        >
          ×
        </button>
      </div>
    </div>
  );
}
