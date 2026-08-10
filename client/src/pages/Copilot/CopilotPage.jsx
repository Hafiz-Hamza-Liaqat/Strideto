/**
 * CopilotPage — Mission 19.
 *
 * Authenticated Student Evidence-Grounded AI Copilot experience.
 *
 * Features:
 *   - Question input (bounded to MAX_QUESTION_LENGTH)
 *   - Context type selector
 *   - Entity reference preselection (from contextual entry points)
 *   - Structured response: answer, evidence cards, source labels, warnings
 *   - Official / Strideto Derived / AI Synthesis labels
 *   - Freshness warnings and conflict display
 *   - Deterministic eligibility/match/journey pass-through
 *   - Suggested follow-up questions
 *   - Provider-not-configured state (truthful, no fake AI)
 *   - Loading and error states
 *   - Responsive layout
 *
 * Boundaries:
 *   - No autonomous account mutations
 *   - Source links come from server-supplied evidence only
 *   - Model text rendered safely (no raw HTML execution)
 */
import { useState, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ROUTES } from '../../constants';

const API_BASE = '/api';
const MAX_QUESTION = 1000;

const CONTEXT_TYPE_LABELS = {
  general_guidance: 'General Guidance',
  tests: 'Tests',
  test_acceptance: 'Test Acceptance',
  programs: 'Programs',
  scholarships: 'Scholarships',
  eligibility: 'Eligibility',
  journey: 'Journey',
  institution: 'Institution',
  comparison: 'Comparison',
};

const GROUNDING_LABELS = {
  well_grounded: { label: 'Well Grounded', color: '#16a34a' },
  partially_grounded: { label: 'Partially Grounded', color: '#ca8a04' },
  insufficient_evidence: { label: 'Insufficient Evidence', color: '#dc2626' },
  conflicting_evidence: { label: 'Conflicting Evidence', color: '#7c3aed' },
  stale_evidence: { label: 'Stale Evidence', color: '#ea580c' },
  provider_not_configured: { label: 'Evidence Summary', color: '#2563eb' },
  policy_blocked: { label: 'Policy Review', color: '#be123c' },
};

const SOURCE_TYPE_LABELS = {
  official_fact: { label: 'Official', color: '#16a34a', badge: 'bg-green-100 text-green-800' },
  institution_submitted: { label: 'Institution Verified', color: '#0284c7', badge: 'bg-blue-100 text-blue-800' },
  strideto_derived: { label: 'Strideto', color: '#7c3aed', badge: 'bg-purple-100 text-purple-800' },
  canonical_secondary: { label: 'Canonical Source', color: '#374151', badge: 'bg-gray-100 text-gray-700' },
  agent_statement: { label: 'Agent Statement', color: '#b45309', badge: 'bg-yellow-100 text-yellow-800' },
  ai_synthesis: { label: 'AI Synthesis', color: '#6b7280', badge: 'bg-gray-100 text-gray-600' },
};

const FRESHNESS_LABELS = {
  fresh: null,
  review_due: { text: 'Review due', color: '#ca8a04' },
  stale: { text: 'Outdated', color: '#dc2626' },
  broken: { text: 'Source broken', color: '#dc2626' },
  unknown: { text: 'Freshness unknown', color: '#6b7280' },
};

