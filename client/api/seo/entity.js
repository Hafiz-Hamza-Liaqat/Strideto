/* global process */

import {
  buildEntityDiscovery,
  buildEntityJsonLd,
  buildNotFoundDiscovery,
  renderEntitySeoShell,
} from '../../../shared/seo/entityDiscovery.js';

const API_ORIGIN = (process.env.STRIDETO_PUBLIC_API_ORIGIN || 'https://api.strideto.com').replace(/\/$/, '');
const CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';
const NO_STORE = 'no-store';

function requestOrigin() {
  const host = process.env.VERCEL_URL
    || process.env.VERCEL_BRANCH_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL
    || 'www.strideto.com';
  return `https://${String(host).replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
}

async function fetchWithTimeout(url, options, timeoutMs = 5000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
}

function write(res, html, status, cache = CACHE) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.end(html);
}

export async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    return res.end('Method Not Allowed');
  }
  const type = String(req.query?.type || '').toLowerCase();
  const slug = String(req.query?.slug || '').trim();
  if (!/^(scholarship|blog|institution|test|program)$/.test(type) || !/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
    return write(res, renderEntitySeoShell('', buildNotFoundDiscovery(type, slug)), 404, 'public, max-age=0, s-maxage=30');
  }

  const [shellResult, entityResult] = await Promise.allSettled([
    fetchWithTimeout(`${requestOrigin()}/index.html`, { headers: { accept: 'text/html' } }),
    fetchWithTimeout(`${API_ORIGIN}/api/seo/entity/${encodeURIComponent(type)}/${encodeURIComponent(slug)}`, { headers: { accept: 'application/json' } }),
  ]);
  if (shellResult.status === 'rejected') return write(res, 'Public page temporarily unavailable', 502, NO_STORE);
  const shellResponse = shellResult.value;
  const baseHtml = await shellResponse.text();
  if (!shellResponse.ok) return write(res, baseHtml, 502, NO_STORE);
  if (entityResult.status === 'rejected') return write(res, renderEntitySeoShell(baseHtml, buildNotFoundDiscovery(type, slug)), 502, NO_STORE);
  const response = entityResult.value;
  if (!response.ok) {
    const status = response.status === 404 ? 404 : 502;
    const discovery = buildNotFoundDiscovery(type, slug);
    return write(res, renderEntitySeoShell(baseHtml, discovery), status, status === 404 ? 'public, max-age=0, s-maxage=30' : NO_STORE);
  }
  let entity;
  try {
    entity = await response.json();
  } catch {
    return write(res, renderEntitySeoShell(baseHtml, buildNotFoundDiscovery(type, slug)), 502, NO_STORE);
  }
  if (!entity || typeof entity !== 'object' || entity.type !== type || entity.slug !== slug) {
    return write(res, renderEntitySeoShell(baseHtml, buildNotFoundDiscovery(type, slug)), 502, NO_STORE);
  }
  const discovery = buildEntityDiscovery(type, {
    ...entity,
    jsonLd: buildEntityJsonLd(type, entity),
  });
  if (!discovery) return write(res, renderEntitySeoShell(baseHtml, buildNotFoundDiscovery(type, slug)), 404, 'public, max-age=0, s-maxage=30');
  return write(res, renderEntitySeoShell(baseHtml, discovery), 200);
}

export default handler;
