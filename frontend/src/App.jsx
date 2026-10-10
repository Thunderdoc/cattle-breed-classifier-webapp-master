import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { BackToTop, CommandPalette, ErrorBoundary, Footer, Nav, PageMeta, ToastHost } from './components/chrome';
import { StoreProvider } from './lib/store';
import About from './pages/About';
import Breeds from './pages/Breeds';
import BreedDetail from './pages/BreedDetail';
import Classify from './pages/Classify';
import Docs from './pages/Docs';
import Landing from './pages/Landing';
import ModelCard from './pages/ModelCard';
import NotFound from './pages/NotFound';

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  React.useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash]);
  return null;
}

function Shell() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="bg-scene" aria-hidden="true" />
      <div className="bg-grid" aria-hidden="true" />
      <Nav />
      <main id="main">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/classify" element={<Classify />} />
            <Route path="/breeds" element={<Breeds />} />
            <Route path="/breeds/:slug" element={<BreedDetail />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/model" element={<ModelCard />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
      <ToastHost />
      <BackToTop />
      <CommandPalette />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ScrollToTop />
      <Shell />
      <PageMeta />
    </StoreProvider>
  );
}
