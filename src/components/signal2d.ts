/**
 * 2D fallback for the "Signal to Context" hero, used when WebGL is
 * unavailable or OGL fails to load. Faint drifting points that link into
 * constellations near the pointer. Honours reduced-motion + offscreen pause.
 */

type Pt = { x: number; y: number; vx: number; vy: number };

export function initSignal2D(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let pts: Pt[] = [];
  let raf = 0;
  let running = false;
  let t = 0;

  let primaryRGB = '245,245,244';
  let linkRGB = '45,212,191';
  function readColors(): void {
    const s = getComputedStyle(canvas);
    primaryRGB = s.getPropertyValue('--signal-primary').trim() || primaryRGB;
    linkRGB = s.getPropertyValue('--signal-link').trim() || linkRGB;
  }

  const pointer = { x: -9999, y: -9999, active: false };
  const LINK = 118;
  const RADIUS = 170;

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function seed(): void {
    const density = coarse ? 5200 : 3600;
    let n = Math.round((w * h) / density);
    n = Math.max(45, Math.min(n, coarse ? 140 : 260));
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
    }));
  }

  function frame(): void {
    t += 0.005;
    ctx.clearRect(0, 0, w, h);

    let px = pointer.x;
    let py = pointer.y;
    let active = pointer.active;
    if (!active && coarse) {
      px = w * (0.5 + 0.32 * Math.sin(t * 0.9));
      py = h * (0.5 + 0.28 * Math.cos(t * 1.15));
      active = true;
    }

    for (const p of pts) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = w + 10;
      else if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      else if (p.y > h + 10) p.y = -10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${primaryRGB}, 0.5)`;
      ctx.fill();
    }

    if (active) {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const da = Math.hypot(a.x - px, a.y - py);
        if (da > RADIUS) continue;
        const near = 1 - da / RADIUS;
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > LINK) continue;
          const strength = (1 - d / LINK) * near;
          if (strength <= 0.02) continue;
          ctx.strokeStyle = `rgba(${linkRGB}, ${(strength * 0.55).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(a.x, a.y, 1.15 + near * 1.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${linkRGB}, ${(near * 0.9).toFixed(3)})`;
        ctx.fill();
      }
    }

    raf = requestAnimationFrame(frame);
  }

  function start(): void {
    if (running || reduce) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  function stop(): void {
    running = false;
    cancelAnimationFrame(raf);
  }
  function staticDraw(): void {
    ctx.clearRect(0, 0, w, h);
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${primaryRGB}, 0.5)`;
      ctx.fill();
    }
  }

  if (!coarse) {
    window.addEventListener(
      'pointermove',
      (e) => {
        const r = canvas.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        if (x >= 0 && x <= w && y >= 0 && y <= h) {
          pointer.x = x;
          pointer.y = y;
          pointer.active = true;
        } else {
          pointer.active = false;
        }
      },
      { passive: true }
    );
  }

  let resizeTimer = 0;
  window.addEventListener(
    'resize',
    () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resize();
        if (reduce) staticDraw();
      }, 150);
    },
    { passive: true }
  );

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) start();
        else stop();
      }
    },
    { threshold: 0.01 }
  );
  io.observe(canvas);

  const mo = new MutationObserver(readColors);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  readColors();
  resize();
  if (reduce) staticDraw();
  else start();
}
