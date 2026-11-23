// Honest Match Protocol v1.0 scoring engine.
// Deterministic: verifies receipts, then weighs evidence. Shared by the API and the UI.

export const PROTOCOL_VERSION = '1.0';
export const WEIGHTS = { required: 3, preferred: 1, implied: 1 };
export const LEVEL_VALUE = [0, 0.35, 0.7, 1];
export const LEVEL_NAME = ['None', 'Mentioned', 'Applied', 'Demonstrated'];

export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9+#%$' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// A quote counts as verified if it appears in the source, allowing for the
// model trimming punctuation or joining pieces with "...".
export function verifyQuote(quote, source) {
  if (!quote) return false;
  const src = norm(source);
  const parts = String(quote).split(/\.{3}|…/).map(norm).filter((p) => p.length >= 3);
  if (!parts.length) return false;
  if (parts.every((p) => src.includes(p))) return true;
  // Fallback: 90% of the quote's words appear, in order, inside one window of the source.
  const words = norm(quote).split(' ').filter(Boolean);
  if (words.length < 4) return false;
  const srcWords = src.split(' ');
  for (let start = 0; start < srcWords.length; start++) {
    if (srcWords[start] !== words[0]) continue;
    let i = 0, j = start, hits = 0;
    const limit = Math.min(srcWords.length, start + words.length * 2);
    while (i < words.length && j < limit) {
      if (srcWords[j] === words[i]) { hits++; i++; j++; }
      else if (srcWords[j + 1] === words[i]) { j++; }
      else { i++; }
    }
    if (hits / words.length >= 0.9) return true;
  }
  return false;
}

export function band(score) {
  if (score >= 80) return { label: 'Strong', tone: 'good' };
  if (score >= 60) return { label: 'Competitive', tone: 'good' };
  if (score >= 40) return { label: 'Stretch', tone: 'warn' };
  return { label: 'Long shot', tone: 'bad' };
}

const IMPORTANCE = ['required', 'preferred', 'implied'];
const GATE_STATUS = ['pass', 'fail', 'unclear'];

export function processResult(raw, posting, resume) {
  const reqs = Array.isArray(raw?.requirements) ? raw.requirements : [];
  const audit = { posting_quotes_checked: 0, posting_quotes_unverified: 0, resume_quotes_checked: 0, resume_quotes_rejected: 0 };

  const requirements = reqs.slice(0, 25).map((r, idx) => {
    const importance = IMPORTANCE.includes(r?.importance) ? r.importance : 'implied';
    let level = Math.max(0, Math.min(3, parseInt(r?.level, 10) || 0));
    const claimedLevel = level;
    const postingQuote = r?.posting_quote ? String(r.posting_quote) : '';
    let resumeQuote = r?.resume_quote ? String(r.resume_quote) : null;

    audit.posting_quotes_checked++;
    const postingVerified = verifyQuote(postingQuote, posting);
    if (!postingVerified) audit.posting_quotes_unverified++;

    let receipt = 'none';
    if (resumeQuote) {
      audit.resume_quotes_checked++;
      if (verifyQuote(resumeQuote, resume)) receipt = 'verified';
      else { receipt = 'rejected'; audit.resume_quotes_rejected++; level = 0; }
    } else if (level > 0) {
      receipt = 'missing';
      level = 0;
    }

    const weight = WEIGHTS[importance];
    const value = LEVEL_VALUE[level];
    return {
      id: r?.id || `R${idx + 1}`,
      text: String(r?.text || 'Requirement'),
      posting_quote: postingQuote,
      posting_verified: postingVerified,
      importance,
      category: r?.category || 'technical_skill',
      level,
      claimed_level: claimedLevel,
      resume_quote: resumeQuote,
      receipt,
      note: r?.note ? String(r.note) : '',
      gap_action: level <= 1 ? (r?.gap_action ? String(r.gap_action) : 'Build one small, real project that uses this, then describe it in one honest resume line.') : null,
      weight,
      points: weight * value,
    };
  });

  const totalWeight = requirements.reduce((s, r) => s + r.weight, 0);
  const earned = requirements.reduce((s, r) => s + r.points, 0);
  const score = totalWeight ? Math.round((100 * earned) / totalWeight) : 0;

  const gates = (Array.isArray(raw?.gates) ? raw.gates : []).slice(0, 6).map((g) => ({
    type: g?.type || 'other',
    status: GATE_STATUS.includes(g?.status) ? g.status : 'unclear',
    posting_quote: g?.posting_quote ? String(g.posting_quote) : '',
    posting_verified: verifyQuote(g?.posting_quote, posting),
    candidate_fact: g?.candidate_fact ? String(g.candidate_fact) : '',
    note: g?.note ? String(g.note) : '',
  }));
  // A gate whose posting quote cannot be found cannot block the candidate; downgrade it.
  gates.forEach((g) => { if (g.status === 'fail' && !g.posting_verified) { g.status = 'unclear'; g.note = (g.note + ' The rule could not be found word for word in the posting, so it was not treated as a block.').trim(); } });

  const defend = (Array.isArray(raw?.defend_questions) ? raw.defend_questions : []).slice(0, 6)
    .filter((q) => q && q.question)
    .map((q) => ({ resume_quote: q.resume_quote ? String(q.resume_quote) : '', question: String(q.question), verified: verifyQuote(q.resume_quote, resume) }));

  const by = (imp) => requirements.filter((r) => r.importance === imp);
  const met = (list) => list.filter((r) => r.level >= 2).length;

  return {
    protocol_version: PROTOCOL_VERSION,
    role_title: raw?.role_title ? String(raw.role_title) : 'This role',
    company: raw?.company ? String(raw.company) : null,
    score,
    band: band(score),
    eligible: !gates.some((g) => g.status === 'fail'),
    has_unclear_gate: gates.some((g) => g.status === 'unclear'),
    breakdown: {
      required: { met: met(by('required')), total: by('required').length },
      preferred: { met: met(by('preferred')), total: by('preferred').length },
      implied: { met: met(by('implied')), total: by('implied').length },
    },
    requirements,
    gates,
    defend_questions: defend,
    summary: raw?.summary ? String(raw.summary) : '',
    audit,
  };
}

// Pull the first JSON object out of a model reply, tolerating code fences or stray text.
export function extractJson(text) {
  if (!text) throw new Error('Empty model reply');
  let t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try { return JSON.parse(t); } catch (_) { /* fall through */ }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object in model reply');
  return JSON.parse(t.slice(start, end + 1));
}

// Strip email addresses, phone numbers and URLs with personal handles before text leaves the browser.
export function redact(text) {
  return String(text || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
    .replace(/(\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[phone removed]')
    .replace(/https?:\/\/(www\.)?linkedin\.com\/\S+/gi, '[link removed]');
}
