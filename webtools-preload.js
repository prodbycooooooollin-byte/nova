// Nova's built-in page tools, page side (the main-process half is webtools.js). Registered in every tab only while one of the four
// features is on. Each frame asks one tiny synchronous question and does nothing at all when no tool applies to it.
const { ipcRenderer, webFrame } = require('electron');
try {
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    let cfg = null;
    try { cfg = ipcRenderer.sendSync('nova:tools'); } catch (e) { /* main process busy or closing */ }
    if (cfg && cfg.on) start(cfg);
  }
} catch (e) { /* not available in this frame */ }

function start(cfg) {
  const isTop = window === window.top;
  const onYouTube = /(^|\.)youtube\.com$/.test(location.hostname);

  // ---- a small note over a video, shared by the speed keys and SponsorBlock ----
  let badge = null, badgeTimer = 0;
  const note = (video, text, corner) => {
    try {
      if (!badge) {
        badge = document.createElement('div');
        badge.style.cssText = 'position:fixed;z-index:2147483647;padding:7px 12px;border-radius:9px;background:rgba(10,10,16,.8);color:#fff;font:600 14px/1 system-ui,Segoe UI,sans-serif;pointer-events:none;opacity:0;transition:opacity .25s;white-space:nowrap';
      }
      const host = document.fullscreenElement || document.body || document.documentElement;
      if (badge.parentNode !== host) host.appendChild(badge);
      const r = video.getBoundingClientRect();
      badge.textContent = text;
      badge.style.left = Math.max(8, r.left + 14) + 'px';
      badge.style.top = corner === 'bottom' ? Math.max(8, r.bottom - 64) + 'px' : Math.max(8, r.top + 14) + 'px';
      badge.style.opacity = '1';
      clearTimeout(badgeTimer); badgeTimer = setTimeout(() => { badge.style.opacity = '0'; }, 1300);
    } catch (e) { /* page in a state we cannot draw into */ }
  };
  const bigVideo = () => {
    let best = null, area = 0;
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect(), a = r.width * r.height;
      if (r.width >= 200 && a > area) { area = a; best = v; }
    }
    return best;
  };

  // ---- video speed: S slower, D faster, R back to normal and again to return, Z and X jump ten seconds ----
  if (cfg.speed) {
    let last = 1.5;
    addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.defaultPrevented || !e.key || e.key.length !== 1) return;
      const k = e.key.toLowerCase();
      if (k !== 's' && k !== 'd' && k !== 'r' && k !== 'z' && k !== 'x') return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const v = bigVideo(); if (!v) return;
      if (k === 's' || k === 'd') v.playbackRate = Math.min(16, Math.max(0.1, Math.round((v.playbackRate + (k === 'd' ? 0.25 : -0.25)) * 100) / 100));
      else if (k === 'r') { if (v.playbackRate === 1) v.playbackRate = last; else { last = v.playbackRate; v.playbackRate = 1; } }
      else v.currentTime = Math.max(0, v.currentTime + (k === 'x' ? 10 : -10));
      note(v, k === 'z' ? '−10 s' : k === 'x' ? '+10 s' : v.playbackRate.toFixed(2).replace(/0$/, '') + '×');
      e.preventDefault(); e.stopPropagation();
    }, true);
  }

  // ---- cookie banners: the consent boxes of the common tools are hidden, and a scroll lock they leave behind is lifted ----
  if (cfg.cookies) {
    const BOXES = ['#onetrust-consent-sdk', '#onetrust-banner-sdk', '.onetrust-pc-dark-filter', '#CybotCookiebotDialog', '#CybotCookiebotDialogBodyUnderlay', '.qc-cmp2-container', '#qc-cmp2-container',
      '#didomi-host', '#didomi-notice', '#usercentrics-root', '#uc-center-container', '#truste-consent-track', '.truste_overlay', '.truste_box_overlay', '#consent_blackbar', '#cmplz-cookiebanner-container', '.cmplz-cookiebanner',
      '#BorlabsCookieBox', '.osano-cm-window', '.osano-cm-dialog', '.cky-consent-container', '.cky-overlay', '#iubenda-cs-banner', '#cookiefirst-root', '#cmpbox', '#cmpbox2', '#cmpwrapper',
      '#cookiescript_injected', '#cookiescript_injected_wrapper', '.fc-consent-root', '.fc-dialog-overlay', '#_evidon_banner', '#cookie-law-info-bar', '.cli-modal-backdrop', '#cookieconsent', '.cc-window', '.cc-revoke',
      '.klaro .cookie-notice', '.klaro .cookie-modal', 'div[id^="sp_message_container_"]', 'iframe[id^="sp_message_iframe_"]', '.sp_message_container', '#eu-cookie-law', '.eu-cookie-compliance-banner',
      '#cookie-banner', '#cookie-notice', '#cookie_notice', '#cookieNotice', '#cookiebanner', '#cookieBanner', '#cookie-consent', '.cookie-banner', '.cookie-notice', '.cookie-consent', '.cookieconsent', '.cookie-bar', '.cookies-eu-banner', '#gdpr-cookie-notice'];
    const css = BOXES.join(',') + '{display:none !important}'
      + 'html.didomi-popup-open,body.didomi-popup-open,html.sp-message-open,body.sp-message-open,html.cmplz-blocked,body.cmplz-blocked{overflow:auto !important;position:static !important}';
    try { webFrame.insertCSS(css, { cssOrigin: 'user' }); } catch (e) { /* frame is going away */ }
    if (isTop) {
      const unlock = () => {
        try {
          if (!document.querySelector(BOXES.join(','))) return; // only when a known banner was really there
          for (const el of [document.documentElement, document.body]) if (el && getComputedStyle(el).overflowY === 'hidden') el.style.setProperty('overflow', 'auto', 'important');
        } catch (e) { /* ignore */ }
      };
      document.addEventListener('DOMContentLoaded', () => { setTimeout(unlock, 400); setTimeout(unlock, 2200); }, { once: true });
    }
  }

  // ---- YouTube: SponsorBlock and the dislike count follow the video in the address, which changes without a page load ----
  if (isTop && onYouTube && (cfg.sponsor || cfg.dislike)) {
    let id = '', segs = [], done = new Set(), votes = null;
    const currentId = () => {
      try {
        const u = new URL(location.href);
        if (u.pathname === '/watch') return u.searchParams.get('v') || '';
        const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/); return m ? m[1] : '';
      } catch (e) { return ''; }
    };
    const compact = (n) => { try { return new Intl.NumberFormat(navigator.language, { notation: 'compact', maximumFractionDigits: 1 }).format(n); } catch (e) { return String(n); } };
    const showVotes = () => {
      if (!votes) return;
      const btn = document.querySelector('dislike-button-view-model button, #segmented-dislike-button button, ytd-toggle-button-renderer#dislike-button button');
      if (!btn) return;
      let span = btn.querySelector('[data-nova-dislike]');
      if (!span) {
        span = document.createElement('span'); span.setAttribute('data-nova-dislike', '');
        span.style.cssText = 'margin-left:6px;font:500 14px/20px Roboto,Arial,sans-serif;color:inherit;pointer-events:none';
        btn.appendChild(span);
      }
      const txt = compact(votes.dislikes); if (span.textContent !== txt) span.textContent = txt;
    };
    const load = () => {
      const n = currentId(); if (n === id) return;
      id = n; segs = []; done = new Set(); votes = null;
      const stale = document.querySelector('[data-nova-dislike]'); if (stale) stale.remove();
      if (!/^[\w-]{11}$/.test(n)) return;
      if (cfg.sponsor) ipcRenderer.invoke('nova:tools-sponsor', n).then((r) => { if (id === n && Array.isArray(r)) segs = r; }).catch(() => {});
      if (cfg.dislike) ipcRenderer.invoke('nova:tools-dislike', n).then((r) => { if (id === n && r) { votes = r; showVotes(); } }).catch(() => {});
    };
    if (cfg.sponsor) {
      document.addEventListener('timeupdate', (e) => {
        const v = e.target; if (!segs.length || !v || v.tagName !== 'VIDEO' || v.seeking) return;
        const t = v.currentTime;
        for (const s of segs) {
          if (t >= s.start && t < s.end - 0.25 && !done.has(s.id)) {
            done.add(s.id); v.currentTime = s.end + 0.01;
            note(v, s.category === 'sponsor' ? 'Skipped a sponsor' : s.category === 'selfpromo' ? 'Skipped self-promotion' : 'Skipped a reminder', 'bottom');
            break;
          }
        }
      }, true); // media events do not bubble, so listen on the way down
    }
    document.addEventListener('yt-navigate-finish', load);
    setInterval(() => { load(); if (cfg.dislike) showVotes(); }, 1500); // the page rebuilds its buttons now and then; a cheap check puts the count back
    load();
  }
}