export default function CopilotPage() {
  const [searchParams] = useSearchParams();

  const initialContext = searchParams.get('context') || '';
  const initialEntityRefs = (() => {
    try {
      const raw = searchParams.get('refs');
      return raw ? JSON.parse(decodeURIComponent(raw)) : {};
    } catch {
      return {};
    }
  })();

  const [question, setQuestion] = useState(searchParams.get('q') || '');
  const [contextType, setContextType] = useState(initialContext);
  const [entityRefs] = useState(initialEntityRefs);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedEvidence, setExpandedEvidence] = useState(false);
  const questionRef = useRef(null);

  const submit = useCallback(async (q = question, ctx = contextType) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setExpandedEvidence(false);

    try {
      const res = await fetch(`${API_BASE}/copilot/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          question: q.slice(0, MAX_QUESTION),
          contextType: ctx || undefined,
          entityRefs: Object.keys(entityRefs).length > 0 ? entityRefs : undefined,
          locale: navigator.language || 'en',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Request failed');
        return;
      }
      setResponse(data);
    } catch {
      setError('Unable to reach Strideto Copilot. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [question, contextType, entityRefs]);

  const handleSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  const handleFollowUp = (q) => {
    setQuestion(q);
    submit(q, contextType);
    questionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Strideto Copilot</h1>
          <p style={styles.subtitle}>
            Evidence-grounded answers about tests, programs, scholarships, eligibility, and your journey.
          </p>
        </header>

        {/* Question form */}
        <form onSubmit={handleSubmit} style={styles.form} ref={questionRef}>
          <div style={styles.contextRow}>
            <label style={styles.label} htmlFor="context-type">Focus area</label>
            <select
              id="context-type"
              value={contextType}
              onChange={(e) => setContextType(e.target.value)}
              style={styles.select}
            >
              <option value="">Any area</option>
              {Object.entries(CONTEXT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div style={styles.questionRow}>
            <textarea
              id="copilot-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION))}
              placeholder="Ask about tests, programs, scholarships, eligibility, or your journey…"
              style={styles.textarea}
              rows={3}
              maxLength={MAX_QUESTION}
              aria-label="Your question"
            />
            <div style={styles.questionMeta}>
              <span style={styles.charCount}>{question.length}/{MAX_QUESTION}</span>
              <button
                type="submit"
                disabled={loading || !question.trim()}
                style={{ ...styles.submitBtn, opacity: (loading || !question.trim()) ? 0.6 : 1 }}
              >
                {loading ? 'Thinking…' : 'Ask Strideto'}
              </button>
            </div>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div style={styles.errorBox} role="alert">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Response */}
        {response && !loading && (
          <div style={styles.responseArea}>
            {/* Grounding status badge */}
            <GroundingBadge status={response.groundingStatus} />

            {/* Provider not configured — truthful state */}
            {response.groundingStatus === 'provider_not_configured' && (
              <div style={styles.notConfiguredBox}>
                <strong>AI synthesis is not yet active.</strong> The verified evidence retrieved for your question is shown in the Evidence section below.
              </div>
            )}

            {/* Policy blocked */}
            {response.groundingStatus === 'policy_blocked' && (
              <div style={styles.policyBox}>
                <strong>Output policy applied.</strong>
                {response.policyMessages?.map((m, i) => <p key={i}>{m}</p>)}
              </div>
            )}

            {/* Answer */}
            {response.answer && (
              <div style={styles.answerBox}>
                <div style={styles.answerLabel}>
                  {response.answerType === 'not_configured' ? 'Evidence Summary' : 'Answer'}
                </div>
                <p style={styles.answerText}>{response.answer}</p>
              </div>
            )}

            {/* Deterministic results (pass-through — AI cannot override) */}
            {response.deterministicResults && Object.keys(response.deterministicResults).length > 0 && (
              <DeterministicResults results={response.deterministicResults} />
            )}

            {/* Source warnings */}
            {response.sourceWarnings?.length > 0 && (
              <WarningList warnings={response.sourceWarnings} />
            )}

            {/* Conflicts */}
            {response.conflicts?.length > 0 && (
              <ConflictList conflicts={response.conflicts} />
            )}

            {/* Disclaimers */}
            {response.disclaimers?.length > 0 && (
              <DisclaimerList disclaimers={response.disclaimers} />
            )}

            {/* Evidence cards */}
            {response.evidence?.length > 0 && (
              <div style={styles.evidenceSection}>
                <button
                  onClick={() => setExpandedEvidence((v) => !v)}
                  style={styles.evidenceToggle}
                  aria-expanded={expandedEvidence}
                >
                  {expandedEvidence ? '▾' : '▸'} Evidence ({response.evidence.length} item{response.evidence.length !== 1 ? 's' : ''})
                </button>
                {expandedEvidence && (
                  <div style={styles.evidenceList}>
                    {response.evidence.map((item) => (
                      <EvidenceCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Suggested follow-ups */}
            {response.suggestedFollowUps?.length > 0 && (
              <div style={styles.followUpsSection}>
                <div style={styles.followUpsLabel}>Follow-up questions</div>
                <div style={styles.followUpsList}>
                  {response.suggestedFollowUps.map((q, i) => (
                    <button key={i} onClick={() => handleFollowUp(q)} style={styles.followUpBtn}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.generatedAt}>
              Generated: {response.generatedAt ? new Date(response.generatedAt).toLocaleString() : ''}
              {response.providerMeta?.providerState && (
                <span style={styles.providerLabel}> · {response.providerMeta.providerState}</span>
              )}
            </div>
          </div>
        )}

        {/* Suggested starting questions */}
        {!response && !loading && !error && (
          <SuggestedStarters onSelect={handleFollowUp} />
        )}

        <div style={styles.backLinks}>
          <Link to={ROUTES.JOURNEY} style={styles.backLink}>← Journey</Link>
          <Link to={ROUTES.PERSONALIZATION_HUB} style={styles.backLink}>← Personalization</Link>
        </div>
      </div>
    </div>
  );
}

function GroundingBadge({ status }) {
  const meta = GROUNDING_LABELS[status] ?? { label: status, color: '#6b7280' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        color: '#fff',
        backgroundColor: meta.color,
      }}>
        {meta.label}
      </span>
    </div>
  );
}

function EvidenceCard({ item }) {
  const sourceInfo = SOURCE_TYPE_LABELS[item.sourceType] ?? { label: item.sourceType, badge: 'bg-gray-100 text-gray-600' };
  const freshness = item.freshnessState ? FRESHNESS_LABELS[item.freshnessState] : null;

  return (
    <div style={styles.evidenceCard}>
      <div style={styles.evidenceCardHeader}>
        <span style={{
          ...styles.sourceBadge,
          color: sourceInfo.color ?? '#374151',
          border: `1px solid ${sourceInfo.color ?? '#d1d5db'}`,
        }}>
          {sourceInfo.label}
        </span>
        {freshness && (
          <span style={{ ...styles.freshnessBadge, color: freshness.color }}>
            ⚠ {freshness.text}
          </span>
        )}
        <span style={styles.entityTypeBadge}>{item.entityType?.replace(/_/g, ' ')}</span>
      </div>
      <div style={styles.evidenceCardFact}>{item.fact}</div>
      {item.value && <div style={styles.evidenceCardValue}>{item.value}</div>}
      {item.officialAttribution && (
        <div style={styles.officialAttribution}>📋 {item.officialAttribution}</div>
      )}
      {item.sourceLabel && <div style={styles.sourceLabel}>Source: {item.sourceLabel}</div>}
      {item.lastVerifiedAt && (
        <div style={styles.verifiedAt}>Verified: {new Date(item.lastVerifiedAt).toLocaleDateString()}</div>
      )}
      {item.publicSafeUrl && (
        <div style={styles.publicUrl}>
          <a
            href={item.publicSafeUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.publicUrlLink}
          >
            Official source ↗
          </a>
        </div>
      )}
    </div>
  );
}

function DeterministicResults({ results }) {
  return (
    <div style={styles.deterministicBox}>
      <div style={styles.deterministicLabel}>Deterministic Results (authoritative)</div>
      {results.eligibility && (
        <div>
          <strong>Eligibility:</strong>{' '}
          {Object.entries(results.eligibility).map(([k, v]) => (
            <span key={k} style={{ marginRight: 12 }}>{k}: <strong>{v}</strong></span>
          ))}
        </div>
      )}
      {results.journeyStage && (
        <div><strong>Journey stage:</strong> {results.journeyStage}</div>
      )}
      {results.nextBestAction && (
        <div><strong>Next best action:</strong> {results.nextBestAction}</div>
      )}
      {results.gapSummary && (
        <div><strong>Profile gaps:</strong> {results.gapSummary}</div>
      )}
    </div>
  );
}

function WarningList({ warnings }) {
  return (
    <div style={styles.warningList}>
      {warnings.map((w, i) => (
        <div key={i} style={styles.warningItem}>⚠ {w}</div>
      ))}
    </div>
  );
}

function ConflictList({ conflicts }) {
  return (
    <div style={styles.conflictBox}>
      <div style={styles.conflictLabel}>⚡ Conflicting Evidence Detected</div>
      {conflicts.map((c, i) => (
        <div key={i} style={styles.conflictItem}>
          <div style={styles.conflictKey}>{c.key}</div>
          <div>Values: {c.values.map((v, j) => <span key={j} style={styles.conflictValue}>{v}</span>)}</div>
          <div style={styles.conflictRec}>{c.recommendation}</div>
        </div>
      ))}
    </div>
  );
}

function DisclaimerList({ disclaimers }) {
  return (
    <div style={styles.disclaimerList}>
      {disclaimers.map((d, i) => (
        <div key={i} style={styles.disclaimerItem}>ℹ {d}</div>
      ))}
    </div>
  );
}

function SuggestedStarters({ onSelect }) {
  const starters = [
    'Which test do I need for my target programs?',
    'What programs fit my goals and profile?',
    'What scholarships may I be eligible for?',
    'What gaps exist in my profile?',
    'What should I do next on my journey?',
  ];
  return (
    <div style={styles.startersBox}>
      <div style={styles.startersLabel}>Try asking:</div>
      <div style={styles.startersList}>
        {starters.map((q, i) => (
          <button key={i} onClick={() => onSelect(q)} style={styles.starterBtn}>{q}</button>
        ))}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  page: { minHeight: '100vh', padding: '24px 16px', backgroundColor: 'var(--color-bg, #f9fafb)' },
  container: { maxWidth: 780, margin: '0 auto' },
  header: { marginBottom: 28 },
  title: { fontSize: 28, fontWeight: 700, color: 'var(--color-text, #111827)', margin: 0 },
  subtitle: { marginTop: 6, color: 'var(--color-text-secondary, #6b7280)', fontSize: 15 },
  form: { background: 'var(--color-surface, #fff)', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 },
  contextRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary, #374151)', whiteSpace: 'nowrap' },
  select: { flex: '1 1 180px', minWidth: 0, minHeight: 44, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, background: 'var(--color-surface, #fff)', color: 'var(--color-text, #111827)' },
  questionRow: { display: 'flex', flexDirection: 'column', gap: 8 },
  textarea: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--color-surface, #fff)', color: 'var(--color-text, #111827)' },
  questionMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  charCount: { fontSize: 12, color: '#64748b' },
  submitBtn: { minHeight: 44, padding: '9px 20px', borderRadius: 8, background: '#4f46e5', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#dc2626', marginBottom: 16 },
  responseArea: { background: 'var(--color-surface, #fff)', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 },
  notConfiguredBox: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', color: '#1d4ed8', marginBottom: 16, fontSize: 14 },
  policyBox: { background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '12px 16px', color: '#c2410c', marginBottom: 16, fontSize: 14 },
  answerBox: { marginBottom: 20 },
  answerLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: 6 },
  answerText: { fontSize: 15, lineHeight: 1.6, color: 'var(--color-text, #111827)', whiteSpace: 'pre-wrap', margin: 0 },
  deterministicBox: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14 },
  deterministicLabel: { fontWeight: 700, marginBottom: 6, color: '#15803d', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' },
  warningList: { marginBottom: 16 },
  warningItem: { fontSize: 13, color: '#b45309', padding: '6px 12px', background: '#fffbeb', borderRadius: 6, marginBottom: 4, border: '1px solid #fde68a' },
  conflictBox: { background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '12px 16px', marginBottom: 16 },
  conflictLabel: { fontWeight: 700, color: '#7c3aed', fontSize: 13, marginBottom: 8 },
  conflictItem: { marginBottom: 12 },
  conflictKey: { fontWeight: 600, color: '#374151', fontSize: 13, marginBottom: 4 },
  conflictValue: { display: 'inline-block', margin: '0 4px', padding: '1px 8px', background: '#e9d5ff', borderRadius: 4, fontSize: 12 },
  conflictRec: { fontSize: 12, color: '#6b7280', marginTop: 4, fontStyle: 'italic' },
  disclaimerList: { marginBottom: 16 },
  disclaimerItem: { fontSize: 12, color: '#6b7280', padding: '4px 10px', background: '#f9fafb', borderRadius: 6, marginBottom: 4, lineHeight: 1.5 },
  evidenceSection: { marginTop: 20 },
  evidenceToggle: { minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#4f46e5', padding: '4px 0' },
  evidenceList: { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 },
  evidenceCard: { minWidth: 0, overflowWrap: 'anywhere', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px', fontSize: 13, background: 'var(--color-surface, #f9fafb)' },
  evidenceCardHeader: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  sourceBadge: { display: 'inline-block', padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 },
  freshnessBadge: { fontSize: 11, fontWeight: 600 },
  entityTypeBadge: { fontSize: 11, color: '#9ca3af', padding: '1px 6px', background: '#f3f4f6', borderRadius: 6 },
  evidenceCardFact: { fontWeight: 600, color: 'var(--color-text, #111827)', marginBottom: 4 },
  evidenceCardValue: { color: '#374151', lineHeight: 1.4 },
  officialAttribution: { marginTop: 6, fontSize: 12, color: '#0284c7', fontStyle: 'italic' },
  sourceLabel: { marginTop: 4, fontSize: 11, color: '#64748b' },
  verifiedAt: { marginTop: 2, fontSize: 11, color: '#64748b' },
  publicUrl: { marginTop: 6 },
  publicUrlLink: { fontSize: 12, color: '#4f46e5', textDecoration: 'none' },
  followUpsSection: { marginTop: 20, paddingTop: 16, borderTop: '1px solid #e5e7eb' },
  followUpsLabel: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: 8 },
  followUpsList: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  followUpBtn: { minHeight: 44, padding: '6px 12px', borderRadius: 16, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4f46e5', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  generatedAt: { marginTop: 16, fontSize: 11, color: '#64748b', textAlign: 'right', overflowWrap: 'anywhere' },
  providerLabel: { color: '#d1d5db' },
  startersBox: { background: 'var(--color-surface, #fff)', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 },
  startersLabel: { fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 10 },
  startersList: { display: 'flex', flexDirection: 'column', gap: 6 },
  starterBtn: { minHeight: 44, textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'var(--color-surface, #f9fafb)', color: 'var(--color-text, #111827)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  backLinks: { display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8 },
  backLink: { fontSize: 13, color: '#6b7280', textDecoration: 'none' },
};
