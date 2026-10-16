// Nova's password saver, page side (the main-process half is passwords.js). Registered in every tab only while the feature is on.
// It works in the top frame of http(s) pages and nowhere else. One synchronous question when the page starts; unless the answer is "nothing to do"
// it then watches for three things: a login form being submitted, the user clicking into a login field that has saved logins, and the interface
// telling it which login the user picked. It never holds a stored password until the user has picked one, and it trusts only real user input.
const { ipcRenderer } = require('electron');

function start(info) {
  const send = (ch, d) => { try { ipcRenderer.send(ch, d); } catch (e) { /* the page is going away */ } };
  const isInput = (n) => n instanceof HTMLInputElement;
  const visible = (el) => {
    if (!el.isConnected || el.disabled) return false;
    const r = el.getClientRects()[0];
    if (!r || r.width < 4 || r.height < 4) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  // a field that holds a user name or an email address
  const userLike = (el) => isInput(el) && /^(text|email|tel)$/.test(el.type) && !el.readOnly && !/cc-|one-time-code/i.test(el.autocomplete || '') && !/search|captcha/i.test((el.name || '') + (el.id || '')) && visible(el);
  const passwords = (root) => [...root.querySelectorAll('input[type=password]')].filter(visible);
  const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
  const hasBoth = (n) => { const p = passwords(n); return p.length > 0 && [...n.querySelectorAll('input')].some((i) => userLike(i) && (i.compareDocumentPosition(p[0]) & FOLLOWING)); };
  // the part of the page that makes one login: the form, or the closest wrapper holding both a user name and a password field
  const climb = (el) => { let n = el.parentElement; for (let i = 0; n && i < 8; i++, n = n.parentElement) if (hasBoth(n)) return n; return null; };
  const rootOf = (el) => el.form || climb(el) || document.body || document.documentElement;

  // The password field to keep and the user name field before it. One password field is a sign-in; two equal ones are a sign-up with
  // confirmation; three (old, new, confirm) are a change, where the new one is kept. Anything else is too ambiguous to guess.
  function fields(root) {
    const all = passwords(root);
    if (!all.length || all.length > 3) return null;
    let pass = null, change = false;
    if (all.length === 1) pass = all[0];
    else if (all.length === 2 && all[0].value && all[0].value === all[1].value) pass = all[0];
    else if (all.length === 3 && all[1].value && all[1].value === all[2].value) { pass = all[1]; change = true; }
    let user = null;
    for (const i of root.querySelectorAll('input')) if ((i.compareDocumentPosition(all[0]) & FOLLOWING) && userLike(i)) user = i; // the closest one before the first password field
    return { all, pass, user, change };
  }

  // ---- saving: tell the interface what was submitted, then see what the next page looks like ----
  let lastSig = '';
  const landed = () => { let has = true; try { has = passwords(document).length > 0; } catch (e) { /* assume the form is still there */ } send('nova:pw-landed', { hasForm: has }); };
  function capture(root) {
    if (!root) return;
    const f = fields(root);
    if (!f || !f.pass || !f.user || !f.pass.value || !f.user.value.trim()) return;
    const user = f.user.value.trim(), pass = f.pass.value, sig = user + '\u0000' + pass;
    if (sig === lastSig) return; // the same sign-in announces itself through click, Enter and submit
    lastSig = sig; setTimeout(() => { lastSig = ''; }, 2500);
    let ok = false;
    try { ok = ipcRenderer.sendSync('nova:pw-submit', { user, pass, change: f.change }); } catch (e) { /* ignore */ }
    if (ok) setTimeout(landed, 1600); // a sign-in that happens without loading a new page: is the form gone?
  }
  // the page that follows a submit reports whether it still shows a password field (then the sign-in failed and nothing is offered)
  if (info.pending) {
    let done = false;
    const once = (ms) => setTimeout(() => { if (!done) { done = true; landed(); } }, ms);
    window.addEventListener('load', () => once(700), { once: true });
    document.addEventListener('DOMContentLoaded', () => once(5000), { once: true });
  }

  // ---- filling: the interface shows the saved logins, the user picks one, the interface sends it here ----
  let shown = false, target = null;
  const dismiss = () => { if (shown) { shown = false; send('nova:pw-dismiss'); } };
  function offer(el) {
    if (!info.fill || !isInput(el)) return;
    const f = fields(rootOf(el));
    if (!f || f.all.length !== 1 || (el !== f.all[0] && el !== f.user)) return;
    const r = el.getBoundingClientRect();
    target = el; shown = true;
    send('nova:pw-focus', { x: +r.left || 0, y: +r.top || 0, w: +r.width || 0, h: +r.height || 0 });
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const setValue = (el, v) => { setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  ipcRenderer.on('nova:pw-fill', (_e, d) => {
    shown = false;
    if (!d || typeof d.pass !== 'string') return;
    let el = target && target.isConnected ? target : null;
    if (!el) el = passwords(document)[0] || null;
    if (!el) return;
    const f = fields(rootOf(el));
    if (!f || f.all.length !== 1) return;
    if (f.user && typeof d.user === 'string' && d.user) setValue(f.user, d.user);
    setValue(f.all[0], d.pass);
  });

  // ---- real user input only: a script that fakes a click or a submit changes nothing ----
  document.addEventListener('submit', (e) => { if (e.isTrusted && info.save && e.target instanceof HTMLFormElement) capture(e.target); }, true);
  document.addEventListener('click', (e) => {
    if (!e.isTrusted) return;
    const t = e.target;
    if (isInput(t) && /^(text|email|tel|password)$/.test(t.type)) return offer(t); // a click into a field; buttons made of <input> fall through to the submit check
    dismiss();
    if (!info.save || !t || !t.closest) return;
    const b = t.closest('button,input[type=submit],input[type=button],input[type=image],[role=button],a');
    if (b) capture(b.form || climb(b));
  }, true);
  document.addEventListener('keydown', (e) => {
    if (!e.isTrusted) return;
    if (e.key === 'Enter') { if (info.save && isInput(e.target)) capture(rootOf(e.target)); dismiss(); }
    else if (e.key === 'ArrowDown') { if (!shown && isInput(e.target)) offer(e.target); }
    else if (e.key === 'Tab') dismiss();
  }, true);
  document.addEventListener('input', (e) => { if (e.isTrusted) dismiss(); }, true); // typing means the list is not wanted
  window.addEventListener('scroll', dismiss, { capture: true, passive: true });
  window.addEventListener('resize', dismiss, { passive: true });
}

try {
  if ((location.protocol === 'http:' || location.protocol === 'https:') && window.top === window) {
    let r = null;
    try { r = ipcRenderer.sendSync('nova:pw-ask'); } catch (e) { r = null; }
    if (r && r.on && (r.save || r.fill || r.pending)) start(r);
  }
} catch (e) { /* not available in this frame */ }
