import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from 'framer-motion';
import { processResult, redact, LEVEL_NAME, WEIGHTS, LEVEL_VALUE } from '../lib/engine.js';
import { SAMPLE_POSTING, SAMPLE_RESUME, SAMPLE_PROFILE, SAMPLE_RAW } from './sample.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = ['2026', '2027', '2028', '2029', '2030', '2031'];
const SCHOOL_YEARS = ['First year (freshman)', 'Second year (sophomore)', 'Third year (junior)', 'Fourth year (senior)', 'Graduate student'];
const AUTH = ['US citizen or permanent resident', 'F-1 student, eligible for CPT', 'F-1 student, planning to use OPT', 'Will need visa sponsorship later', 'Prefer not to say'];
const STEPS = [
  { k: 'Extract', d: 'Pull every qualification out of the posting, word for word' },
  { k: 'Gate', d: 'Check graduation window, class year, work authorization, location' },
  { k: 'Rate', d: 'Grade each requirement 0 to 3 against your resume' },
  { k: 'Verify', d: 'Reject any receipt that is not really in your text' },
  { k: 'Score', d: 'Weigh the verified evidence with fixed rules' },
];
const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } };

/* ---------- small pieces ---------- */

function Spotlight({ className = '', children, as: Tag = 'div', ...rest }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return <Tag ref={ref} onMouseMove={onMove} className={`glass spot ${className}`} {...rest}>{children}</Tag>;
}

function CountUp({ to, duration = 1.4 }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v));
  const [val, setVal] = useState(0);
  useEffect(() => {
    const c = animate(mv, to, { duration, ease: [0.22, 1, 0.36, 1] });
    const unsub = rounded.on('change', setVal);
    return () => { c.stop(); unsub(); };
  }, [to]);
  return <>{val}</>;
}

function ScoreRing({ score, tone }) {
  const R = 78, C = 2 * Math.PI * R;
  return (
    <div className="ring" role="img" aria-label={`Fit score ${score} out of 100`}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b7bff" />
            <stop offset="55%" stopColor="#ff8fb1" />
            <stop offset="100%" stopColor="#ffb35c" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={R} className="ring-track" />
        <motion.circle
          cx="100" cy="100" r={R} className="ring-bar" stroke="url(#ringGrad)"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - score / 100) }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="ring-center">
        <div className="ring-num"><CountUp to={score} /></div>
        <div className="ring-sub">fit score</div>
      </div>
    </div>
  );
}

function LevelMeter({ level }) {
  return (
    <div className="meter" aria-label={`Evidence level ${level} of 3, ${LEVEL_NAME[level]}`}>
      {[1, 2, 3].map((i) => <span key={i} className={i <= level ? `on l${level}` : ''} />)}
      <em>{LEVEL_NAME[level]}</em>
    </div>
  );
}

function Chip({ tone = 'muted', children }) { return <span className={`chip ${tone}`}>{children}</span>; }

const GATE_LABEL = { graduation_window: 'Graduation window', class_year: 'Class year', work_authorization: 'Work authorization', location: 'Location', other: 'Eligibility' };
const RECEIPT = {
  verified: { tone: 'good', label: 'Receipt verified' },
  rejected: { tone: 'bad', label: 'Receipt rejected: not in your resume' },
  missing: { tone: 'bad', label: 'No receipt given' },
  none: { tone: 'muted', label: 'No evidence found' },
};

/* ---------- sections ---------- */

function Nav() {
  return (
    <header className="nav">
      <a href="#top" className="brand" aria-label="FitCheck home">
        <span className="logo" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M9 16.5l4.5 4.5L23 11" /></svg></span>
        FitCheck
      </a>
      <nav>
        <a href="#how">How it works</a>
        <a href="/SKILL.md" target="_blank" rel="noreferrer">Protocol</a>
        <a href="#match" className="nav-cta">Run a match</a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <motion.div {...fade} className="eyebrow"><span className="dot" /> Honest Match Protocol v1.0</motion.div>
      <motion.h1 {...fade} transition={{ ...fade.transition, delay: 0.05 }}>
        Know how you really fit.<br />Every score shows its <span className="shine">receipts.</span>
      </motion.h1>
      <motion.p {...fade} transition={{ ...fade.transition, delay: 0.12 }} className="hero-sub">
        Paste an internship posting and your resume. FitCheck rates every requirement against your own words,
        checks eligibility like graduation date and work authorization, and throws out any claim it cannot quote.
      </motion.p>
      <motion.div {...fade} transition={{ ...fade.transition, delay: 0.18 }} className="hero-actions">
        <a href="#match" className="btn primary">Run a match</a>
        <a href="#how" className="btn ghost">See the architecture</a>
      </motion.div>
      <motion.ul {...fade} transition={{ ...fade.transition, delay: 0.24 }} className="hero-points">
        <li><b>Receipts.</b> Every match and gap quotes the posting and your resume.</li>
        <li><b>Universal.</b> One protocol file any AI agent can follow.</li>
        <li><b>Honest.</b> It never tells you to stretch your resume.</li>
      </motion.ul>
    </section>
  );
}

