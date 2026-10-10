import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Camera,
  Cpu,
  Database,
  Gauge,
  GraduationCap,
  Landmark,
  Layers,
  Lock,
  Scan,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Tractor,
  Upload,
  Zap,
} from 'lucide-react';
import { PageMeta } from '../components/chrome';
import { Accordion, CodeBlock, ConfidenceBar, Reveal, SectionHead, Stat } from '../components/ui';
import { api } from '../lib/api';
import { useStore } from '../lib/store';

const API_SNIPPETS = {
  cURL: `# Classify from a URL
curl "https://YOUR-HOST/api/v1/predict?url=https://…/cow.jpg"

# …or upload a file
curl -X POST -F "file=@my_cow.jpg" \\
  https://YOUR-HOST/api/v1/predict`,
  Python: `import requests

with open("my_cow.jpg", "rb") as fh:
    r = requests.post(
        "https://YOUR-HOST/api/v1/predict",
        files={"file": fh},
        params={"top_n": 3},
        timeout=30,
    )
r.raise_for_status()
print(r.json()["class"], r.json()["predictions"][0]["prob"])`,
  JavaScript: `const form = new FormData();
form.append('file', fileInput.files[0]);

const res = await fetch('/api/v1/predict', { method: 'POST', body: form });
const { class: breed, predictions } = await res.json();
console.log(breed, predictions);`,
};

