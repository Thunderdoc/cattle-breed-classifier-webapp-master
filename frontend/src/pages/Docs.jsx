import React, { useState } from 'react';
import { Braces, Play, Terminal } from 'lucide-react';
import { PageMeta } from '../components/chrome';
import { CodeBlock, Reveal } from '../components/ui';
import { api } from '../lib/api';
import { useStore } from '../lib/store';

const ENDPOINTS = [
  { method: 'POST', path: '/api/v1/predict', desc: 'Classify one image (multipart file, JSON {image|url}, or ?url=).' },
  { method: 'POST', path: '/api/v1/predict/batch', desc: 'Classify up to 16 images (multipart files[] or JSON images[]).' },
  { method: 'GET', path: '/api/v1/breeds', desc: 'Encyclopedia list; filters: species, utility, q.' },
  { method: 'GET', path: '/api/v1/breeds/{slug}', desc: 'Single breed profile.' },
  { method: 'GET', path: '/api/v1/classes', desc: 'Model class names.' },
  { method: 'GET', path: '/api/v1/samples', desc: 'Bundled sample images.' },
  { method: 'GET', path: '/api/v1/stats', desc: 'Public counters for dashboards.' },
  { method: 'GET', path: '/api/v1/system', desc: 'Engine, version and limit metadata.' },
  { method: 'GET', path: '/health', desc: 'Liveness + model status.' },
  { method: 'GET', path: '/ready', desc: 'Readiness probe.' },
  { method: 'GET', path: '/metrics', desc: 'Prometheus text exposition.' },
  { method: 'POST', path: '/api/classify', desc: 'Legacy v1 alias of /api/v1/predict.' },
];

const ERRORS = [
  ['400', 'predict_bad_request', 'Malformed/unsupported image, missing input, or unsafe URL.'],
  ['404', 'not_found', 'Unknown endpoint or breed slug.'],
  ['413', 'payload_too_large', 'Upload exceeds MAX_FILE_SIZE_MB (default 10 MB).'],
  ['429', 'rate_limited', 'Per-IP window exceeded; honour Retry-After.'],
  ['500', 'predict_internal', 'Unexpected server fault; includes request_id for tracing.'],
];

const CONSOLE_JOBS = [
  { id: 'system', label: 'GET /api/v1/system', run: () => api.system() },
  { id: 'classes', label: 'GET /api/v1/classes', run: () => api.classes() },
  { id: 'breeds', label: 'GET /api/v1/breeds?species=buffalo', run: () => api.breeds({ species: 'buffalo' }) },
  { id: 'stats', label: 'GET /api/v1/stats', run: () => api.stats() },
  { id: 'sample', label: 'POST /api/v1/predict (bundled sample)', run: async () => {
      const s = await api.samples();
      return api.predictUrl(s[0].url, 3);
    } },
];

