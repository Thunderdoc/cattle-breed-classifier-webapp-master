import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Download } from 'lucide-react';
import { PageMeta } from '../components/chrome';
import { CodeBlock, Reveal } from '../components/ui';
import { api } from '../lib/api';

const FETCH_SNIPPET = `# the bundled subset is hand-verified; the full training corpus
# (≈4,000 labelled photographs, 26 breeds) is fetched on demand:
python3 scripts/fetch_dataset.py --out data/raw

# …then index it into the service (copies curated plates,
# rebuilds static/dataset/<breed-slug>/ folders + manifests):
python3 scripts/fetch_dataset.py --ingest`;

export default function Dataset() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.dataset().then(setData).catch(() => {});
  }, []);

  const breeds = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.breeds;
    return data.breeds.filter((b) =>
      b.breed.endsWith('buffalo') ? filter === 'buffalo' : filter === 'cattle',
    );
  }, [data, filter]);

  return (
    <>
      <PageMeta
        title="Field archive"
        description="Every real photograph bundled with the cattle breed classifier, grouped per breed with full provenance — plus the path to the complete training corpus."
      />
      <div className="container page-head">
        <span className="eyebrow">
          <Archive size={14} /> The field archive
        </span>
        <h1 className="h-display">Every photograph we ship, and where it came from.</h1>
        <p className="lead" style={{ maxWidth: '62ch' }}>
          No renders, no stock montages: each plate below is a real field or press photograph,
          checked by hand against the breed it labels, filed per breed with its provenance.
          The archive feeds the catalogue plates, the studio&apos;s sample picker and the demo
          engine&apos;s colour prototypes.
        </p>
      </div>

      <div className="container section" style={{ paddingTop: 0 }}>
        {data ? (
          <>
            <div className="folio mb-3" aria-hidden="true">
              <span>{data.total_images} photographs</span>
              <span className="folio-mid">{data.breeds_with_images} breeds filed</span>
              <span>provenance per file</span>
            </div>
            <div className="chip-row mb-3" role="group" aria-label="Filter archive by species">
              {[
                ['all', 'Everything'],
                ['cattle', 'Cattle'],
                ['buffalo', 'Buffalo'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className="chip"
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="dataset-grid">
              {breeds.map((b) => (
                <figure className="dataset-card" key={b.breed}>
                  <div className="dataset-thumbs">
                    {b.images.map((im) => (
                      <img key={im.url} src={im.url} alt={`${b.name} reference photograph`} loading="lazy" />
                    ))}
                  </div>
                  <figcaption>
                    <span className="dataset-name">
                      <Link to={`/breeds/${b.breed}`} style={{ color: 'inherit' }}>
                        {b.name}
                      </Link>
                    </span>
                    <span className="dataset-count mono">
                      {b.count} photo{b.count === 1 ? '' : 's'}
                    </span>
                    <ul className="dataset-credits">
                      {b.images.map((im) => (
                        <li key={im.url}>{im.credit || 'Provenance on file'}</li>
                      ))}
                    </ul>
                  </figcaption>
                </figure>
              ))}
            </div>
          </>
        ) : (
          <p className="dim">Loading the archive index…</p>
        )}
      </div>

      <div className="container section" style={{ paddingTop: 0 }}>
        <Reveal>
          <div className="card">
            <h2 className="card-title mb-2">Beyond the bundled subset</h2>
            <p className="dim mb-3" style={{ fontSize: '.92rem', maxWidth: '78ch' }}>
              What ships in the repository is the verified core: a hand-checked plate per covered
              breed. The complete training corpus — roughly four thousand labelled photographs
              across the twenty-six classes, extensible to ten thousand and beyond as new field
              plates are ingested — is downloaded and indexed by script, so any deployment can
              rebuild the full dataset without touching the application code. Dropped folders are
              picked up automatically under <code className="mono">static/dataset/&lt;breed-slug&gt;/</code>.
            </p>
            <CodeBlock snippets={{ Bash: FETCH_SNIPPET }} />
            <p className="dim mt-2" style={{ fontSize: '.8rem' }}>
              <Download size={13} style={{ verticalAlign: '-2px' }} /> The fetcher verifies
              checksums, skips duplicates and writes provenance entries for everything it ingests.
            </p>
          </div>
        </Reveal>
      </div>
    </>
  );
}
