// The hero's signature element: a satellite tracing an orbit around a "Creditcoin"
// core, ported from the prototype. rAF-driven; briefly flips to an outage state
// once per orbit as a hint at what the product does. Static under reduced-motion.
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../../lib/animations";

export default function OrbitSat() {
  const satRef = useRef(null);
  const groupRef = useRef(null);

  useEffect(() => {
    const sat = satRef.current;
    const group = groupRef.current;
    if (!sat) return;

    const cx = 230,
      cy = 230,
      rx = 150,
      ry = 96;

    if (prefersReducedMotion()) {
      sat.setAttribute("transform", `translate(${cx + rx}, ${cy})`);
      return;
    }

    let raf = 0;
    let start = 0;
    let outageCooldownUntil = 0;
    const period = 15000; // ms per full orbit

    const tick = (now) => {
      if (!start) start = now;
      const t = ((now - start) % period) / period;
      const ang = t * Math.PI * 2;
      const x = cx + rx * Math.cos(ang);
      const y = cy + ry * Math.sin(ang);
      sat.setAttribute("transform", `translate(${x}, ${y})`);

      // brief simulated outage as it passes the far side
      if (t > 0.46 && t < 0.5 && now > outageCooldownUntil) {
        group?.classList.add("outage");
        outageCooldownUntil = now + 4000;
        window.setTimeout(() => group?.classList.remove("outage"), 1300);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="orbit-wrap" aria-hidden="true">
      <svg viewBox="0 0 460 460">
        <ellipse className="orbit-path" cx="230" cy="230" rx="150" ry="96" />
        <ellipse className="orbit-path" cx="230" cy="230" rx="198" ry="128" opacity="0.45" />
        <circle cx="230" cy="230" r="22" fill="none" stroke="var(--line)" strokeWidth="1" />
        <circle cx="230" cy="230" r="5" fill="var(--ink-soft)" />
        <text className="orbit-label" x="230" y="268" textAnchor="middle">
          CREDITCOIN
        </text>
        <g ref={groupRef} className="orbit-sat">
          <g ref={satRef} transform="translate(380,230)">
            <circle className="ring" r="13" />
            <circle r="5" />
            <text className="orbit-label" x="0" y="-18" textAnchor="middle">
              SAT-014
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