export default function Docs() {
  const { toast } = useStore();
  const [job, setJob] = useState(CONSOLE_JOBS[0]);
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);

  const execute = async () => {
    setBusy(true);
    setOut(null);
    const t0 = performance.now();
    try {
      const data = await job.run();
      setOut({ ok: true, ms: Math.round(performance.now() - t0), data });
    } catch (err) {
      setOut({ ok: false, ms: Math.round(performance.now() - t0), data: { error: err.message, status: err.status } });
      toast(`Console request failed: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageMeta title="API documentation" description="Reference for the Bovine AI REST API: prediction, batch, encyclopedia, health, metrics, error codes and rate limits — with a live console." />
      <div className="container page-head">
        <span className="eyebrow"><Terminal size={12} /> Developers</span>
        <h1 className="h-section mt-2">API reference</h1>
        <p className="lead mt-2">
          Stable, versioned JSON over HTTPS. All prediction endpoints accept multipart uploads, base64 JSON bodies, or
          remote URLs, and share one error envelope: <code className="mono">{'{ error, code, request_id }'}</code>.
        </p>
      </div>

      <div className="container docs-grid" style={{ paddingBottom: '4rem' }}>
        <aside className="docs-side" aria-label="Documentation sections">
          <a href="#endpoints" className="active">Endpoints</a>
          <a href="#console">Live console</a>
          <a href="#schema">Response schema</a>
          <a href="#errors">Errors &amp; limits</a>
          <a href="#sdk">SDK snippets</a>
        </aside>

        <div style={{ display: 'grid', gap: '2.6rem', minWidth: 0 }}>
          <Reveal>
            <section id="endpoints">
              <h2 className="h-sub mb-3">Endpoints</h2>
              <div style={{ display: 'grid', gap: '.6rem' }}>
                {ENDPOINTS.map((e) => (
                  <div key={e.path + e.method} className="endpoint-row">
                    <span className={`method ${e.method.toLowerCase()}`}>{e.method}</span>
                    <code style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{e.path}</code>
                    <span className="dim" style={{ fontSize: '.83rem', flex: '1.2 1 220px' }}>{e.desc}</span>
                  </div>
                ))}
              </div>
            </section>
          </Reveal>

          <Reveal>
            <section id="console">
              <h2 className="h-sub mb-3">Live console</h2>
              <div className="card" style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
                  <select className="select" style={{ flex: 1, minWidth: 240 }} value={job.id} onChange={(e) => setJob(CONSOLE_JOBS.find((j) => j.id === e.target.value))} aria-label="Choose request">
                    {CONSOLE_JOBS.map((j) => (
                      <option key={j.id} value={j.id}>{j.label}</option>
                    ))}
                  </select>
                  <button className="btn btn-primary" onClick={execute} disabled={busy}>
                    <Play size={15} /> {busy ? 'Running…' : 'Run'}
                  </button>
                </div>
                {out && (
                  <div className="codeblock">
                    <div className="codeblock-head">
                      <span className={`badge ${out.ok ? 'badge-accent' : 'badge-warn'}`}>{out.ok ? '200 OK' : 'error'}</span>
                      <span className="mono faint" style={{ fontSize: '.75rem' }}>{out.ms} ms</span>
                      <span className="mono faint" style={{ fontSize: '.75rem', marginLeft: 'auto' }}>{job.label}</span>
                    </div>
                    <pre style={{ maxHeight: 380 }}>{JSON.stringify(out.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            </section>
          </Reveal>

          <Reveal>
            <section id="schema">
              <h2 className="h-sub mb-3">Prediction response schema</h2>
              <CodeBlock
                snippets={{
                  JSON: `{
  "class": "Gir Cow",                 // top prediction
  "predictions": [
    { "class": "Gir Cow", "output": 3.41, "prob": 0.8124 },
    { "class": "Sahiwal Cow", "output": 1.02, "prob": 0.0741 }
  ],
  "inference_time_ms": 41.3,
  "engine": "resnet18-finetuned",     // or heuristic-color-prior
  "demo": false,                      // true when fallback engine active
  "breed": { "slug": "gir-cow", "name": "Gir", "species": "cattle",
             "utility": "milch", "status": "registered" },
  "image": { "width": 918, "height": 720, "format": "jpeg", "downscaled": false }
}`,
                }}
              />
            </section>
          </Reveal>

          <Reveal>
            <section id="errors">
              <h2 className="h-sub mb-3">Errors &amp; limits</h2>
              <div className="card card-flat" style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr><th>HTTP</th><th>code</th><th>Meaning</th></tr>
                  </thead>
                  <tbody>
                    {ERRORS.map(([status, code, meaning]) => (
                      <tr key={code}>
                        <td><span className="mono">{status}</span></td>
                        <td><code>{code}</code></td>
                        <td>{meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="dim mt-3" style={{ fontSize: '.9rem' }}>
                Default rate limit: <strong>60 prediction requests / 60 s per IP</strong> (env-configurable). URL fetches
                are SSRF-guarded: public IPs only, http(s) only, ≤3 redirects, ≤15 MB, image Content-Type required.
              </p>
            </section>
          </Reveal>

          <Reveal>
            <section id="sdk">
              <h2 className="h-sub mb-3">SDK snippets</h2>
              <CodeBlock
                snippets={{
                  cURL: `curl -X POST -F "file=@cow.jpg" \\
  "https://YOUR-HOST/api/v1/predict?top_n=3"`,
                  Python: `import requests
r = requests.post("https://YOUR-HOST/api/v1/predict",
                  files={"file": open("cow.jpg", "rb")}, timeout=30)
print(r.json()["class"])`,
                  'Node.js': `const fd = new FormData();
fd.append('file', blob, 'cow.jpg');
const r = await fetch('https://YOUR-HOST/api/v1/predict', { method: 'POST', body: fd });
console.log((await r.json()).class);`,
                }}
              />
            </section>
          </Reveal>

          <Reveal>
            <div className="demo-banner">
              <Braces size={16} style={{ flex: 'none', marginTop: 2 }} />
              <span>
                Every response carries <code className="mono">X-Request-Id</code>; quote it when reporting issues. The
                OpenAPI-shaped contract above is covered by the repo&apos;s pytest suite (<code className="mono">tests/</code>).
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </>
  );
}
