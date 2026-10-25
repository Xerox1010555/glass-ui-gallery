/* vs-dropzone — from vividsites.app/c/dropzone (behaviour only; markup and CSS variables live in index.html / dropzone.css). */
(() => {
  if (window.__vsDropzone) return; window.__vsDropzone = true;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const KB = 1024, MB = KB * 1024;
  const X_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  const TICK = '<svg class="vs-dropzone-tick" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11"/><path pathLength="1" d="M7.2 12.4l3.2 3.2 6.4-6.8"/></svg>';
  const BANG = '<svg class="vs-dropzone-bang" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.4"/><path d="M12 7.2v5.6M12 16.4v.1"/></svg>';
  const parseSize = (s) => { const m = String(s || '').trim().match(/^([\d.]+)\s*(b|kb|mb|gb)?$/i); return m ? +m[1] * ({ b: 1, kb: KB, mb: MB, gb: MB * 1024 })[(m[2] || 'b').toLowerCase()] : Infinity; };
  const fmt = (n) => n < KB ? n + ' B' : n < MB ? Math.round(n / KB) + ' KB' : (n / MB).toFixed(n < 100 * MB ? 1 : 0) + ' MB';
  const fmtLimit = (n) => n >= MB ? +(n / MB).toFixed(1) + ' MB' : Math.round(n / KB) + ' KB';
  const parseAccept = (s) => String(s || '').split(',').map((a) => a.trim().toLowerCase()).filter(Boolean);
  const mimeOk = (type, rule) => rule.endsWith('/*') ? type.startsWith(rule.slice(0, -1)) : type === rule;
  const accepts = (f, rules) => !rules.length || rules.some((a) => a[0] === '.' ? f.name.toLowerCase().endsWith(a) : mimeOk((f.type || '').toLowerCase(), a));
  const kind = (f) => { const e = (f.name.split('.').pop() || '').toLowerCase(), t = f.type || '';
    if (e === 'pdf') return 'pdf'; if (/^(zip|rar|7z|gz|tar)$/.test(e)) return 'zip'; if (/^(csv|xls|xlsx|numbers|tsv)$/.test(e)) return 'sheet';
    if (t.startsWith('video/') || /^(mov|mp4|webm|mkv)$/.test(e)) return 'video'; if (t.startsWith('audio/') || /^(mp3|wav|flac|aac)$/.test(e)) return 'audio';
    if (/^(doc|docx|txt|md|rtf|pages)$/.test(e)) return 'doc'; return 'file'; };
  const hintFor = (rules, max) => {
    const names = rules.map((a) => a === 'image/*' ? 'Images' : a === 'video/*' ? 'Video' : a === 'audio/*' ? 'Audio' : a[0] === '.' ? a.slice(1).toUpperCase() : (a.split('/')[1] || a).toUpperCase());
    return (names.length ? names.join(', ') : 'Any file') + (isFinite(max) ? ' · up to ' + fmtLimit(max) : '');
  };
  let uid = 0;

  function mount(root) {
    if (root.__vsDz) return; root.__vsDz = true;
    const zone = root.querySelector('.vs-dropzone-zone'), input = root.querySelector('.vs-dropzone-input');
    const list = root.querySelector('.vs-dropzone-list'), hint = root.querySelector('.vs-dropzone-hint'), sr = root.querySelector('.vs-dropzone-sr');
    const glow = root.querySelector('.vs-dropzone-glow'), lit = root.querySelector('.vs-dropzone-lit'), cards = [...root.querySelectorAll('.vs-dropzone-card')];
    const id = 'vs-dropzone-' + (++uid);
    // the glow lives in a rounded clip so it never spills past the zone's corners
    const clip = document.createElement('span'); clip.className = 'vs-dropzone-glowclip'; clip.setAttribute('aria-hidden', 'true');
    zone.insertBefore(clip, glow); clip.appendChild(glow);
    if (hint) { hint.id = id + '-hint'; zone.setAttribute('aria-describedby', hint.id); }
    const autoHint = hint && !hint.textContent.trim();
    const writeHint = () => { if (autoHint) hint.textContent = hintFor(parseAccept(root.dataset.accept), parseSize(root.dataset.maxSize)); };
    const syncInput = () => { input.accept = root.dataset.accept || ''; zone.setAttribute('aria-disabled', String(root.hasAttribute('data-disabled'))); };
    writeHint(); syncInput();
    new MutationObserver(() => { writeHint(); syncInput(); }).observe(root, { attributes: true, attributeFilter: ['data-accept', 'data-max-size', 'data-disabled'] });

    /* ── one rAF loop per instance, alive only while something moves ── */
    const tasks = new Set(); let raf = 0, last = 0, dirty = false;
    const frame = (now) => {
      const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
      for (const t of tasks) if (!t(dt, now)) tasks.delete(t);
      if (dirty) { dirty = false; paintZone(now); }
      raf = tasks.size ? requestAnimationFrame(frame) : 0;
    };
    const run = (t) => { tasks.add(t); if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    // semi-implicit Euler spring, sub-stepped; interruptible (keeps its velocity when retargeted)
    const spring = (x, k, c, on, eps = .001) => {
      const s = { x, v: 0, g: x, k, c, done: null };
      s.step = (dt) => {
        const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
        for (let i = 0; i < n; i++) { s.v += (-s.k * (s.x - s.g) - s.c * s.v) * h; s.x += s.v * h; }
        const rest = Math.abs(s.v) < eps * 4 && Math.abs(s.x - s.g) < eps;
        if (rest) { s.x = s.g; s.v = 0; } on(s.x);
        if (rest && s.done) { const d = s.done; s.done = null; d(); }
        return !rest;
      };
      s.to = (g, v) => { s.g = g; if (v != null) s.v = v; if (reduce.matches) { s.x = g; s.v = 0; on(g); if (s.done) { const d = s.done; s.done = null; d(); } return s; } run(s.step); return s; };
      s.set = (v) => { s.x = s.g = v; s.v = 0; on(v); return s; };
      return s;
    };

    /* ── the zone: lift, fan, glow position + strength ── */
    const mark = () => { dirty = true; };
    const Z = { lift: spring(0, 300, 22, mark), fan: spring(0, 240, 19, mark), glow: spring(0, 180, 26, mark),
      gx: spring(0, 420, 38, mark, .1), gy: spring(0, 420, 38, mark, .1) };
    let over = false, hovering = false, depth = 0, breathT = 0;
    const paintZone = (now) => {
      const L = Z.lift.x, F = Z.fan.x, b = over && !reduce.matches ? (Math.sin(now / 1000 * Math.PI * 1.25) * .5 + .5) : 0;
      breathT = b;
      zone.style.transform = L || b ? `translate3d(0,${(-4 * L).toFixed(2)}px,0) scale(${(1 + .012 * L + .005 * b * L).toFixed(4)})` : '';
      zone.style.setProperty('--vs-dropzone-lift', Math.max(0, L).toFixed(3));
      glow.style.opacity = Math.max(0, Math.min(1, Z.glow.x * (.88 + .12 * b))).toFixed(3);
      glow.style.transform = `translate3d(${Z.gx.x.toFixed(1)}px,${Z.gy.x.toFixed(1)}px,0)`;
      lit.style.setProperty('--x', Z.gx.x.toFixed(1) + 'px'); lit.style.setProperty('--y', Z.gy.x.toFixed(1) + 'px');
      cards.forEach((c, i) => {
        const d = i === 2 ? 0 : i === 0 ? -1 : 1;
        const rot = d * (5 + 13 * F), tx = d * (4 + 17 * F), ty = (i === 2 ? -9 : -3) * F - (i === 2 ? 2 * b * F : 0);
        c.style.transform = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) rotate(${rot.toFixed(2)}deg)`;
      });
    };
    paintZone(0);
    const breathe = () => { dirty = true; return over; };
    const aim = (cx, cy, jump) => {
      const r = zone.getBoundingClientRect(), sx = r.width / zone.offsetWidth || 1;
      const x = (cx - r.left) / sx, y = (cy - r.top) / sx;
      if (jump) { Z.gx.set(x); Z.gy.set(y); } else { Z.gx.to(x); Z.gy.to(y); }
    };
    const rest = () => { Z.lift.to(over ? 1 : 0); Z.fan.to(over ? 1 : hovering ? .32 : 0); Z.glow.to(over ? 1 : hovering ? .34 : 0); };
    const disabled = () => root.hasAttribute('data-disabled');
    const setOver = (on, e) => {
      if (on === over) return; over = on;
      root.classList.toggle('is-over', on); if (!on) root.classList.remove('is-reject');
      if (on && e) aim(e.clientX, e.clientY, Z.glow.x < .05);
      if (on) run(breathe);
      rest();
    };
    zone.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'mouse' || disabled()) return; hovering = true; aim(e.clientX, e.clientY, Z.glow.x < .05); rest(); });
    zone.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && !disabled()) aim(e.clientX, e.clientY); });
    zone.addEventListener('pointerleave', () => { hovering = false; rest(); });
    zone.addEventListener('pointerdown', (e) => { if (!disabled() && e.button === 0) Z.lift.to(Z.lift.g, -5); });

    // drags: a depth counter survives the enter/leave pairs of child nodes
    const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    zone.addEventListener('dragenter', (e) => { if (!hasFiles(e) || disabled()) return; e.preventDefault(); depth++; setOver(true, e); });
    zone.addEventListener('dragover', (e) => {
      if (!hasFiles(e) || disabled()) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
      if (!over) { depth = Math.max(1, depth); setOver(true, e); }
      aim(e.clientX, e.clientY);
      // mime types are visible during a drag; flag it if none of them can be accepted
      const rules = parseAccept(root.dataset.accept), items = [...(e.dataTransfer.items || [])].filter((i) => i.kind === 'file');
      const bad = rules.length && !rules.some((r) => r[0] === '.') && items.length && items.every((i) => i.type && !rules.some((r) => mimeOk(i.type.toLowerCase(), r)));
      root.classList.toggle('is-reject', !!bad);
    });
    zone.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) setOver(false); });
    zone.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return; e.preventDefault(); depth = 0;
      const files = [...(e.dataTransfer.files || [])];
      setOver(false); Z.lift.to(0, -9); // a small press as the files land
      if (!reduce.matches && !disabled() && files.length) {
        const r = zone.getBoundingClientRect(), sx = r.width / zone.offsetWidth || 1, rp = document.createElement('span');
        rp.className = 'vs-dropzone-ripple'; rp.setAttribute('aria-hidden', 'true');
        rp.style.left = (e.clientX - r.left) / sx + 'px'; rp.style.top = (e.clientY - r.top) / sx + 'px'; clip.appendChild(rp);
        rp.animate([{ transform: 'scale(.08)', opacity: .9 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 750, easing: 'cubic-bezier(.16,1,.3,1)' }).onfinish = () => rp.remove();
      }
      if (!disabled() && files.length) addFiles(files);
    });
    zone.addEventListener('click', () => { if (!disabled()) input.click(); });
    zone.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); if (!disabled()) { Z.lift.to(Z.lift.g, -5); input.click(); } } });
    zone.addEventListener('paste', (e) => { const f = [...((e.clipboardData && e.clipboardData.files) || [])]; if (f.length && !disabled()) { e.preventDefault(); addFiles(f); } });
    input.addEventListener('change', () => { const f = [...input.files]; input.value = ''; if (f.length) addFiles(f); });

    /* ── rows ── */
    const rows = [];
    const say = (t) => { sr.textContent = ''; setTimeout(() => (sr.textContent = t), 60); };
    const speed = () => parseFloat(getComputedStyle(root).getPropertyValue('--vs-dropzone-speed')) || 1;
    function makeRow(file, err) {
      const li = document.createElement('li'); li.className = 'vs-dropzone-row';
      const isImg = /^image\//.test(file.type) && !err;
      const r = { file, el: li, err, state: err ? 'error' : 'uploading', p: 0, url: null, leaving: false };
      li.innerHTML = `<span class="vs-dropzone-washclip" aria-hidden="true"><span class="vs-dropzone-wash"></span></span><span class="vs-dropzone-thumb" aria-hidden="true"></span>
        <span class="vs-dropzone-body"><span class="vs-dropzone-name"></span>
        <span class="vs-dropzone-meta"><span class="vs-dropzone-size">${fmt(file.size)}</span><i>·</i><span class="vs-dropzone-state"></span></span>
        <span class="vs-dropzone-bar" aria-hidden="true"><span class="vs-dropzone-fill"></span></span></span>
        <span class="vs-dropzone-side"><span class="vs-dropzone-status"><span class="vs-dropzone-pct" aria-hidden="true">0%</span>${TICK}${BANG}</span>
        <button class="vs-dropzone-x" type="button">${X_ICON}</button></span>`;
      const $ = (s) => li.querySelector(s);
      $('.vs-dropzone-name').textContent = file.name; li.title = file.name;
      $('.vs-dropzone-x').setAttribute('aria-label', 'Remove ' + file.name);
      r.state$ = $('.vs-dropzone-state'); r.pct = $('.vs-dropzone-pct'); r.fill = $('.vs-dropzone-fill'); r.wash = $('.vs-dropzone-wash'); r.track = $('.vs-dropzone-bar'); r.bw = 0;
      const th = $('.vs-dropzone-thumb');
      if (isImg) {
        r.url = URL.createObjectURL(file); const img = new Image(); img.alt = ''; img.decoding = 'async';
        img.onload = () => { th.classList.add('is-loaded'); const d = document.createElement('span'); d.textContent = img.naturalWidth + ' × ' + img.naturalHeight; const dot = document.createElement('i'); dot.textContent = '·'; $('.vs-dropzone-size').after(dot, d); };
        img.src = r.url; th.appendChild(img);
      } else {
        const b = document.createElement('span'); b.className = 'vs-dropzone-badge'; b.dataset.k = kind(file);
        b.textContent = ((file.name.includes('.') ? file.name.split('.').pop() : 'file') || 'file').slice(0, 4).toUpperCase(); th.appendChild(b);
      }
      r.state$.textContent = err || 'Waiting';
      if (err) li.classList.add('is-error');
      li.setAttribute('aria-label', file.name + ', ' + (err || 'uploading'));
      // motion: y (FLIP + fly-in), o (opacity), s (scale), sh (error shake), bar (displayed progress)
      let dirtyRow = false;
      const paint = () => { if (dirtyRow) return; dirtyRow = true; run(flush); };
      const flush = () => {
        dirtyRow = false;
        li.style.transform = `translate3d(${r.sh.x.toFixed(2)}px,${r.y.x.toFixed(2)}px,0) scale(${r.s.x.toFixed(4)})`;
        li.style.opacity = Math.max(0, Math.min(1, r.o.x)).toFixed(3);
        const b = Math.max(0, Math.min(1, r.bar.x));
        r.fill.style.transform = `scaleX(${b.toFixed(4)})`; r.wash.style.transform = `translate3d(${(-(1 - b) * r.bw).toFixed(2)}px,0,0)`;
        const pc = Math.round(b * 100) + '%'; if (r.pct.textContent !== pc) r.pct.textContent = pc;
        return false;
      };
      r.y = spring(0, 330, 25, paint, .05); r.o = spring(1, 260, 32, paint); r.s = spring(1, 360, 24, paint);
      r.sh = spring(0, 900, 16, paint, .05); r.bar = spring(0, 150, 22, paint);
      $('.vs-dropzone-x').addEventListener('click', (e) => { e.stopPropagation(); remove(r, true); });
      return r;
    }
    // the wash clip ends where the bar's track ends; the wash slides by the bar's own width
    const fit = (r) => { const t = r.track; if (!t.offsetWidth) return; r.bw = t.offsetWidth; r.el.style.setProperty('--vs-dropzone-wash-w', (t.offsetLeft + t.offsetWidth) + 'px'); r.bar.to(r.bar.g); };
    new ResizeObserver(() => rows.forEach(fit)).observe(list);
    function upload(r) {
      if (r.leaving || r.state !== 'uploading') return;
      r.state$.textContent = 'Uploading';
      const done = () => {
        if (r.leaving) return; r.state = 'done'; r.bar.to(1); r.el.classList.add('is-done');
        r.state$.textContent = 'Uploaded';
        r.el.setAttribute('aria-label', r.file.name + ', uploaded');
        if (!reduce.matches) r.el.animate([{ backgroundColor: 'color-mix(in srgb, var(--vs-dropzone-row), var(--vs-dropzone-accent) 12%)' }, {}], { duration: 900, easing: 'cubic-bezier(.2,0,0,1)' });
        root.dispatchEvent(new CustomEvent('vs-dropzone-complete', { bubbles: true, detail: { file: r.file } }));
        say(r.file.name + ' uploaded');
      };
      const fail = (msg) => { if (r.leaving) return; r.state = 'error'; r.el.classList.add('is-error'); r.state$.textContent = msg; r.sh.to(0, 260); say(r.file.name + ': ' + msg); };
      if (typeof root.vsUpload === 'function') {
        Promise.resolve(root.vsUpload(r.file, (p) => { r.p = Math.max(r.p, Math.min(1, p)); r.bar.to(r.p); }))
          .then(done, (e) => fail((e && e.message) || 'Upload failed'));
        return;
      }
      // simulated: a size-aware duration with an uneven rate, so bars never move in lockstep
      const dur = Math.min(4.2, Math.max(1.3, 1.1 + r.file.size / (1.8 * MB))) / speed();
      const a = 1.5 + Math.random() * 2.5, ph = Math.random() * 6.28; let t = 0;
      run((dt) => {
        if (r.leaving) return false;
        t += dt; r.p = Math.min(1, r.p + dt / dur * (.35 + 1.3 * (.5 + .5 * Math.sin(t * a + ph))));
        r.bar.to(r.p); if (r.p >= 1) { done(); return false; } return true;
      });
    }
    function addFiles(files) {
      files = [...(files || [])]; if (!files.length) return;
      const rules = parseAccept(root.dataset.accept), max = parseSize(root.dataset.maxSize), cap = +root.dataset.maxFiles || Infinity;
      let count = rows.filter((r) => !r.leaving && r.state !== 'error').length;
      const made = files.map((f) => {
        let err = null;
        if (!accepts(f, rules)) err = 'Type not accepted';
        else if (f.size > max) err = 'Over the ' + fmtLimit(max) + ' limit';
        else if (count >= cap) err = 'Limit is ' + cap + ' file' + (cap === 1 ? '' : 's');
        else count++;
        return makeRow(f, err);
      });
      // FLIP: newest batch goes on top, the rows already there spring down to make room
      const live = rows.filter((r) => !r.leaving), before = live.map((r) => r.el.getBoundingClientRect().top);
      const frag = document.createDocumentFragment(); made.forEach((r) => frag.appendChild(r.el)); list.prepend(frag);
      live.forEach((r, i) => { const d = before[i] - r.el.getBoundingClientRect().top; if (Math.abs(d) > .5) { r.y.x += d; r.y.to(0); } });
      rows.unshift(...made); made.forEach(fit);
      made.forEach((r, i) => {
        r.o.set(0); r.y.set(-22 - i * 6); r.s.set(.95);
        const go = () => { r.o.to(1); r.y.to(0, 60); r.s.to(1); if (r.err) setTimeout(() => r.sh.to(0, 300), 180); else setTimeout(() => upload(r), 160); };
        reduce.matches ? go() : setTimeout(go, i * 60);
      });
      const bad = made.filter((r) => r.err), good = made.length - bad.length;
      bad.forEach((r) => root.dispatchEvent(new CustomEvent('vs-dropzone-reject', { bubbles: true, detail: { file: r.file, reason: r.err } })));
      root.dispatchEvent(new CustomEvent('vs-dropzone-add', { bubbles: true, detail: { files: made.filter((r) => !r.err).map((r) => r.file), rejected: bad.map((r) => ({ file: r.file, reason: r.err })) } }));
      say((good ? good + (good === 1 ? ' file' : ' files') + ' added. ' : '') + bad.map((r) => r.file.name + ': ' + r.err).join('. '));
    }
    function remove(r, focusNext) {
      if (r.leaving) return; r.leaving = true;
      if (r.url) { URL.revokeObjectURL(r.url); r.url = null; }
      const i = rows.indexOf(r); rows.splice(i, 1);
      const live = rows.filter((x) => !x.leaving), before = live.map((x) => x.el.getBoundingClientRect().top);
      // lift it out of the flow where it stands, then let the rest close the gap
      const el = r.el; el.style.top = el.offsetTop + 'px'; el.style.left = el.offsetLeft + 'px'; el.style.width = el.offsetWidth + 'px';
      el.style.position = 'absolute'; el.style.pointerEvents = 'none'; el.setAttribute('aria-hidden', 'true');
      live.forEach((x, k) => { const d = before[k] - x.el.getBoundingClientRect().top; if (Math.abs(d) > .5) { x.y.x += d; x.y.to(0); } });
      r.o.done = () => el.remove(); r.o.to(0); r.s.to(.9);
      if (focusNext) { const nx = rows[i] || rows[i - 1]; (nx ? nx.el.querySelector('.vs-dropzone-x') : zone).focus({ preventScroll: true }); }
      root.dispatchEvent(new CustomEvent('vs-dropzone-remove', { bubbles: true, detail: { file: r.file } }));
      say('Removed ' + r.file.name);
    }
    function clear() {
      const all = rows.splice(0);
      all.forEach((r, k) => {
        r.leaving = true; if (r.url) { URL.revokeObjectURL(r.url); r.url = null; }
        const go = () => { r.o.done = () => r.el.remove(); r.o.to(0); r.s.to(.94); r.y.to(-10); };
        reduce.matches ? go() : setTimeout(go, k * 55);
      });
    }
    root.addFiles = addFiles; root.clear = clear;
    Object.defineProperty(root, 'files', { get: () => rows.filter((r) => !r.leaving && r.state !== 'error').map((r) => r.file), configurable: true });
  }

  // files dragged anywhere over the page arm every zone; drops that miss a zone do nothing
  let wdepth = 0;
  const armed = (on) => document.querySelectorAll('.vs-dropzone').forEach((r) => r.classList.toggle('is-armed', on && !r.hasAttribute('data-disabled')));
  const filesIn = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  addEventListener('dragenter', (e) => { if (filesIn(e)) { wdepth++; armed(true); } });
  addEventListener('dragleave', (e) => { if (filesIn(e) && --wdepth <= 0) { wdepth = 0; armed(false); } });
  addEventListener('dragover', (e) => { if (filesIn(e) && !(e.target.closest && e.target.closest('.vs-dropzone-zone'))) { e.preventDefault(); e.dataTransfer.dropEffect = 'none'; } });
  addEventListener('drop', (e) => { if (filesIn(e)) { wdepth = 0; armed(false); if (!(e.target.closest && e.target.closest('.vs-dropzone-zone'))) e.preventDefault(); } });
  const init = () => document.querySelectorAll('.vs-dropzone').forEach(mount);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
  window.vsDropzone = { mount };
})();
