import { mapExplicitLeverCommitment } from '../wave7-lever-type.mjs';
import { parseJobSource, normalizePunctuation } from './job-source-structural-parser.mjs';

export const HYDRATION_STATUS = Object.freeze({
  HYDRATED: 'HYDRATED',
  SOURCE_THIN_OK: 'SOURCE_THIN_OK',
  SOURCE_UNAVAILABLE: 'SOURCE_UNAVAILABLE',
  APPLICATION_UNAVAILABLE: 'APPLICATION_UNAVAILABLE',
  IDENTITY_MISMATCH: 'IDENTITY_MISMATCH',
  CLOSED_OR_FILLED: 'CLOSED_OR_FILLED',
  UNSUPPORTED_SOURCE: 'UNSUPPORTED_SOURCE',
  EXTRACTION_INCOMPLETE: 'EXTRACTION_INCOMPLETE',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_EMPLOYMENT_TYPE: 'MISSING_EMPLOYMENT_TYPE',
  UNSUPPORTED_EMPLOYMENT_TYPE: 'UNSUPPORTED_EMPLOYMENT_TYPE',
});

const SUPPORTED_TYPES = new Set(['full-time', 'part-time', 'contract', 'internship']);
const SUPPORTED_JOB_TYPES = new Set(['Government', 'Private', 'Internship']);
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_USER_AGENT = 'STRIDETO-job-detail-hydrator/1.0';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function asText(value) {
  return normalizePunctuation(String(value ?? ''));
}

function normalized(value) {
  return asText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') ?? null;
}

function sourceFamily(record) {
  const explicit = String(record.sourceType ?? record.ecosystem ?? '').toLowerCase();
  const url = String(record.sourceUrl ?? '').toLowerCase();
  if (explicit.includes('greenhouse') || url.includes('greenhouse.io')) return 'GREENHOUSE';
  if (explicit.includes('lever') || url.includes('lever.co')) return 'LEVER';
  if (explicit.includes('workday') || url.includes('myworkdayjobs.com')) return 'WORKDAY';
  if (explicit.includes('smartrecruiters') || url.includes('smartrecruiters.com')) return 'SMARTRECRUITERS';
  if (explicit.includes('employer') || explicit.includes('career') || explicit.includes('direct')) return 'EMPLOYER_CAREERS';
  if (explicit && !/^https?:\/\//.test(explicit)) return null;
  if (/^https?:\/\//i.test(url)) return 'EMPLOYER_CAREERS';
  return null;
}

function isAllowedSourceUrl(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !/(?:linkedin|indeed|glassdoor|ziprecruiter|jooble|talent\.com)/i.test(url.hostname);
  } catch {
    return false;
  }
}

function isGenericCareersUrl(value) {
  try {
    const url = new URL(value);
    const path = `${url.pathname}${url.search}`.toLowerCase();
    return /\/(?:careers?|jobs?|opportunities?)(?:\/?)?(?:\?|$)/.test(path) && !/[0-9a-f]{6,}|[?&](?:gh_jid|jobid|id)=/i.test(path);
  } catch {
    return true;
  }
}

function hasClosedLanguage(value) {
  return /\b(?:closed|expired|removed|filled|no longer available|position has been filled|job is no longer accepting applications|posting is no longer active)\b/i.test(asText(value));
}

function normalizeType(value, family) {
  if (!value) return null;
  if (family === 'LEVER') {
    const leverValue = mapExplicitLeverCommitment(value);
    if (leverValue) return leverValue;
  }
  const raw = asText(value).toLowerCase();
  if (/^full[ -]?time(?:\s|$)/.test(raw)) return 'full-time';
  if (/^part[ -]?time(?:\s|$)/.test(raw)) return 'part-time';
  if (/^contract(?:or)?(?:\s|$)/.test(raw)) return 'contract';
  if (/^intern(?:ship)?(?:\s|$)/.test(raw)) return 'internship';
  return null;
}

function explicitType(detail, record, family, rawBody) {
  const candidates = [
    detail?.employmentType,
    detail?.employment_type,
    detail?.commitment,
    detail?.categories?.commitment,
    detail?.type,
    record.explicitType,
    record.employmentType,
    record.employmentTypeEvidence,
  ];
  for (const value of candidates) {
    const mapped = normalizeType(value, family);
    if (mapped) return mapped;
    if (value) return null;
  }
  const bodyMatch = asText(rawBody).match(/\b(full[ -]?time|part[ -]?time|contract(?:or)?|intern(?:ship)?)\b/i);
  return normalizeType(bodyMatch?.[1], family);
}

function explicitJobType(detail, record) {
  const value = firstValue(detail?.jobType, detail?.job_type, record.jobType);
  return SUPPORTED_JOB_TYPES.has(value) ? value : null;
}

function getDetailText(detail, pageBody) {
  if (typeof detail === 'string') return detail;
  return firstValue(
    detail?.content,
    detail?.descriptionBody,
    detail?.description,
    detail?.descriptionPlain,
    detail?.body,
    pageBody,
  ) ?? '';
}

function getTitle(detail, record) {
  return asText(firstValue(detail?.title, detail?.text, record.title));
}

function getCompany(detail, record) {
  return asText(firstValue(detail?.company_name, detail?.company?.name, detail?.company, record.company));
}

function getLocation(detail, record) {
  return asText(firstValue(
    detail?.location?.name,
    detail?.location,
    detail?.categories?.location,
    detail?.categories?.allLocations?.join(' / '),
    record.location,
  ));
}

function identityMatches(record, detail, sourceBody) {
  const title = getTitle(detail, record);
  const company = getCompany(detail, record);
  const location = getLocation(detail, record);
  const titleMatch = !record.title || normalized(title) === normalized(record.title);
  const companyMatch = !record.company || normalized(company) === normalized(record.company);
  const recordLocation = normalized(record.location);
  const locationMatch = !recordLocation || !location || normalized(location).includes(recordLocation) || recordLocation.includes(normalized(location));
  return {
    value: Boolean(titleMatch && companyMatch && locationMatch),
    titleMatch,
    companyMatch,
    locationMatch,
    sourceHasIdentity: Boolean(title || company || sourceBody),
  };
}

function validateInput(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) errors.push('record must be an object');
  for (const field of ['company', 'title', 'externalId', 'sourceUrl']) if (!record?.[field]) errors.push(`missing ${field}`);
  if (record?.sourceUrl && !isAllowedSourceUrl(record.sourceUrl)) errors.push('sourceUrl must be an allowed HTTP(S) canonical source');
  if (record?.applicationLink && !isAllowedSourceUrl(record.applicationLink)) errors.push('applicationLink must be an allowed HTTP(S) URL');
  return errors;
}

