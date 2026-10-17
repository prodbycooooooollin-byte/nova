# Nova

A fast, quiet Chromium browser with a better way to handle tabs.

**Three pillars:** performance first, then customisation, then user experience.

- **Three profiles:** Ultra Performance (bare minimum), Nova (recommended), Complete (everything on)
- **Resource budget:** set a memory limit and Nova keeps itself under it; a CPU guard sleeps greedy background tabs
- **Smart sleep:** background tabs freeze after 30 seconds (no CPU, nothing lost), sleep earlier with an invisible wake (scroll position, typed text and a picture of the page are kept; resting the pointer on a sleeping tab wakes it), and how soon a tab sleeps adapts to how fast you come back to each site. Each step has its own switch
- **Built-in ad blocker** using the uBlock Origin filter lists
- **Smart dark mode** (optional, off by default): Dark Reader's engine built in, switched on per site, no extension process
- **Password saver** (optional, off by default): offers to keep a login after you sign in and fills it only when you click it, on the exact same site (scheme, host and port), never in frames and never in private tabs. A site with no login of its own can also be offered the logins of its other addresses (www.tiktok.com and developers.tiktok.com), listed with their address, https only, under their own switch; addresses that strangers share (github.io, onrender.com, vercel.app, lovable.app, ...) are never treated as one site. Every password is sealed with Electron's safeStorage (Windows DPAPI); `passwords.json` holds only the site, the user name and the sealed blob. Settings > Passwords lists, shows, copies, deletes, exports (CSV, with a warning) and imports Chrome CSV files. It is a small built-in for people without a password manager; Proton Pass and Bitwarden keep working as extensions.
- **Tabs:** vertical or top, spaces, drag to reorder, sleeping and archiving, Ctrl+K command bar, tab overview
- **Customisation:** 19 themes, start-page wallpapers (or your own image), layout, density, shortcuts, custom CSS and JS
- **Move in:** bookmarks, history, extensions and search engine from Chrome, Edge, Brave or Vivaldi
- **Library:** bookmarks, history, downloads, clear browsing data
- **Extensions:** one-click install from the Chrome Web Store
- **Auto-updates** from GitHub releases

## Develop

```
npm install
npm start
```

## Release

Bump `version` in `package.json`, build the installer and publish it as a GitHub release:

```
npx electron-builder --win portable --publish never
node scripts/make-update.js dist/win-unpacked dist/Nova-Setup-X.Y.Z.exe X.Y.Z owner/repo dist
gh release create vX.Y.Z dist/Nova-Setup-X.Y.Z.exe dist/Nova-update-X.Y.Z.zip dist/latest.json --generate-notes
```

Installed copies read `latest.json` from the latest release. A normal update is the small `Nova-update-X.Y.Z.zip` (the new `app.asar`, about 6 MB): Nova downloads it, `boot.js` starts it on the next launch, and no installer runs, so antivirus programs have nothing to block. The full Setup exe is only used when an update needs a newer Electron than the installed copy has. A bundle that fails to start is dropped and the built-in version takes over.

## Third-party

Interface icons come from the IBM Carbon Design System (Apache License 2.0, https://github.com/carbon-design-system/carbon). The Inter typeface is used under the SIL Open Font License. The ad blocker is built on @ghostery/adblocker-electron. Smart dark mode runs Dark Reader's dynamic-theme engine (MIT License, Copyright (c) Dark Reader Ltd., https://github.com/darkreader/darkreader); the engine and its licence are in `assets/darkreader/`.
