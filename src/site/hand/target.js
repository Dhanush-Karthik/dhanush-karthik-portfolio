// Aim assist. A fingertip in mid-air is not a mouse: it wanders a few pixels even when held still.
// So buttons and links near the cursor pull it in (the way a console controller snaps to menu
// items), and it only switches target once the cursor is clearly over the next one, so the hand's
// shake does not flicker between two buttons that sit side by side.

const SEL = 'a[href], button, input:not([type="hidden"]), textarea, select, summary, [role="button"], [role="tab"], [role="link"], label[for], [data-hand]';
const REACH = 38;        // px from the element's edge at which it starts to pull
const HYST = 10;         // px a neighbour must beat the current target by before the cursor switches to it

export class Magnet {
  constructor() { this.items = []; this.stamp = -1e9; this.cur = null; }

  refresh(now) {
    if (now - this.stamp < 220) return;
    this.stamp = now;
    const W = window.innerWidth, H = window.innerHeight;
    const out = [];
    document.querySelectorAll(SEL).forEach((el) => {
      if (el.disabled || el.closest(".hand-panel, .hand-cursor, .sr-only, [aria-hidden='true'][inert]")) return;
      const r = el.getBoundingClientRect();
      if (r.width < 6 || r.height < 6 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.pointerEvents === "none" || cs.display === "none" || parseFloat(cs.opacity) < 0.05) return;
      out.push({ el, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, w: r.width, h: r.height });
    });
    this.items = out;
  }

  static gap(it, x, y) {
    const dx = x < it.x0 ? it.x0 - x : x > it.x1 ? x - it.x1 : 0;
    const dy = y < it.y0 ? it.y0 - y : y > it.y1 ? y - it.y1 : 0;
    return Math.hypot(dx, dy);
  }

  // Not covered by something else at its centre (a hidden panel, a closed menu, the page behind a modal).
  static reachable(it) {
    const top = document.elementFromPoint((it.x0 + it.x1) / 2, (it.y0 + it.y1) / 2);
    return !!top && (it.el === top || it.el.contains(top) || top.contains(it.el));
  }

  // Returns { el, x, y } for the element the cursor should act on (x, y pulled toward its middle), or null.
  pick(x, y, calm) {
    let best = null, bd = Infinity, ba = Infinity;
    for (const it of this.items) {
      const d = Magnet.gap(it, x, y);
      if (d > REACH) continue;
      const a = it.w * it.h;
      if (d > bd || (d === bd && a >= ba)) continue;   // nearer wins; of two the same distance (nested), the smaller
      if (!Magnet.reachable(it)) continue;
      best = it; bd = d; ba = a;
    }
    const keep = this.cur && this.items.find((i) => i.el === this.cur.el);
    if (keep && best !== keep && calm && Magnet.gap(keep, x, y) <= (best ? bd : REACH) + HYST) best = keep;
    this.cur = best;
    return best ? this.aim(best, x, y) : null;
  }

  aim(it, x, y) {
    const cx = (it.x0 + it.x1) / 2, cy = (it.y0 + it.y1) / 2;
    const inside = Magnet.gap(it, x, y) === 0;
    // Big surfaces (cards, text boxes) keep the real cursor; small targets pull it to their middle.
    const k = inside ? (Math.max(it.w, it.h) < 150 ? 0.5 : 0) : 0.75;
    return { el: it.el, x: x + (cx - x) * k, y: y + (cy - y) * k };
  }

  clear() { this.cur = null; this.items = []; this.stamp = -1e9; }
}
