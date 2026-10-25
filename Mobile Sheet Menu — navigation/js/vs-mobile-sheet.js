/* vs-mobile-sheet — a phone menu as a bottom sheet (vividsites component, kept verbatim). */
(() => {
  if (window.vsMobileSheet) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const live = new Set(); let raf = 0, last = 0;
  const tick = now => {
    const dt = Math.min(.064, (now - last) / 1000 || .016); last = now;
    for (const s of live) { let keep = false; try { keep = s.update(dt, now); } catch (e) { console.error(e); } if (!keep) live.delete(s); }
    raf = live.size ? requestAnimationFrame(tick) : 0;
  };
  const wake = s => { live.add(s); if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  const S = (x, k, z) => ({ x, v: 0, g: x, k, c: 2 * Math.sqrt(k) * z });
  const tune = (s, k, z) => { s.k = k; s.c = 2 * Math.sqrt(k) * z; };
  const run = (s, n, h, eps) => {
    if (Math.abs(s.v) < eps && Math.abs(s.x - s.g) < eps) { s.x = s.g; s.v = 0; return false; }
    if (reduce.matches) { s.x = s.g; s.v = 0; return false; }
    for (let i = 0; i < n; i++) { s.v += (-s.k * (s.x - s.g) - s.c * s.v) * h; s.x += s.v * h; }
    return true;
  };
  const rubber = (x, lim) => lim * (1 - Math.exp(-x / lim));     // x >= 0, approaches lim
  const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

  function mount(root) {
    if (root.__vsSheet) return root.__vsSheet;
    const panel = root.querySelector('.vs-mobile-sheet-panel');
    let backdrop = root.querySelector('.vs-mobile-sheet-backdrop');
    if (!backdrop) { backdrop = document.createElement('div'); backdrop.className = 'vs-mobile-sheet-backdrop'; root.prepend(backdrop); }
    const handle = root.querySelector('.vs-mobile-sheet-handle');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.tabIndex = -1;
    if (!panel.hasAttribute('aria-label')) panel.setAttribute('aria-label', 'Menu');
    const triggers = () => root.id ? [...document.querySelectorAll(`[aria-controls="${root.id}"]`)] : [];
    const wrap = () => document.querySelector(root.dataset.wrapper || '[data-vs-mobile-sheet-wrapper]');
    const items = [...root.querySelectorAll('.vs-mobile-sheet-link, .vs-mobile-sheet-more > *')].map(el => ({ el, s: S(0, 240, .78), at: 0 }));

    let H = 0, maxH = 0, snaps = [0], cur = 0, open = false, back = null, drag = null, blockClick = 0;
    const vis = S(0, 260, .9);
    const PAD = () => parseFloat(getComputedStyle(root).getPropertyValue('--vs-mobile-sheet-pad')) || 160;

    function measure() {
      H = root.clientHeight; if (!H) return;
      const pad = PAD();
      panel.style.height = 'auto';
      const content = panel.offsetHeight - pad;
      const top = Math.max(28, H * .06);
      maxH = Math.min(content, H - top);
      panel.style.height = (maxH + pad) + 'px';
      const raw = (root.dataset.snaps || '').split(',').map(s => s.trim()).filter(Boolean);
      const nav = panel.querySelector('.vs-mobile-sheet-nav');
      let list = raw.map(s => { if (s === 'nav' && nav) return nav.offsetTop + nav.offsetHeight + 14; const f = parseFloat(s); return f <= 1 ? f * H : f; }).filter(v => v > 0).map(v => clamp(v, Math.min(140, maxH), maxH));
      if (!list.length) list = [maxH];
      list.sort((a, b) => a - b); snaps = list.filter((v, i) => !i || v - list[i - 1] > 8);
      cur = Math.min(cur, snaps.length - 1);
      if (open && !drag) { vis.g = snaps[cur]; wake(api); }
    }

    function render() {
      const v = vis.x, s0 = snaps[0] || 1;
      panel.style.transform = `translate3d(0,${(maxH - v).toFixed(2)}px,0)`;
      const p = clamp(v / s0, 0, 1), p2 = snaps.length > 1 ? clamp((v - s0) / (maxH - s0), 0, 1) : 0;
      backdrop.style.opacity = (.42 * p + .1 * p2).toFixed(4);
      const w = wrap();
      if (w) {
        if (root.dataset.scale !== 'false' && v > .5) {
          w.style.transformOrigin = '50% 0'; w.style.borderRadius = '22px'; w.style.overflow = 'hidden';
          w.style.transform = `translate3d(0,${(p * 26 + p2 * 6).toFixed(2)}px,0) scale(${(1 - .075 * p - .02 * p2).toFixed(4)})`;
        } else { w.style.transform = ''; w.style.borderRadius = ''; w.style.overflow = ''; }
      }
    }

    function show() {
      if (open) return; open = true;
      root.hidden = false; root.dataset.state = 'open'; measure();
      if (vis.x < 1) { vis.x = 0; vis.v = 0; }
      cur = 0; tune(vis, 250, .9); vis.g = snaps[0];
      back = document.activeElement;
      triggers().forEach(t => t.setAttribute('aria-expanded', 'true'));
      const w = wrap(); if (w) w.inert = true;
      const t0 = performance.now() + 70;
      items.forEach((it, i) => { if (it.s.x < .02) { it.s.x = 0; it.s.v = 0; } it.at = t0 + i * 42; it.s.g = 1; });
      requestAnimationFrame(() => panel.focus({ preventScroll: true }));
      root.dispatchEvent(new CustomEvent('open', { bubbles: true }));
      wake(api);
    }
    function hide(velocity = 0) {
      if (!open) return; open = false;
      root.dataset.state = 'closing';
      tune(vis, 300, 1); vis.g = 0; vis.v = Math.min(vis.v, velocity);
      triggers().forEach(t => t.setAttribute('aria-expanded', 'false'));
      const w = wrap(); if (w) w.inert = false;
      const to = back && back.isConnected ? back : triggers()[0];
      if (to && root.contains(document.activeElement)) to.focus({ preventScroll: true });
      root.dispatchEvent(new CustomEvent('close', { bubbles: true }));
      wake(api);
    }
    function snapTo(i, velocity = 0) {
      cur = clamp(i, 0, snaps.length - 1); tune(vis, 330, .8); vis.g = snaps[cur]; vis.v = velocity; wake(api);
      root.dispatchEvent(new CustomEvent('snap', { bubbles: true, detail: { index: cur } }));
    }

    const api = {
      el: root, open: show, close: () => hide(), snap: i => open && snapTo(i), get isOpen() { return open; },
      update(dt, now) {
        const n = Math.max(1, Math.round(dt * 120)), h = dt / n;
        let moving = drag && drag.active ? true : run(vis, n, h, .2);
        for (const it of items) {
          if (open && now < it.at) { moving = true; continue; }
          if (run(it.s, n, h, .001)) moving = true;
          const p = it.s.x;
          it.el.style.opacity = clamp(p, 0, 1).toFixed(3);
          it.el.style.transform = p >= .999 ? '' : `translate3d(0,${((1 - p) * 26).toFixed(2)}px,0)`;
        }
        render();
        if (!open && !moving && vis.x < .5) {                       // fully closed: tidy up
          root.hidden = true; root.dataset.state = 'closed';
          items.forEach(it => { it.s.x = it.s.g = 0; it.s.v = 0; it.el.style.opacity = '0'; });
          const w = wrap(); if (w) { w.style.transform = ''; w.style.borderRadius = ''; w.style.overflow = ''; }
        }
        return moving;
      },
    };

    // drag anywhere on the sheet, with velocity and a rubber band past the top
    panel.addEventListener('pointerdown', e => {
      if (!open || e.button > 0) return;
      const r = panel.getBoundingClientRect();
      drag = { id: e.pointerId, y0: e.clientY, v0: vis.x, ly: e.clientY, lt: performance.now(), vel: 0, active: false, k: r.height / panel.offsetHeight || 1 };
    });
    panel.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dy = (e.clientY - drag.y0) / drag.k;
      if (!drag.active) {
        if (Math.abs(dy) < 6) return;
        drag.active = true; drag.y0 = e.clientY; drag.v0 = vis.x; root.classList.add('is-dragging');
        try { panel.setPointerCapture(e.pointerId); } catch (_) {}
      }
      const d = (e.clientY - drag.y0) / drag.k, raw = drag.v0 - d;
      vis.x = raw > maxH ? maxH + rubber(raw - maxH, 56) : Math.max(0, raw); vis.v = 0; vis.g = vis.x;
      const now = performance.now(), dtm = Math.max(1, now - drag.lt);
      const inst = -((e.clientY - drag.ly) / drag.k) / (dtm / 1000);
      drag.vel = drag.vel * .6 + inst * .4; drag.ly = e.clientY; drag.lt = now;
      wake(api);
    });
    const end = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null; root.classList.remove('is-dragging');
      if (!d.active) return;
      blockClick = performance.now();
      const vel = performance.now() - d.lt > 90 ? 0 : clamp(d.vel, -6000, 6000);   // a pause kills the flick
      const proj = vis.x + vel * .2;
      if (proj < snaps[0] * .55) { hide(vel); return; }
      let best = 0; snaps.forEach((s, i) => { if (Math.abs(s - proj) < Math.abs(snaps[best] - proj)) best = i; });
      snapTo(best, vel);
    };
    panel.addEventListener('pointerup', end); panel.addEventListener('pointercancel', end);
    panel.addEventListener('click', e => {
      if (performance.now() - blockClick < 250) { e.preventDefault(); e.stopPropagation(); return; }
      if (e.target.closest('.vs-mobile-sheet-close')) { hide(); return; }
      if (e.target.closest('.vs-mobile-sheet-handle')) { snapTo(cur + 1 < snaps.length ? cur + 1 : 0); return; }
      const a = e.target.closest('a[href]');
      if (a && root.dataset.closeOnNav !== 'false') hide();
    }, true);
    backdrop.addEventListener('click', () => hide());
    if (handle) handle.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp') { e.preventDefault(); snapTo(cur + 1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); cur === 0 ? hide() : snapTo(cur - 1); }
    });
    root.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); hide(); return; }
      if (e.key !== 'Tab') return;
      const f = [...panel.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
    document.addEventListener('click', e => {
      const t = root.id && e.target.closest(`[aria-controls="${root.id}"]`);
      if (t && !t.disabled) { e.preventDefault(); open ? hide() : show(); }
    });
    triggers().forEach(t => { t.setAttribute('aria-expanded', 'false'); t.setAttribute('aria-haspopup', 'dialog'); });
    new ResizeObserver(() => { if (!root.hidden) { measure(); render(); } }).observe(root);
    new MutationObserver(() => { if (!root.hidden) { measure(); wake(api); } }).observe(root, { attributes: true, attributeFilter: ['data-snaps', 'data-scale', 'class'] });
    if (document.fonts) document.fonts.ready.then(() => { if (!root.hidden) measure(); });
    items.forEach(it => { it.el.style.opacity = '0'; });
    root.__vsSheet = api;
    if (root.hasAttribute('data-open')) show();
    return api;
  }
  const init = () => document.querySelectorAll('.vs-mobile-sheet').forEach(mount);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
  window.vsMobileSheet = { mount };
})();
