// Turns the hand cursor into the same events a mouse would produce, on the same elements, so
// React handlers, R3F raycasts and plain listeners all react without knowing about hand mode.

const ID = 77;

function make(type, x, y, extra) {
  const pointer = type.startsWith("pointer");
  const Ctor = pointer ? PointerEvent : MouseEvent;
  const up = type === "pointerup" || type === "mouseup" || type === "click";
  const init = {
    bubbles: true, cancelable: true, composed: true, view: window,
    clientX: x, clientY: y, screenX: x, screenY: y, button: 0, buttons: up ? 0 : (extra.buttons ?? 0),
    ...extra,
  };
  if (pointer) Object.assign(init, { pointerId: ID, pointerType: "mouse", isPrimary: true, width: 1, height: 1, pressure: up ? 0 : 0.5 });
  return new Ctor(type, init);
}

export class Synth {
  constructor() { this.over = null; }

  // Called every frame with whatever is under the cursor. Fires the enter / leave pairs a real mouse
  // would when the cursor crosses from one element to another (React's onMouseEnter hangs off these).
  move(target, x, y, buttons = 0) {
    if (!target) return;
    if (target !== this.over) {
      const prev = this.over;
      if (prev?.isConnected) {
        prev.dispatchEvent(make("pointerout", x, y, { relatedTarget: target }));
        prev.dispatchEvent(make("mouseout", x, y, { relatedTarget: target }));
      }
      target.dispatchEvent(make("pointerover", x, y, { relatedTarget: prev }));
      target.dispatchEvent(make("mouseover", x, y, { relatedTarget: prev }));
      this.over = target;
    }
    target.dispatchEvent(make("pointermove", x, y, { buttons }));
    target.dispatchEvent(make("mousemove", x, y, { buttons }));
  }

  down(target, x, y) {
    if (!target) return;
    target.dispatchEvent(make("pointerdown", x, y, { buttons: 1 }));
    target.dispatchEvent(make("mousedown", x, y, { buttons: 1 }));
  }

  up(target, x, y) {
    if (!target) return;
    target.dispatchEvent(make("pointerup", x, y, {}));
    target.dispatchEvent(make("mouseup", x, y, {}));
    // Handlers that listen on window (drags that outlive the element) get it even if the target left the page.
    if (!target.isConnected) window.dispatchEvent(make("pointerup", x, y, {}));
  }

  click(target, x, y) {
    if (!target) return;
    const field = target.closest?.("input, textarea, select");
    if (field) field.focus();
    target.dispatchEvent(make("click", x, y, {}));
  }

  // The cursor left (hand lost, mode off): let go of whatever it was over.
  leave(x = 0, y = 0) {
    const prev = this.over;
    if (prev?.isConnected) {
      prev.dispatchEvent(make("pointerout", x, y, { relatedTarget: null }));
      prev.dispatchEvent(make("mouseout", x, y, { relatedTarget: null }));
    }
    this.over = null;
  }
}
