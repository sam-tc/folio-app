
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { purgeExpiredDeletedItems } from '@/database/items';

export function ForegroundCleanup() {
  const db = useSQLiteContext();

  useEffect(() => {
    let previousState = AppState.currentState;

    const subscription = AppState.addEventListener(
      'change',
      (nextState) => {
        const returnedToForeground =
          (previousState === 'background' ||
            previousState === 'inactive') &&
          nextState === 'active';

        previousState = nextState;

        if (!returnedToForeground) {
          return;
        }

        void purgeExpiredDeletedItems(db)
          .then((deletedCount) => {
            console.log(
              'Folio foreground cleanup:',
              deletedCount,
              'expired items removed'
            );
          })
          .catch((error) => {
            console.error(
              'Folio foreground cleanup failed:',
              error
            );
          });
      }
    );

    return () => {
      subscription.remove();
    };
  }, [db]);

  return null;
}
