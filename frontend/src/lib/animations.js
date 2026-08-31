// Ports of the prototype's motion primitives: the scroll-reveal IntersectionObserver
// and the decode/scramble text effect. All of them honor prefers-reduced-motion.
import { useEffect } from "react";

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Observe every .reveal / .reveal-stagger in the document and add `.in` when it
// scrolls into view (one-shot). Re-runs when `deps` change (e.g. route change).
export function useScrollReveal(deps = []) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".reveal, .reveal-stagger"));
    if (prefersReducedMotion()) {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/#•";

// Progressively "decode" an element's text from noise to `finalText`. Returns a
// cleanup fn. Used on the hero headline.
export function scrambleText(el, finalText, { duration = 900 } = {}) {
  if (!el) return () => {};
  if (prefersReducedMotion()) {
    el.textContent = finalText;
    return () => {};
  }
  const start = performance.now();
  let raf = 0;
  const tick = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const revealCount = Math.floor(p * finalText.length);
    let out = "";
    for (let i = 0; i < finalText.length; i++) {
      const ch = finalText[i];
      if (i < revealCount || ch === " ") out += ch;
      else out += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
    }
    el.textContent = out;
    if (p < 1) raf = requestAnimationFrame(tick);
    else el.textContent = finalText;
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
