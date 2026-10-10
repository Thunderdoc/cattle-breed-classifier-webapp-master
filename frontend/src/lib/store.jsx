import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { useLocalStorage } from './hooks';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [theme, setTheme] = useLocalStorage('bovine.theme', 'dark');
  const [toasts, setToasts] = useState([]);
  const [system, setSystem] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#191c16' : '#f2ede1';
  }, [theme]);

  useEffect(() => {
    let alive = true;
    api
      .system()
      .then((s) => alive && setSystem(s))
      .catch(() => alive && setSystem(null));
    return () => {
      alive = false;
    };
  }, []);

  const toast = useCallback((message, kind = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      toasts,
      toast,
      dismissToast,
      system,
      paletteOpen,
      setPaletteOpen,
    }),
    [theme, setTheme, toasts, toast, dismissToast, system, paletteOpen]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
