# Nova

A fast, quiet Chromium browser with a better way to handle tabs.

**Three pillars:** performance first, then customisation, then user experience.

- **Three profiles:** Ultra Performance (bare minimum), Nova (recommended), Complete (everything on)
- **Resource budget:** set a memory limit and Nova keeps itself under it; a CPU guard sleeps greedy background tabs
- **Built-in ad blocker** using the uBlock Origin filter lists
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
gh release create v0.7.0 dist/Nova-Setup-0.7.0.exe --generate-notes
```

Installed copies of Nova check this repository's latest release on startup and update themselves.

## Third-party

Interface icons come from the IBM Carbon Design System (Apache License 2.0, https://github.com/carbon-design-system/carbon). The Inter typeface is used under the SIL Open Font License. The ad blocker is built on @ghostery/adblocker-electron.
