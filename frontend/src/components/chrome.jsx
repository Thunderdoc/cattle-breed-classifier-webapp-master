import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUp,
  BookOpen,
  Command,
  FileCode2,
  Github,
  Heart,
  Menu,
  Moon,
  Scan,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { useHotkey, useScrolled } from '../lib/hooks';
import { api } from '../lib/api';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/classify', label: 'Classify' },
  { to: '/breeds', label: 'Breeds' },
  { to: '/docs', label: 'API Docs' },
  { to: '/model', label: 'Model Card' },
  { to: '/about', label: 'About' },
];

/* ── SEO / document meta ──────────────────────────────────────────────── */
export function PageMeta({ title, description }) {
  useEffect(() => {
    document.title = title ? `${title} · Bovine AI` : 'Bovine AI — Indigenous Cattle Breed Classifier';
    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = description;
    }
  }, [title, description]);
  return null;
}

/* ── Navbar ───────────────────────────────────────────────────────────── */
export function Nav() {
  const scrolled = useScrolled(10);
  const { theme, toggleTheme, setPaletteOpen, system } = useStore();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className={`nav ${scrolled || open ? 'scrolled' : ''}`}>
      <div className="container nav-inner">
        <Link to="/" className="nav-brand" aria-label="Bovine AI home">
          <img src="/favicon.svg" alt="" width="34" height="34" />
          Bovine&nbsp;AI
          <small>v2.0</small>
        </Link>

        <nav className={`nav-links ${open ? 'open' : ''}`} aria-label="Primary">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          <button className="btn btn-ghost btn-icon" onClick={() => setPaletteOpen(true)} aria-label="Open command palette" title="Search (⌘K)">
            <Command size={17} />
          </button>
          <button className="btn btn-ghost btn-icon" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <a className="btn btn-ghost btn-icon" href="https://github.com/sajit9285/cattle-breed-classifier-webapp" target="_blank" rel="noreferrer noopener" aria-label="GitHub repository">
            <Github size={17} />
          </a>
          <Link to="/classify" className="btn btn-primary btn-sm">
            <Scan size={15} />
            <span className="nav-cta-label">Classify</span>
          </Link>
          <button className="btn btn-ghost btn-icon nav-burger" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {system?.engine?.demo && (
        <div style={{ background: 'rgba(251,191,36,.1)', borderBottom: '1px solid rgba(251,191,36,.3)', color: 'var(--warn)', fontSize: '.76rem', textAlign: 'center', padding: '.3rem 1rem', fontFamily: 'var(--font-mono)' }}>
          demo engine active — trained checkpoint not loaded on this instance
        </div>
      )}
    </header>
  );
}

