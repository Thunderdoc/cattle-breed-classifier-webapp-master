import React from 'react';
import { Github, Heart, Leaf, Rocket } from 'lucide-react';
import { PageMeta } from '../components/chrome';
import { Reveal, SectionHead } from '../components/ui';

export default function About() {
  return (
    <>
      <PageMeta title="About" description="The story, stack and roadmap behind Bovine AI — an open deep-learning service for identifying indigenous Indian cattle breeds." />
      <div className="container page-head">
        <span className="eyebrow"><Leaf size={12} /> About</span>
        <h1 className="h-section mt-2">Conservation, one prediction at a time</h1>
        <p className="lead mt-2">
          India&apos;s indigenous cattle are genetic treasures — heat-tolerant, disease-resistant, drought-hardy — yet many
          breeds are declining because they are simply invisible to modern markets. Bovine AI makes them visible.
        </p>
      </div>

      <div className="container" style={{ paddingBottom: '4rem', display: 'grid', gap: '1.6rem' }}>
        <Reveal>
          <div className="card" style={{ padding: 'clamp(1.6rem,4vw,2.6rem)' }}>
            <h2 className="h-sub mb-3">The project</h2>
            <p className="dim" style={{ maxWidth: '78ch' }}>
              Started as a PyTorch training notebook over ~4,000 crowd-gathered images of 26 indigenous breeds, the
              project grew into a full product: a hardened Flask inference service, a React front-end with an
              encyclopedia of every supported breed, a versioned public API, containerised deployment and CI. The goal
              has never changed — give farmers, cooperatives, vets and researchers a free, instant, honest answer to
              “what breed is this?”.
            </p>
            <div className="feature-grid mt-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {[
                ['PyTorch', 'ResNet-18 fine-tune, CPU-friendly inference'],
                ['Flask 3', 'Versioned API, SSRF guards, rate limits, metrics'],
                ['React 18 + Vite', 'SPA with router, palette, themes, a11y'],
                ['Ops', 'Docker, gunicorn, nginx, GitHub Actions CI'],
              ].map(([t, d]) => (
                <div key={t} className="card card-flat">
                  <div className="card-title" style={{ fontSize: '.98rem' }}>{t}</div>
                  <p className="dim mt-1" style={{ fontSize: '.85rem' }}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.4rem' }}>
          <Reveal delay={1}>
            <div className="card" style={{ height: '100%' }}>
              <h2 className="card-title mb-3"><Rocket size={18} /> Roadmap</h2>
              <ul className="trait-list">
                <li>• Grad-CAM saliency overlays to show <em>why</em> a breed was chosen</li>
                <li>• On-device inference build (ONNX / WebGPU) for offline field use</li>
                <li>• Community photo contributions with expert-verified labels</li>
                <li>• Herd management exports (CSV → coop dashboards)</li>
                <li>• Additional registered breeds as labelled data allows</li>
              </ul>
            </div>
          </Reveal>
          <Reveal delay={2}>
            <div className="card" style={{ height: '100%' }}>
              <h2 className="card-title mb-3"><Heart size={18} /> Contribute</h2>
              <p className="dim" style={{ fontSize: '.93rem' }}>
                The entire stack is MIT-licensed. Issues, breed-data corrections, translations and labelled photos are
                all welcome — the encyclopedia explicitly separates registered breeds from landraces so contributions
                can be credited and provenance kept honest.
              </p>
              <a className="btn btn-primary mt-3" href="https://github.com/sajit9285/cattle-breed-classifier-webapp" target="_blank" rel="noreferrer noopener">
                <Github size={16} /> Open the repository
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal>
          <div className="card" id="license" style={{ background: 'var(--grad-soft)' }}>
            <h2 className="card-title mb-2">Author &amp; license</h2>
            <p className="dim">
              Created and maintained by{' '}
              <a href="https://sajit9285.github.io/myportfolio" target="_blank" rel="noreferrer noopener" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                Ajit Kumar Singh
              </a>
              . Released under the MIT License — use it, fork it, ship it to the field.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <SectionHead center eyebrow="Acknowledgements" title="Standing on open shoulders" sub="PyTorch, torchvision, Flask, React, Vite, lucide icons, Fontsource typefaces and the NBAGR breed registry documentation." />
        </Reveal>
      </div>
    </>
  );
}
