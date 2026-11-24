import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, animate, useMotionValue } from 'framer-motion';
import { processResult, redact, LEVEL_NAME, WEIGHTS, LEVEL_VALUE } from '../lib/engine.js';
import { SAMPLE_POSTING, SAMPLE_RESUME, SAMPLE_PROFILE, SAMPLE_RAW } from './sample.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = ['2026', '2027', '2028', '2029', '2030', '2031'];
const SCHOOL_YEARS = ['First year', 'Second year', 'Third year', 'Fourth year', 'Graduate student'];
const AUTH = ['US citizen or permanent resident', 'F-1 student, eligible for CPT', 'F-1 student, planning to use OPT', 'Will need visa sponsorship later', 'Prefer not to say'];
const STEPS = [
  ['Reading the posting', 'Listing every qualification word for word'],
  ['Checking eligibility', 'Graduation window, work authorization, location'],
  ['Rating your evidence', 'Each requirement from 0 to 3 against your resume'],
  ['Verifying quotes', 'Any quote not in your resume scores 0'],
  ['Scoring', 'Fixed weights, same rules for every model'],
];
const GATE_LABEL = { graduation_window: 'Graduation window', class_year: 'Class year', work_authorization: 'Work authorization', location: 'Location', other: 'Eligibility' };
const IMP_LABEL = { required: 'Required', preferred: 'Preferred', implied: 'Implied' };
const ease = [0.22, 1, 0.36, 1];

/* ---------- small pieces ---------- */

function Count({ to }) {
  const mv = useMotionValue(0);
  const [v, setV] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setV(to); return; }
    const c = animate(mv, to, { duration: 1.1, ease, onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [to]);
  return <>{v}</>;
}

function Meter({ level }) {
  return (
    <span className="meter" aria-label={`Evidence ${level} of 3, ${LEVEL_NAME[level]}`}>
      <span className="meter__bars" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={i <= level ? `on l${level}` : ''} />)}</span>
      {LEVEL_NAME[level]}
    </span>
  );
}

function Mark({ children, struck }) {
  return <mark className={struck ? 'hl hl--struck' : 'hl'}>{children}</mark>;
}

/* ---------- hero product frame (real UI, static) ---------- */

function HeroFrame() {
  return (
    <motion.div className="frame" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25, ease }} aria-label="Example of a FitCheck report">
      <div className="frame__bar"><span /><span /><span /><em>Software Engineering Intern, Summer 2027</em></div>
      <div className="frame__body">
        <div className="frame__score">
          <div className="frame__num">61</div>
          <div><b>Competitive</b><span>4 of 5 required met</span></div>
        </div>
        <div className="frow">
          <div className="frow__head"><b>React web interfaces</b><Meter level={3} /></div>
          <p className="frow__q"><small>Posting</small><Mark>Experience building web interfaces with React.</Mark></p>
          <p className="frow__q"><small>Resume</small><Mark>Built a React front end that lets students plan their semester, used by 40 classmates</Mark></p>
          <span className="stamp stamp--ok">Quote verified</span>
        </div>
        <div className="frow">
          <div className="frow__head"><b>Cloud services such as AWS</b><Meter level={0} /></div>
          <p className="frow__q"><small>Resume</small><Mark struck>Deployed the StudyBuddy API on AWS Lambda</Mark></p>
          <span className="stamp stamp--bad">Not in your resume. Scored 0.</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------- sections ---------- */

function Nav() {
  return (
    <header className="nav">
      <div className="nav__in">
        <a href="#top" className="brand"><span className="brand__mark" aria-hidden="true" />FitCheck</a>
        <nav aria-label="Main">
          <a href="#how">How scoring works</a>
          <a href="/SKILL.md" target="_blank" rel="noreferrer">Protocol</a>
          <a href="#check" className="btn btn--small">Check my fit</a>
        </nav>
      </div>
    </header>
  );
}

function Hero({ onSample }) {
  return (
    <section className="hero" id="top">
      <div className="wrap hero__grid">
        <motion.div className="hero__text" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
          <h1>Internship fit checker for CS students</h1>
          <p className="lead">Paste a job posting and your resume. FitCheck scores each requirement, checks graduation date and work authorization, and quotes the exact lines it used from both.</p>
          <div className="actions">
            <a href="#check" className="btn">Check my fit</a>
            <button type="button" className="btn btn--ghost" onClick={onSample}>See a sample report</button>
          </div>
          <p className="fact">Most reports are ready in under 10 seconds. Free, no account.</p>
        </motion.div>
        <HeroFrame />
      </div>
    </section>
  );
}