function Field({ id, label, hint, children }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}{hint && <small>{hint}</small>}</span>
      {children}
    </label>
  );
}

function InputPanel({ form, setForm, onRun, onSample, busy }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const load = () => setForm((f) => ({ ...f, posting: SAMPLE_POSTING, resume: SAMPLE_RESUME, ...SAMPLE_PROFILE }));
  const ready = form.posting.trim().length >= 80 && form.resume.trim().length >= 80;
  return (
    <Spotlight className="panel input-panel" as="section" id="match" aria-labelledby="match-h">
      <div className="panel-head">
        <div>
          <div className="kicker">Step 1</div>
          <h2 id="match-h">Paste the posting and your resume</h2>
        </div>
        <button type="button" className="btn small ghost" onClick={load}>Load sample</button>
      </div>
      <div className="two">
        <Field id="posting" label="Job posting" hint={`${form.posting.length.toLocaleString()} / 15,000`}>
          <textarea id="posting" value={form.posting} onChange={set('posting')} maxLength={15000} placeholder="Paste the full posting, including basic and preferred qualifications" />
        </Field>
        <Field id="resume" label="Your resume" hint={`${form.resume.length.toLocaleString()} / 10,000`}>
          <textarea id="resume" value={form.resume} onChange={set('resume')} maxLength={10000} placeholder="Paste your resume as plain text" />
        </Field>
      </div>
      <div className="kicker" style={{ marginTop: 6 }}>Step 2 · A few questions the posting may care about</div>
      <div className="grid4">
        <Field id="gradMonth" label="Graduation month">
          <select id="gradMonth" value={form.gradMonth} onChange={set('gradMonth')}>{MONTHS.map((m) => <option key={m}>{m}</option>)}</select>
        </Field>
        <Field id="gradYear" label="Graduation year">
          <select id="gradYear" value={form.gradYear} onChange={set('gradYear')}>{YEARS.map((m) => <option key={m}>{m}</option>)}</select>
        </Field>
        <Field id="year" label="Year in school">
          <select id="year" value={form.year} onChange={set('year')}>{SCHOOL_YEARS.map((m) => <option key={m}>{m}</option>)}</select>
        </Field>
        <Field id="authorization" label="Work authorization">
          <select id="authorization" value={form.authorization} onChange={set('authorization')}>{AUTH.map((m) => <option key={m}>{m}</option>)}</select>
        </Field>
      </div>
      <div className="row-end">
        <Field id="location" label="Location preference" hint="optional">
          <input id="location" value={form.location} onChange={set('location')} placeholder="e.g. Phoenix, AZ or remote" />
        </Field>
        <label className="toggle" htmlFor="redact">
          <input id="redact" type="checkbox" checked={form.redact} onChange={set('redact')} />
          <span className="switch" aria-hidden="true" />
          <span>Remove email, phone and LinkedIn before sending</span>
        </label>
      </div>
      <div className="run-row">
        <button type="button" className="btn primary big" onClick={onRun} disabled={!ready || busy}>
          {busy ? 'Matching…' : 'Run honest match'}
        </button>
        <button type="button" className="btn ghost" onClick={onSample} disabled={busy}>See a sample result</button>
        <p className="fine">Your text goes to a free AI model through OpenRouter to run the match. Free models may keep inputs, so leave out anything private. Nothing is saved on this site.</p>
      </div>
    </Spotlight>
  );
}

function Loading({ seconds }) {
  const active = Math.min(STEPS.length - 1, Math.floor(seconds / 4));
  return (
    <motion.section {...fade} className="glass panel loading" aria-live="polite">
      <div className="kicker">Running the protocol · {seconds}s</div>
      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s.k} className={i < active ? 'done' : i === active ? 'now' : ''}>
            <span className="step-dot" />
            <div><b>{s.k}</b><span>{s.d}</span></div>
          </li>
        ))}
      </ol>
      <p className="fine">Free models can take 20 to 60 seconds.</p>
    </motion.section>
  );
}

