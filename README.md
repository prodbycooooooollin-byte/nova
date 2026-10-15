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

Bump `version` in `package.json`, commit, then:

```
git tag v0.5.0
git push --tags
```

GitHub Actions builds `Nova-Setup-<version>.exe` and attaches it to the release. Nova checks for it on startup.
