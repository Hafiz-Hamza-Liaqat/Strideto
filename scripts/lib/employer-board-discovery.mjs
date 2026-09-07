import { normalizePunctuation } from './job-source-structural-parser.mjs';

const AGGREGATOR_HOSTS = /(?:linkedin\.com|indeed\.com|glassdoor\.|ziprecruiter\.|jooble\.|talent\.com)/i;
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_USER_AGENT = 'STRIDETO-employer-board-discovery/1.0';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function text(value) { return normalizePunctuation(String(value ?? '')).trim(); }
function norm(value) { return text(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function urlKey(value) {
  try { const url = new URL(value); url.hash = ''; url.search = ''; return url.toString().replace(/\/$/, '').toLowerCase(); } catch { return ''; }
}
function sourceFamily(board) {
  const value = String(board?.sourceType ?? '').toUpperCase();
  if (value.includes('GREENHOUSE')) return 'GREENHOUSE';
  if (value.includes('LEVER')) return 'LEVER';
  if (value.includes('WORKDAY')) return 'WORKDAY';
  if (value.includes('SMARTRECRUITERS')) return 'SMARTRECRUITERS';
  if (value.includes('EMPLOYER') || value.includes('CAREER')) return 'EMPLOYER_CAREERS';
  return null;
}
function canonicalUrl(value) {
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) && !AGGREGATOR_HOSTS.test(url.hostname) ? url.toString() : null; } catch { return null; }
}
function slugFromUrl(value) {
  try { return new URL(value).pathname.split('/').filter(Boolean).at(-1) ?? null; } catch { return null; }
}
function first(...values) { return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') ?? null; }
function arrayFrom(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  return value.jobs ?? value.postings ?? value.jobPostings ?? value.content ?? value.data ?? value.results ?? value.items ?? [];
}
function exactIdentity(record) { return `${norm(record.company)}|${norm(record.title)}|${norm(record.location)}`; }

export function normalizeDiscoveryRecord(raw, board = {}) {
  const family = sourceFamily(board);
  const sourceUrl = canonicalUrl(first(raw.absolute_url, raw.hostedUrl, raw.url, raw.jobUrl, raw.sourceUrl, raw.jobPostingUrl, raw.externalPath, raw.ref));
  const applicationLink = canonicalUrl(first(raw.applyUrl, raw.apply_url, raw.applicationLink, raw.applicationUrl));
  const location = text(first(raw.location?.name, raw.location, raw.categories?.location, raw.categories?.allLocations?.join(' / '), raw.jobLocation, board.countryHint));
  const company = text(first(raw.company?.name, raw.company_name, raw.company, board.company));
  const title = text(first(raw.title, raw.text, raw.name, raw.jobTitle));
  const externalId = text(first(raw.id, raw.jobId, raw.requisitionId, raw.requisition_id, raw.externalId, raw.referenceId));
  return {
    company, title, externalId, sourceUrl, ...(applicationLink ? { applicationLink } : {}),
    sourceType: family, ...(board.boardId ? { board: String(board.boardId) } : {}),
    ...(location ? { location } : {}),
    metadata: { ...(board.metadata ?? {}), ...(raw.metadata ?? {}), slug: first(raw.slug, slugFromUrl(sourceUrl)), sourceFamily: family },
  };
}

export function validateBoardConfig(board) {
  const errors = [];
  if (!board || typeof board !== 'object' || Array.isArray(board)) return ['board must be an object'];
  if (!board.company) errors.push('missing company');
  if (!sourceFamily(board)) errors.push('unsupported sourceType');
  if (!board.boardUrl && !board.careersUrl && !board.boardId) errors.push('missing boardUrl, careersUrl, or boardId');
  return errors;
}

export function normalizeHistory(rows = []) {
  const index = { ids: new Set(), sourceUrls: new Set(), applicationLinks: new Set(), keys: new Set() };
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    if (row.externalId != null && String(row.externalId).trim()) index.ids.add(String(row.externalId));
    for (const value of [row.sourceUrl, row.officialSourceUrl]) { const key = urlKey(value); if (key) index.sourceUrls.add(key); }
    for (const value of [row.applicationLink, row.applicationUrl]) { const key = urlKey(value); if (key) index.applicationLinks.add(key); }
    const key = exactIdentity({ company: row.company ?? row.employer, title: row.title, location: row.location ?? row.city ?? row.country });
    if (!key.startsWith('||')) index.keys.add(key);
  }
  return index;
}