function ReqCard({ r, i }) {
  const imp = { required: 'Required', preferred: 'Preferred', implied: 'Implied' }[r.importance];
  const rec = RECEIPT[r.receipt];
  return (
    <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i, duration: 0.4 }}
      className={`req glass ${r.level >= 2 ? 'is-met' : r.level === 1 ? 'is-thin' : 'is-gap'}`}>
      <div className="req-top">
        <h4>{r.text}</h4>
        <div className="req-tags">
          <Chip tone={r.importance === 'required' ? 'accent' : 'muted'}>{imp} · weight {r.weight}</Chip>
          <LevelMeter level={r.level} />
        </div>
      </div>
      <div className="receipts">
        <div className="rq">
          <span className="rq-label">Posting says {!r.posting_verified && <Chip tone="warn">quote not exact</Chip>}</span>
          <blockquote>“{r.posting_quote || 'No quote given'}”</blockquote>
        </div>
        <div className="rq">
          <span className="rq-label">Your resume says <Chip tone={rec.tone}>{rec.label}</Chip></span>
          {r.resume_quote
            ? <blockquote className={r.receipt === 'rejected' ? 'struck' : ''}>“{r.resume_quote}”</blockquote>
            : <blockquote className="empty">Nothing in your resume backs this up.</blockquote>}
        </div>
      </div>
      {r.receipt === 'rejected' && <p className="note bad">The model claimed level {r.claimed_level}, but this line is not in your resume, so the engine scored it as 0.</p>}
      {r.note && r.receipt !== 'rejected' && <p className="note">{r.note}</p>}
      {r.gap_action && <div className="gap"><b>Honest next step</b><p>{r.gap_action}</p></div>}
    </motion.article>
  );
}

