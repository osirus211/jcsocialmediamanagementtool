import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'auto';

export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // Check if dark mode is enabled via Tailwind's dark mode class
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (isDarkMode) {
      setTheme('dark');
    } else if (prefersDark) {
      setTheme('auto');
    } else {
      setTheme('light');
    }

    // Listen for changes to system preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!document.documentElement.classList.contains('dark')) {
        setTheme(e.matches ? 'auto' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    
    // Listen for changes to dark mode class
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark');
          setTheme(isDark ? 'dark' : (prefersDark ? 'auto' : 'light'));
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      observer.disconnect();
    };
  }, []);

  return theme;
}