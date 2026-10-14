import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Appearance } from 'react-native';
import Storage from 'expo-sqlite/kv-store';

// A preference is different from the effective theme.
// "system" means Folio follows the phone's own appearance setting.
export type AppearancePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'folio.appearance.v1';

type AppearanceContextValue = {
  preference: AppearancePreference;
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

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preference, updatePreference] = useState<AppearancePreference>(
    loadSavedPreference
  );

  // This React Native API changes the *whole app's* effective scheme.
  // Existing useColorScheme() hooks in the Library, Archive and tabs
  // therefore update without being rewritten individually.
  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  async function setPreference(nextPreference: AppearancePreference) {
    const previous = preference;
    if (previous === nextPreference) return;

    updatePreference(nextPreference);

    try {
      await Storage.setItem(STORAGE_KEY, nextPreference);
    } catch (error) {
      // Do not show a saved selection if persistence failed.
      updatePreference(previous);
      throw error;
    }
  }

  const value = useMemo(
    () => ({ preference, setPreference }),
    [preference]
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearancePreference() {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error('useAppearancePreference must be used inside AppearanceProvider.');
  }
  return context;
}
