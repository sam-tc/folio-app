import { useEffect, useState } from 'react';
import { useFolioColorScheme } from '@/components/appearance-provider';

// Avoid a server/client appearance mismatch when rendering for web.
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const colorScheme = useFolioColorScheme();
  useEffect(() => { setHasHydrated(true); }, []);
  return hasHydrated ? colorScheme : 'light';
}