function HeroDemoCard() {
  const [samples, setSamples] = useState([]);
  const [active, setActive] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useStore();

  useEffect(() => {
    let alive = true;
    api
      .samples()
      .then((s) => {
        if (!alive || !s.length) return;
        setSamples(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const run = useCallback(
    async (i) => {
      if (!samples[i] || busy) return;
      setActive(i);
      setBusy(true);
      setResult(null);
      try {
        const res = await api.predictUrl(samples[i].url, 3);
        setResult(res);
      } catch (err) {
        toast(`Live demo failed: ${err.message}`, 'error');
      } finally {
        setBusy(false);
      }
    },
    [samples, busy, toast]
  );

  useEffect(() => {
    if (samples.length) run(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples.length]);

  return (
    <div className="hero-card">
      <div className="card card-glow">
        <div className="hero-shot">
          {samples[active] ? <img src={samples[active].url} alt={samples[active].name} /> : <div className="skeleton" style={{ height: '100%' }} />}
          {busy && <div className="scan-overlay" aria-hidden="true" />}
        </div>

        <div className="hero-result" aria-live="polite">
          {result && !busy
            ? result.predictions.map((p) => (
                <ConfidenceBar key={p.class} label={p.class} prob={p.prob} secondary={p.class === result.class ? 'top match' : null} />
              ))
            : [0, 1, 2].map((i) => (
                <div key={i} className="cbar">
                  <div className="skeleton" style={{ height: 14, width: '42%' }} />
                  <div className="skeleton" style={{ height: 14, width: 44 }} />
                  <div className="cbar-track">
                    <div className="skeleton" style={{ height: '100%', width: busy ? '60%' : '0%' }} />
                  </div>
                </div>
              ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.5rem', marginTop: '.9rem' }}>
          {samples.slice(0, 4).map((s, i) => (
            <button
              key={s.url}
              onClick={() => run(i)}
              aria-label={`Classify sample: ${s.name}`}
              title={s.name}
              style={{
                borderRadius: 10,
                overflow: 'hidden',
                border: i === active ? '2px solid var(--accent)' : '1px solid var(--border)',
                aspectRatio: '1',
                padding: 0,
              }}
            >
              <img src={s.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>
          ))}
        </div>

        <Link to="/classify" className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: '.9rem' }}>
          Open the full studio <ArrowRight size={15} />
        </Link>
      </div>
      <div className="hero-float f1 mono">
        <Zap size={13} style={{ color: 'var(--accent)' }} /> {result ? `${result.inference_time_ms} ms` : '— ms'}
      </div>
      <div className="hero-float f2 mono">
        <ShieldCheck size={13} style={{ color: 'var(--accent)' }} /> images never stored
      </div>
    </div>
  );
}

export default function Landing() {
  const [stats, setStats] = useState(null);
  const [spotlight, setSpotlight] = useState([]);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
    api.breeds().then((d) => setSpotlight(d.breeds.slice(0, 7))).catch(() => {});
  }, []);

  return (
    <>
      <PageMeta
        description="Identify 26 indigenous Indian cattle & buffalo breeds from one photo. Millisecond inference, explainable confidence, a full breed encyclopedia and a production REST API."
      />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <Reveal>
              <span className="eyebrow">
                <Sparkles size={12} /> v2.0 — encyclopedia, batch API &amp; model card
              </span>
            </Reveal>
            <Reveal delay={1}>
              <h1 className="h-display" style={{ marginTop: '1.2rem' }}>
                Every indigenous breed,
                <br />
                <span className="grad-text">recognised in a glance.</span>
              </h1>
            </Reveal>
            <Reveal delay={2}>
              <p className="lead mt-3">
                Bovine AI identifies <strong>26 Indian cattle and buffalo breeds</strong> from a single photo — a
                fine-tuned ResNet-18 serving explainable, ranked predictions in milliseconds. Upload, paste a URL, or
                call the REST API from your own tools.
              </p>
            </Reveal>
            <Reveal delay={3}>
              <div className="hero-cta">
                <Link to="/classify" className="btn btn-primary btn-lg">
                  <Scan size={18} /> Classify an image
                </Link>
                <Link to="/breeds" className="btn btn-outline btn-lg">
                  <BookOpen size={18} /> Explore 26 breeds
                </Link>
              </div>
            </Reveal>
            <Reveal delay={4}>
              <div className="hero-trust">
                <Stat value={stats?.breeds ?? 26} label="breeds" />
                <Stat value={stats?.states ?? 17} label="states covered" />
                <Stat value={4000} suffix="+" label="training images" />
                <Stat value={50} suffix="ms" label="median inference" />
              </div>
            </Reveal>
          </div>
          <Reveal delay={2}>
            <HeroDemoCard />
          </Reveal>
        </div>
      </section>

      {/* ── MARQUEE ──────────────────────────────────────────────────── */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((dup) => (
            <React.Fragment key={dup}>
              <span>Gir</span><span>Sahiwal</span><span>Murrah</span><span>Tharparkar</span>
              <span>Red Sindhi</span><span>Mehsana</span><span>Surti</span><span>Jaffarabadi</span>
              <span>Hariana</span><span>Khillar</span><span>Dangi</span><span>Deoni</span>
              <span>Banni</span><span>Nagpuri</span><span>Bhagnari</span><span>Bvill</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── STATS BAND ───────────────────────────────────────────────── */}
      <section className="section-tight">
        <div className="container">
          <Reveal>
            <div className="stats-band">
              <Stat value={stats?.cattle ?? 20} label="cattle breeds" />
              <Stat value={stats?.buffalo ?? 6} label="buffalo breeds" />
              <Stat value={stats?.predictions_served ?? 0} label="predictions served" />
              <Stat value={100} suffix="%" label="open source" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <SectionHead
            center
            eyebrow="Capabilities"
            title={<>Built like a product, <span className="grad-text">not a demo</span></>}
            sub="Every surface — from the drop-zone to the batch endpoint — is designed for daily, production use."
          />
          <div className="feature-grid">
            {[
              { icon: <Upload size={20} />, t: 'Five ways to input', d: 'Drag & drop, file picker, clipboard paste, live camera capture or a remote URL — with instant preview and EXIF-aware orientation.' },
              { icon: <BarChart3 size={20} />, t: 'Explainable confidence', d: 'Ranked top-N predictions with calibrated probabilities, not a single opaque label. Tune N per request.' },
              { icon: <Layers size={20} />, t: 'Batch inference', d: 'Classify up to 16 images per request through the UI or POST /api/v1/predict/batch, with per-image error isolation.' },
              { icon: <BookOpen size={20} />, t: 'Living encyclopedia', d: 'Every prediction links into a researched profile: origin, coat, horns, milk yield, fat % and conservation notes.' },
              { icon: <Lock size={20} />, t: 'Private by design', d: 'Images are processed in memory and discarded. Strict CSP, SSRF-guarded URL fetches, per-IP rate limiting.' },
              { icon: <Gauge size={20} />, t: 'Production ops', d: 'Gunicorn-ready, Prometheus /metrics, health & readiness probes, request IDs, graceful demo-mode fallback.' },
            ].map((f, i) => (
              <Reveal key={f.t} delay={(i % 3) + 1}>
                <div className="card card-hover card-glow" style={{ height: '100%' }}>
                  <div className="card-icon">{f.icon}</div>
                  <h3 className="card-title">{f.t}</h3>
                  <p>{f.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <SectionHead center eyebrow="Workflow" title="Three steps from field to fact" />
          <div className="steps">
            {[
              { n: '01', icon: <Camera size={22} />, t: 'Capture', d: 'Snap a photo in the shed or pick one from your library. Phones, DSLRs and CCTV frames all work.' },
              { n: '02', icon: <Cpu size={22} />, t: 'Infer', d: 'The image is normalised to 224×224 and passed through a fine-tuned ResNet-18 on the server.' },
              { n: '03', icon: <BarChart3 size={22} />, t: 'Understand', d: 'Get ranked breeds with confidence, then dive into traits, yields and history in the encyclopedia.' },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i + 1}>
                <div className="step">
                  <div className="step-num">{s.n}</div>
                  <h3 className="h-sub">{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── BREED SPOTLIGHT ──────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <SectionHead
            eyebrow="Encyclopedia"
            title="Meet the breeds"
            sub="From the gir forests of Saurashtra to the Banni salt marshes — scroll through a few of the 26 profiles."
          />
        </div>
        <div className="container">
          <div className="spotlight">
            {spotlight.map((b) => (
              <Link key={b.slug} to={`/breeds/${b.slug}`} className="card card-hover breed-card">
                <div
                  className="swatch"
                  style={b.image ? undefined : { background: `linear-gradient(140deg, rgb(${b.color_rgb.join(',')}), rgb(${b.color_rgb.map((c) => Math.max(0, c - 45)).join(',')}))` }}
                >
                  {b.image && <img src={b.image} alt={`${b.name} reference photo`} loading="lazy" />}
                </div>
                <div className="body">
                  <div className="meta">
                    <span className={`badge ${b.species === 'buffalo' ? 'badge-info' : 'badge-accent'}`}>{b.species}</span>
                    <span className="badge">{b.utility}</span>
                  </div>
                  <h4>{b.name}</h4>
                  <p>{b.summary.split('.')[0]}.</p>
                </div>
              </Link>
            ))}
          </div>
          <Reveal>
            <Link to="/breeds" className="btn btn-outline">
              Browse all 26 breeds <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── API ──────────────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container api-split">
          <Reveal>
            <span className="eyebrow">API-first</span>
            <h2 className="h-section mt-2">
              One endpoint,
              <br />
              <span className="grad-text">every integration.</span>
            </h2>
            <p className="lead mt-2">
              A versioned JSON API with multipart, base64 and URL inputs, batch mode, per-IP rate limits and stable
              error codes. Point your herd-management app, notebook or mobile app at it in minutes.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '1.4rem' }}>
              <span className="chip"><span className="method post">POST</span> /api/v1/predict</span>
              <span className="chip"><span className="method post">POST</span> /api/v1/predict/batch</span>
              <span className="chip"><span className="method get">GET</span> /api/v1/breeds</span>
              <span className="chip"><span className="method get">GET</span> /health</span>
            </div>
            <Link to="/docs" className="btn btn-primary mt-4">
              Read the API docs <ArrowRight size={16} />
            </Link>
          </Reveal>
          <Reveal delay={2}>
            <CodeBlock snippets={API_SNIPPETS} />
          </Reveal>
        </div>
      </section>

      {/* ── USE CASES ────────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <SectionHead center eyebrow="In the field" title="Who it serves" />
          <div className="usecase-grid">
            {[
              { icon: <Tractor size={20} />, t: 'Farmers & co-ops', d: 'Verify breed claims at purchase and record herd composition digitally.' },
              { icon: <Stethoscope size={20} />, t: 'Veterinarians', d: 'Breed-aware care: body condition, yield expectations and temperament at a glance.' },
              { icon: <Database size={20} />, t: 'Researchers', d: 'A reproducible inference endpoint and model card for conservation genetics work.' },
              { icon: <GraduationCap size={20} />, t: 'Students', d: 'An end-to-end reference: training notebook, Flask service, React front-end, CI & Docker.' },
            ].map((u, i) => (
              <Reveal key={u.t} delay={i + 1}>
                <div className="card card-hover" style={{ height: '100%' }}>
                  <div className="card-icon">{u.icon}</div>
                  <h3 className="card-title">{u.t}</h3>
                  <p className="dim" style={{ fontSize: '.9rem' }}>{u.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <SectionHead center eyebrow="FAQ" title="Questions, answered" />
          <div className="mt-4">
            <Reveal>
              <AccordionFAQ />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="section-tight">
        <div className="container">
          <Reveal>
            <div className="card" style={{ background: 'var(--grad-soft)', textAlign: 'center', padding: 'clamp(2.4rem,5vw,4rem)' }}>
              <h2 className="h-section">
                Ready to <span className="grad-text">identify your herd?</span>
              </h2>
              <p className="lead center" style={{ margin: '1rem auto 0' }}>
                No sign-up, no storage, no nonsense. Drop an image and get an answer before your chai cools.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center' }}>
                <Link to="/classify" className="btn btn-primary btn-lg">
                  <Scan size={18} /> Start classifying
                </Link>
                <a className="btn btn-outline btn-lg" href="https://github.com/sajit9285/cattle-breed-classifier-webapp" target="_blank" rel="noreferrer noopener">
                  <Landmark size={18} /> Star on GitHub
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

function AccordionFAQ() {
  return (
    <Accordion
      items={[
        {
          q: 'How accurate is the classifier?',
          a: 'With the trained ResNet-18 checkpoint loaded, validation accuracy on the held-out split is in the high-80s to low-90s percent range across the 26 classes (see the Model Card). Instances running without the checkpoint fall back to a clearly-labelled deterministic demo engine so integrations stay testable.',
        },
        {
          q: 'Are my images stored anywhere?',
          a: 'No. Images are decoded in server memory, transformed, classified and discarded within the same request. Nothing is written to disk, and no third-party service ever sees them.',
        },
        {
          q: 'Can I run this on my own server?',
          a: 'Yes — the repo ships a Dockerfile, docker-compose, gunicorn config and nginx sample. One command builds the React front-end and serves everything from a single Flask origin.',
        },
        {
          q: 'What image formats are accepted?',
          a: 'JPEG, PNG, WebP, GIF and BMP up to 10 MB, validated by magic bytes (not just MIME type). EXIF orientation is honoured and oversized images are safely downscaled.',
        },
        {
          q: 'Why 26 breeds and not all 50+ Indian breeds?',
          a: 'The training corpus covers 26 breeds with enough images per class to learn reliably. The encyclopedia documents all 26 with honest provenance — registered breeds and locally-recognised landraces are labelled distinctly.',
        },
        {
          q: 'Is the API rate limited?',
          a: 'Yes: 60 prediction requests per minute per IP by default (configurable via environment). Limits return HTTP 429 with a Retry-After header so clients can back off gracefully.',
        },
      ]}
    />
  );
}
