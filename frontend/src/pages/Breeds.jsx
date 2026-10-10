import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, Sprout } from 'lucide-react';
import { PageMeta } from '../components/chrome';
import { EmptyState, Reveal, Skeleton } from '../components/ui';

const UTILITY = [
  { id: '', label: 'All utilities' },
  { id: 'milch', label: 'Milch' },
  { id: 'draught', label: 'Draught' },
  { id: 'dual', label: 'Dual purpose' },
];

export default function Breeds() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [species, setSpecies] = useState('');
  const [utility, setUtility] = useState('');

  useEffect(() => {
    fetch('/api/v1/breeds')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ breeds: [] }));
  }, []);

  const list = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.breeds.filter((b) => {
      if (species && b.species !== species) return false;
      if (utility && b.utility !== utility) return false;
      if (term) {
        const hay = `${b.name} ${b.origin.state} ${b.coat} ${b.traits.join(' ')}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [data, q, species, utility]);

  return (
    <>
      <PageMeta title="Breed encyclopedia" description="Researched profiles for 26 indigenous Indian cattle and buffalo breeds: origin, coat, horns, milk yield, fat content and conservation notes." />
      <div className="container page-head">
        <span className="eyebrow"><Sprout size={12} /> Encyclopedia</span>
        <h1 className="h-section mt-2">26 indigenous breeds, documented</h1>
        <p className="lead mt-2">
          Registered breeds and locally-recognised landraces, each with provenance, physical descriptors and production
          ranges compiled from NBAGR descriptors and livestock literature.
        </p>
      </div>

      <div className="container" style={{ paddingBottom: '4rem' }}>
        <div className="filter-bar" role="search">
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              placeholder="Search breeds, states, traits…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search breeds"
            />
          </div>
          <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap' }}>
            {[{ id: '', label: 'All' }, { id: 'cattle', label: 'Cattle' }, { id: 'buffalo', label: 'Buffalo' }].map((s) => (
              <button key={s.id} className="chip" aria-pressed={species === s.id} onClick={() => setSpecies(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap' }}>
            {UTILITY.map((u) => (
              <button key={u.id} className="chip" aria-pressed={utility === u.id} onClick={() => setUtility(u.id)}>
                {u.label}
              </button>
            ))}
          </div>
          <span className="faint mono" style={{ fontSize: '.75rem', marginLeft: 'auto' }}>{list.length} / {data?.breeds?.length ?? '…'}</span>
        </div>

        {!data && (
          <div className="breed-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} h={210} />
            ))}
          </div>
        )}

        {data && list.length === 0 && (
          <EmptyState icon={<Search size={36} />} title="No breeds match those filters" sub="Try clearing the search or switching species/utility." />
        )}

        <div className="breed-grid">
          {list.map((b, i) => (
            <Reveal key={b.slug} delay={(i % 3) + 1}>
              <Link to={`/breeds/${b.slug}`} className="card card-hover breed-card" style={{ height: '100%' }}>
                <div
                  className="swatch"
                  style={{ background: `linear-gradient(140deg, rgb(${b.color_rgb.join(',')}), rgb(${b.color_rgb.map((c) => Math.max(0, c - 50)).join(',')}))` }}
                />
                <div className="body">
                  <div className="meta">
                    <span className={`badge ${b.species === 'buffalo' ? 'badge-info' : 'badge-accent'}`}>{b.species}</span>
                    <span className="badge">{b.utility}</span>
                    {b.status === 'landrace' && <span className="badge badge-warn">landrace</span>}
                  </div>
                  <h4>{b.name}</h4>
                  <p className="faint mono" style={{ fontSize: '.72rem' }}>{b.origin.state}</p>
                  <p>{b.coat}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '.4rem' }}>
                    <span className="mono" style={{ fontSize: '.75rem', color: 'var(--accent)' }}>
                      {b.milk_yield_kg[0]}–{b.milk_yield_kg[1]} kg/lactation
                    </span>
                    <ArrowRight size={15} style={{ color: 'var(--text-faint)' }} />
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>

        {data?.meta?.disclaimer && (
          <p className="faint mt-4" style={{ fontSize: '.8rem', maxWidth: '80ch' }}>
            {data.meta.disclaimer} Source: {data.meta.source}
          </p>
        )}
      </div>
    </>
  );
}
