/*
 * ZenTouch kiosk demo — interaction engine.
 *
 * Stands in for the real MediaPipe + EKF + intent-scoring pipeline
 * described in the ZenTouch spec, using the mouse as a proxy for the
 * smoothed hand-position signal. Every element with class
 * "touch-target" is treated as a registered DOM target the way the
 * spec's Intent Engine would see it (a live screen rect).
 *
 * Each frame:
 *   1. Ease a "hand shadow" position toward the raw pointer (stand-in
 *      for EKF-smoothed position).
 *   2. Score every visible, enabled target by inverse distance,
 *      softmax to a probability distribution, then EMA-smooth over
 *      time (mirrors the spec's Pt = lambda*P + (1-lambda)*Pt-1).
 *   3. Arm the highest-probability target, with a switch margin so
 *      two close targets don't flicker back and forth.
 *   4. Pull the rendered shadow toward the armed target ("soft-snap").
 *   5. On mousedown over an armed target, fill a hold-to-confirm
 *      progress bar; mouseup before it fills cancels the press;
 *      filling it fires a "tt-confirm" event on the target.
 */
(function () {
  const HOLD_MS_DEFAULT = 900;
  const CURSOR_EASE = 0.25;
  const SNAP_PULL = 0.4;
  const PROB_SMOOTHING = 0.18;
  const SWITCH_MARGIN = 0.1;
  const MAX_ARM_DIST = 300;
  const SOFTMAX_TEMPERATURE = 150;

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let shadowX = mouseX;
  let shadowY = mouseY;
  let hasMouse = false;

  let armed = null;
  let holding = false;
  let holdStart = 0;
  let holdMs = HOLD_MS_DEFAULT;

  const smoothedProb = new WeakMap();
  let cursorEl = null;

  function getTargets() {
    return Array.from(document.querySelectorAll('.touch-target')).filter((el) => {
      if (el.classList.contains('tt-disabled')) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      return true;
    });
  }

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function setArmed(el) {
    if (armed === el) return;
    if (armed) armed.classList.remove('armed');
    armed = el;
    if (armed) {
      armed.classList.add('armed');
      if (!armed.dataset.armedLabel) armed.dataset.armedLabel = 'HOLD TO SELECT';
    }
  }

  function updateTargeting() {
    const targets = getTargets();
    if (targets.length === 0) {
      setArmed(null);
      return null;
    }

    let nearestDist = Infinity;
    const withDist = targets.map((el) => {
      const c = centerOf(el);
      const d = Math.hypot(c.x - shadowX, c.y - shadowY);
      if (d < nearestDist) nearestDist = d;
      return { el, c, d };
    });

    const scores = withDist.map((o) => -o.d / SOFTMAX_TEMPERATURE);
    const maxScore = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - maxScore));
    const sumExp = exps.reduce((a, b) => a + b, 0) || 1;

    let best = null;
    let bestP = -1;
    withDist.forEach((o, i) => {
      const raw = exps[i] / sumExp;
      const prev = smoothedProb.get(o.el) ?? 0;
      const smoothed = PROB_SMOOTHING * raw + (1 - PROB_SMOOTHING) * prev;
      smoothedProb.set(o.el, smoothed);
      if (smoothed > bestP) {
        bestP = smoothed;
        best = o;
      }
    });

    if (nearestDist > MAX_ARM_DIST) {
      setArmed(null);
      return null;
    }

    if (armed && armed !== best.el) {
      const armedP = smoothedProb.get(armed) ?? 0;
      if (bestP > armedP + SWITCH_MARGIN) {
        setArmed(best.el);
      }
    } else {
      setArmed(best.el);
    }

    return armed ? centerOf(armed) : null;
  }

  function startHold(el) {
    if (!el || el.classList.contains('tt-disabled')) return;
    holding = true;
    holdStart = performance.now();
    holdMs = parseInt(el.dataset.holdMs || HOLD_MS_DEFAULT, 10);
    el.classList.add('holding');
    el.style.setProperty('--tt-progress', 0);
  }

  function cancelHold() {
    if (!holding) return;
    holding = false;
    if (armed) {
      armed.classList.remove('holding');
      armed.style.setProperty('--tt-progress', 0);
    }
  }

  function completeHold(el) {
    holding = false;
    el.classList.remove('holding');
    el.style.setProperty('--tt-progress', 0);
    el.classList.add('tt-flash');
    setTimeout(() => el.classList.remove('tt-flash'), 240);
    el.dispatchEvent(new CustomEvent('tt-confirm', { bubbles: true }));
    if (el.dataset.href) {
      setTimeout(() => {
        window.location.href = el.dataset.href;
      }, 140);
    }
  }

  function tick() {
    if (hasMouse) {
      shadowX += (mouseX - shadowX) * CURSOR_EASE;
      shadowY += (mouseY - shadowY) * CURSOR_EASE;
    }

    const armedCenter = holding ? (armed ? centerOf(armed) : null) : updateTargeting();

    let visX = shadowX;
    let visY = shadowY;
    if (armedCenter) {
      visX = shadowX + (armedCenter.x - shadowX) * SNAP_PULL;
      visY = shadowY + (armedCenter.y - shadowY) * SNAP_PULL;
    }
    if (cursorEl) {
      cursorEl.style.transform = `translate(${visX}px, ${visY}px)`;
      cursorEl.classList.toggle('tt-cursor-armed', !!armed);
      cursorEl.style.opacity = hasMouse ? 1 : 0;
    }

    if (holding && armed) {
      const elapsed = performance.now() - holdStart;
      const pct = Math.min(1, elapsed / holdMs);
      armed.style.setProperty('--tt-progress', pct.toFixed(3));
      if (pct >= 1) completeHold(armed);
    }

    requestAnimationFrame(tick);
  }

  function init() {
    cursorEl = document.createElement('div');
    cursorEl.id = 'tt-cursor';
    cursorEl.style.opacity = 0;
    document.body.appendChild(cursorEl);

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!hasMouse) {
        shadowX = mouseX;
        shadowY = mouseY;
      }
      hasMouse = true;
    });
    window.addEventListener('mouseleave', () => {
      hasMouse = false;
      cancelHold();
      setArmed(null);
    });
    window.addEventListener('mousedown', () => {
      if (armed) startHold(armed);
    });
    window.addEventListener('mouseup', cancelHold);
    window.addEventListener('blur', cancelHold);

    requestAnimationFrame(tick);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
