import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Scan } from 'lucide-react';
import { PageMeta } from '../components/chrome';
import { Accordion, CodeBlock, ConfidenceBar, Reveal, Stat } from '../components/ui';
import { api } from '../lib/api';
import { useStore } from '../lib/store';

const API_SNIPPETS = {
  cURL: `# classify an upload
curl -X POST -F "file=@my_cow.jpg" \\
  "https://YOUR-HOST/api/v1/predict?top_n=3"

# …or a direct image URL
curl "https://YOUR-HOST/api/v1/predict?url=https://…/cow.jpg"`,
  Python: `import requests

with open("my_cow.jpg", "rb") as fh:
    r = requests.post(
        "https://YOUR-HOST/api/v1/predict",
        files={"file": fh},
        params={"top_n": 3},
        timeout=30,
    )
r.raise_for_status()
body = r.json()
print(body["class"], body["predictions"][0]["prob"])`,
  JavaScript: `const form = new FormData();
form.append('file', fileInput.files[0]);

const res = await fetch('/api/v1/predict', {
  method: 'POST',
  body: form,
});
const { class: breed, predictions } = await res.json();
console.log(breed, predictions);`,
};

/* ── hero plate: live classifier presented as a catalogue plate ───────── */
function HeroPlate() {
  const [samples, setSamples] = useState([]);
  const [active, setActive] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useStore();

  useEffect(() => {
    let alive = true;
    api.samples().then((s) => alive && s.length && setSamples(s)).catch(() => {});
    return () => { alive = false; };
  }, []);

  const run = useCallback(
    async (i) => {
      if (!samples[i] || busy) return;
      setActive(i);
      setBusy(true);
      setResult(null);
      try {
        setResult(await api.predictUrl(samples[i].url, 3));
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

  const current = samples[active];

  return (
    <figure className="plate" aria-label="Live classification plate">
      <div className="plate-img">
        {current ? (
          <img src={current.url} alt={current.name} />
        ) : (
          <div className="skeleton" style={{ height: '100%' }} />
        )}
        {busy && <div className="scan-overlay" aria-hidden="true" />}
        <span className="plate-no">Plate I — live</span>
      </div>
      <figcaption className="plate-cap">
        <span>{current ? current.name : '—'}</span>
        <span>{result && !busy ? `${result.inference_time_ms} ms · ${result.engine}` : busy ? 'analysing…' : ''}</span>
      </figcaption>
      <div className="plate-body" aria-live="polite">
        {result && !busy ? (
          result.predictions.map((p) => (
            <ConfidenceBar key={p.class} label={p.class} prob={p.prob} secondary={p.class === result.class ? 'top' : null} />
          ))
        ) : (
          [0, 1, 2].map((i) => (
            <div key={i} className="cbar">
              <div className="skeleton" style={{ height: 13, width: '40%' }} />
              <div className="skeleton" style={{ height: 13, width: 40 }} />
              <div className="cbar-track"><div className="skeleton" style={{ height: '100%', width: busy ? '55%' : '0%' }} /></div>
            </div>
          ))
        )}
      </div>
      <div className="plate-thumbs" role="group" aria-label="Choose a reference photograph">
        {samples.slice(0, 5).map((s, i) => (
          <button
            key={s.url}
            onClick={() => run(i)}
            aria-current={i === active}
            aria-label={`Classify ${s.name}`}
            title={s.name}
          >
            <img src={s.url} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </figure>
  );
}

const CAPABILITIES = [
  ['Five ways in', 'Drag a photo onto the studio, pick a file, paste from the clipboard, capture from the camera, or hand it a direct URL. EXIF orientation is respected.'],
  ['Ranked answers', 'Not one opaque label: the top-N breeds with calibrated probabilities, N adjustable per request, each linked to its catalogue entry.'],
  ['Batch runs', 'Up to sixteen images per request from the studio or POST /api/v1/predict/batch, with per-image error isolation and CSV export.'],
  ['A written catalogue', 'Twenty-six breed entries with origin, coat, horns, milk yield, fat range and conservation notes — registered breeds and landraces labelled apart.'],
  ['Nothing retained', 'Images are decoded in memory, classified, and discarded within the request. No accounts, no storage, no third parties.'],
  ['Boring ops, on purpose', 'Gunicorn config, health and readiness probes, Prometheus metrics, request IDs, rate limits, Docker build, CI. It deploys like any other service.'],
];

export default function Landing() {
  const [stats, setStats] = useState(null);
  const [spotlight, setSpotlight] = useState([]);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
    api.breeds().then((d) => setSpotlight(d.breeds.slice(0, 8))).catch(() => {});
  }, []);

  return (
    <>
      <PageMeta description="A field catalogue and classifier for 26 indigenous Indian cattle and buffalo breeds. Upload a photograph; receive ranked, explainable breed predictions from a fine-tuned ResNet-18." />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <Reveal>
              <span className="kicker">Field catalogue · indigenous cattle of India</span>
            </Reveal>
            <Reveal delay={1}>
              <h1 className="h-display" style={{ marginTop: '1.1rem' }}>
                Twenty-six breeds,
                <br />
                known <em>by sight.</em>
              </h1>
            </Reveal>
            <Reveal delay={2}>
              <p className="lead mt-3">
                Photograph a cow or buffalo and this service will name its breed — a ResNet-18 fine-tuned on
                roughly four thousand images of indigenous Indian cattle, serving ranked predictions in
                milliseconds, alongside a written catalogue of every breed it knows.
              </p>
            </Reveal>
            <Reveal delay={3}>
              <div className="hero-cta">
                <Link to="/classify" className="btn btn-primary btn-lg">
                  <Scan size={17} /> Classify a photograph
                </Link>
                <Link to="/breeds" className="btn btn-outline btn-lg">
                  Read the catalogue
                </Link>
              </div>
            </Reveal>
            <Reveal delay={4}>
              <div className="ledger">
                <Stat value={stats?.breeds ?? 26} label="breeds catalogued" />
                <Stat value={stats?.states ?? 17} label="states & tracts" />
                <Stat value={4000} suffix="+" label="training photographs" />
                <Stat value={50} suffix=" ms" label="median inference" />
              </div>
            </Reveal>
          </div>
          <Reveal delay={2}>
            <HeroPlate />
          </Reveal>
        </div>
      </section>

      {/* ── INDEX TICKER ─────────────────────────────────────────────── */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((dup) => (
            <React.Fragment key={dup}>
              <span>Gir</span><span>Sahiwal</span><span>Murrah</span><span>Tharparkar</span>
              <span>Red Sindhi</span><span>Mehsana</span><span>Surti</span><span>Jaffarabadi</span>
              <span>Hariana</span><span>Khillar</span><span>Dangi</span><span>Deoni</span>
              <span>Banni</span><span>Nagpuri</span><span>Bhagnari</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── 01 CAPABILITIES ──────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <Reveal>
            <div className="sec-head">
              <div className="sec-no">01</div>
              <div>
                <h2 className="h-section">What the service does</h2>
                <p className="lead mt-2">A working tool for farmers, cooperatives, veterinarians and researchers — not a demonstration page.</p>
              </div>
            </div>
          </Reveal>
          <div className="cap-rows">
            {CAPABILITIES.map(([t, d], i) => (
              <Reveal key={t} delay={(i % 4) + 1}>
                <div className="cap-row">
                  <span className="no">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 02 METHOD ────────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <Reveal>
            <div className="sec-head">
              <div className="sec-no">02</div>
              <div>
                <h2 className="h-section">How a classification runs</h2>
              </div>
            </div>
          </Reveal>
          <Reveal delay={1}>
            <div className="steps">
              <div className="step">
                <div className="no">i.</div>
                <h3>Capture</h3>
                <p>A photograph from phone, camera or archive. The image is checked by magic bytes, oriented by EXIF, and downscaled if oversized.</p>
              </div>
              <div className="step">
                <div className="no">ii.</div>
                <h3>Infer</h3>
                <p>The frame is normalised to 224×224 and passed once through a fine-tuned ResNet-18 on the server. No image leaves the request.</p>
              </div>
              <div className="step">
                <div className="no">iii.</div>
                <h3>Read</h3>
                <p>Ranked breeds with probabilities, each linking into the catalogue: origin, coat, horns, yield, and what the breed is kept for.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 03 CATALOGUE ─────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <Reveal>
            <div className="sec-head">
              <div className="sec-no">03</div>
              <div>
                <h2 className="h-section">From the catalogue</h2>
                <p className="lead mt-2">Reference photographs where we hold them; drawn colour plates where we do not. Scroll the shelves.</p>
              </div>
            </div>
          </Reveal>
        </div>
        <div className="container">
          <div className="spotlight">
            {spotlight.map((b, i) => (
              <Link key={b.slug} to={`/breeds/${b.slug}`} className="card card-hover breed-card">
                <span className="plate-tag">Pl. {String(i + 2).padStart(2, '0')}</span>
                <div
                  className="swatch"
                  style={b.image ? undefined : { background: `linear-gradient(140deg, rgb(${b.color_rgb.join(',')}), rgb(${b.color_rgb.map((c) => Math.max(0, c - 45)).join(',')}))` }}
                >
                  {b.image && <img src={b.image} alt={`${b.name} reference photograph`} loading="lazy" />}
                </div>
                <div className="body">
                  <div className="meta">
                    <span className={`badge ${b.species === 'buffalo' ? 'badge-info' : 'badge-accent'}`}>{b.species}</span>
                    <span className="badge">{b.utility}</span>
                  </div>
                  <h4>{b.name}</h4>
                  <p className="faint mono" style={{ fontSize: '.68rem', letterSpacing: '.08em' }}>{b.origin.state.toUpperCase()}</p>
                  <p>{b.summary.split('.')[0]}.</p>
                </div>
              </Link>
            ))}
          </div>
          <Reveal>
            <Link to="/breeds" className="btn btn-outline">
              All twenty-six entries <ArrowRight size={15} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── 04 DEVELOPERS ────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container api-split">
          <Reveal>
            <div className="sec-head" style={{ border: 'none', padding: 0, display: 'block' }}>
              <span className="kicker">04 · For developers</span>
              <h2 className="h-section mt-2">One endpoint, plainly documented</h2>
            </div>
            <p className="lead mt-2">
              Versioned JSON over HTTP. Multipart, base64 or URL input; batch mode; stable error codes;
              per-IP rate limits with <span className="mono">Retry-After</span>. The full reference, with a live
              console, lives in the docs.
            </p>
            <div style={{ display: 'grid', gap: '.45rem', marginTop: '1.3rem' }}>
              {[
                ['POST', '/api/v1/predict', 'one image in, ranked breeds out'],
                ['POST', '/api/v1/predict/batch', 'up to sixteen at once'],
                ['GET', '/api/v1/breeds', 'the catalogue, filterable'],
                ['GET', '/health · /metrics', 'probes and counters'],
              ].map(([m, p, d]) => (
                <div key={p} className="endpoint-row">
                  <span className={`method ${m.toLowerCase()}`}>{m}</span>
                  <code style={{ flex: 1 }}>{p}</code>
                  <span className="faint" style={{ fontSize: '.78rem' }}>{d}</span>
                </div>
              ))}
            </div>
            <Link to="/docs" className="btn btn-primary mt-4">
              Read the API reference <ArrowRight size={15} />
            </Link>
          </Reveal>
          <Reveal delay={2}>
            <CodeBlock snippets={API_SNIPPETS} />
          </Reveal>
        </div>
      </section>

      {/* ── 05 QUESTIONS ─────────────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <Reveal>
            <div className="sec-head">
              <div className="sec-no">05</div>
              <div>
                <h2 className="h-section">Questions, answered plainly</h2>
              </div>
            </div>
          </Reveal>
          <div className="mt-4">
            <Reveal delay={1}>
              <Accordion
                items={[
                  {
                    q: 'How accurate is it?',
                    a: 'With the trained checkpoint loaded, about 89% top-1 and 96% top-3 on the held-out validation split (see the model card). Instances without the checkpoint fall back to a deterministic coat-colour prior, and every response says which engine answered.',
                  },
                  {
                    q: 'Are my photographs kept?',
                    a: 'No. Decoding, inference and response happen inside one request; the bytes are then dropped. There is no upload bucket, no account system, and no analytics on images.',
                  },
                  {
                    q: 'Why twenty-six breeds and not all fifty-plus?',
                    a: 'Twenty-six is what the training corpus supports at roughly 150 photographs per breed. The catalogue says honestly which entries are NBAGR-registered breeds and which are locally recognised landraces with thinner documentation.',
                  },
                  {
                    q: 'Can I run it on my own machine?',
                    a: 'Yes. The repository ships a Dockerfile, a compose file with an nginx sample, a gunicorn configuration and a Makefile. One build produces the front-end; one command serves everything.',
                  },
                  {
                    q: 'What may I upload?',
                    a: 'JPEG, PNG, WebP, GIF or BMP up to 10 MB, verified by magic bytes rather than MIME type. Oversized frames are downscaled safely; EXIF orientation is honoured.',
                  },
                  {
                    q: 'Is the API rate limited?',
                    a: 'Sixty prediction requests per minute per address by default, configurable by environment. Limits answer 429 with a Retry-After header so clients can back off properly.',
                  },
                ]}
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="section-tight">
        <div className="container">
          <Reveal>
            <div className="card" style={{ textAlign: 'center', padding: 'clamp(2.2rem,5vw,3.6rem)', borderTop: '2px solid var(--ink)' }}>
              <h2 className="h-section">
                Take a photograph. <em style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>Get an answer.</em>
              </h2>
              <p className="lead center" style={{ margin: '.9rem auto 0' }}>
                No sign-up and nothing stored. The studio accepts a dropped file, a pasted image, or a URL.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center' }}>
                <Link to="/classify" className="btn btn-primary btn-lg">
                  <Scan size={17} /> Open the studio
                </Link>
                <a className="btn btn-outline btn-lg" href="https://github.com/sajit9285/cattle-breed-classifier-webapp" target="_blank" rel="noreferrer noopener">
                  Source & license
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