function Field({ id, label, hint, children, wide }) {
  return (
    <div className={wide ? 'field field--wide' : 'field'}>
      <label htmlFor={id}>{label}{hint && <span className="field__hint">{hint}</span>}</label>
      {children}
    </div>
  );
}

function CheckForm({ form, setForm, onRun, onSample, busy }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const load = () => setForm((f) => ({ ...f, posting: SAMPLE_POSTING, resume: SAMPLE_RESUME, ...SAMPLE_PROFILE }));
  const ready = form.posting.trim().length >= 80 && form.resume.trim().length >= 80;
  return (
    <section className="check" id="check" aria-labelledby="check-h">
      <div className="wrap">
        <div className="check__head">
          <h2 id="check-h">Check a posting against your resume</h2>
          <button type="button" className="link" onClick={load}>Fill in an example</button>
        </div>
        <div className="paste">
          <Field id="posting" label="Job posting" hint={`${form.posting.length.toLocaleString()} of 15,000`}>
            <textarea id="posting" value={form.posting} onChange={set('posting')} maxLength={15000} placeholder="Paste the whole posting, including basic and preferred qualifications" />
          </Field>
          <Field id="resume" label="Your resume" hint={`${form.resume.length.toLocaleString()} of 10,000`}>
            <textarea id="resume" value={form.resume} onChange={set('resume')} maxLength={10000} placeholder="Paste your resume as plain text" />
          </Field>
        </div>
        <div className="answers">
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
          <Field id="location" label="Location" hint="Optional">
            <input id="location" value={form.location} onChange={set('location')} placeholder="Phoenix, AZ or remote" />
          </Field>
        </div>
        <div className="submit">
          <button type="button" className="btn btn--big" onClick={onRun} disabled={!ready || busy}>{busy ? 'Checking…' : 'Check my fit'}</button>
          <button type="button" className="btn btn--ghost" onClick={onSample} disabled={busy}>See a sample report</button>
          <label className="toggle" htmlFor="redact">
            <input id="redact" type="checkbox" checked={form.redact} onChange={set('redact')} />
            <span className="toggle__box" aria-hidden="true" />
            Remove email, phone and LinkedIn before sending
          </label>
        </div>
        <p className="privacy">Your text goes to a free AI model through OpenRouter. Free models may keep what they receive, so leave out anything private. This site saves nothing.</p>
      </div>
    </section>
  );
}