function requestDescriptor(record, family) {
  if (family === 'GREENHOUSE' && record.board && record.externalId) {
    return { url: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(record.board)}/jobs/${encodeURIComponent(record.externalId)}`, responseType: 'json' };
  }
  if (family === 'LEVER' && record.board && record.externalId) {
    return { url: `https://api.lever.co/v0/postings/${encodeURIComponent(record.board)}/${encodeURIComponent(record.externalId)}?mode=json`, responseType: 'json' };
  }
  return { url: record.detailUrl || record.sourceUrl, responseType: 'html' };
}

async function defaultTransport({ url, responseType, signal, userAgent }) {
  const response = await fetch(url, { signal, redirect: 'follow', headers: { accept: responseType === 'json' ? 'application/json' : 'text/html,application/xhtml+xml', 'user-agent': userAgent } });
  const body = await response.text();
  let data = body;
  if (responseType === 'json') {
    try { data = JSON.parse(body); } catch { data = null; }
  }
  return { status: response.status, url: response.url || url, body, data, headers: response.headers };
}

async function requestWithRetry(descriptor, options) {
  const retries = Math.max(0, Number(options.retries ?? 2));
  let attempt = 0;
  while (true) {
    try {
      const response = await options.transport({ ...descriptor, signal: AbortSignal.timeout(options.timeoutMs ?? 12000), userAgent: options.userAgent ?? DEFAULT_USER_AGENT });
      if (!TRANSIENT_STATUSES.has(response.status) || attempt >= retries) return response;
      attempt += 1;
      await sleep(Number(options.retryDelayMs ?? 50) * attempt);
    } catch (error) {
      if (attempt >= retries) throw error;
      attempt += 1;
      await sleep(Number(options.retryDelayMs ?? 50) * attempt);
    }
  }
}

function responseBody(response) {
  return response?.data ?? response?.body ?? '';
}