function Results({ data, meta, isSample, onReset }) {
  const [filter, setFilter] = useState('all');
  const reqs = data.requirements;
  const list = useMemo(() => {
    const order = { required: 0, preferred: 1, implied: 2 };
    const sorted = [...reqs].sort((a, b) => order[a.importance] - order[b.importance] || a.level - b.level);
    if (filter === 'gaps') return sorted.filter((r) => r.level <= 1);
    if (filter === 'matches') return sorted.filter((r) => r.level >= 2);
    return sorted;
  }, [reqs, filter]);
  const gaps = reqs.filter((r) => r.level <= 1).length;
  const tone = data.band.tone;

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify({ ...data, meta }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'fitcheck-report.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <section className="results" id="results" aria-labelledby="res-h">
      {isSample && <div className="banner warn">Sample result: made-up posting, resume and model reply, run through the real scoring engine.</div>}
      {!data.eligible && <div className="banner bad">You do not meet at least one eligibility rule below. A high fit score does not change that.</div>}
      {data.eligible && data.has_unclear_gate && <div className="banner warn">One eligibility rule is unclear. Check it on the official posting before you apply.</div>}

      <motion.div {...fade} className="score-grid">
        <Spotlight className="panel score-card">
          <ScoreRing score={data.score} tone={tone} />
          <div className="score-meta">
            <div className="kicker">{data.company ? `${data.company} · ` : ''}Honest Match v{data.protocol_version}</div>
            <h2 id="res-h">{data.role_title}</h2>
            <div className="band-row"><Chip tone={tone}>{data.band.label}</Chip>{!data.eligible && <Chip tone="bad">Not eligible</Chip>}</div>
            <p className="summary">{data.summary}</p>
          </div>
        </Spotlight>
        <div className="side-stack">
          <Spotlight className="panel stat">
            <div className="kicker">Requirements met</div>
            {['required', 'preferred', 'implied'].map((k) => {
              const b = data.breakdown[k]; if (!b.total) return null;
              return (
                <div key={k} className="bar-row">
                  <span>{k[0].toUpperCase() + k.slice(1)}</span>
                  <div className="bar"><motion.i initial={{ width: 0 }} animate={{ width: `${(100 * b.met) / b.total}%` }} transition={{ duration: 1, delay: 0.3 }} /></div>
                  <b>{b.met}/{b.total}</b>
                </div>
              );
            })}
          </Spotlight>
          <Spotlight className="panel stat audit">
            <div className="kicker">Receipt audit</div>
            <p><b>{data.audit.resume_quotes_checked}</b> resume quotes checked, <b className={data.audit.resume_quotes_rejected ? 'bad-t' : ''}>{data.audit.resume_quotes_rejected}</b> rejected as not really in your resume.</p>
            <p className="fine">{meta?.model ? `Model: ${meta.model}` : 'Scored by the FitCheck engine'}{meta?.ms ? ` · ${(meta.ms / 1000).toFixed(1)}s` : ''}</p>
          </Spotlight>
        </div>
      </motion.div>

      {data.gates.length > 0 && (
        <div className="block">
          <h3>Eligibility</h3>
          <div className="gates">
            {data.gates.map((g, i) => (
              <Spotlight key={i} className={`gate panel g-${g.status}`}>
                <div className="gate-top"><b>{GATE_LABEL[g.type] || 'Eligibility'}</b><Chip tone={g.status === 'pass' ? 'good' : g.status === 'fail' ? 'bad' : 'warn'}>{g.status === 'pass' ? 'Pass' : g.status === 'fail' ? 'Does not fit' : 'Unclear'}</Chip></div>
                <blockquote>“{g.posting_quote}”</blockquote>
                <p className="fine">You: {g.candidate_fact}{g.note ? `. ${g.note}` : ''}</p>
              </Spotlight>
            ))}
          </div>
        </div>
      )}

      <div className="block">
        <div className="block-head">
          <h3>Requirement by requirement</h3>
          <div className="seg" role="tablist" aria-label="Filter requirements">
            {[['all', `All ${reqs.length}`], ['gaps', `Gaps ${gaps}`], ['matches', `Matches ${reqs.length - gaps}`]].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="reqs">
          <AnimatePresence mode="popLayout">{list.map((r, i) => <ReqCard key={r.id} r={r} i={i} />)}</AnimatePresence>
          {!list.length && <p className="fine">Nothing in this view.</p>}
        </div>
      </div>

      {data.defend_questions.length > 0 && (
        <div className="block">
          <h3>Be ready to defend these</h3>
          <div className="qs">
            {data.defend_questions.map((q, i) => (
              <Spotlight key={i} className="panel q">
                <span className="q-num">Q{i + 1}</span>
                <div><p className="q-text">{q.question}</p>{q.resume_quote && <p className="fine">About: “{q.resume_quote}”</p>}</div>
              </Spotlight>
            ))}
          </div>
        </div>
      )}

      <div className="run-row center">
        <button className="btn primary" onClick={onReset}>Run another match</button>
        <button className="btn ghost" onClick={downloadJson}>Download report (JSON)</button>
      </div>
    </section>
  );
}

function How() {
  const nodes = [
    ['Your inputs', 'Posting, resume, and profile answers. Contact details removed in the browser.'],
    ['SKILL.md protocol', 'One plain-text rule set: extract, gate, rate 0 to 3, quote everything, never stretch.'],
    ['Any LLM agent', 'Here a free OpenRouter model. Could be Ajax, Claude, GPT or a local model.'],
    ['Receipt verifier', 'Code checks every quote against your real text. Fake receipts score 0.'],
    ['Scoring engine', 'Fixed weights turn verified evidence into the same score for every agent.'],
  ];
  return (
    <section className="how" id="how" aria-labelledby="how-h">
      <div className="kicker">Architecture</div>
      <h2 id="how-h">The model reads. The rules decide.</h2>
      <p className="hero-sub">Most AI resume tools let the model invent a score. FitCheck splits the job: a portable protocol tells any agent what to look for and forces it to quote its evidence, then deterministic code verifies the quotes and does the math.</p>
      <div className="pipeline">
        {nodes.map(([t, d], i) => (
          <motion.div key={t} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: i * 0.08 }} className="glass node">
            <span className="node-i">{String(i + 1).padStart(2, '0')}</span>
            <b>{t}</b><p>{d}</p>
          </motion.div>
        ))}
      </div>
      <div className="how-grid">
        <Spotlight className="panel">
          <h3>Scoring rules</h3>
          <table className="tbl">
            <thead><tr><th>Evidence level</th><th>Value</th></tr></thead>
            <tbody>{LEVEL_NAME.map((n, i) => <tr key={n}><td>{i} · {n}</td><td>{LEVEL_VALUE[i]}</td></tr>)}</tbody>
          </table>
          <table className="tbl">
            <thead><tr><th>Importance</th><th>Weight</th></tr></thead>
            <tbody>{Object.entries(WEIGHTS).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody>
          </table>
          <p className="fine">Score = 100 × Σ(weight × value) ÷ Σ(weight). Any failed eligibility gate marks you not eligible.</p>
        </Spotlight>
        <Spotlight className="panel">
          <h3>Use it with any agent</h3>
          <p className="fine">Give the protocol to an agent as its instructions, then pass the posting and resume. Run its JSON through the engine for a comparable score.</p>
          <pre className="code"><code>{`const protocol = await fetch('/SKILL.md').then(r => r.text());

const reply = await anyAgent.chat([
  { role: 'system', content: protocol },
  { role: 'user', content: posting + resume + profile },
]);

const report = processResult(JSON.parse(reply), posting, resume);
// report.score, report.gates, report.requirements[].receipt`}</code></pre>
          <a className="btn small ghost" href="/SKILL.md" target="_blank" rel="noreferrer">Open SKILL.md</a>
        </Spotlight>
      </div>
    </section>
  );
}

