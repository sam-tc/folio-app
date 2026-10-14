import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState, Appearance } from 'react-native';
import Storage from 'expo-sqlite/kv-store';

export type AppearancePreference = 'system' | 'light' | 'dark';
export type FolioColorScheme = 'light' | 'dark';

const STORAGE_KEY = 'folio.appearance.v1';

type AppearanceContextValue = {
  preference: AppearancePreference;
  colorScheme: FolioColorScheme;
  setPreference: (value: AppearancePreference) => Promise<void>;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function isValidPreference(value: string | null): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function loadSavedPreference(): AppearancePreference {
  try {
    const saved = Storage.getItemSync(STORAGE_KEY);
    return isValidPreference(saved) ? saved : 'system';
  } catch (error) {
    console.warn('Could not read Folio appearance preference:', error);
    return 'system';
  }
}

function readSystemScheme(): FolioColorScheme {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preference, updatePreference] =
    useState<AppearancePreference>(loadSavedPreference);
  const [systemScheme, updateSystemScheme] =
    useState<FolioColorScheme>(readSystemScheme);

  useEffect(() => {
    // Listen to genuine iOS/Android system appearance changes directly.
    // Do not call Appearance.setColorScheme: that overrides the OS value.
    const appearanceSubscription = Appearance.addChangeListener(({ colorScheme }) => {
      updateSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });

    // iOS may update appearance while Folio is backgrounded in Settings.
    // Read it again each time Folio becomes active.
    const stateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        updateSystemScheme(readSystemScheme());
      }
    });

    return () => {
      appearanceSubscription.remove();
      stateSubscription.remove();
    };
  }, []);

  const colorScheme: FolioColorScheme =
    preference === 'system' ? systemScheme : preference;

  async function setPreference(nextPreference: AppearancePreference) {
    if (nextPreference === preference) return;
    const previous = preference;
    updatePreference(nextPreference);

    try {
      await Storage.setItem(STORAGE_KEY, nextPreference);
    } catch (error) {
      updatePreference(previous);
      throw error;
    }
  }

  const value = useMemo(
    () => ({ preference, colorScheme, setPreference }),
    [preference, colorScheme]
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearancePreference(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error('useAppearancePreference must be used inside AppearanceProvider.');
  }
  return context;
}

export function useFolioColorScheme(): FolioColorScheme {
  return useAppearancePreference().colorScheme;
}
