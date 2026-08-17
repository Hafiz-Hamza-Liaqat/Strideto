import { useEffect, useState } from 'react';
import { ui } from '../../design-system/surfaceClasses';

export default function MessageThread({
  threadId,
  loadMessages,
  sendMessage,
  canShareDocuments = false,
  title = 'Consultation messages',
  description = 'This private thread exists only for this consultation and closes after the bounded post-consultation period.',
  placeholder = 'Write a consultation message',
  readOnly = false,
}) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => threadId && loadMessages(threadId).then((r) => setMessages(r.data.messages || [])).catch((e) => setError(e.response?.data?.error || 'Unable to load messages.'));
  useEffect(() => { void load(); }, [threadId]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      await sendMessage(threadId, { messageType: 'text', text });
      setText('');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Message could not be sent.');
    } finally {
      setBusy(false);
    }
  };
  if (!threadId) return <p className={ui.muted}>Conversation context is not available.</p>;
  return (
    <section className={`${ui.card} p-4`}>
      <h2 className="font-semibold">{title}</h2>
      <p className={`mt-1 text-xs ${ui.muted}`}>{description}</p>
      {error ? <p className={`mt-3 ${ui.error}`} role="alert">{error}</p> : null}
      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
        {messages.length === 0 ? (
          <p className={ui.muted}>No messages yet.</p>
        ) : messages.map((message) => (
          <div key={message.id || message._id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/60">
            <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">{message.senderActorType} · {(message.messageType || 'case_message').replaceAll('_', ' ')}</p>
            {message.text ? <p className="mt-1 whitespace-pre-wrap text-sm">{message.text}</p> : null}
            {message.documentReference?.displayName ? <p className={`mt-1 text-sm ${ui.link}`}>Vault reference: {message.documentReference.displayName}</p> : null}
          </div>
        ))}
      </div>
      {readOnly ? <p className={`mt-4 ${ui.muted}`}>This Case thread is read-only.</p> : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor={`message-${threadId}`}>{placeholder}</label>
          <input
            id={`message-${threadId}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={4000}
            disabled={busy}
            className={`${ui.input} flex-1 disabled:opacity-50`}
            placeholder={placeholder}
            aria-label={placeholder}
          />
          <button disabled={busy} className={ui.primaryBtn}>Send</button>
        </form>
      )}
      {canShareDocuments ? (
        <p className={`mt-3 text-xs ${ui.muted}`}>
          To share a document, create an exact, time-bounded Agent grant in your <a className={`${ui.link} underline`} href="/vault">Vault</a>. A consultation never grants Vault access automatically.
        </p>
      ) : null}
    </section>
  );
}
