# folio.

**A little space for the things worth keeping.**

Ever saved a link and forgotten where it went? Screenshotted something useful, only to lose it in your gallery? Or had an idea that deserved more than a temporary note?

That's why I built **Folio** — a personal pocket library for the things you want to return to.

One place. Three ways to save. No unnecessary clutter.

## What can Folio do?

- **Notes** — Capture ideas, thoughts, and anything worth writing down.
- **Links** — Save useful websites and open them again whenever you need them.
- **Images** — Keep visual references and photos alongside your other saved items.
- **Library** — Browse everything in one place, with search and filters.
- **Archive** — Put things away without losing them.
- **Recently Deleted** — Restore accidentally deleted items before their 30-day cleanup.
- **Appearance** — Choose Light, Dark, or System mode, with your preference remembered.

Saved content is stored locally using SQLite, so your library survives app restarts without requiring an internet connection.

## The tech behind it

| Technology | Purpose |
|---|---|
| React Native | Cross-platform mobile interface |
| Expo | Development and native platform tooling |
| TypeScript | Safer, maintainable application code |
| Expo Router | File-based navigation |
| SQLite | Local persistent storage |
| Expo Image Picker / File System | Image selection and file management |

## Getting started

**Requirements:** Node.js, npm, and Expo Go or a compatible development build.

```bash
git clone https://github.com/sam-tc/folio-app.git
cd folio-app
npm install
npx expo start
```

Scan the QR code using Expo Go on a supported device, or launch the app using an available simulator.

For development checks:

```bash
npx tsc --noEmit
npx expo-doctor
```

Some native capabilities require a development build rather than Expo Go.

## How it works

Folio keeps its saved items in a local SQLite database. Each item has a type and associated content, allowing notes, links, and images to share the same library experience.

Images are stored as files with their metadata managed separately. Archive and deletion operations change an item's state, making recovery possible before permanent cleanup.

The interface separates capturing, browsing, editing, and managing saved content into simple, focused flows.

## Design philosophy

**Make saving effortless. Make rediscovery enjoyable.**

Folio is designed to feel more like a personal collection than a productivity dashboard. The focus is on readable content, clear interactions, thoughtful colors, and minimal friction.

## Testing

The local-first workflows have been exercised on iPhone, including:

- Creating and editing notes, links, and images
- Searching and filtering saved content
- Archiving, restoring, and deleting items
- Persisting content across app restarts
- Switching between appearance modes

Native features and Android-specific behaviour should be checked in their respective builds before being marked as fully verified.

## Future improvements

More reliable cross-device synchronization, native sharing, and reminders are natural extensions of Folio's core experience.

---

**Built with curiosity, iterations, and a lot of testing.**

*Keep what matters. Find it when it matters.*