function descriptor(board) {
  const family = sourceFamily(board);
  if (board.boardUrl) return { url: board.boardUrl, responseType: board.responseType ?? 'json' };
  if (family === 'GREENHOUSE') return { url: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.boardId)}/jobs`, responseType: 'json' };
  if (family === 'LEVER') return { url: `https://api.lever.co/v0/postings/${encodeURIComponent(board.boardId)}?mode=json`, responseType: 'json' };
  if (family === 'SMARTRECRUITERS') return { url: `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board.boardId)}/postings`, responseType: 'json' };
  return { url: board.careersUrl, responseType: board.responseType ?? 'json' };
}

async function defaultTransport({ url, responseType, signal, userAgent }) {
  const response = await fetch(url, { signal, redirect: 'follow', headers: { accept: responseType === 'json' ? 'application/json' : 'text/html,application/xhtml+xml', 'user-agent': userAgent } });
  const body = await response.text();
  let data = body;
  if (responseType === 'json') { try { data = JSON.parse(body); } catch { data = null; } }
  return { status: response.status, url: response.url || url, body, data };
}

async function fetchWithRetry(board, options) {
  const retries = Math.max(0, Number(options.retries ?? 2));
  let attempt = 0;
  while (true) {
    try {
      const response = await options.transport({ ...descriptor(board), signal: AbortSignal.timeout(options.timeoutMs ?? 12000), userAgent: options.userAgent ?? DEFAULT_USER_AGENT });
      if (!TRANSIENT_STATUSES.has(response.status) || attempt >= retries) return response;
      attempt += 1; await sleep(Number(options.retryDelayMs ?? 50) * attempt);
    } catch (error) {
      if (attempt >= retries) throw error;
      attempt += 1; await sleep(Number(options.retryDelayMs ?? 50) * attempt);
    }
  }
}

function postingsFor(response) {
  const body = response?.data ?? response?.body;
  if (typeof body === 'string') { try { return arrayFrom(JSON.parse(body)); } catch { return []; } }
  return arrayFrom(body);
}

function classify(record, history, current) {
  if (!record.sourceType || !record.company || !record.title || !record.externalId || !record.sourceUrl) return { classification: 'INVALID_DISCOVERY', reason: 'missing canonical identity field' };
  if (!canonicalUrl(record.sourceUrl)) return { classification: 'INVALID_DISCOVERY', reason: 'non-canonical or aggregator source URL' };
  const id = String(record.externalId);
  const source = urlKey(record.sourceUrl);
  const application = urlKey(record.applicationLink);
  const key = exactIdentity(record);
  if (history.ids.has(id) || history.sourceUrls.has(source) || (application && history.applicationLinks.has(application))) return { classification: 'HISTORICAL_DUPLICATE', reason: 'externalId, sourceUrl, or applicationLink matched history' };
  const exactCurrent = current.find((candidate) => String(candidate.externalId) === id || urlKey(candidate.sourceUrl) === source || (application && urlKey(candidate.applicationLink) === application));
  if (exactCurrent) return { classification: 'CURRENT_BATCH_DUPLICATE', reason: 'exact identity already discovered in current batch' };
  const semanticCurrent = current.find((candidate) => exactIdentity(candidate) === key);
  if (semanticCurrent || history.keys.has(key)) return { classification: 'SEMANTIC_REVIEW', reason: 'same company/title/location with distinct exact requisition identity' };
  return { classification: 'NEW', reason: null };
}

function sourceFamilyCounts(records) { return Object.fromEntries(Object.entries(Object.groupBy(records, (record) => record.sourceType)).map(([key, value]) => [key, value.length])); }

