# Backbone

Backbone is a personal, back-pain-aware workout tracker: a small offline-first PWA for logging
strength sessions and mobility work when your lower back has opinions about it. It remembers what
you lifted last time, times your rests and stretch holds, and can substitute exercises that
compress the spine so a flare-up means adapting the session rather than skipping it. It runs
entirely in the browser with no account and no server, installs to the home screen, and works
with the phone in airplane mode. **Backbone is not medical advice.** It is a log, not a clinician.
Train pain-guided: stay inside a range that does not increase your symptoms, back off when it
does, and get anything new or worsening looked at by a physio or doctor.

## Stack

Vanilla JavaScript, native ES modules, plain CSS. No build step, no dependencies, no framework.
What is in the repo is what ships.

```
index.html              static shell: tab bar, toast host, sheet root
css/style.css           the whole design system (tokens + component classes)
js/app.js               boot, hash router, showToast / openSheet / navigate / el
js/store.js             the ONLY module that touches localStorage
js/wakelock.js          Screen Wake Lock wrapper
js/views/*.js           one module per screen: export mount(rootEl), optional unmount()
sw.js                   service worker (must stay at the repo root for scope)
manifest.webmanifest    PWA manifest
icons/                  generated PNG icons
```

## Local development

```sh
python3 -m http.server 8765
# then open http://localhost:8765/
```

A static file server is required: ES modules and the service worker will not load over `file://`.
Service workers do run on `http://localhost`, so install and offline behaviour are testable
locally. To test as it will behave on GitHub Pages, serve from a parent directory and open
`http://localhost:8765/workout-tracker/`.

**All URLs in this project must be relative (`./…`).** The app is hosted on GitHub Pages under a
repository subpath, so a leading `/` resolves to the wrong place and silently breaks the manifest,
the service worker scope, and every dynamic view import.

## Deploy checklist

1. **Bump `CACHE` in `sw.js`** (`wt-v1` → `wt-v2` → …). This is required on *every* release.
   Without it, returning users keep the old cached files forever.
2. **Keep `PRECACHE` in `sw.js` in sync** with the files that actually exist. Adding a view module
   or an asset without adding it to `PRECACHE` means that file is not available offline.
3. Bump `APP_VERSION` in `js/store.js` (shown on the Settings screen).
4. Confirm every path is relative, including any new dynamic `import()`.
5. Push to the deploy branch. On next open, the app detects the new worker and offers
   "Update ready — Restart". That prompt is deliberately suppressed while a workout is in
   progress, so a reload can never wipe an in-flight session.

## Where the data lives

Everything is in `localStorage` on the phone, under keys prefixed `wt.` (`wt.settings`,
`wt.sessions`, `wt.exerciseState`, `wt.activeSession`, `wt.bodyWeights`, `wt.meta`). There is no
sync and no server copy, which means:

- Clearing the browser's site data, or uninstalling the PWA on some Androids, deletes your
  history. The app calls `navigator.storage.persist()` to reduce the chance of automatic
  eviction, but that is a request, not a guarantee.
- **Back up from Settings → Export backup.** That writes a `backbone-backup-YYYY-MM-DD.json`
  file to your downloads. Settings shows how long ago the last export was.
- Import replaces everything. Before it does, it automatically exports the current data as
  `backbone-pre-import-YYYY-MM-DD.json`, so a mistaken import is recoverable.
- If a stored value is ever unreadable, the raw string is copied to `wt.corrupt.<key>` rather than
  being discarded, and that key is reset to its default.

## Icons

`icons/*.png` are generated, not hand-drawn. They were produced by a throwaway pure-Python PNG
writer (no Pillow required) rendering a rounded dark square plus a six-vertebra spine glyph in the
accent teal. To change the mark, regenerate all four sizes together so they stay consistent:
`icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (extra safe-zone padding, full-bleed
background), and `apple-touch-icon.png` (180px).
