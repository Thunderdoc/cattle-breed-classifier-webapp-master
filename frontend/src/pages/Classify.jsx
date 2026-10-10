import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  CameraOff,
  ClipboardPaste,
  Copy,
  Download,
  Eraser,
  FileJson,
  Image as ImageIcon,
  Layers,
  Link2,
  Scan,
  Table,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import { PageMeta } from '../components/chrome';
import { ConfidenceBar, EmptyState, Skeleton, Tabs } from '../components/ui';
import { api, downloadText, toCsv } from '../lib/api';
import { makeThumb, readAsDataUrl, useLocalStorage } from '../lib/hooks';
import { useStore } from '../lib/store';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp';

export default function Classify() {
  const { toast, system } = useStore();
  const [mode, setMode] = useState('upload');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [topN, setTopN] = useLocalStorage('bovine.topn', 5);
  const [history, setHistory] = useLocalStorage('bovine.history', []);
  const [samples, setSamples] = useState([]);
  const [drag, setDrag] = useState(false);
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchResults, setBatchResults] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);

  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    api.samples().then(setSamples).catch(() => {});
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── camera ─────────────────────────────────────────────────────── */
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraOn(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 40);
    } catch {
      toast('Camera unavailable in this browser context — use upload or paste instead.', 'warn');
    }
  };
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };
  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPreview(dataUrl);
    setFile(dataUrlToFile(dataUrl, `camera-${Date.now()}.jpg`));
    stopCamera();
    toast('Frame captured — hit Predict.');
  };

  /* ── input helpers ──────────────────────────────────────────────── */
  const acceptFile = useCallback(
    (f) => {
      if (!f) return;
      if (!f.type?.startsWith('image/')) {
        toast('That file is not an image.', 'error');
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast('Image exceeds the 10 MB limit.', 'error');
        return;
      }
      setFile(f);
      setResult(null);
      setError(null);
      readAsDataUrl(f).then(setPreview);
    },
    [toast]
  );

  useEffect(() => {
    const onPaste = (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const img = items.find((i) => i.type.startsWith('image/'));
      if (img) {
        e.preventDefault();
        setMode('upload');
        acceptFile(img.getAsFile());
        toast('Image pasted from clipboard.');
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [acceptFile, toast]);

  /* ── predict ────────────────────────────────────────────────────── */
  const predict = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      let res;
      if (mode === 'url') {
        if (!/^https?:\/\//i.test(url)) throw new Error('Enter a valid http(s) image URL.');
        res = await api.predictUrl(url, topN);
      } else if (file instanceof File) {
        res = await api.predictFile(file, topN);
      } else if (typeof file === 'string' && file.startsWith('data:')) {
        res = await api.predictBase64(file, topN);
      } else if (typeof file === 'string' && file.startsWith('/')) {
        res = await api.predictUrl(file, topN);
      } else {
        throw new Error('Choose an image first — drop, paste, capture or pick a sample.');
      }
      setResult(res);
      const thumb = preview ? await makeThumb(preview) : null;
      setHistory((h) =>
        [
          {
            id: Date.now(),
            thumb,
            label: res.class,
            prob: res.predictions[0]?.prob ?? 0,
          },
          ...h,
        ].slice(0, 12)
      );
    } catch (err) {
      setError(err.message);
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const runBatch = async () => {
    if (!batchFiles.length) return;
    setBusy(true);
    setBatchResults(null);
    setError(null);
    try {
      const res = await api.predictBatch(batchFiles, topN);
      setBatchResults(res);
    } catch (err) {
      setError(err.message);
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    setFile(null);
    setPreview(null);
    setUrl('');
    setResult(null);
    setError(null);
    setBatchFiles([]);
    setBatchResults(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const exportCsv = () => {
    if (!result) return;
    downloadText(
      `prediction-${Date.now()}.csv`,
      toCsv(result.predictions.map((p) => ({ breed: p.class, probability: p.prob, logit: p.output }))),
      'text/csv'
    );
  };

  const top = result?.predictions?.[0];

  return (
    <>
      <PageMeta title="Classify" description="Upload, paste, capture or link a cattle photo and get ranked breed predictions with confidence scores." />
      <div className="container page-head">
        <span className="eyebrow">Studio</span>
        <h1 className="h-section mt-2">Classify a breed</h1>
        <p className="lead mt-2">
          Drop an image anywhere on the panel, paste from your clipboard (Ctrl/⌘+V), capture from camera, or point at a
          URL. Results include ranked confidence and an encyclopedia link per breed.
        </p>
        {system?.engine?.demo && (
          <div className="demo-banner mt-3" role="note">
            <Zap size={16} style={{ flex: 'none', marginTop: 2 }} />
            <span>
              <strong>Demo engine active.</strong> This instance has no trained checkpoint loaded, so predictions come
              from a deterministic coat-colour prior and are illustrative only. Deploy with the ResNet-18 weights for
              research-grade results — see the <Link to="/model" style={{ textDecoration: 'underline' }}>Model Card</Link>.
            </span>
          </div>
        )}
      </div>

      <div className="container" style={{ paddingBottom: '4rem' }}>
        <div className="workspace">
          {/* ── INPUT PANEL ─────────────────────────────────────────── */}
          <div className="card" style={{ display: 'grid', gap: '1.1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <Tabs
                ariaLabel="Input mode"
                active={mode}
                onChange={(m) => { setMode(m); if (m !== 'camera') stopCamera(); }}
                tabs={[
                  { id: 'upload', label: 'Upload', icon: <Upload size={15} /> },
                  { id: 'url', label: 'URL', icon: <Link2 size={15} /> },
                  { id: 'camera', label: 'Camera', icon: <Camera size={15} /> },
                  { id: 'batch', label: 'Batch', icon: <Layers size={15} /> },
                ]}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem', color: 'var(--text-dim)' }}>
                Top-N
                <select className="select" style={{ width: 74, padding: '.45rem .8rem' }} value={topN} onChange={(e) => setTopN(Number(e.target.value))}>
                  {[1, 3, 5, 7, 10].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>

            {mode === 'upload' && (
              <div
                className={`dropzone ${drag ? 'drag' : ''}`}
                role="button"
                tabIndex={0}
                aria-label="Upload an image"
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); acceptFile(e.dataTransfer.files?.[0]); }}
              >
                {preview ? (
                  <div className="dropzone-preview">
                    <img src={preview} alt="Selected for classification" />
                    {busy && <div className="scan-overlay" />}
                  </div>
                ) : (
                  <>
                    <div className="dropzone-icon"><Upload size={24} /></div>
                    <div style={{ fontWeight: 600 }}>Drop an image here, or click to browse</div>
                    <div className="dim" style={{ fontSize: '.85rem', marginTop: '.35rem' }}>
                      JPEG · PNG · WebP · GIF · BMP — max 10 MB. Or paste with Ctrl/⌘+V.
                    </div>
                  </>
                )}
                <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={(e) => acceptFile(e.target.files?.[0])} />
              </div>
            )}

            {mode === 'url' && (
              <div className="field">
                <label htmlFor="img-url">Image URL</label>
                <input
                  id="img-url"
                  className="input"
                  type="url"
                  placeholder="https://example.com/cow.jpg"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <div className="faint" style={{ fontSize: '.8rem', marginTop: '.5rem' }}>
                  Direct image links only (…jpg / …png / …webp) — search-page URLs are not images.
                  Fetched server-side with SSRF protection; on network-restricted deployments external
                  hosts may be unreachable, so prefer Upload or a bundled sample.
                </div>
                {url && /^https?:\/\//i.test(url) && (
                  <div className="dropzone-preview mt-2">
                    <img src={url} alt="URL preview" onError={(e) => { e.target.style.display = 'none'; }} onLoad={(e) => { e.target.style.display = 'block'; }} />
                  </div>
                )}
              </div>
            )}

            {mode === 'camera' && (
              <div style={{ display: 'grid', gap: '.8rem' }}>
                <div className="dropzone-preview" style={{ aspectRatio: '4/3', background: 'var(--bg-soft)' }}>
                  {cameraOn ? (
                    <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : preview ? (
                    <img src={preview} alt="Captured frame" />
                  ) : (
                    <EmptyState icon={<CameraOff size={34} />} title="Camera is off" sub="Start the camera and capture a frame of the animal." />
                  )}
                </div>
                <div style={{ display: 'flex', gap: '.6rem' }}>
                  {cameraOn ? (
                    <>
                      <button className="btn btn-primary" onClick={capture}><Camera size={16} /> Capture frame</button>
                      <button className="btn btn-danger" onClick={stopCamera}><CameraOff size={16} /> Stop</button>
                    </>
                  ) : (
                    <button className="btn btn-outline" onClick={startCamera}><Camera size={16} /> Start camera</button>
                  )}
                </div>
              </div>
            )}

            {mode === 'batch' && (
              <div style={{ display: 'grid', gap: '.9rem' }}>
                <div
                  className={`dropzone ${drag ? 'drag' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload multiple images"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    setBatchFiles(Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/')).slice(0, 16));
                  }}
                  style={{ padding: '1.6rem' }}
                >
                  <div className="dropzone-icon"><Layers size={22} /></div>
                  <div style={{ fontWeight: 600 }}>Drop up to 16 images</div>
                  <div className="dim" style={{ fontSize: '.85rem' }}>Each image is classified independently; failures are isolated.</div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPT}
                    multiple
                    hidden
                    onChange={(e) => setBatchFiles(Array.from(e.target.files || []).slice(0, 16))}
                  />
                </div>
                {batchFiles.length > 0 && (
                  <div className="sample-strip" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))' }}>
                    {batchFiles.map((f, i) => (
                      <BatchThumb key={`${f.name}-${i}`} file={f} />
                    ))}
                  </div>
                )}
                <button className="btn btn-primary" onClick={runBatch} disabled={busy || !batchFiles.length}>
                  {busy ? <Scan className="spin" size={16} /> : <Layers size={16} />} Classify {batchFiles.length || ''} image{batchFiles.length === 1 ? '' : 's'}
                </button>
                {batchResults && (
                  <div style={{ display: 'grid', gap: '.5rem' }}>
                    {batchResults.results.map((r) => (
                      <div key={r.index} className="endpoint-row" style={{ justifyContent: 'space-between' }}>
                        <span className="mono faint">#{r.index + 1}</span>
                        {r.ok ? (
                          <>
                            <strong style={{ flex: 1 }}>{r.result.class}</strong>
                            <span className="badge badge-accent">{(r.result.predictions[0]?.prob * 100).toFixed(1)}%</span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--danger)', fontSize: '.85rem' }}>{r.error}</span>
                        )}
                      </div>
                    ))}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        downloadText(
                          `batch-${Date.now()}.csv`,
                          toCsv(
                            batchResults.results
                              .filter((r) => r.ok)
                              .map((r) => ({ image: r.index + 1, breed: r.result.class, probability: r.result.predictions[0]?.prob ?? '' }))
                          ),
                          'text/csv'
                        )
                      }
                    >
                      <Table size={14} /> Export CSV
                    </button>
                  </div>
                )}
              </div>
            )}

            {mode !== 'batch' && (
              <div style={{ display: 'flex', gap: '.7rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={predict} disabled={busy}>
                  {busy ? <Scan className="spin" size={17} /> : <Scan size={17} />} {busy ? 'Analysing…' : 'Predict breed'}
                </button>
                <button className="btn btn-outline" onClick={clearAll} aria-label="Clear inputs and result">
                  <Eraser size={16} /> Clear
                </button>
              </div>
            )}

            <div>
              <div className="faint mono" style={{ fontSize: '.72rem', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.6rem' }}>
                Try a sample
              </div>
              <div className="sample-strip">
                {samples.map((s) => (
                  <button
                    key={s.url}
                    onClick={() => {
                      setMode('upload');
                      setFile(s.url);
                      setPreview(s.url);
                      setResult(null);
                      setError(null);
                    }}
                    title={`${s.name}${s.credit ? ` · photo: ${s.credit}` : ''}`}
                  >
                    <img src={s.url} alt={s.name} loading="lazy" />
                    <span className="cap">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── RESULT PANEL ────────────────────────────────────────── */}
          <div className="card" style={{ display: 'grid', gap: '1rem', minHeight: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title"><ImageIcon size={17} /> Prediction</h2>
              {result && (
                <span className="badge badge-accent mono">{result.inference_time_ms} ms · {result.engine}</span>
              )}
            </div>

            {error && (
              <div className="demo-banner" style={{ borderColor: 'rgba(248,113,113,.4)', background: 'rgba(248,113,113,.08)', color: 'var(--danger)' }}>
                <Trash2 size={15} style={{ flex: 'none', marginTop: 2 }} /> <span>{error}</span>
              </div>
            )}

            {busy && (
              <div style={{ display: 'grid', gap: '.8rem' }}>
                <Skeleton h={86} />
                <Skeleton h={44} />
                <Skeleton h={44} />
                <Skeleton h={44} />
              </div>
            )}

            {!busy && !result && !error && (
              <EmptyState
                icon={<Scan size={40} />}
                title="No prediction yet"
                sub="Results appear here with ranked confidence, breed links and export options."
              />
            )}

            {!busy && result && (
              <>
                <div className="result-hero">
                  <div className="ring" style={{ '--p': (top.prob * 100).toFixed(0) }}>
                    <span>{Math.round(top.prob * 100)}%</span>
                  </div>
                  <div>
                    <div className="faint mono" style={{ fontSize: '.7rem', letterSpacing: '.12em', textTransform: 'uppercase' }}>Top match</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700 }}>{result.class}</div>
                    <div style={{ display: 'flex', gap: '.45rem', marginTop: '.35rem', flexWrap: 'wrap' }}>
                      {result.breed && (
                        <>
                          <span className={`badge ${result.breed.species === 'buffalo' ? 'badge-info' : 'badge-accent'}`}>{result.breed.species}</span>
                          <span className="badge">{result.breed.utility}</span>
                          <Link to={`/breeds/${result.breed.slug}`} className="badge" style={{ cursor: 'pointer' }}>
                            encyclopedia →
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  {result.predictions.map((p) => (
                    <ConfidenceBar
                      key={p.class}
                      label={p.class}
                      prob={p.prob}
                      secondary={p.class === result.class ? 'top' : null}
                    />
                  ))}
                </div>

                <div className="dim" style={{ fontSize: '.82rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <span>input: {result.image.width}×{result.image.height} {result.image.format}</span>
                  {result.image.downscaled && <span className="badge badge-warn">downscaled</span>}
                  {result.demo && <span className="badge badge-warn">demo engine</span>}
                </div>

                <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(JSON.stringify(result, null, 2)); toast('JSON copied to clipboard.'); }}>
                    <Copy size={14} /> Copy JSON
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => downloadText(`prediction-${Date.now()}.json`, JSON.stringify(result, null, 2))}>
                    <FileJson size={14} /> Download JSON
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={exportCsv}>
                    <Download size={14} /> CSV
                  </button>
                </div>
              </>
            )}

            {history.length > 0 && (
              <div style={{ marginTop: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="faint mono" style={{ fontSize: '.72rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>Recent (this browser)</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setHistory([])} aria-label="Clear history">
                    <Trash2 size={13} /> Clear
                  </button>
                </div>
                <div className="history-strip mt-2">
                  {history.map((h) => (
                    <div key={h.id} className="history-item" title={`${h.label} (${(h.prob * 100).toFixed(0)}%)`}>
                      {h.thumb ? (
                        <img src={h.thumb} alt={h.label} loading="lazy" />
                      ) : (
                        <div className="skeleton" style={{ width: 74, height: 74 }} />
                      )}
                      <div className="cap">{h.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="center mt-4 faint" style={{ fontSize: '.85rem' }}>
          <ClipboardPaste size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> Tip: paste an image from your
          clipboard anywhere on this page, or press <span className="kbd">⌘K</span> to jump to any breed.
        </div>
      </div>
    </>
  );
}

function BatchThumb({ file }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    readAsDataUrl(file).then(setSrc);
  }, [file]);
  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '1' }}>
      {src && <img src={src} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
    </div>
  );
}

function dataUrlToFile(dataUrl, name) {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type: mime });
}
