import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Plus } from 'lucide-react';
import { useCountUp, useReveal } from '../lib/hooks';

/* ── Section wrappers ─────────────────────────────────────────────────── */
export function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }) {
  const ref = useReveal();
  const d = delay ? ` reveal-d${Math.min(delay, 4)}` : '';
  return (
    <Tag ref={ref} className={`reveal ${d} ${className}`}>
      {children}
    </Tag>
  );
}

export function SectionHead({ eyebrow, title, sub, center }) {
  return (
    <Reveal className={center ? 'center' : ''}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="h-section mt-2">{title}</h2>
      {sub && <p className={`lead mt-2 ${center ? 'center' : ''}`} style={center ? { marginInline: 'auto' } : undefined}>{sub}</p>}
    </Reveal>
  );
}

export function Stat({ value, suffix = '', label }) {
  const [ref, n] = useCountUp(value);
  return (
    <div ref={ref}>
      <div className="stat-num">
        {n.toLocaleString()}
        {suffix}
      </div>
      <span>{label}</span>
    </div>
  );
}

/* ── Code block with tabs + copy ──────────────────────────────────────── */
export function CodeBlock({ snippets }) {
  const keys = Object.keys(snippets);
  const [active, setActive] = useState(keys[0]);
  const [copied, setCopied] = useState(false);
  const code = snippets[active];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  // very light token highlighting
  const html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/(#[^\n]*|\/\/[^\n]*)/g, '<span class="tok-c">$1</span>')
    .replace(/("[^"\n]*"|'[^'\n]*')/g, '<span class="tok-s">$1</span>')
    .replace(/\b(import|from|const|let|await|async|function|return|export|curl|fetch|print|def)\b/g, '<span class="tok-k">$1</span>');

  return (
    <div className="codeblock">
      <div className="codeblock-head" role="tablist" aria-label="Code language">
        {keys.map((k) => (
          <button key={k} role="tab" className="codeblock-tab" aria-selected={active === k} onClick={() => setActive(k)}>
            {k}
          </button>
        ))}
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={copy}
          aria-label="Copy code"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/* ── Accordion ────────────────────────────────────────────────────────── */
export function Accordion({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div style={{ display: 'grid', gap: '.7rem' }}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className={`acc-item ${isOpen ? 'open' : ''}`}>
            <button className="acc-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? -1 : i)}>
              {item.q}
              <Plus size={18} />
            </button>
            <div className="acc-body" style={{ maxHeight: isOpen ? '320px' : 0 }}>
              <div className="acc-body-inner">{item.a}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Tabs ─────────────────────────────────────────────────────────────── */
export function Tabs({ tabs, active, onChange, ariaLabel }) {
  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          className="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ── Confidence bar row ───────────────────────────────────────────────── */
export function ConfidenceBar({ label, prob, secondary, onClick }) {
  const [w, setW] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(() => setW(prob * 100), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [prob]);
  const pct = (prob * 100).toFixed(1);
  return (
    <div className="cbar" ref={ref}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', minWidth: 0 }}>
        {onClick ? (
          <button
            onClick={onClick}
            style={{ fontWeight: 600, fontSize: '.95rem', color: 'var(--text)', textAlign: 'left' }}
            className="linklike"
            title={`Open ${label} in the encyclopedia`}
          >
            {label}
          </button>
        ) : (
          <span style={{ fontWeight: 600, fontSize: '.95rem' }}>{label}</span>
        )}
        {secondary && <span className="badge">{secondary}</span>}
      </div>
      <span className="mono" style={{ fontSize: '.85rem', color: 'var(--accent)' }}>
        {pct}%
      </span>
      <div className="cbar-track">
        <div className="cbar-fill" style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

/* ── Empty / skeleton states ──────────────────────────────────────────── */
export function Skeleton({ h = 18, w = '100%', style }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} />;
}

export function EmptyState({ icon, title, sub }) {
  return (
    <div className="center" style={{ padding: '2.6rem 1rem', color: 'var(--text-faint)' }}>
      <div style={{ display: 'grid', placeItems: 'center', marginBottom: '.8rem', color: 'var(--border-strong)' }}>{icon}</div>
      <div style={{ fontWeight: 600, color: 'var(--text-dim)' }}>{title}</div>
      {sub && <div style={{ fontSize: '.88rem', marginTop: '.3rem' }}>{sub}</div>}
    </div>
  );
}

export function Chevron() {
  return <ChevronDown size={16} />;
}
