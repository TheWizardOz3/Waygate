'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

interface ThemeProviderProps {
  children: React.ReactNode;
  /**
   * Default theme to use if no theme is stored
   * @default 'system'
   */
  defaultTheme?: 'light' | 'dark' | 'system';
  /**
   * Key used to store theme preference in localStorage
   * @default 'waygate-theme'
   */
  storageKey?: string;
  /**
   * Whether to enable system theme detection
   * @default true
   */
  enableSystem?: boolean;
  /**
   * Disable all CSS transitions when switching themes
   * @default true
   */
  disableTransitionOnChange?: boolean;
}

/**
 * Theme provider that wraps the application and manages dark/light mode.
 * Uses next-themes under the hood with class-based dark mode (matches Tailwind config).
 *
 * Theme is persisted to localStorage and syncs with system preference by default.
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'waygate-theme',
  enableSystem = true,
  disableTransitionOnChange = true,
  ...props
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      disableTransitionOnChange={disableTransitionOnChange}
      storageKey={storageKey}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
