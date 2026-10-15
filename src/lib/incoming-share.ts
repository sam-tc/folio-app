import type { SharePayload } from 'expo-sharing';

import { normalizeWebUrl } from '@/database/items';

export type PreparedIncomingShare =
  | {
      status: 'ready';
      type: 'note' | 'link';
      title: string;
      content: string;
      originalText: string;
    }
  | {
      status: 'empty' | 'unsupported';
      message: string;
    };

function tryNormalizeUrl(value: string): string | null {
  try {
    return normalizeWebUrl(value);
  } catch {
    return null;
  }
}

function getWebsiteTitle(url: string): string {
  try {
    const hostname = new URL(url).hostname;

    return hostname.replace(/^www\./i, '');
  } catch {
    return 'Shared link';
  }
}

function prepareText(
  text: string,
  explicitlyUrl: boolean
): PreparedIncomingShare {
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      status: 'empty',
      message: 'The shared content is empty.',
    };
  }

  if (explicitlyUrl) {
    const normalizedUrl = tryNormalizeUrl(trimmed);

    if (!normalizedUrl) {
      return {
        status: 'unsupported',
        message: 'The shared website address is not valid.',
      };
    }

    return {
      status: 'ready',
      type: 'link',
      title: getWebsiteTitle(normalizedUrl),
      content: normalizedUrl,
      originalText: trimmed,
    };
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  /*
   * Android browsers may share either:
   *
   * https://example.com
   *
   * or:
   *
   * Example Page
   * https://example.com
   *
   * Only interpret the text as a link when the
   * final line is clearly a URL.
   */
  const lastLine = lines[lines.length - 1] ?? '';

  const looksLikeUrl =
    /^https?:\/\/\S+$/i.test(lastLine);

  if (looksLikeUrl) {
    const normalizedUrl = tryNormalizeUrl(lastLine);

    if (normalizedUrl) {
      const sharedTitle = lines
        .slice(0, -1)
        .join(' ')
        .trim();

      return {
        status: 'ready',
        type: 'link',
        title:
          sharedTitle.slice(0, 150) ||
          getWebsiteTitle(normalizedUrl),
        content: normalizedUrl,
        originalText: trimmed,
      };
    }
  }

  /*
   * Keep ordinary text intact.
   *
   * In particular, don't discard surrounding
   * sentences merely because they contain a URL.
   */
  const firstLine = lines[0] ?? 'Shared note';

  return {
    status: 'ready',
    type: 'note',
    title: firstLine.slice(0, 80),
    content: trimmed,
    originalText: trimmed,
  };
}

/**
 * Prepare an incoming Android share for review.
 *
 * This function never saves anything.
 * The user must explicitly confirm the save
 * on the review screen.
 */
export function prepareIncomingShare(
  payloads: SharePayload[]
): PreparedIncomingShare {
  if (payloads.length === 0) {
    return {
      status: 'empty',
      message: 'Nothing has been shared with Folio.',
    };
  }

  if (payloads.length > 1) {
    return {
      status: 'unsupported',
      message:
        'Please share one text item or website link at a time.',
    };
  }

  const payload = payloads[0];

  if (
    payload.shareType &&
    payload.shareType !== 'text' &&
    payload.shareType !== 'url'
  ) {
    return {
      status: 'unsupported',
      message:
        'Folio currently accepts shared text and website links.',
    };
  }

  const mimeType = payload.mimeType?.toLowerCase();

  if (
    mimeType &&
    mimeType !== 'text/plain' &&
    mimeType !== 'text/uri-list'
  ) {
    return {
      status: 'unsupported',
      message:
        'This shared content format is not supported.',
    };
  }

  return prepareText(
    payload.value ?? '',
    payload.shareType === 'url'
  );
}
