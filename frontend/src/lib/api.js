/** Thin typed-ish API client for the Bovine AI backend. */

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function handle(res) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      (data && (data.error || data.message)) || `Request failed with status ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export const api = {
  system: () => fetch('/api/v1/system').then(handle),
  stats: () => fetch('/api/v1/stats').then(handle),
  classes: () => fetch('/api/v1/classes').then(handle),
  breeds: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return fetch(`/api/v1/breeds${qs ? `?${qs}` : ''}`).then(handle);
  },
  breed: (slug) => fetch(`/api/v1/breeds/${slug}`).then(handle),
  samples: () => fetch('/api/v1/samples').then(handle),

  predictFile: (file, topN) => {
    const fd = new FormData();
    fd.append('file', file);
    const qs = topN ? `?top_n=${topN}` : '';
    return fetch(`/api/v1/predict${qs}`, { method: 'POST', body: fd }).then(handle);
  },
  predictUrl: (url, topN) => {
    const qs = new URLSearchParams({ url });
    if (topN) qs.set('top_n', String(topN));
    return fetch(`/api/v1/predict?${qs}`).then(handle);
  },
  predictBase64: (dataUrl, topN) =>
    fetch(`/api/v1/predict${topN ? `?top_n=${topN}` : ''}`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ image: dataUrl }),
    }).then(handle),
  predictBatch: async (files, topN) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const qs = topN ? `?top_n=${topN}` : '';
    return fetch(`/api/v1/predict/batch${qs}`, { method: 'POST', body: fd }).then(handle);
  },
  raw: (path, options) => fetch(path, options).then(handle),
};

export function downloadText(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toCsv(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
}
