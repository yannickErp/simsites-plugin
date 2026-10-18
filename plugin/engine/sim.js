/*
 * SimSites scene runtime.
 *
 * A scene is a plain HTML page that calls Sim.define({ duration, viewport, steps, render }).
 * render(t, h) must lay out the whole scene for time t (seconds) and be a pure function of t:
 * no timers, no Date.now(), no unseeded Math.random(). The runtime draws a fake cursor and
 * click ripples from `steps`, and talks to the Studio player over postMessage.
 */
(function () {
  'use strict';

  // ---- helpers handed to render(t, h) -------------------------------------------------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const easings = {
    linear: (p) => p,
    in: (p) => p * p * p,
    out: (p) => 1 - Math.pow(1 - p, 3),
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    spring: (p) => 1 - Math.cos(p * Math.PI * 4.5) * Math.exp(-p * 6),
  };

  function $(target) {
    if (target instanceof Element) return target;
    let el = document.querySelector(`[data-sim="${target}"]`);
    if (!el) {
      try {
        el = document.querySelector(target);
      } catch {
        el = null; // not a valid selector either
      }
    }
    // A lookup that finds nothing makes render() silently do nothing: remember it for the Studio's checks.
    if (!el) (window.__simMisses = window.__simMisses || new Set()).add(String(target));
    return el;
  }

  const h = {
    clamp,
    lerp,
    ease: easings,
    /** 0..1 progress of t between t0 and t1, eased (default inOut). */
    prog(t, t0, t1, ease = 'inOut') {
      const p = clamp((t - t0) / Math.max(1e-6, t1 - t0));
      return (typeof ease === 'function' ? ease : easings[ease] || easings.inOut)(p);
    },
    /** Value tweened from a to b while t goes t0 → t1. */
    tween(t, t0, t1, a, b, ease) {
      return lerp(a, b, h.prog(t, t0, t1, ease));
    },
    /** The part of `text` typed so far, typing between t0 and t1. */
    typed(text, t, t0, t1) {
      const n = Math.round(clamp((t - t0) / Math.max(1e-6, t1 - t0)) * text.length);
      return text.slice(0, n);
    },
    /** True while t0 <= t < t1 (t1 optional). */
    between(t, t0, t1 = Infinity) {
      return t >= t0 && t < t1;
    },
    /** Seeded pseudo-random in [0,1) — deterministic. */
    rand(seed) {
      const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
      return x - Math.floor(x);
    },
    $,
    /** Apply inline styles; numbers get rounded to 3 decimals so frames stay identical. */
    set(target, styles) {
      const el = $(target);
      if (!el) return el;
      for (const k in styles) {
        let v = styles[k];
        if (typeof v === 'number') v = Math.round(v * 1000) / 1000;
        if (k.startsWith('--')) el.style.setProperty(k, String(v));
        else el.style[k] = v;
      }
      return el;
    },
    /** Show/hide with opacity (keeps layout). */
    fade(target, opacity) {
      return h.set(target, { opacity, visibility: opacity <= 0.001 ? 'hidden' : 'visible' });
    },
    text(target, value) {
      const el = $(target);
      if (el && el.textContent !== value) el.textContent = value;
      return el;
    },
    /** Fake page scroll: translates the [data-sim-scroll] wrapper (or document.body). */
    scrollTo(y) {
      const root = document.querySelector('[data-sim-scroll]') || document.body;
      root.style.transform = `translateY(${-Math.round(y)}px)`;
    },
    variant: new URLSearchParams(location.search).get('variant') || 'default',
  };

  // ---- runtime state --------------------------------------------------------------------
  let spec = null;
  let currentT = 0;
  let targets = []; // [{ step, x, y }] cursor waypoints measured at step.t
  let cursorEl, rippleEl, pickOutline, keyEl;
  let pickMode = false;

  const isEmbedded = window.parent !== window;
  const post = (msg) => isEmbedded && window.parent.postMessage({ source: 'simsites', ...msg }, '*');

  function injectBaseStyles() {
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent; }
      html, body { margin: 0; overflow: hidden; }
      #__sim-cursor { position: fixed; left: 0; top: 0; width: 22px; height: 22px; z-index: 2147483646;
        pointer-events: none; will-change: transform; }
      #__sim-ripple { position: fixed; left: 0; top: 0; width: 44px; height: 44px; margin: -22px 0 0 -22px;
        border-radius: 50%; border: 2px solid rgba(80,140,255,.9); background: rgba(80,140,255,.18);
        z-index: 2147483645; pointer-events: none; opacity: 0; }
      #__sim-pick { position: fixed; z-index: 2147483647; pointer-events: none; display: none;
        outline: 2px solid #2445f5; outline-offset: 2px; border-radius: 6px; background: rgba(36,69,245,.08); }
      #__sim-pick span { position: absolute; left: -2px; top: -26px; background: #2445f5; color: #fff;
        font: 600 11px/1 ui-monospace, Menlo, monospace; padding: 5px 7px; border-radius: 5px; white-space: nowrap; }
      body.__sim-picking, body.__sim-picking * { cursor: crosshair !important; }
    `;
    document.head.appendChild(style);
  }

  function buildOverlay() {
    cursorEl = document.createElement('div');
    cursorEl.id = '__sim-cursor';
    cursorEl.innerHTML =
      '<svg viewBox="0 0 22 22" width="22" height="22"><path d="M3 2l14 8.2-6.1 1.4L8 18z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    rippleEl = document.createElement('div');
    rippleEl.id = '__sim-ripple';
    pickOutline = document.createElement('div');
    pickOutline.id = '__sim-pick';
    pickOutline.innerHTML = '<span></span>';
    // A key press step shows the key, like a screencast keystroke overlay.
    keyEl = document.createElement('div');
    keyEl.id = '__sim-key';
    keyEl.style.cssText =
      'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483646;pointer-events:none;' +
      'padding:6px 12px;border-radius:8px;background:rgba(17,17,17,.82);color:#fff;font:600 14px/1.2 system-ui,sans-serif;display:none';
    document.body.append(rippleEl, cursorEl, pickOutline, keyEl);
  }

  const POINTER_STEPS = new Set(['click', 'dblclick', 'upload', 'type', 'hover', 'expect-click', 'drag']);
  const DRAG_TIME = 0.8; // a drag: press on the target at t, release on its drop zone DRAG_TIME later
  const KEY_NAMES = { Enter: '⏎ Enter', Escape: 'Esc', Tab: '⇥ Tab', Backspace: '⌫', ArrowDown: '↓', ArrowUp: '↑', ArrowLeft: '←', ArrowRight: '→', ' ': 'Space' };

  /** Render each pointer step's moment once and record where its target is on screen. */
  function measureTargets() {
    targets = [];
    if (!spec) return;
    for (const step of spec.steps) {
      if (!POINTER_STEPS.has(step.do) || !step.target) continue;
      spec.render(step.t, h);
      const el = $(step.target);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const x = step.do === 'type' ? r.left + Math.min(24, r.width / 2) : r.left + r.width / 2;
      targets.push({ step, x, y: r.top + r.height / 2 });
      if (step.do === 'drag' && step.to) {
        // The pointer carries the item to the drop zone, as it is when the drag ends.
        spec.render(Math.min(spec.duration, step.t + DRAG_TIME), h);
        const to = $(step.to);
        if (to) {
          const d = to.getBoundingClientRect();
          targets.push({ step: { ...step, do: 'drop', t: step.t + DRAG_TIME }, x: d.left + d.width / 2, y: d.top + d.height / 2 });
        }
      }
    }
  }

  function cursorAt(t) {
    const [vw, vh] = [window.innerWidth, window.innerHeight];
    let from = { x: vw * 0.62, y: vh * 0.78, t: 0 };
    if (!targets.length) return { ...from, visible: false };
    for (const tg of targets) {
      const arrive = tg.step.t - 0.08;
      const leave = Math.max(from.t + 0.15, arrive - Math.min(0.9, Math.max(0.35, (arrive - from.t) * 0.6)));
      if (t < arrive) {
        const p = h.prog(t, leave, arrive, 'inOut');
        return { x: lerp(from.x, tg.x, p), y: lerp(from.y, tg.y, p), visible: true };
      }
      from = { x: tg.x, y: tg.y, t: tg.step.t };
    }
    return { x: from.x, y: from.y, visible: true };
  }

  function drawOverlay(t) {
    const c = cursorAt(t);
    cursorEl.style.display = c.visible && !pickMode ? 'block' : 'none';
    cursorEl.style.transform = `translate(${Math.round(c.x - 3)}px, ${Math.round(c.y - 2)}px)`;
    // Click ripple for the latest click within 0.55s.
    let ripple = null;
    for (const tg of targets) {
      if (tg.step.do !== 'click' && tg.step.do !== 'dblclick' && tg.step.do !== 'upload') continue;
      // A double-click shows two quick ripples.
      const dt0 = t - tg.step.t;
      const dt = tg.step.do === 'dblclick' && dt0 >= 0.18 ? dt0 - 0.18 : dt0;
      if (dt >= 0 && dt < 0.55) ripple = { tg, dt };
    }
    if (ripple && !pickMode) {
      const p = ripple.dt / 0.55;
      rippleEl.style.opacity = String(Math.round((1 - p) * 1000) / 1000);
      rippleEl.style.transform = `translate(${Math.round(ripple.tg.x)}px, ${Math.round(ripple.tg.y)}px) scale(${(0.4 + p * 0.9).toFixed(3)})`;
    } else {
      rippleEl.style.opacity = '0';
    }
    // Key presses: the key shows for 0.8s.
    let key = null;
    for (const step of spec ? spec.steps : []) if (step.do === 'key' && step.value && t >= step.t && t < step.t + 0.8) key = step.value;
    if (keyEl) {
      keyEl.style.display = key && !pickMode ? 'block' : 'none';
      if (key) keyEl.textContent = KEY_NAMES[key] || key;
    }
  }

  function seek(t) {
    if (!spec) return;
    currentT = clamp(t, 0, spec.duration);
    spec.render(currentT, h);
    drawOverlay(currentT);
  }

  // ---- picking (click-to-comment) ---------------------------------------------------------
  function cssPath(el) {
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.body && parts.length < 5) {
      let part = el.tagName.toLowerCase();
      if (el.id) {
        parts.unshift(`${part}#${el.id}`);
        break;
      }
      const cls = [...el.classList].slice(0, 2).join('.');
      if (cls) part += `.${cls}`;
      parts.unshift(part);
      el = el.parentElement;
    }
    return parts.join(' > ');
  }

  function pick(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el || el === document.body || el === document.documentElement) return null;
    const simEl = el.closest('[data-sim]');
    const node = simEl || el;
    const r = node.getBoundingClientRect();
    let snippet = node.outerHTML.replace(/\s+/g, ' ');
    if (snippet.length > 400) snippet = snippet.slice(0, 400) + '…';
    return {
      target: simEl ? simEl.getAttribute('data-sim') : null,
      selector: simEl ? `[data-sim="${simEl.getAttribute('data-sim')}"]` : cssPath(el),
      text: (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
      rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      snippet,
      t: Math.round(currentT * 100) / 100,
    };
  }

  function showPickOutline(info) {
    if (!info) return (pickOutline.style.display = 'none');
    const { x, y, w, h: hh } = info.rect;
    Object.assign(pickOutline.style, {
      display: 'block', left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px`,
    });
    pickOutline.firstChild.textContent = info.target ? `@${info.target}` : info.selector;
  }

  function setPickMode(on) {
    pickMode = on;
    document.body.classList.toggle('__sim-picking', on);
    if (!on) pickOutline.style.display = 'none';
    drawOverlay(currentT);
  }

  document.addEventListener('mousemove', (e) => pickMode && showPickOutline(pick(e.clientX, e.clientY)));
  document.addEventListener(
    'click',
    (e) => {
      if (!pickMode) return;
      e.preventDefault();
      e.stopPropagation();
      const info = pick(e.clientX, e.clientY);
      if (info) post({ type: 'picked', info });
    },
    true,
  );

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || msg.source !== 'simsites-player') return;
    if (msg.type === 'hello' && window.__sim) announce();
    if (msg.type === 'seek') seek(msg.t);
    if (msg.type === 'pick-mode') setPickMode(!!msg.on);
    // Point out an element for the reviewer (e.g. an interaction from the coverage list).
    if (msg.type === 'highlight') {
      if (!msg.rect) return showPickOutline(null);
      showPickOutline({ rect: msg.rect, target: null, selector: msg.label || '' });
    }
  });

  window.addEventListener('resize', () => {
    measureTargets();
    seek(currentT);
  });

  function announce() {
    post({
      type: 'ready',
      duration: spec.duration,
      viewport: spec.viewport,
      steps: spec.steps,
      variants: spec.variants,
      title: spec.title,
    });
  }

  // ---- public API ----------------------------------------------------------------------
  window.Sim = {
    define(s) {
      if (typeof s.render !== 'function') throw new Error('Sim.define: render(t, h) is required');
      spec = {
        duration: s.duration || 10,
        viewport: s.viewport || [1440, 900],
        // A step with `only: '<variant>'` belongs to that layout alone (e.g. the phone opens the menu first).
        steps: (s.steps || []).filter((st) => !st.only || st.only === h.variant).sort((a, b) => a.t - b.t),
        variants: s.variants || ['default'],
        title: s.title || document.title,
        render: s.render,
      };
      const start = () => {
        injectBaseStyles();
        buildOverlay();
        measureTargets();
        const initial = Number(new URLSearchParams(location.search).get('t') || 0);
        seek(initial);
        window.__sim = {
          duration: spec.duration,
          viewport: spec.viewport,
          steps: spec.steps,
          variants: spec.variants,
          seek,
          pick,
          get t() {
            return currentT;
          },
        };
        announce();
        // Standalone playback (e.g. a hand-off's index.html): ?play loops the scene in real time.
        if (new URLSearchParams(location.search).has('play')) {
          let t0 = null;
          const loop = (now) => {
            if (t0 === null) t0 = now;
            seek((((now - t0) / 1000) % (spec.duration + 1.5)));
            requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);
        }
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
      else start();
    },
  };

  window.addEventListener('error', (e) => post({ type: 'error', message: String(e.message || e.error) }));
})();
