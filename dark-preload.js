// Nova's smart dark mode, page side (the main-process half is darkmode.js). Registered in every tab only while the feature is on.
// Per frame it asks one tiny synchronous question: is this site dark? Only a "yes" brings Dark Reader's engine (MIT, assets/darkreader)
// into this isolated world, so on every other page nothing is loaded, no observer runs and no process exists.
const { ipcRenderer } = require('electron');
try {
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    let DR = null, broken = false;
    // a frame inside a page follows the site of the page it sits in, like the Dark Reader extension does
    const topHost = () => { try { const o = location.ancestorOrigins; return o && o.length ? new URL(o[o.length - 1]).hostname : location.hostname; } catch (e) { return location.hostname; } };
    const ask = () => { try { return ipcRenderer.sendSync('nova:dark', { host: location.hostname, top: topHost(), needCode: !DR }); } catch (e) { return null; } };
    // stylesheets and images from other sites cannot be read by a page; the engine asks the main process, which is allowed to
    const viaMain = async (url) => {
      const r = await ipcRenderer.invoke('nova:dark-fetch', url, location.href);
      if (!r || r.error) throw new Error((r && r.error) || 'could not load ' + url);
      return new Response(r.body, { status: r.status, headers: { 'content-type': r.type } });
    };
    const whenRoot = (fn) => {
      if (document.documentElement) return fn();
      const mo = new MutationObserver(() => { if (document.documentElement) { mo.disconnect(); fn(); } });
      mo.observe(document, { childList: true });
    };
    const apply = (r) => {
      if (broken) return;
      if (!r || !r.on) { try { if (DR && DR.isEnabled()) DR.disable(); } catch (e) { /* page is going away */ } return; }
      try {
        if (!DR) { // the engine is a UMD bundle: hand it a module object of our own so it never touches the page's globals
          const m = { exports: {} };
          new Function('module', 'exports', r.code)(m, m.exports);
          DR = m.exports; DR.setFetchMethod(viaMain);
        }
        whenRoot(() => { try { DR.enable(r.theme); } catch (e) { broken = true; } });
      } catch (e) { broken = true; }
    };
    ipcRenderer.on('nova:dark-refresh', () => { apply(ask()); ipcRenderer.send('nova:dark-ack'); });
    apply(ask());
  }
} catch (e) { /* not available in this frame */ }
