import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Scan } from 'lucide-react';
import { PageMeta } from '../components/chrome';

export default function NotFound() {
  return (
    <>
      <PageMeta title="404" />
      <div className="nf">
        <div>
          <div className="code">404</div>
          <h1 className="h-sub mt-2">This pasture is empty</h1>
          <p className="lead" style={{ margin: '.8rem auto 1.8rem' }}>
            The page you were after wandered off. Let&apos;s herd you back.
          </p>
          <div style={{ display: 'flex', gap: '.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" className="btn btn-primary"><Home size={16} /> Home</Link>
            <Link to="/classify" className="btn btn-outline"><Scan size={16} /> Classify</Link>
          </div>
        </div>
      </div>
    </>
  );
}