export async function discoverEmployerBoards(boards, options = {}) {
  const configured = Array.isArray(boards) ? boards : [];
  const history = normalizeHistory(options.history ?? []);
  const transport = options.transport ?? defaultTransport;
  const maxRecords = options.maxRecords == null ? Infinity : Math.max(0, Number(options.maxRecords));
  const maxPerEmployer = options.maxPerEmployer == null ? Infinity : Math.max(0, Number(options.maxPerEmployer));
  const allowlist = options.sourceFamilyAllowlist?.map((value) => String(value).toUpperCase());
  const boardResults = new Array(configured.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= configured.length) return;
      const board = configured[index];
      const errors = validateBoardConfig(board);
      const family = sourceFamily(board);
      if (errors.length || (allowlist?.length && !allowlist.includes(family))) {
        boardResults[index] = { index, company: board?.company ?? null, sourceType: family, status: 'FAILED', reason: errors.join('; ') || 'source family not allowed', rawCount: 0, records: [] };
        continue;
      }
      try {
        const response = await fetchWithRetry(board, { ...options, transport });
        if (!response || response.status >= 400) throw new Error(`HTTP_${response?.status ?? 'unknown'}`);
        const raw = postingsFor(response);
        boardResults[index] = { index, company: board.company, sourceType: family, status: 'SUCCEEDED', reason: null, rawCount: raw.length, records: raw.map((item) => normalizeDiscoveryRecord(item, board)) };
      } catch (error) {
        boardResults[index] = { index, company: board?.company ?? null, sourceType: family, status: 'FAILED', reason: error.message, rawCount: 0, records: [] };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, Number(options.concurrency ?? 3)), 8, Math.max(1, configured.length)) }, worker));
  const rawRecords = boardResults.flatMap((result) => result?.records ?? []);
  const screenedRecords = [];
  const newRecords = [];
  const currentCandidates = [];
  const employerCounts = new Map();
  let hardStopSkipped = 0;
  let maxEmployerSkipped = 0;
  for (const record of rawRecords) {
    if (newRecords.length >= maxRecords) { hardStopSkipped += 1; continue; }
    const count = employerCounts.get(norm(record.company)) ?? 0;
    if (count >= maxPerEmployer) { maxEmployerSkipped += 1; screenedRecords.push({ ...record, discoveryClassification: 'MAX_PER_EMPLOYER', discoveryReason: 'max-per-employer reached' }); continue; }
    const decision = classify(record, history, currentCandidates);
    const screened = { ...record, discoveryClassification: decision.classification, discoveryReason: decision.reason };
    screenedRecords.push(screened);
    if (decision.classification === 'NEW') { newRecords.push(screened); currentCandidates.push(screened); employerCounts.set(norm(record.company), count + 1); }
    else if (decision.classification === 'SEMANTIC_REVIEW') currentCandidates.push(screened);
  }
  const failedBoards = boardResults.filter((result) => result?.status === 'FAILED');
  const report = {
    boardsConfigured: configured.length,
    boardsSucceeded: boardResults.filter((result) => result?.status === 'SUCCEEDED').length,
    boardsFailed: failedBoards.length,
    failedBoards,
    sourceFamilyCounts: sourceFamilyCounts(rawRecords),
    discoveredRaw: rawRecords.length,
    invalidDiscovery: screenedRecords.filter((record) => record.discoveryClassification === 'INVALID_DISCOVERY').length,
    historicalDuplicate: screenedRecords.filter((record) => record.discoveryClassification === 'HISTORICAL_DUPLICATE').length,
    currentBatchDuplicate: screenedRecords.filter((record) => record.discoveryClassification === 'CURRENT_BATCH_DUPLICATE').length,
    semanticReview: screenedRecords.filter((record) => record.discoveryClassification === 'SEMANTIC_REVIEW').length,
    acceptedNew: newRecords.length,
    acceptedForScreening: rawRecords.length - screenedRecords.filter((record) => record.discoveryClassification === 'INVALID_DISCOVERY').length - hardStopSkipped,
    screened: screenedRecords.filter((record) => !['INVALID_DISCOVERY', 'MAX_PER_EMPLOYER'].includes(record.discoveryClassification)).length,
    maxRecordsSkipped: hardStopSkipped,
    maxPerEmployerSkipped: maxEmployerSkipped,
    perEmployerCounts: Object.fromEntries([...employerCounts.entries()].sort()),
  };
  report.invariants = {
    boards: report.boardsConfigured === report.boardsSucceeded + report.boardsFailed,
    discovered: report.discoveredRaw === report.acceptedForScreening + report.invalidDiscovery + report.maxRecordsSkipped,
    screened: report.screened === report.acceptedNew + report.historicalDuplicate + report.currentBatchDuplicate + report.semanticReview,
  };
  report.invariantPass = Object.values(report.invariants).every(Boolean);
  return { records: newRecords, screenedRecords, boardResults, report };
}

export { canonicalUrl, exactIdentity, norm, sourceFamily, urlKey };
