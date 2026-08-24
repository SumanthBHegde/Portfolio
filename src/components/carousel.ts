/**
 * Coverflow carousel controller. Center card scaled up, neighbours pushed out,
 * blurred and faded. Prev/next buttons, dots, arrow keys, touch/pointer drag.
 * No dependencies.
 */

export function initCarousel(): void {
  const track = document.getElementById('carousel-track');
  const prev = document.getElementById('carousel-prev');
  const next = document.getElementById('carousel-next');
  const dotsWrap = document.getElementById('carousel-dots');
  if (!track || !prev || !next || !dotsWrap) return;

  const items = Array.from(
    track.querySelectorAll<HTMLLIElement>('.carousel__item')
  );
  const n = items.length;
  if (!n) return;

  let active = 0;
  const compact = window.matchMedia('(max-width: 48rem)');

  const dots: HTMLButtonElement[] = items.map((_, i) => {
    const b = document.createElement('button');
    b.className = 'carousel__dot';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', `Project ${i + 1}`);
    b.addEventListener('click', () => go(i));
    dotsWrap.appendChild(b);
    return b;
  });

  function layout(): void {
    const single = compact.matches;
    items.forEach((el, i) => {
      const d = i - active;
      const ad = Math.abs(d);
      let x = 0;
      let scale = 1.05;
      let opacity = 1;
      let z = 5;
      let blur = 0;
      if (single) {
        // Small/medium: one centered card, no peeking neighbours.
        if (d === 0) {
          scale = 1;
        } else {
          opacity = 0;
          scale = 0.9;
          z = 0;
        }
      } else if (ad === 1) {
        x = d * 82;
        scale = 0.8;
        opacity = 0.4;
        z = 3;
        blur = 3;
      } else if (ad === 2) {
        x = d * 132;
        scale = 0.7;
        opacity = 0;
        z = 1;
        blur = 4;
      } else if (ad >= 3) {
        x = d * 150;
        scale = 0.66;
        opacity = 0;
        z = 0;
        blur = 4;
      }
      el.style.transform = `translateX(${x}%) scale(${scale})`;
      el.style.opacity = String(opacity);
      el.style.zIndex = String(z);
      el.style.filter = blur ? `blur(${blur}px)` : 'none';
      el.style.pointerEvents = opacity > 0 ? 'auto' : 'none';
      el.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
      if (d !== 0) el.onclick = () => go(i);
      else el.onclick = null;
    });
    dots.forEach((dot, i) =>
      dot.setAttribute('aria-selected', String(i === active))
    );
  }

  function go(i: number): void {
    active = Math.max(0, Math.min(n - 1, i));
    layout();
  }

  prev.addEventListener('click', () => go(active - 1));
  next.addEventListener('click', () => go(active + 1));

  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(active - 1);
    else if (e.key === 'ArrowRight') go(active + 1);
  });

  // Pointer/touch drag. We capture the pointer and, once the gesture reads as
  // horizontal, call preventDefault so the browser's scroll heuristic does not
  // steal it (paired with `touch-action: pan-y` in the CSS).
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let pointerId = -1;

  track.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    pointerId = e.pointerId;
    try {
      track.setPointerCapture(e.pointerId);
    } catch (_) {
      /* not all pointers can be captured */
    }
  });

  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      e.preventDefault();
    }
  });

  function endDrag(e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    try {
      track!.releasePointerCapture(pointerId);
    } catch (_) {
      /* already released */
    }
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) <= Math.abs(dy)) return; // vertical gesture, let it scroll
    if (dx > 45) go(active - 1);
    else if (dx < -45) go(active + 1);
  }
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', () => {
    dragging = false;
  });

  // Re-layout when crossing the compact breakpoint or on resize/rotate.
  compact.addEventListener('change', layout);
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(layout, 120);
  });

  layout();
}
