import { createContext, useContext, useEffect, useState } from 'react';

interface DarkModeContextValue {
  dark: boolean;
  toggle: () => void;
}

const DarkModeContext = createContext<DarkModeContextValue>({ dark: false, toggle: () => {} });

export const DarkModeProvider = ({ children }: { children: React.ReactNode }) => {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <DarkModeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDarkMode = () => useContext(DarkModeContext);