function detailObject(response) {
  const body = responseBody(response);
  return body && typeof body === 'object' ? body : {};
}

function applicationUrl(detail, record) {
  return firstValue(detail?.applyUrl, detail?.applicationUrl, detail?.apply_url, record.applicationLink);
}

function sourceBackedLocation(detail, record) {
  const value = getLocation(detail, record);
  return value || null;
}

function resultBase(record, family) {
  return {
    title: record.title ?? '', company: record.company ?? '', externalId: String(record.externalId ?? ''),
    sourceUrl: record.sourceUrl ?? '', applicationLink: record.applicationLink ?? null,
    sourceType: family, location: record.location ?? null, country: record.country ?? null,
    countryCode: record.countryCode ?? null, state: record.state ?? record.region ?? null,
    region: record.region ?? null, city: record.city ?? null, type: null, jobType: null,
    workMode: null, salary: null, currency: null, deadline: null, openings: null,
    description: '', responsibilities: [], requirements: [], skills: [], benefits: [],
    experience: [], education: [], locationEligibility: null, unmappedHeadings: [],
    extractionClassification: null, sourceLive: false, applicationLive: false, identityMatch: false,
    hydrationStatus: HYDRATION_STATUS.INVALID_INPUT, hydrationReason: null,
  };
}

export function validateDiscoveryRecord(record) {
  return validateInput(record);
}

