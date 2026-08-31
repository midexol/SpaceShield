// Ambient starfield for the dark landing pages. Fixed to the viewport (not
// any one section) so the same field of stars sits behind the whole scroll —
// mounted once at the page root, not per-section. rAF-driven canvas, cheap
// (a few hundred points, no libraries). Freezes on prefers-reduced-motion —
// still paints once so the field isn't just blank.
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../../lib/animations";

export default function Starfield({ count = 220 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = prefersReducedMotion();

    let width = 0;
    let height = 0;
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    };
    resize();

    const points = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.2 + 0.3,
      a: Math.random() * 0.55 + 0.15,
      tw: Math.random() * 0.015 + 0.004,
      ph: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    const draw = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of points) {
        const a = reduced ? p.a : p.a + Math.sin(t * p.tw + p.ph) * 0.2;
        ctx.beginPath();
        ctx.fillStyle = `rgba(237, 241, 240, ${Math.max(0, a).toFixed(3)})`;
        ctx.arc(p.x * canvas.width, p.y * canvas.height, p.r * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [count]);

  return <canvas ref={canvasRef} className="starfield" aria-hidden="true" />;
}
