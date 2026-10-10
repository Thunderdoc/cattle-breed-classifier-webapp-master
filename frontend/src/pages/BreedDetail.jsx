import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Droplets, MapPin, Ruler, Weight } from 'lucide-react';
import { PageMeta } from '../components/chrome';
import { Reveal, Skeleton } from '../components/ui';

const YIELD_MAX = 2500;

export default function BreedDetail() {
  const { slug } = useParams();
  const [breed, setBreed] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setBreed(null);
    setFailed(false);
    fetch(`/api/v1/breeds/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then(setBreed)
      .catch(() => setFailed(true));
  }, [slug]);

  if (failed) {
    return (
      <div className="container page-head">
        <h1 className="h-section">Breed not found</h1>
        <p className="lead mt-2">The slug “{slug}” doesn’t match any documented breed.</p>
        <Link to="/breeds" className="btn btn-primary mt-3"><ArrowLeft size={16} /> Back to encyclopedia</Link>
      </div>
    );
  }

  if (!breed) {
    return (
      <div className="container page-head" style={{ display: 'grid', gap: '1rem' }}>
        <Skeleton h={40} w={320} />
        <Skeleton h={140} />
      </div>
    );
  }

  const [lo, hi] = breed.milk_yield_kg;
  const [flo, fhi] = breed.milk_fat_pct;

  return (
    <>
      <PageMeta title={`${breed.name} ${breed.species === 'buffalo' ? 'buffalo' : 'cattle'}`} description={breed.summary} />
      <div className="container page-head">
        <Link to="/breeds" className="btn btn-ghost btn-sm"><ArrowLeft size={15} /> Encyclopedia</Link>
      </div>

      <div className="container" style={{ paddingBottom: '4rem', display: 'grid', gap: '1.6rem' }}>
        <Reveal>
          <div className="card" style={{ padding: 'clamp(1.6rem,4vw,2.6rem)' }}>
            <div className="breed-detail-hero">
              <div
                className="breed-swatch-lg"
                style={{ background: `linear-gradient(140deg, rgb(${breed.color_rgb.join(',')}), rgb(${breed.color_rgb.map((c) => Math.max(0, c - 55)).join(',')}))` }}
                role="img"
                aria-label={`Representative coat colour of the ${breed.name} breed`}
              />
              <div>
                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.7rem' }}>
                  <span className={`badge ${breed.species === 'buffalo' ? 'badge-info' : 'badge-accent'}`}>{breed.species}</span>
                  <span className="badge">{breed.utility} purpose</span>
                  <span className={`badge ${breed.status === 'landrace' ? 'badge-warn' : ''}`}>
                    {breed.status === 'landrace' ? 'locally recognised landrace' : 'registered breed'}
                  </span>
                </div>
                <h1 className="h-section">{breed.name}</h1>
                <p className="lead mt-2">{breed.summary}</p>
                <p className="dim mt-2" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.9rem' }}>
                  <MapPin size={15} style={{ color: 'var(--accent)' }} />
                  {breed.origin.country} — {breed.origin.state} · {breed.origin.regions.join(', ')}
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' }}>
          <Reveal delay={1}>
            <div className="card" style={{ height: '100%' }}>
              <h3 className="card-title mb-3"><Ruler size={17} /> Physical descriptors</h3>
              <div style={{ display: 'grid', gap: '.8rem', fontSize: '.93rem' }}>
                <div><span className="faint mono" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.1em' }}>Coat</span><div className="dim">{breed.coat}</div></div>
                <div><span className="faint mono" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.1em' }}>Horns</span><div className="dim">{breed.horns}</div></div>
                <div><span className="faint mono" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.1em' }}>Temperament</span><div className="dim">{breed.temperament}</div></div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={2}>
            <div className="card" style={{ height: '100%' }}>
              <h3 className="card-title mb-3"><Droplets size={17} /> Production</h3>
              <div className="yield-meter">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem' }}>
                  <span className="dim">Milk yield / lactation</span>
                  <span className="mono" style={{ color: 'var(--accent)' }}>{lo}–{hi} kg</span>
                </div>
                <div className="track"><div className="fill" style={{ width: `${Math.min(100, (hi / YIELD_MAX) * 100)}%` }} /></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginTop: '.6rem' }}>
                  <span className="dim">Milk fat</span>
                  <span className="mono" style={{ color: 'var(--accent)' }}>{flo}–{fhi}%</span>
                </div>
                <div className="track"><div className="fill" style={{ width: `${Math.min(100, (fhi / 12) * 100)}%` }} /></div>
                <p className="faint mt-2" style={{ fontSize: '.75rem' }}>Bars are scaled against the best Indian performer (Murrah, ~2,500 kg; Surti fat, ~12%).</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={3}>
            <div className="card" style={{ height: '100%' }}>
              <h3 className="card-title mb-3"><Weight size={17} /> Distinguishing traits</h3>
              <ul className="trait-list">
                {breed.traits.map((t) => (
                  <li key={t}><Check size={15} /> {t}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal>
          <div className="card" style={{ background: 'var(--grad-soft)' }}>
            <h3 className="card-title mb-2">Did you know?</h3>
            <p className="dim">{breed.fun_fact}</p>
            <div className="mt-3" style={{ display: 'flex', gap: '.7rem', flexWrap: 'wrap' }}>
              <Link to="/classify" className="btn btn-primary btn-sm">Classify a {breed.species === 'buffalo' ? 'buffalo' : 'cow'}</Link>
              <Link to="/breeds" className="btn btn-ghost btn-sm">More breeds</Link>
            </div>
          </div>
        </Reveal>
      </div>
    </>
  );
}