/* ── Footer ───────────────────────────────────────────────────────────── */
export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="nav-brand" style={{ marginBottom: '.9rem' }}>
              <img src="/favicon.svg" alt="" width="30" height="30" />
              Bovine AI
            </div>
            <p className="dim" style={{ fontSize: '.9rem', maxWidth: '34ch' }}>
              Open deep-learning identification for India&apos;s indigenous cattle and buffalo breeds — built for farmers,
              veterinarians, researchers and the curious.
            </p>
            <p className="faint mono" style={{ fontSize: '.75rem', marginTop: '1rem' }}>
              ResNet-18 · PyTorch · Flask · React
            </p>
          </div>
          <div>
            <h5>Product</h5>
            <Link to="/classify">Classify an image</Link>
            <Link to="/breeds">Breed encyclopedia</Link>
            <Link to="/docs">API documentation</Link>
            <Link to="/model">Model card</Link>
          </div>
          <div>
            <h5>Resources</h5>
            <Link to="/about">About the project</Link>
            <a href="https://github.com/sajit9285/cattle-breed-classifier-webapp" target="_blank" rel="noreferrer noopener">Source code</a>
            <a href="/health" target="_blank" rel="noreferrer">Health endpoint</a>
            <a href="/metrics" target="_blank" rel="noreferrer">Metrics</a>
          </div>
          <div>
            <h5>Author</h5>
            <a href="https://sajit9285.github.io/myportfolio" target="_blank" rel="noreferrer noopener">Ajit Kumar Singh</a>
            <a href="https://github.com/sajit9285" target="_blank" rel="noreferrer noopener">GitHub</a>
            <Link to="/about#license">License (MIT)</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Indigenous Cattle Breed Classifier. MIT License.</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}>
            Made with <Heart size={13} style={{ color: 'var(--danger)' }} fill="currentColor" /> for indigenous breeds
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ── Toasts ───────────────────────────────────────────────────────────── */
export function ToastHost() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss notification" style={{ color: 'var(--text-faint)' }}>
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Back to top ──────────────────────────────────────────────────────── */
export function BackToTop() {
  const show = useScrolled(600);
  return (
    <button className={`back-top ${show ? 'show' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top">
      <ArrowUp size={18} />
    </button>
  );
}

/* ── Command palette (⌘K) ────────────────────────────────────────────── */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, toggleTheme } = useStore();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [breeds, setBreeds] = useState([]);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    if (paletteOpen) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
      api
        .breeds()
        .then((d) => setBreeds(d.breeds))
        .catch(() => setBreeds([]));
    }
  }, [paletteOpen]);

  useHotkey(useMemo(() => (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setPaletteOpen(true);
    }
    if (e.key === 'Escape') setPaletteOpen(false);
  }, [setPaletteOpen]));

  const items = useMemo(() => {
    const base = [
      ...NAV.map((n) => ({ kind: 'Page', label: n.label, icon: <FileCode2 size={15} />, run: () => navigate(n.to) })),
      { kind: 'Action', label: 'Toggle light / dark theme', icon: <Moon size={15} />, run: toggleTheme },
    ];
    const breedItems = breeds.map((b) => ({
      kind: b.species === 'buffalo' ? 'Buffalo breed' : 'Cattle breed',
      label: b.name,
      icon: <BookOpen size={15} />,
      run: () => navigate(`/breeds/${b.slug}`),
    }));
    const term = q.trim().toLowerCase();
    const all = [...base, ...breedItems];
    if (!term) return all.slice(0, 9);
    return all.filter((i) => i.label.toLowerCase().includes(term) || i.kind.toLowerCase().includes(term)).slice(0, 12);
  }, [q, breeds, navigate, toggleTheme]);

  useEffect(() => setIdx(0), [q]);

  if (!paletteOpen) return null;

  const go = (item) => {
    setPaletteOpen(false);
    item.run();
  };

  return (
    <>
      <div className="palette-backdrop" onClick={() => setPaletteOpen(false)} />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={inputRef}
          value={q}
          placeholder="Search pages, breeds, actions…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            if (e.key === 'Enter' && items[idx]) go(items[idx]);
          }}
        />
        <div className="palette-list">
          {items.length === 0 && <div className="palette-empty">No matches for “{q}”</div>}
          {items.map((item, i) => (
            <button key={`${item.kind}-${item.label}`} className="palette-item" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => go(item)}>
              {item.icon}
              <span style={{ flex: 1 }}>{item.label}</span>
              <span className="kbd">{item.kind}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '.8rem', padding: '.7rem 1rem', borderTop: '1px solid var(--border)', color: 'var(--text-faint)', fontSize: '.75rem' }} className="mono">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '.35rem', alignItems: 'center' }}>
            <Sparkles size={12} /> ⌘K
          </span>
        </div>
      </div>
    </>
  );
}

/* ── Error boundary ───────────────────────────────────────────────────── */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="nf">
          <div>
            <div className="code">oops</div>
            <p className="lead" style={{ margin: '1rem auto' }}>
              Something went wrong rendering this page: <span className="mono">{String(this.state.error)}</span>
            </p>
            <button className="btn btn-primary" onClick={() => window.location.assign('/')}>
              Back to safety
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
