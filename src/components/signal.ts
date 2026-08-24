/**
 * "Signal to Context" is the site's signature, now in true 3D (OGL / WebGL).
 *
 * A depth point-cloud drifts and slowly rotates; the camera/scene parallaxes
 * toward the pointer; where attention lands, nearby points resolve into a
 * connected constellation, then fade back to noise. Sentinel's thesis made
 * dimensional. Dots use --primary, links use --accent (the only hue in the hero).
 *
 * Perf: OGL is dynamically imported only when the hero is near view. rAF pauses
 * offscreen / when hidden. prefers-reduced-motion → one static frame. If WebGL
 * is unavailable or OGL fails to load, we fall back to the 2D canvas version.
 */

import { initSignal2D } from './signal2d';

export async function initSignal(canvas: HTMLCanvasElement): Promise<void> {
  // Kick off only when the hero is on/near screen, then hand off.
  const io = new IntersectionObserver(
    async (entries, obs) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      obs.disconnect();
      try {
        await start3D(canvas);
      } catch (err) {
        console.warn('[signal] WebGL unavailable, using 2D fallback', err);
        initSignal2D(canvas);
      }
    },
    { rootMargin: '200px' }
  );
  io.observe(canvas);
}

async function start3D(canvas: HTMLCanvasElement): Promise<void> {
  const { Renderer, Camera, Transform, Geometry, Program, Mesh } = await import(
    'ogl'
  );

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  const renderer = new Renderer({
    canvas,
    alpha: true,
    antialias: true,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
  });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);

  const camera = new Camera(gl, { fov: 35 });
  camera.position.z = 5;

  const scene = new Transform();

  // ---- Point cloud (model space) ----
  const rect0 = canvas.getBoundingClientRect();
  const area = Math.max(rect0.width * rect0.height, 120000);
  const N = Math.round(
    Math.max(80, Math.min(coarse ? 130 : 240, (area / 2600) | 0))
  );
  // Spread is derived from the camera frustum at resize (fills the canvas at any
  // aspect); EZ is fixed depth. Start with sane defaults, refined in resize().
  let EX = 3.3;
  let EY = 1.75;
  const EZ = 1.5;
  const base = new Float32Array(N * 3);
  const sizes = new Float32Array(N);
  const drift = new Float32Array(N * 3);
  function seed(): void {
    for (let i = 0; i < N; i++) {
      base[i * 3] = (Math.random() * 2 - 1) * EX;
      base[i * 3 + 1] = (Math.random() * 2 - 1) * EY;
      base[i * 3 + 2] = (Math.random() * 2 - 1) * EZ;
      sizes[i] = 8 + Math.random() * 12;
      drift[i * 3] = (Math.random() - 0.5) * 0.0016;
      drift[i * 3 + 1] = (Math.random() - 0.5) * 0.0016;
      drift[i * 3 + 2] = (Math.random() - 0.5) * 0.0016;
    }
  }
  seed();

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const colorPrimary = { value: [0.96, 0.96, 0.96] };
  const colorLink = { value: [0.18, 0.83, 0.75] };

  const pointsGeo = new Geometry(gl, {
    position: { size: 3, data: base },
    aSize: { size: 1, data: sizes },
  });
  const pointsProgram = new Program(gl, {
    vertex: /* glsl */ `
      attribute vec3 position;
      attribute float aSize;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      uniform float uPixelRatio;
      varying float vDepth;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (4.4 / max(vDepth, 0.1));
      }
    `,
    fragment: /* glsl */ `
      precision highp float;
      uniform vec3 uColor;
      varying float vDepth;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = dot(c, c);
        if (d > 0.25) discard;
        float a = smoothstep(0.25, 0.0, d);
        float depthFade = clamp(1.25 - (vDepth - 3.0) * 0.24, 0.2, 1.0);
        gl_FragColor = vec4(uColor, a * 0.72 * depthFade);
      }
    `,
    uniforms: { uColor: colorPrimary, uPixelRatio: { value: dpr } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const points = new Mesh(gl, {
    geometry: pointsGeo,
    program: pointsProgram,
    mode: gl.POINTS,
  });
  points.setParent(scene);

  // ---- Constellation lines (dynamic, capped, alpha-faded) ----
  const MAX_SEG = 700;
  const linePos = new Float32Array(MAX_SEG * 2 * 3);
  const lineAlpha = new Float32Array(MAX_SEG * 2);
  const linesGeo = new Geometry(gl, {
    position: { size: 3, data: linePos, usage: gl.DYNAMIC_DRAW },
    aAlpha: { size: 1, data: lineAlpha, usage: gl.DYNAMIC_DRAW },
  });
  const linesProgram = new Program(gl, {
    vertex: /* glsl */ `
      attribute vec3 position;
      attribute float aAlpha;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragment: /* glsl */ `
      precision highp float;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        if (vAlpha <= 0.001) discard;
        gl_FragColor = vec4(uColor, vAlpha);
      }
    `,
    uniforms: { uColor: colorLink },
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const lines = new Mesh(gl, {
    geometry: linesGeo,
    program: linesProgram,
    mode: gl.LINES,
  });
  lines.setParent(scene);

  // ---- Sizing ----
  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    const aspect = rect.width / Math.max(rect.height, 1);
    camera.perspective({ aspect });
    // Fit the cloud to the visible frustum at z=0 so it fills the panel.
    const fovRad = (35 * Math.PI) / 180;
    const halfH = Math.tan(fovRad / 2) * camera.position.z;
    EX = halfH * aspect * 1.08;
    EY = halfH * 1.08;
    seed();
    pointsGeo.attributes.position.needsUpdate = true;
    pointsGeo.attributes.aSize.needsUpdate = true;
  }
  resize();
  let resizeTimer = 0;
  window.addEventListener(
    'resize',
    () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 150);
    },
    { passive: true }
  );

  // ---- Pointer ----
  const ndc = { x: 0, y: 0, active: false };
  if (!coarse) {
    window.addEventListener(
      'pointermove',
      (e) => {
        const r = canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
          ndc.x = x * 2 - 1;
          ndc.y = -(y * 2 - 1);
          ndc.active = true;
        } else {
          ndc.active = false;
        }
      },
      { passive: true }
    );
  }

  // ---- Theme colours ----
  function readColors(): void {
    const s = getComputedStyle(canvas);
    const p = s.getPropertyValue('--signal-primary').trim();
    const l = s.getPropertyValue('--signal-link').trim();
    const parse = (v: string) =>
      v.split(',').map((n) => parseFloat(n) / 255) as number[];
    if (p) colorPrimary.value = parse(p);
    if (l) colorLink.value = parse(l);
  }
  readColors();
  const mo = new MutationObserver(readColors);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  // ---- Frame ----
  const RADIUS = 1.35; // focus reach in world XY
  const LINK = 0.92; // max 3D distance between linked points
  let autoY = 0;
  let rotY = 0;
  let rotX = 0;
  let t = 0;

  function frame(): void {
    t += 0.005;
    autoY += 0.0016;

    // parallax eases toward pointer (or a slow auto-focus on touch)
    let fx: number;
    let fy: number;
    let focusActive = ndc.active;
    if (ndc.active) {
      rotY += (ndc.x * 0.32 - rotY) * 0.05;
      rotX += (-ndc.y * 0.2 - rotX) * 0.05;
      fx = ndc.x;
      fy = ndc.y;
    } else {
      rotY += (0 - rotY) * 0.03;
      rotX += (0 - rotX) * 0.03;
      fx = 0.32 * Math.sin(t * 0.9);
      fy = 0.28 * Math.cos(t * 1.15);
      focusActive = coarse; // constellations still breathe on touch
    }

    const ry = autoY + rotY;
    scene.rotation.y = ry;
    scene.rotation.x = rotX;

    // slow drift + wrap in model space
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      base[j] += drift[j];
      base[j + 1] += drift[j + 1];
      base[j + 2] += drift[j + 2];
      if (base[j] > EX || base[j] < -EX) drift[j] *= -1;
      if (base[j + 1] > EY || base[j + 1] < -EY) drift[j + 1] *= -1;
      if (base[j + 2] > EZ || base[j + 2] < -EZ) drift[j + 2] *= -1;
    }
    pointsGeo.attributes.position.needsUpdate = true;

    // world XY focus (plane at z=0)
    const halfH = Math.tan((35 * Math.PI) / 180 / 2) * 5;
    const rect = canvas.getBoundingClientRect();
    const halfW = halfH * (rect.width / Math.max(rect.height, 1));
    const wfx = fx * halfW;
    const wfy = fy * halfH;

    // rotate points to world (CPU) to test proximity to focus
    const cy = Math.cos(ry);
    const sy = Math.sin(ry);
    const cx = Math.cos(rotX);
    const sx = Math.sin(rotX);
    lineAlpha.fill(0);
    let seg = 0;

    if (focusActive) {
      // precompute world positions
      const wx = new Float32Array(N);
      const wy = new Float32Array(N);
      const near = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const j = i * 3;
        const x = base[j];
        const y = base[j + 1];
        const z = base[j + 2];
        const x1 = x * cy + z * sy;
        const z1 = -x * sy + z * cy;
        const y2 = y * cx - z1 * sx;
        wx[i] = x1;
        wy[i] = y2;
        const d = Math.hypot(x1 - wfx, y2 - wfy);
        near[i] = d < RADIUS ? 1 - d / RADIUS : 0;
      }
      for (let i = 0; i < N && seg < MAX_SEG; i++) {
        if (near[i] <= 0) continue;
        const ji = i * 3;
        for (let k = i + 1; k < N && seg < MAX_SEG; k++) {
          if (near[k] <= 0) continue;
          const jk = k * 3;
          const dx = base[ji] - base[jk];
          const dy = base[ji + 1] - base[jk + 1];
          const dz = base[ji + 2] - base[jk + 2];
          const d3 = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d3 > LINK) continue;
          const strength = (1 - d3 / LINK) * Math.min(near[i], near[k]);
          if (strength <= 0.03) continue;
          const o = seg * 6;
          linePos[o] = base[ji];
          linePos[o + 1] = base[ji + 1];
          linePos[o + 2] = base[ji + 2];
          linePos[o + 3] = base[jk];
          linePos[o + 4] = base[jk + 1];
          linePos[o + 5] = base[jk + 2];
          const a = strength * 0.78;
          lineAlpha[seg * 2] = a;
          lineAlpha[seg * 2 + 1] = a;
          seg++;
        }
      }
    }
    linesGeo.attributes.position.needsUpdate = true;
    linesGeo.attributes.aAlpha.needsUpdate = true;

    renderer.render({ scene, camera });
    raf = requestAnimationFrame(frame);
  }

  // ---- Lifecycle ----
  let raf = 0;
  let running = false;
  function play(): void {
    if (running || reduce) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  function pause(): void {
    running = false;
    cancelAnimationFrame(raf);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else play();
  });
  const vio = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) play();
        else pause();
      }
    },
    { threshold: 0.01 }
  );
  vio.observe(canvas);

  if (reduce) {
    scene.rotation.y = 0.2;
    renderer.render({ scene, camera });
  } else {
    play();
  }
}
