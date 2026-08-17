import { useCallback, useEffect, useState } from 'react';
import { ui } from '../../design-system/surfaceClasses';

export function GbsContextMessages({ contextType, contextRef, loadMessages, sendMessage }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (requestedPage = 1) => {
    if (!contextRef) return;
    setError('');
    try {
      const { data } = await loadMessages(requestedPage, 20);
      setItems((current) => requestedPage === 1 ? data.items : [...data.items, ...current]);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch {
      setError('Unable to load this conversation.');
    }
  }, [contextRef, loadMessages]);

  useEffect(() => { load(1); }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await sendMessage(text);
      setItems((current) => [...current, data.item]);
      setText('');
    } catch {
      setError('Unable to send this message.');
    } finally { setBusy(false); }
  };

  const title = `Business ${contextType} conversation`;
  return (
    <section className="space-y-3" aria-labelledby={`gbs-${contextType}-messages-heading`}>
      <div>
        <h3 id={`gbs-${contextType}-messages-heading`} className="font-medium">{title}</h3>
        <p className={ui.muted}>This conversation belongs only to this {contextType}.</p>
      </div>
      {page < totalPages ? (
        <button type="button" className={ui.secondaryBtn} onClick={() => load(page + 1)}>Load older messages</button>
      ) : null}
      <ol className="space-y-2" aria-live="polite">
        {items.length === 0 ? <li className={ui.muted}>No messages yet.</li> : items.map((message) => (
          <li key={message.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-xs font-medium">{message.senderActorType === 'provider' ? 'Provider' : 'Business Client'}</p>
            <p className="whitespace-pre-wrap break-words-safe">{message.text}</p>
            <time className={`text-xs ${ui.muted}`} dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
          </li>
        ))}
      </ol>
      {error ? <p className={ui.error} role="alert">{error}</p> : null}
      <form onSubmit={submit} className="space-y-2">
        <label htmlFor={`gbs-${contextType}-message`} className="block text-sm font-medium">Message Provider or Business Client</label>
        <textarea
          id={`gbs-${contextType}-message`}
          className={`${ui.input} min-h-[96px]`}
          value={text}
          maxLength={4000}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit" className={ui.primaryBtn} disabled={busy || !text.trim()} aria-busy={busy}>
          {busy ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </section>
  );
}
