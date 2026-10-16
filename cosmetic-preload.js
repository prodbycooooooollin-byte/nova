// Nova's cosmetic filtering and scriptlet injection. Runs in every frame before any page script.
// The stock Ghostery preload asks the main process and injects the answer later, after the page has already started, which is too late
// for uBlock Origin's scriptlets (they must be in place before YouTube reads its player data). Here the answer is fetched synchronously,
// so hide rules and scriptlets are active from the first line of the page, the way uBlock Origin does it.
const { ipcRenderer, contextBridge, webFrame } = require('electron');
try {
  if (/^https?:$/.test(location.protocol)) {
    let r = null;
    try { r = ipcRenderer.sendSync('nova:cosmetics', location.href); } catch (e) { /* main process busy or closing */ }
    if (r && r.active !== false) {
      if (r.styles) { try { webFrame.insertCSS(r.styles, { cssOrigin: 'user' }); } catch (e) { /* frame is going away */ } }
      for (const code of r.scripts || []) {
        try { contextBridge.executeInMainWorld({ func: new Function(code) }); } catch (e) { /* one broken scriptlet must not stop the others */ }
      }
      // Generic hide rules depend on the class names, ids and links a page actually uses. Two passes (not a permanent observer) keep this cheap.
      const scan = () => {
        try {
          const classes = new Set(), ids = new Set(), hrefs = new Set();
          for (const el of document.querySelectorAll('[class],[id],a[href]')) {
            if (classes.size + ids.size + hrefs.size > 6000) break;
            if (el.id) ids.add(el.id);
            if (typeof el.className === 'string') for (const c of el.className.split(/\s+/)) if (c) classes.add(c);
            const h = el.getAttribute && el.tagName === 'A' ? el.getAttribute('href') : null; if (h) hrefs.add(h);
          }
          ipcRenderer.invoke('nova:cosmetics-dom', location.href, { classes: [...classes], ids: [...ids], hrefs: [...hrefs] }).then((css) => { if (css) webFrame.insertCSS(css, { cssOrigin: 'user' }); }).catch(() => {});
        } catch (e) { /* ignore */ }
      };
      document.addEventListener('DOMContentLoaded', () => setTimeout(scan, 250), { once: true });
      window.addEventListener('load', () => setTimeout(scan, 1800), { once: true });
    }
  }
} catch (e) { /* not available in this frame */ }