/* ---------- app ---------- */

export default function App() {
  const [form, setForm] = useState({ posting: '', resume: '', gradMonth: 'December', gradYear: '2028', year: SCHOOL_YEARS[1], authorization: AUTH[0], location: '', redact: true });
  const [state, setState] = useState({ phase: 'idle' });
  const [seconds, setSeconds] = useState(0);
  const timer = useRef(null);

  const scrollTo = (id) => setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);

  const run = async () => {
    setState({ phase: 'loading' }); setSeconds(0);
    clearInterval(timer.current); timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    scrollTo('status');
    const resume = form.redact ? redact(form.resume) : form.resume;
    try {
      const r = await fetch('/api/match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posting: form.posting, resume, profile: { graduation: `${form.gradMonth} ${form.gradYear}`, year: form.year, authorization: form.authorization, location: form.location } }),
      });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); }
      catch {
        if (r.status === 404) throw new Error('The matching API was not found (404). If you are running this on your own computer, use `npx vercel dev` instead of `npm run dev`, or open the deployed site.');
        if (r.status === 504 || /timeout|timed out/i.test(text)) throw new Error('The AI model took longer than the server allows (timeout). Free models are sometimes slow. Try again, or see the sample result.');
        throw new Error(`The server sent back something unexpected (HTTP ${r.status}): ${text.slice(0, 140)}`);
      }
      if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
      // Re-verify on the client against the exact text sent.
      const result = processResult(data.result ? { ...data.result, requirements: data.result.requirements.map((x) => ({ ...x, level: x.claimed_level ?? x.level })) } : {}, form.posting, resume);
      setState({ phase: 'done', data: result, meta: data.meta, isSample: false });
    } catch (e) {
      setState({ phase: 'error', message: e.message });
    } finally {
      clearInterval(timer.current); scrollTo('status');
    }
  };

  const sample = () => {
    const data = processResult(SAMPLE_RAW, SAMPLE_POSTING, SAMPLE_RESUME);
    setState({ phase: 'done', data, meta: { model: 'sample reply (no model call)' }, isSample: true });
    scrollTo('status');
  };

  const reset = () => { setState({ phase: 'idle' }); scrollTo('match'); };

  return (
    <>
      <div className="aurora" aria-hidden="true"><i className="a1" /><i className="a2" /><i className="a3" /></div>
      <div className="grain" aria-hidden="true" />
      <Nav />
      <main className="wrap">
        <Hero />
        <InputPanel form={form} setForm={setForm} onRun={run} onSample={sample} busy={state.phase === 'loading'} />
        <div id="status" className="status-anchor" />
        <AnimatePresence mode="wait">
          {state.phase === 'loading' && <Loading key="l" seconds={seconds} />}
          {state.phase === 'error' && (
            <motion.div key="e" {...fade} className="glass panel error" role="alert">
              <b>That match did not finish.</b>
              <p>{state.message}</p>
              <div className="run-row"><button className="btn primary" onClick={run}>Try again</button><button className="btn ghost" onClick={sample}>See a sample result</button></div>
            </motion.div>
          )}
          {state.phase === 'done' && <motion.div key="d" {...fade}><Results data={state.data} meta={state.meta} isSample={state.isSample} onReset={reset} /></motion.div>}
        </AnimatePresence>
        <How />
      </main>
      <footer className="foot wrap">
        <p>FitCheck is a class project for The Agentic Self by Vishnu Uppalapati. It is a practice tool, not a hiring prediction. Always confirm eligibility on the official posting.</p>
      </footer>
    </>
  );
}
