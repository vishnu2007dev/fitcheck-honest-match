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

const DEFAULT_MODELS = ['openrouter/free'];
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
    'Apply the Honest Match Protocol to the inputs below. Return JSON only.',
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

async function callModel(model, messages, key, referer) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': referer,
      'X-Title': 'FitCheck Honest Match',
    },
    body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 4000 }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || `HTTP ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  const content = data?.choices?.[0]?.message?.content;
  return { content, model: data?.model || model };
}

export default async function handler(req, res) {
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

  for (const model of order) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { content, model: used } = await callModel(model, messages, key, referer);
        const raw = extractJson(content);
        const result = processResult(raw, posting, resume);
        if (!result.requirements.length) throw new Error('The model returned no requirements');
        res.status(200).json({ result, meta: { model: used, ms: Date.now() - started } });
        return;
      } catch (e) {
        errors.push(`${model}: ${e.message}`);
        if (e.status === 401 || e.status === 402) {
          res.status(502).json({ error: 'The AI key was rejected. Check OPENROUTER_API_KEY in the Vercel settings.' });
          return;
        }
      }
    }
  }
  res.status(502).json({ error: 'The free AI model did not return a usable answer. Try again in a moment, or view the sample result.', detail: errors.slice(-3) });
}
