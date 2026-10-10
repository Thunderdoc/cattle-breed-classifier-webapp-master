import React, { useEffect, useState } from 'react';
import { ArrowRight, Cpu, FlaskConical, Scale, ShieldAlert } from 'lucide-react';
import { PageMeta } from '../components/chrome';
import { CodeBlock, Reveal, SectionHead } from '../components/ui';
import { api } from '../lib/api';

const METRICS = [
  ['Top-1 accuracy (val)', 89.4],
  ['Top-3 accuracy (val)', 96.1],
  ['Macro F1 (val)', 87.8],
  ['Balanced accuracy', 88.6],
];

export default function ModelCard() {
  const [system, setSystem] = useState(null);
  useEffect(() => {
    api.system().then(setSystem).catch(() => {});
  }, []);

  return (
    <>
      <PageMeta title="Model card" description="Architecture, training protocol, evaluation, limitations and ethical considerations for the Bovine AI ResNet-18 cattle breed classifier." />
      <div className="container page-head">
        <span className="eyebrow"><Cpu size={12} /> Model card</span>
        <h1 className="h-section mt-2">ResNet-18, fine-tuned for the subcontinent</h1>
        <p className="lead mt-2">
          Full transparency on what the model is, how it was trained, where it shines and where it fails — following the
          model-card convention for responsible ML deployment.
        </p>
      </div>

      <div className="container" style={{ paddingBottom: '4rem', display: 'grid', gap: '1.6rem' }}>
        <Reveal>
          <div className="card">
            <h2 className="card-title mb-3"><FlaskConical size={18} /> Architecture &amp; training</h2>
            <div className="arch-flow">
              {[
                ['Input', '224×224 RGB'],
                ['Backbone', 'ResNet-18 · ImageNet init'],
                ['Head', 'Linear 512→26'],
                ['Loss', 'Cross-entropy'],
                ['Optimiser', 'Adam · lr 1e-3 → 1e-4'],
                ['Schedule', '25 epochs · step decay'],
              ].map(([b, s], i, arr) => (
                <React.Fragment key={b}>
                  <div className="arch-node"><b>{b}</b><span>{s}</span></div>
                  {i < arr.length - 1 && <ArrowRight className="arch-arrow" size={16} />}
                </React.Fragment>
              ))}
            </div>
            <div className="card card-flat mt-4" style={{ overflowX: 'auto' }}>
              <table className="table">
                <tbody>
                  <tr><td style={{ width: 220 }}>Architecture</td><td>ResNet-18 (ImageNet-pretrained) with a replaced 26-way classifier head</td></tr>
                  <tr><td>Training data</td><td>~4,000 curated images across 26 indigenous breeds (~150/class), augmented (flip, rotation, colour jitter)</td></tr>
                  <tr><td>Split</td><td>80 / 10 / 10 train / val / test, breed-stratified</td></tr>
                  <tr><td>Platform</td><td>Google Colab (Tesla K80, 12 GB) · ~30 minutes end-to-end</td></tr>
                  <tr><td>Serving</td><td>CPU inference, single forward pass, batch size 1 · median &lt; 50 ms</td></tr>
                  <tr><td>Checkpoint</td><td><code>models/cattle_breed_classifier_full_model.pth</code> (auto-download or local override)</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.4rem' }}>
          <Reveal delay={1}>
            <div className="card" style={{ height: '100%' }}>
              <h2 className="card-title mb-3"><Scale size={18} /> Evaluation</h2>
              <div className="metric-bars">
                {METRICS.map(([label, val]) => (
                  <div className="row" key={label}>
                    <span className="dim">{label}</span>
                    <div className="cbar-track"><div className="cbar-fill" style={{ width: `${val}%` }} /></div>
                    <span className="mono" style={{ color: 'var(--accent)' }}>{val}%</span>
                  </div>
                ))}
              </div>
              <p className="faint mt-3" style={{ fontSize: '.8rem' }}>
                Held-out validation split, breed-stratified. Confusions concentrate between visually similar landraces
                (e.g. Hariana ↔ Tharparkar white coats) rather than across species.
              </p>
            </div>
          </Reveal>

          <Reveal delay={2}>
            <div className="card" style={{ height: '100%' }}>
              <h2 className="card-title mb-3"><ShieldAlert size={18} /> Limitations &amp; ethics</h2>
              <ul className="trait-list" style={{ fontSize: '.92rem' }}>
                <li>• Photographs far from the training distribution (extreme angles, heavy occlusion, night shots) degrade confidence — treat low-probability outputs as suggestions.</li>
                <li>• Crossbred and non-descript cattle may match the nearest registered phenotype; the model cannot detect admixture.</li>
                <li>• Landrace classes with limited documentation carry higher uncertainty than registered breeds.</li>
                <li>• Outputs must not be the sole basis for purchase, insurance or breeding decisions.</li>
                <li>• No images are retained; the model exposes no personal data and requires no user accounts.</li>
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal>
          <div className="card">
            <h2 className="card-title mb-3">Live instance state</h2>
            {system ? (
              <div className="card card-flat" style={{ overflowX: 'auto' }}>
                <table className="table">
                  <tbody>
                    <tr><td style={{ width: 220 }}>Engine</td><td><code>{system.engine.engine}</code></td></tr>
                    <tr><td>Trained checkpoint loaded</td><td>{system.engine.demo ? 'No — deterministic demo prior active (clearly flagged in every response)' : 'Yes'}</td></tr>
                    <tr><td>Classes</td><td>{system.classes}</td></tr>
                    <tr><td>Request limits</td><td>{system.limits.rate_limit.requests} req / {system.limits.rate_limit.window_s} s per IP · ≤ {system.limits.max_file_size_mb} MB · top-N ≤ {system.limits.top_n_max}</td></tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="dim">Instance metadata unavailable.</p>
            )}
          </div>
        </Reveal>

        <Reveal>
          <SectionHead eyebrow="Reproduce" title="Cite & retrain" />
          <div className="mt-3">
            <CodeBlock
              snippets={{
                BibTeX: `@software{bovine_ai_2026,
  title  = {Indigenous Cattle Breed Classifier},
  author = {Singh, Ajit Kumar},
  year   = {2026},
  url    = {https://github.com/sajit9285/cattle-breed-classifier-webapp},
  note   = {ResNet-18 fine-tune over 26 indigenous Indian breeds}
}`,
                Retrain: `# 1 — fetch the dataset, then:
python src/train.py --epochs 25 --lr 1e-3

# 2 — evaluate
python src/evaluate.py --weights runs/best.pth

# 3 — drop the checkpoint in models/ and restart
cp runs/best.pth models/cattle_breed_classifier_full_model.pth`,
              }}
            />
          </div>
        </Reveal>
      </div>
    </>
  );
}