export async function hydrateJobDetail(record, options = {}) {
  const errors = validateInput(record);
  const family = sourceFamily(record ?? {});
  const result = { ...resultBase(record ?? {}, family), input: { ...(record ?? {}) } };
  if (errors.length) return { ...result, hydrationStatus: HYDRATION_STATUS.INVALID_INPUT, hydrationReason: errors.join('; ') };
  if (isGenericCareersUrl(record.sourceUrl)) return { ...result, hydrationStatus: HYDRATION_STATUS.SOURCE_UNAVAILABLE, hydrationReason: 'sourceUrl is a generic careers/jobs landing page, not an exact vacancy' };
  const allowlist = options.sourceFamilyAllowlist;
  if (Array.isArray(allowlist) && allowlist.length && !allowlist.map(String).map((v) => v.toUpperCase()).includes(family)) {
    return { ...result, hydrationStatus: HYDRATION_STATUS.UNSUPPORTED_SOURCE, hydrationReason: `source family ${family ?? 'UNKNOWN'} is not allowed` };
  }
  if (!family) return { ...result, hydrationStatus: HYDRATION_STATUS.UNSUPPORTED_SOURCE, hydrationReason: 'source family could not be identified' };
  const transport = options.transport ?? defaultTransport;
  let detailResponse;
  try {
    detailResponse = await requestWithRetry(requestDescriptor(record, family), { ...options, transport });
  } catch (error) {
    return { ...result, hydrationStatus: HYDRATION_STATUS.SOURCE_UNAVAILABLE, hydrationReason: error.message };
  }
  if (!detailResponse || detailResponse.status >= 400 || detailResponse.status === 0) {
    return { ...result, hydrationStatus: detailResponse?.status === 404 ? HYDRATION_STATUS.CLOSED_OR_FILLED : HYDRATION_STATUS.SOURCE_UNAVAILABLE, hydrationReason: `source HTTP ${detailResponse?.status ?? 'unknown'}` };
  }
  const detail = detailObject(detailResponse);
  const sourceUrl = record.sourceUrl;
  let sourceResponse = detailResponse;
  if (sourceUrl && sourceUrl !== detailResponse.url) {
    try { sourceResponse = await requestWithRetry({ url: sourceUrl, responseType: 'html' }, { ...options, transport }); }
    catch (error) { return { ...result, hydrationStatus: HYDRATION_STATUS.SOURCE_UNAVAILABLE, hydrationReason: error.message }; }
  }
  const sourceBody = getDetailText(detail, sourceResponse.body);
  const title = getTitle(detail, record);
  const company = getCompany(detail, record);
  const location = sourceBackedLocation(detail, record);
  const identity = identityMatches(record, detail, sourceBody);
  const type = explicitType(detail, record, family, sourceBody);
  const jobType = explicitJobType(detail, record);
  const parsed = parseJobSource(sourceBody);
  const hydrated = { ...result, title, company, sourceUrl, location, country: firstValue(detail.country, record.country), countryCode: firstValue(detail.countryCode, record.countryCode), state: firstValue(detail.state, detail.region, record.state, record.region), region: firstValue(detail.region, record.region), city: firstValue(detail.city, record.city), applicationLink: applicationUrl(detail, record), type, jobType, workMode: firstValue(detail.workMode, detail.work_mode, record.workMode), salary: firstValue(detail.salary, record.salary), currency: firstValue(detail.currency, record.currency), deadline: firstValue(detail.deadline, detail.closeDate, record.deadline), openings: firstValue(detail.openings, record.openings), description: sourceBody, responsibilities: parsed.responsibilities, requirements: parsed.requirements, skills: parsed.skills, benefits: parsed.benefits, experience: parsed.experience, education: parsed.education, locationEligibility: firstValue(detail.locationEligibility, record.locationEligibility), unmappedHeadings: parsed.unmappedHeadings, extractionClassification: parsed.extractionClassification, sourceLive: sourceResponse.status >= 200 && sourceResponse.status < 300, identityMatch: identity.value, typeEvidence: type ? firstValue(detail.employmentType, detail.employment_type, detail.commitment, detail.categories?.commitment, record.explicitType, record.employmentType) : null };
  if (hasClosedLanguage(sourceBody) || hasClosedLanguage(detailResponse.body)) return { ...hydrated, hydrationStatus: HYDRATION_STATUS.CLOSED_OR_FILLED, hydrationReason: 'source contains closed/filled language' };
  if (!identity.value) return { ...hydrated, hydrationStatus: HYDRATION_STATUS.IDENTITY_MISMATCH, hydrationReason: `identity mismatch: title=${identity.titleMatch}, company=${identity.companyMatch}, location=${identity.locationMatch}` };
  if (!type) return { ...hydrated, hydrationStatus: HYDRATION_STATUS.MISSING_EMPLOYMENT_TYPE, hydrationReason: 'no explicit supported employment type was found' };
  if (parsed.extractionClassification === 'EXTRACTION_INCOMPLETE' && !options.diagnosticOnly) return { ...hydrated, hydrationStatus: HYDRATION_STATUS.EXTRACTION_INCOMPLETE, hydrationReason: 'shared structural parser classified source as EXTRACTION_INCOMPLETE' };
  if (!hydrated.applicationLink || isGenericCareersUrl(hydrated.applicationLink)) return { ...hydrated, hydrationStatus: HYDRATION_STATUS.APPLICATION_UNAVAILABLE, hydrationReason: 'exact application route is missing or generic careers URL' };
  let applicationResponse;
  try { applicationResponse = await requestWithRetry({ url: hydrated.applicationLink, responseType: 'html' }, { ...options, transport }); }
  catch (error) { return { ...hydrated, hydrationStatus: HYDRATION_STATUS.APPLICATION_UNAVAILABLE, hydrationReason: error.message }; }
  const applicationLive = applicationResponse.status >= 200 && applicationResponse.status < 400 && !isGenericCareersUrl(applicationResponse.url || hydrated.applicationLink);
  if (!applicationLive) return { ...hydrated, applicationLive: false, hydrationStatus: HYDRATION_STATUS.APPLICATION_UNAVAILABLE, hydrationReason: `application HTTP ${applicationResponse.status}` };
  const finalStatus = parsed.extractionClassification === 'SOURCE_THIN_OK' ? HYDRATION_STATUS.SOURCE_THIN_OK : HYDRATION_STATUS.HYDRATED;
  return { ...hydrated, applicationLive: true, hydrationStatus: finalStatus, hydrationReason: null };
}

export async function hydrateJobDetails(records, options = {}) {
  const input = Array.isArray(records) ? records : [];
  const concurrency = Math.max(1, Math.min(Number(options.concurrency ?? 3), Number(options.maxConcurrency ?? 8)));
  const maxRecords = options.maxRecords == null ? input.length : Math.max(0, Number(options.maxRecords));
  const selected = input.slice(0, maxRecords);
  const output = new Array(selected.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= selected.length) return;
      output[index] = await hydrateJobDetail(selected[index], options);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, worker));
  return output;
}

export function summarizeHydration(records) {
  return Object.fromEntries([...new Set(records.map((record) => record.hydrationStatus))].sort().map((status) => [status, records.filter((record) => record.hydrationStatus === status).length]));
}
