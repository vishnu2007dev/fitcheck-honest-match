// POST /api/match  ->  runs the Honest Match Protocol with any OpenRouter model, then scores it.
// The API key lives only in the server environment variable OPENROUTER_API_KEY.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { processResult, extractJson, PROTOCOL_VERSION } from '../lib/engine.js';

// The protocol is read from the same SKILL.md the site publishes at /SKILL.md (bundled via vercel.json includeFiles).
let PROTOCOL = '';
function loadProtocol() {
  if (!PROTOCOL) PROTOCOL = readFileSync(path.join(process.cwd(), 'public', 'SKILL.md'), 'utf8');
  return PROTOCOL;
}

// Fast, non-thinking free models first; the openrouter/free router (random free model) is the last resort.
const DEFAULT_MODELS = [
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-26b-a4b-it:free',
  'baidu/ernie-5.5-flash-preview:free',
  'openrouter/free',
];
const MAX_POSTING = 15000;
const MAX_RESUME = 10000;

// Best-effort rate limit per server instance, to protect a free key on a public link.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 10;
}

function buildUserMessage({ posting, resume, profile }) {
  const p = profile || {};
  return [
    'Apply the Honest Match Protocol to the inputs below. Return JSON only, with no reasoning text.',
    'Keep it compact so you answer fast: at most 10 requirements, notes under 20 words, gap actions under 35 words, 3 defend questions.',
    '',
    '=== CANDIDATE PROFILE (answers from the candidate) ===',
    `Expected graduation: ${p.graduation || 'not given'}`,
    `Current year in school: ${p.year || 'not given'}`,
    `Work authorization: ${p.authorization || 'not given'}`,
    `Location preference: ${p.location || 'not given'}`,
    '',
    '=== JOB POSTING ===',
    posting,
    '',
    '=== RESUME ===',
    resume,
  ].join('\n');
}

async function callModel(model, messages, key, referer, timeoutMs, noThinking = true) {
  // OpenRouter sends headers right away and keeps the body open while the model writes,
  // so the abort timer has to cover reading the body, not just the headers.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let status = 0, text = '';
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': referer,
        'X-Title': 'FitCheck Honest Match',
      },
      body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 3000, ...(noThinking ? { reasoning: { enabled: false } } : {}) }),
    });
    status = r.status;
    text = await r.text();
  } catch (e) {
    const err = new Error(e.name === 'AbortError' ? `No answer within ${Math.round(timeoutMs / 1000)}s` : `Could not reach OpenRouter: ${e.message}`);
    err.status = e.name === 'AbortError' ? 504 : 502;
    throw err;
  } finally {
    clearTimeout(t);
  }
  let data = {};
  try { data = JSON.parse(text); } catch { /* keep empty */ }
  if (status < 200 || status >= 300 || data?.error) {
    const err = new Error(data?.error?.message || `HTTP ${status}`);
    err.status = data?.error?.code && Number(data.error.code) ? Number(data.error.code) : status;
    throw err;
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content || !String(content).trim()) {
    const err = new Error('Empty model reply');
    err.status = 204;
    throw err;
  }
  return { content, model: data?.model || model };
}

export default async function handler(req, res) {
  try {
    await run(req, res);
  } catch (e) {
    console.error('match failed', e);
    if (!res.headersSent) res.status(500).json({ error: `Server error: ${e.message}` });
  }
}

// Vercel stops the function at 120 s (vercel.json); keep the whole run under this budget so we always answer with JSON.
const BUDGET_MS = 110000;

async function run(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, protocol_version: PROTOCOL_VERSION, key_configured: Boolean(process.env.OPENROUTER_API_KEY) });
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST.' }); return; }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) { res.status(503).json({ error: 'The AI key is not set up on this site yet. Try the sample result instead.' }); return; }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) { res.status(429).json({ error: 'Too many matches from this connection. Wait a few minutes and try again.' }); return; }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const posting = String(body?.posting || '').trim();
  const resume = String(body?.resume || '').trim();
  if (posting.length < 80) { res.status(400).json({ error: 'Paste the full job posting (at least a few lines).' }); return; }
  if (resume.length < 80) { res.status(400).json({ error: 'Paste your resume text (at least a few lines).' }); return; }
  if (posting.length > MAX_POSTING || resume.length > MAX_RESUME) { res.status(400).json({ error: 'That is longer than this demo accepts. Trim the posting or resume and try again.' }); return; }

  const messages = [
    { role: 'system', content: loadProtocol() },
    { role: 'user', content: buildUserMessage({ posting, resume, profile: body?.profile }) },
  ];
  const models = (process.env.OPENROUTER_MODEL || '').split(',').map((s) => s.trim()).filter(Boolean);
  const order = models.length ? models : DEFAULT_MODELS;
  const referer = `https://${req.headers.host || 'fitcheck.vercel.app'}`;
  const started = Date.now();
  const errors = [];

  for (let i = 0; i < order.length; i++) {
    const model = order[i];
    const left = BUDGET_MS - (Date.now() - started);
    if (left < 6000) break;
    // Give each model a slice so slower ones cannot use up the whole budget; the last one gets what is left.
    const slice = i === order.length - 1 ? left : Math.min(left, 35000);
    for (const noThinking of [true, false]) {
      try {
        const { content, model: used } = await callModel(model, messages, key, referer, slice, noThinking);
        const raw = extractJson(content);
        const result = processResult(raw, posting, resume);
        if (!result.requirements.length) throw new Error('The model returned no requirements');
        res.status(200).json({ result, meta: { model: used, ms: Date.now() - started } });
        return;
      } catch (e) {
        errors.push(`${model}: ${e.message}`);
        console.error('model attempt failed', model, e.status || '', e.message);
        if (e.status === 401 || e.status === 402) {
          res.status(502).json({ error: 'The AI key was rejected. Check OPENROUTER_API_KEY in the Vercel settings.' });
          return;
        }
        // Only retry the same model without the thinking switch if it rejected the request itself.
        if (!(noThinking && e.status === 400)) break;
      }
    }
  }
  const last = errors[errors.length - 1] || 'no attempt finished';
  res.status(502).json({ error: `The free AI model did not return a usable answer (${last}). Try again in a moment, or view the sample result.`, detail: errors.slice(-3) });
}
