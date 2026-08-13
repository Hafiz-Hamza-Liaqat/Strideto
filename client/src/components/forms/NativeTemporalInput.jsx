import { useRef } from 'react';
import { inputControlClassName } from './controlClasses.js';

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 8v4.5l3 1.75" />
    </svg>
  );
}

/**
 * Shared date/time/datetime-local control: one currentColor trigger, native
 * indicator hidden. Falls back to typing when showPicker is unavailable.
 */
export function NativeTemporalInput({
  type = 'date',
  className = '',
  disabled = false,
  id,
  ...props
}) {
  const inputRef = useRef(null);
  const isTime = type === 'time';
  const label = isTime ? 'Open time picker' : 'Open date picker';

  const openPicker = () => {
    const el = inputRef.current;
    if (!el || disabled) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        /* unsupported or not allowed — fall through to focus */
      }
    }
    el.focus();
  };

  return (
    <div className="relative min-w-0">
      <input
        {...props}
        ref={inputRef}
        id={id}
        type={type}
        disabled={disabled}
        className={`temporal-input ${className || inputControlClassName()} pe-11`}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={label}
        onClick={openPicker}
        className="absolute inset-y-0 end-0 flex items-center justify-center px-2.5 text-gray-600 dark:text-gray-200 hover:text-primary dark:hover:text-mint disabled:opacity-50"
      >
        {isTime ? <ClockIcon /> : <CalendarIcon />}
      </button>
    </div>
  );
}

export function DateInput(props) {
  return <NativeTemporalInput type="date" {...props} />;
}

export function TimeInput(props) {
  return <NativeTemporalInput type="time" {...props} />;
}

export function DateTimeLocalInput(props) {
  return <NativeTemporalInput type="datetime-local" {...props} />;
}

export default DateInput;
