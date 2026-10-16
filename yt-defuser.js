// YouTube ad defuser, loaded together with the ad blocker. The filter lists (with uBlock Origin's scriptlets) strip the ad data from
// YouTube's player responses; this is the safety net for what still gets through, because YouTube sometimes stitches ads into the
// video stream itself:
//  1. hide ad containers and promos
//  2. whatever still plays as an ad is muted, fast-forwarded to its end and skipped within a fraction of a second
// It only runs on youtube.com pages and costs a few lookups per second there. YouTube keeps changing, so this gets updated with Nova.
// (It deliberately does not touch JSON.parse or fetch: the scriptlets do that, and two layers wrapping the same function clash.)
const { contextBridge } = require('electron');
try {
  if (/(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname)) {
    contextBridge.executeInMainWorld({
      func: () => {
        const css = '#masthead-ad,#player-ads,.ytp-ad-overlay-container,.ytp-ad-image-overlay,ytd-ad-slot-renderer,ytd-in-feed-ad-layout-renderer,ytd-banner-promo-renderer,ytd-statement-banner-renderer,ytd-display-ad-renderer,ytd-promoted-sparkles-web-renderer,ytd-promoted-video-renderer,ytd-companion-slot-renderer,ytd-player-legacy-desktop-watch-ads-renderer{display:none!important}';
        const addCss = () => { if (document.getElementById('nova-yt-ads')) return; const s = document.createElement('style'); s.id = 'nova-yt-ads'; s.textContent = css; (document.head || document.documentElement).appendChild(s); };
        try { if (document.documentElement) addCss(); } catch (e) { /* too early */ } document.addEventListener('DOMContentLoaded', addCss);

        const SKIP = '.ytp-skip-ad-button,.ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button__text';
        const tick = () => {
          if (document.hidden) return;
          const player = document.querySelector('.html5-video-player');
          if (!player) return;
          const v = player.querySelector('video.html5-main-video') || player.querySelector('video');
          if (player.classList.contains('ad-showing')) {
            if (v && isFinite(v.duration) && v.duration > 0) {
              if (!v.dataset.novaFast) v.dataset.novaFast = v.muted ? 'm' : 'u';
              v.muted = true; v.playbackRate = 16;
              if (v.currentTime < v.duration - 0.1) v.currentTime = v.duration - 0.05;
            }
            const b = player.querySelector(SKIP); if (b) b.click();
          } else if (v && v.dataset.novaFast) { // ad is over: give the real video its normal speed and sound back
            v.playbackRate = 1; if (v.dataset.novaFast === 'u') v.muted = false; delete v.dataset.novaFast;
          }
        };
        setInterval(tick, 250);
      },
    });
  }
} catch (e) { /* not available in this frame */ }
