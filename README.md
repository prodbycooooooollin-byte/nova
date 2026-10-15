# Nova

A minimal, fast Chromium browser with a better way to handle tabs.

- Three profiles: Ultra Performance, Nova (recommended), Complete
- Resource budget: you set a memory limit, Nova keeps itself under it
- Built-in ad blocker using the uBlock Origin filter lists
- Vertical tabs, spaces, command bar (Ctrl+K), tab overview
- Fully customisable: theme, layout, shortcuts, custom CSS and JS
- One-click extension install from the Chrome Web Store
- Auto-updates from GitHub releases

## Develop

```
npm install
npm start
```

## Release

Bump `version` in `package.json`, build the installer and publish it as a GitHub release:

```
npx electron-builder --win portable --publish never
gh release create v0.5.0 dist/Nova-Setup-0.5.0.exe --generate-notes
```

Installed copies of Nova check this repository's latest release on startup and update themselves.
