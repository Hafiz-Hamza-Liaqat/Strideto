/* global process */

import { renderJobShell, renderSeoShell } from '../../../shared/seo/jobHtmlShell.js';
import { fetchPublicSpaShell } from './_shared/publicSpaShell.js';

const API_ORIGIN = (process.env.STRIDETO_PUBLIC_API_ORIGIN || 'https://api.strideto.com').replace(/\/$/, '');

async function fetchWithTimeout(url, options, timeoutMs = 5000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
}

function writeShell(res, html, status, cacheControl) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.end(html);
}

export async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    return res.end('Method Not Allowed');
  }

  const slug = String(req.query?.slug || '').trim();
  if (!slug || /[\\/?#]/.test(slug)) return res.status(404).end('Not Found');

  const [shellResult, jobResult] = await Promise.allSettled([
    fetchPublicSpaShell(),
    fetchWithTimeout(`${API_ORIGIN}/api/seo/jobs/${encodeURIComponent(slug)}`, { headers: { accept: 'application/json' } }),
  ]);
  if (shellResult.status === 'rejected') {
    return writeShell(res, 'Job page temporarily unavailable', 502, 'no-store');
  }
  const baseHtml = shellResult.value;

  if (jobResult.status === 'rejected') {
    return writeShell(res, baseHtml, 502, 'public, s-maxage=30, stale-while-revalidate=60');
  }
  const jobResponse = jobResult.value;
  if (!jobResponse.ok) {
    const status = jobResponse.status === 404 ? 404 : 502;
    const notFound = status === 404;
    const errorShell = renderSeoShell(baseHtml, {
      path: `/jobs/${slug}`,
      title: notFound ? 'Job not found | STRIDETO' : 'Job temporarily unavailable | STRIDETO',
      description: notFound ? 'The requested Job could not be found.' : 'The requested Job is temporarily unavailable.',
      robots: 'noindex, follow',
    });
    return writeShell(res, errorShell, status, 'public, s-maxage=30, stale-while-revalidate=60');
  }

  const job = await jobResponse.json();
  return writeShell(res, renderJobShell(baseHtml, job), 200, 'public, s-maxage=60, stale-while-revalidate=300');
}

export default handler;
