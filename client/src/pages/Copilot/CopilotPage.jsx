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
import axiosInstance from '../../services/axiosBase';

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
  official_fact: { label: 'Official', color: 'var(--semantic-success)', badge: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-200' },
  institution_submitted: { label: 'Institution Verified', color: 'var(--semantic-info)', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200' },
  strideto_derived: { label: 'Strideto', color: '#a78bfa', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-200' },
  canonical_secondary: { label: 'Canonical Source', color: 'var(--semantic-text-secondary)', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200' },
  agent_statement: { label: 'Agent Statement', color: 'var(--semantic-warning)', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200' },
  ai_synthesis: { label: 'AI Synthesis', color: 'var(--semantic-text-muted)', badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
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
      const { data } = await axiosInstance.post('/copilot/ask', {
        question: q.slice(0, MAX_QUESTION),
        contextType: ctx || undefined,
        entityRefs: Object.keys(entityRefs).length > 0 ? entityRefs : undefined,
        locale: navigator.language || 'en',
      });
      setResponse(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to reach Strideto Copilot. Please try again.');
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
              className="placeholder:text-[color:var(--semantic-placeholder)]"
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
  page: { padding: '24px 16px', backgroundColor: 'var(--semantic-page-bg)', color: 'var(--semantic-text-primary)' },
  container: { maxWidth: 780, margin: '0 auto' },
  header: { marginBottom: 28 },
  title: { fontSize: 28, fontWeight: 700, color: 'var(--semantic-text-primary)', margin: 0 },
  subtitle: { marginTop: 6, color: 'var(--semantic-text-secondary)', fontSize: 15 },
  form: { background: 'var(--semantic-card)', borderRadius: 12, padding: 20, border: '1px solid var(--semantic-border)', marginBottom: 24 },
  contextRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--semantic-text-secondary)', whiteSpace: 'nowrap' },
  select: { flex: '1 1 180px', minWidth: 0, minHeight: 44, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--semantic-border)', fontSize: 14, background: 'var(--semantic-input-bg)', color: 'var(--semantic-input-text)' },
  questionRow: { display: 'flex', flexDirection: 'column', gap: 8 },
  textarea: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--semantic-border)', fontSize: 15, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--semantic-input-bg)', color: 'var(--semantic-input-text)' },
  questionMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  charCount: { fontSize: 12, color: 'var(--semantic-text-muted)' },
  submitBtn: { minHeight: 44, padding: '9px 20px', borderRadius: 8, background: 'var(--semantic-primary)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  errorBox: { background: 'color-mix(in srgb, var(--semantic-danger) 12%, var(--semantic-card))', border: '1px solid var(--semantic-danger)', borderRadius: 8, padding: '12px 16px', color: 'var(--semantic-danger)', marginBottom: 16 },
  responseArea: { background: 'var(--semantic-card)', borderRadius: 12, padding: 24, border: '1px solid var(--semantic-border)', marginBottom: 24 },
  notConfiguredBox: { background: 'color-mix(in srgb, var(--semantic-info) 12%, var(--semantic-card))', border: '1px solid var(--semantic-info)', borderRadius: 8, padding: '12px 16px', color: 'var(--semantic-info)', marginBottom: 16, fontSize: 14 },
  policyBox: { background: 'color-mix(in srgb, var(--semantic-warning) 14%, var(--semantic-card))', border: '1px solid var(--semantic-warning)', borderRadius: 8, padding: '12px 16px', color: 'var(--semantic-warning)', marginBottom: 16, fontSize: 14 },
  answerBox: { marginBottom: 20 },
  answerLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--semantic-text-muted)', marginBottom: 6 },
  answerText: { fontSize: 15, lineHeight: 1.6, color: 'var(--semantic-text-primary)', whiteSpace: 'pre-wrap', margin: 0 },
  deterministicBox: { background: 'color-mix(in srgb, var(--semantic-success) 12%, var(--semantic-card))', border: '1px solid var(--semantic-success)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: 'var(--semantic-text-primary)' },
  deterministicLabel: { fontWeight: 700, marginBottom: 6, color: 'var(--semantic-success)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' },
  warningList: { marginBottom: 16 },
  warningItem: { fontSize: 13, color: 'var(--semantic-warning)', padding: '6px 12px', background: 'color-mix(in srgb, var(--semantic-warning) 12%, var(--semantic-card))', borderRadius: 6, marginBottom: 4, border: '1px solid var(--semantic-warning)' },
  conflictBox: { background: 'var(--semantic-elevated)', border: '1px solid var(--semantic-border)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 },
  conflictLabel: { fontWeight: 700, color: 'var(--semantic-text-primary)', fontSize: 13, marginBottom: 8 },
  conflictItem: { marginBottom: 12 },
  conflictKey: { fontWeight: 600, color: 'var(--semantic-text-secondary)', fontSize: 13, marginBottom: 4 },
  conflictValue: { display: 'inline-block', margin: '0 4px', padding: '1px 8px', background: 'var(--semantic-secondary)', color: 'var(--semantic-secondary-text)', borderRadius: 4, fontSize: 12 },
  conflictRec: { fontSize: 12, color: 'var(--semantic-text-muted)', marginTop: 4, fontStyle: 'italic' },
  disclaimerList: { marginBottom: 16 },
  disclaimerItem: { fontSize: 12, color: 'var(--semantic-text-muted)', padding: '4px 10px', background: 'var(--semantic-elevated)', borderRadius: 6, marginBottom: 4, lineHeight: 1.5 },
  evidenceSection: { marginTop: 20 },
  evidenceToggle: { minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: 'var(--semantic-primary)', padding: '4px 0' },
  evidenceList: { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 },
  evidenceCard: { minWidth: 0, overflowWrap: 'anywhere', border: '1px solid var(--semantic-border)', borderRadius: 8, padding: '12px 14px', fontSize: 13, background: 'var(--semantic-elevated)' },
  evidenceCardHeader: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  sourceBadge: { display: 'inline-block', padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 },
  freshnessBadge: { fontSize: 11, fontWeight: 600 },
  entityTypeBadge: { fontSize: 11, color: 'var(--semantic-text-muted)', padding: '1px 6px', background: 'var(--semantic-secondary)', borderRadius: 6 },
  evidenceCardFact: { fontWeight: 600, color: 'var(--semantic-text-primary)', marginBottom: 4 },
  evidenceCardValue: { color: 'var(--semantic-text-secondary)', lineHeight: 1.4 },
  officialAttribution: { marginTop: 6, fontSize: 12, color: 'var(--semantic-info)', fontStyle: 'italic' },
  sourceLabel: { marginTop: 4, fontSize: 11, color: 'var(--semantic-text-muted)' },
  verifiedAt: { marginTop: 2, fontSize: 11, color: 'var(--semantic-text-muted)' },
  publicUrl: { marginTop: 6 },
  publicUrlLink: { fontSize: 12, color: 'var(--semantic-primary)', textDecoration: 'none' },
  followUpsSection: { marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--semantic-border)' },
  followUpsLabel: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--semantic-text-muted)', marginBottom: 8 },
  followUpsList: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  followUpBtn: { minHeight: 44, padding: '6px 12px', borderRadius: 16, border: '1px solid var(--semantic-border)', background: 'var(--semantic-secondary)', color: 'var(--semantic-secondary-text)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  generatedAt: { marginTop: 16, fontSize: 11, color: 'var(--semantic-text-muted)', textAlign: 'right', overflowWrap: 'anywhere' },
  providerLabel: { color: 'var(--semantic-disabled)' },
  startersBox: { background: 'var(--semantic-card)', borderRadius: 12, padding: 20, border: '1px solid var(--semantic-border)', marginBottom: 24 },
  startersLabel: { fontSize: 13, fontWeight: 600, color: 'var(--semantic-text-muted)', marginBottom: 10 },
  startersList: { display: 'flex', flexDirection: 'column', gap: 6 },
  starterBtn: { minHeight: 44, textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--semantic-border)', background: 'var(--semantic-elevated)', color: 'var(--semantic-text-primary)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  backLinks: { display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8 },
  backLink: { fontSize: 13, color: 'var(--semantic-text-muted)', textDecoration: 'none' },
};