function Loading({ seconds }) {
  const active = Math.min(STEPS.length - 1, Math.floor(seconds / 3));
  return (
    <div className="wrap status" aria-live="polite">
      <h2 className="status__title">Checking your fit <span className="status__time">{seconds}s</span></h2>
      <ol className="steps">
        {STEPS.map(([t, d], i) => (
          <li key={t} className={i < active ? 'is-done' : i === active ? 'is-now' : ''}>
            <span className="steps__dot" aria-hidden="true" /><b>{t}</b><span>{d}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ReqRow({ r }) {
  const state = r.level >= 2 ? 'met' : r.level === 1 ? 'thin' : 'gap';
  return (
    <li className={`req req--${state}`}>
      <div className="req__head">
        <h4>{r.text}</h4>
        <span className="req__imp">{IMP_LABEL[r.importance]}, weight {r.weight}</span>
        <Meter level={r.level} />
      </div>
      <div className="req__quotes">
        <p><small>Posting</small>{r.posting_quote ? <Mark>{r.posting_quote}</Mark> : <em>No quote given</em>}{!r.posting_verified && r.posting_quote && <span className="tag tag--warn">Not word for word</span>}</p>
        <p><small>Resume</small>{r.resume_quote ? <Mark struck={r.receipt === 'rejected'}>{r.resume_quote}</Mark> : <em>Nothing in your resume shows this.</em>}
          {r.receipt === 'verified' && <span className="tag tag--ok">Verified</span>}
          {r.receipt === 'rejected' && <span className="tag tag--bad">Not in your resume</span>}
        </p>
      </div>
      {r.receipt === 'rejected'
        ? <p className="req__note req__note--bad">The model rated this {r.claimed_level} of 3, but the quote is not in your resume, so it scores 0.</p>
        : r.note && <p className="req__note">{r.note}</p>}
      {r.gap_action && <p className="req__next"><b>Next step</b>{r.gap_action}</p>}
    </li>
  );
}

function Report({ data, meta, isSample, onReset }) {
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
  const download = () => {
    const blob = new Blob([JSON.stringify({ ...data, meta }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'fitcheck-report.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="report" aria-labelledby="report-h">
      <div className="wrap">
        {isSample && <p className="notice">This report uses a made-up posting, resume and model reply, run through the real scoring code.</p>}
        {!data.eligible && <p className="notice notice--bad">You do not meet at least one eligibility rule below. A high score does not change that.</p>}
        {data.eligible && data.has_unclear_gate && <p className="notice">One eligibility rule is unclear. Check it on the official posting before you apply.</p>}

        <div className="summary">
          <div className="score">
            <div className={`score__num score__num--${data.band.tone}`}><Count to={data.score} /></div>
            <div className="score__band">{data.band.label}{!data.eligible && ', not eligible'}</div>
          </div>
          <div className="summary__text">
            <h2 id="report-h">{data.role_title}{data.company ? <span className="summary__co">, {data.company}</span> : null}</h2>
            <p>{data.summary}</p>
            <dl className="tallies">
              {['required', 'preferred', 'implied'].map((k) => data.breakdown[k].total ? (
                <div key={k}><dt>{IMP_LABEL[k]}</dt><dd>{data.breakdown[k].met} of {data.breakdown[k].total} met</dd></div>
              ) : null)}
              <div><dt>Resume quotes</dt><dd>{data.audit.resume_quotes_checked} checked, {data.audit.resume_quotes_rejected} rejected</dd></div>
            </dl>
            <p className="meta">{meta?.model ? `Model: ${meta.model}` : 'Scored by FitCheck'}{meta?.ms ? `, ${(meta.ms / 1000).toFixed(1)} seconds` : ''}. Protocol v{data.protocol_version}.</p>
          </div>
        </div>

        {data.gates.length > 0 && (
          <div className="block">
            <h3>Eligibility</h3>
            <ul className="gates">
              {data.gates.map((g, i) => (
                <li key={i} className={`gate gate--${g.status}`}>
                  <div className="gate__head"><b>{GATE_LABEL[g.type] || 'Eligibility'}</b><span className={`tag tag--${g.status === 'pass' ? 'ok' : g.status === 'fail' ? 'bad' : 'warn'}`}>{g.status === 'pass' ? 'Pass' : g.status === 'fail' ? 'Does not fit' : 'Unclear'}</span></div>
                  {g.posting_quote && <p><Mark>{g.posting_quote}</Mark></p>}
                  <p className="gate__you">You: {g.candidate_fact}{g.note ? `. ${g.note}` : ''}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="block">
          <div className="block__head">
            <h3>Requirements</h3>
            <div className="seg" role="tablist" aria-label="Filter requirements">
              {[['all', `All ${reqs.length}`], ['gaps', `Gaps ${gaps}`], ['matches', `Met ${reqs.length - gaps}`]].map(([k, l]) => (
                <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'is-on' : ''} onClick={() => setFilter(k)}>{l}</button>
              ))}
            </div>
          </div>
          <ul className="reqs">{list.map((r) => <ReqRow key={r.id} r={r} />)}</ul>
          {!list.length && <p className="meta">Nothing in this view.</p>}
        </div>

        {data.defend_questions.length > 0 && (
          <div className="block">
            <h3>Questions to prepare for</h3>
            <ol className="qs">
              {data.defend_questions.map((q, i) => (
                <li key={i}><p>{q.question}</p>{q.resume_quote && <p className="qs__about">About <Mark>{q.resume_quote}</Mark></p>}</li>
              ))}
            </ol>
          </div>
        )}

        <div className="submit">
          <button className="btn" onClick={onReset}>Check another posting</button>
          <button className="btn btn--ghost" onClick={download}>Download report as JSON</button>
        </div>
      </div>
    </div>
  );
}

function How() {
  const steps = [
    ['Your inputs', 'Posting, resume and four answers. Contact details are removed in the browser.'],
    ['The protocol', 'SKILL.md tells the model what to extract and makes it quote every line.'],
    ['Any model', 'A free OpenRouter model here. Ajax, Claude, GPT or a local model work the same way.'],
    ['Quote check', 'Code looks for every quote in your text. A quote it cannot find scores 0.'],
    ['Fixed weights', 'The score comes from code, so every model is scored by the same rules.'],
  ];
  return (
    <section className="how" id="how" aria-labelledby="how-h">
      <div className="wrap">
        <h2 id="how-h">How the score is worked out</h2>
        <p className="how__lead">The model reads the posting and your resume. Code checks its quotes and does the math, so the model cannot make up evidence or a number.</p>
        <ol className="flow">
          {steps.map(([t, d], i) => <li key={t}><span className="flow__n">{i + 1}</span><b>{t}</b><p>{d}</p></li>)}
        </ol>
        <div className="how__grid">
          <div>
            <h3>Weights</h3>
            <table className="tbl">
              <thead><tr><th>Evidence</th><th>Value</th></tr></thead>
              <tbody>{LEVEL_NAME.map((n, i) => <tr key={n}><td>{i}, {n}</td><td>{LEVEL_VALUE[i]}</td></tr>)}</tbody>
            </table>
            <table className="tbl">
              <thead><tr><th>Requirement</th><th>Weight</th></tr></thead>
              <tbody>{Object.entries(WEIGHTS).map(([k, v]) => <tr key={k}><td>{IMP_LABEL[k]}</td><td>{v}</td></tr>)}</tbody>
            </table>
            <p className="meta">Score = 100 × sum of (weight × value) ÷ sum of weights. A failed eligibility rule marks you not eligible.</p>
          </div>
          <div>
            <h3>Use the protocol with your own agent</h3>
            <p className="meta">Give SKILL.md to any agent as its instructions, send the posting and resume, then run its reply through the same scoring code.</p>
            <pre className="code"><code>{`const protocol = await fetch('/SKILL.md').then(r => r.text());

const reply = await agent.chat([
  { role: 'system', content: protocol },
  { role: 'user', content: posting + resume + profile },
]);

const report = processResult(JSON.parse(reply), posting, resume);`}</code></pre>
            <a className="btn btn--ghost btn--small" href="/SKILL.md" target="_blank" rel="noreferrer">Read the protocol</a>
          </div>
        </div>
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
        if (r.status === 404) throw new Error('The checking service was not found. If you are running this on your own computer, use `npx vercel dev` instead of `npm run dev`, or open the deployed site.');
        if (r.status === 504 || /timeout|timed out/i.test(text)) throw new Error('The AI model took longer than the server allows. Free models are sometimes slow. Try again, or see the sample report.');
        throw new Error(`The server sent back something unexpected (HTTP ${r.status}): ${text.slice(0, 140)}`);
      }
      if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
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
    setState({ phase: 'done', data, meta: { model: 'sample reply, no model call' }, isSample: true });
    scrollTo('status');
  };

  const reset = () => { setState({ phase: 'idle' }); scrollTo('check'); };

  return (
    <>
      <a href="#check" className="skip">Skip to the form</a>
      <Nav />
      <main>
        <Hero onSample={sample} />
        <CheckForm form={form} setForm={setForm} onRun={run} onSample={sample} busy={state.phase === 'loading'} />
        <section className="results" id="status" aria-live="polite">
          {state.phase === 'loading' && <Loading seconds={seconds} />}
          {state.phase === 'error' && (
            <div className="wrap status" role="alert">
              <h2 className="status__title">The check did not finish</h2>
              <p className="status__msg">{state.message}</p>
              <div className="submit"><button className="btn" onClick={run}>Try again</button><button className="btn btn--ghost" onClick={sample}>See a sample report</button></div>
            </div>
          )}
          {state.phase === 'done' && <Report data={state.data} meta={state.meta} isSample={state.isSample} onReset={reset} />}
        </section>
        <How />
      </main>
      <footer className="foot">
        <div className="wrap foot__in">
          <span className="brand"><span className="brand__mark" aria-hidden="true" />FitCheck</span>
          <p>A class project for The Agentic Self by Vishnu Uppalapati. A practice tool, not a hiring prediction. Confirm eligibility on the official posting.</p>
        </div>
      </footer>
    </>
  );
}
