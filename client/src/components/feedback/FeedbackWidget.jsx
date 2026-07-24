import { useEffect, useId, useRef, useState } from 'react';
import axiosInstance from '../../services/axiosBase';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';

const TYPES = [
  { id: 'bug', label: 'Bug Report', emoji: '🐞' },
  { id: 'feature', label: 'Feature Request', emoji: '💡' },
  { id: 'general', label: 'General Feedback', emoji: '💬' },
];

const MAX_SCREENSHOT_BYTES = 280_000;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('general');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState('');
  const [screenshotName, setScreenshotName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [errors, setErrors] = useState({});
  const panelRef = useRef(null);
  const titleId = useId();

  useOverlayA11y({ open, onClose: () => setOpen(false), containerRef: panelRef, trapFocus: true });

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const resetForm = () => {
    setType('general');
    setMessage('');
    setRating(0);
    setName('');
    setEmail('');
    setWebsite('');
    setScreenshotDataUrl('');
    setScreenshotName('');
    setErrors({});
    setStatus(null);
  };

  const handleClose = () => {
    setOpen(false);
    setStatus(null);
  };

  const handleScreenshot = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setErrors((prev) => ({ ...prev, screenshotDataUrl: undefined }));
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setErrors((prev) => ({ ...prev, screenshotDataUrl: 'Use PNG, JPEG, or WebP' }));
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setErrors((prev) => ({ ...prev, screenshotDataUrl: 'Image must be under ~280KB' }));
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setScreenshotDataUrl(dataUrl);
      setScreenshotName(file.name);
    } catch {
      setErrors((prev) => ({ ...prev, screenshotDataUrl: 'Could not read image' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);
    setErrors({});
    try {
      await axiosInstance.post('/feedback', {
        type,
        message,
        rating: rating || undefined,
        name: name || undefined,
        email: email || undefined,
        website,
        pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        screenshotDataUrl: screenshotDataUrl || undefined,
      });
      setStatus('success');
      resetForm();
      setStatus('success');
    } catch (err) {
      const details = err.response?.data?.details;
      if (details) setErrors(details);
      setStatus('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setStatus(null);
        }}
        className="fixed z-[45] bottom-4 end-4 sm:bottom-6 sm:end-6 min-h-[44px] px-4 rounded-lg bg-primary text-white text-sm font-semibold shadow-lg hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Feedback
      </button>

      {open ? (
        <div className="fixed inset-0 z-[50] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={handleClose} aria-hidden="true" />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-xl bg-white dark:bg-gray-900 shadow-xl p-4 sm:p-6 outline-none"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">
                Send feedback
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="min-h-[44px] min-w-[44px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                aria-label="Close feedback"
              >
                ×
              </button>
            </div>

            {status === 'success' ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  Thank you — your feedback helps us improve Strideto.
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="min-h-[44px] w-full rounded-lg bg-primary text-white font-medium"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <fieldset>
                  <legend className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">Type</legend>
                  <div className="grid gap-2">
                    {TYPES.map((item) => (
                      <label
                        key={item.id}
                        className={`flex items-center gap-3 min-h-[44px] px-3 rounded-lg border cursor-pointer ${
                          type === item.id
                            ? 'border-primary bg-primary/5 dark:bg-primary/10'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="feedback-type"
                          value={item.id}
                          checked={type === item.id}
                          onChange={() => setType(item.id)}
                          className="accent-primary"
                        />
                        <span aria-hidden="true">{item.emoji}</span>
                        <span className="text-sm text-gray-900 dark:text-gray-100">{item.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.type ? <p className="mt-1 text-xs text-red-600">{errors.type}</p> : null}
                </fieldset>

                <div>
                  <label htmlFor="feedback-message" className="block text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">
                    Message
                  </label>
                  <textarea
                    id="feedback-message"
                    required
                    minLength={10}
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                    placeholder="What happened or what would you like?"
                  />
                  {errors.message ? <p className="mt-1 text-xs text-red-600">{errors.message}</p> : null}
                </div>

                <fieldset>
                  <legend className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">
                    Satisfaction (optional)
                  </legend>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Satisfaction rating">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={rating === n}
                        onClick={() => setRating((prev) => (prev === n ? 0 : n))}
                        className={`min-h-[44px] min-w-[44px] rounded-lg border text-sm font-semibold ${
                          rating === n
                            ? 'border-primary bg-primary text-white'
                            : 'border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {errors.rating ? <p className="mt-1 text-xs text-red-600">{errors.rating}</p> : null}
                </fieldset>

                <div>
                  <label htmlFor="feedback-screenshot" className="block text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">
                    Screenshot (optional)
                  </label>
                  <input
                    id="feedback-screenshot"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleScreenshot}
                    className="block w-full text-sm text-gray-600 dark:text-gray-300"
                  />
                  {screenshotName ? (
                    <p className="mt-1 text-xs text-gray-500">
                      Attached: {screenshotName}{' '}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          setScreenshotDataUrl('');
                          setScreenshotName('');
                        }}
                      >
                        Remove
                      </button>
                    </p>
                  ) : null}
                  {errors.screenshotDataUrl ? (
                    <p className="mt-1 text-xs text-red-600">{errors.screenshotDataUrl}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="feedback-name" className="block text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">
                      Name (optional)
                    </label>
                    <input
                      id="feedback-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="feedback-email" className="block text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">
                      Email (optional)
                    </label>
                    <input
                      id="feedback-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
                    />
                    {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
                  </div>
                </div>

                <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
                  <label htmlFor="feedback-website">Website</label>
                  <input
                    id="feedback-website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                {status === 'error' ? (
                  <p className="text-sm text-red-600" role="alert">
                    Could not send feedback. Please try again.
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[44px] w-full rounded-lg bg-primary text-white font-semibold disabled:opacity-60"
                >
                  {submitting ? 'Sending…' : 'Submit feedback'}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
