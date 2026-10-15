/**
 * Convert Android's incoming share intent into
 * a route that Folio already understands.
 *
 * Other deep links are left unchanged.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    const incomingUrl = new URL(path);

    if (incomingUrl.hostname === 'expo-sharing') {
      console.log(
        'FOLIO INCOMING SHARE: Redirecting to Home'
      );

      return '/';
    }
  } catch {
    // Normal relative routes are not necessarily
    // absolute URLs. Leave them unchanged.
  }

  return path;
}
