import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cardData } from "../../lib/utils";
import { Radio, ShieldAlert, Cpu, Coins, Workflow, Sparkles, CheckCircle2 } from "lucide-react";

// Register ScrollTrigger plugin safely
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const ICON_MAP = {
  Radio: Radio,
  ShieldAlert: ShieldAlert,
  Cpu: Cpu,
  Coins: Coins,
  Workflow: Workflow,
};

const Card = ({ card, index, totalCards }) => {
  const cardRef = useRef(null);
  const containerRef = useRef(null);

  const IconComponent = ICON_MAP[card.iconName] || Sparkles;

  useEffect(() => {
    const cardEl = cardRef.current;
    const containerEl = containerRef.current;
    if (!cardEl || !containerEl) return;

    const targetScale = 1 - (totalCards - index) * 0.04;

    gsap.set(cardEl, {
      scale: 1,
      transformOrigin: "center top",
    });

    const trigger = ScrollTrigger.create({
      trigger: containerEl,
      start: "top center+=100",
      end: "bottom center",
      scrub: 0.8,
      onUpdate: (self) => {
        const progress = self.progress;
        const scale = gsap.utils.interpolate(1, targetScale, progress);
        gsap.set(cardEl, {
          scale: Math.max(scale, targetScale),
          transformOrigin: "center top",
        });
      },
    });

    return () => {
      trigger.kill();
    };
  }, [index, totalCards]);

  return (
    <div
      ref={containerRef}
      style={{
        height: "85vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "sticky",
        top: "8vh",
        padding: "1rem 0",
      }}
    >
      <div
        ref={cardRef}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "880px",
          minHeight: "430px",
          borderRadius: "20px",
          isolation: "isolate",
          top: `calc(-2vh + ${index * 18}px)`,
          transformOrigin: "top",
        }}
        className="card-content transition-all duration-300"
      >
        {/* Brand Border Accent Line */}
        <div
          style={{
            position: "absolute",
            inset: "-2px",
            borderRadius: "22px",
            padding: "2px",
            background: `conic-gradient(
              from 0deg,
              transparent 0deg,
              ${card.color} 80deg,
              var(--line) 160deg,
              transparent 240deg,
              ${card.color} 320deg,
              transparent 360deg
            )`,
            zIndex: -1,
            opacity: 0.85,
          }}
        />

        {/* Main Brand-Stylized Card Container */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            borderRadius: "20px",
            background: "linear-gradient(145deg, rgba(23, 24, 26, 0.95), rgba(18, 19, 21, 0.98))",
            backdropFilter: "blur(20px) saturate(160%)",
            border: "1px solid var(--line)",
            boxShadow: `
              0 18px 40px rgba(0, 0, 0, 0.4),
              inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `,
            overflow: "hidden",
            padding: "2rem 2.25rem",
          }}
        >
          {/* Subtle brand ambient glow overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "50%",
              background: `linear-gradient(135deg, ${card.color.replace("0.85", "0.08")} 0%, transparent 100%)`,
              pointerEvents: "none",
              borderRadius: "20px 20px 0 0",
            }}
          />

          {/* Top highlight bar */}
          <div
            style={{
              position: "absolute",
              top: "10px",
              left: "20px",
              right: "20px",
              height: "1px",
              background: "linear-gradient(90deg, transparent 0%, var(--line) 50%, transparent 100%)",
              pointerEvents: "none",
              opacity: 0.5,
            }}
          />

          {/* Card Header & Content */}
          <div style={{ position: "relative", zIndex: 2 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: card.glow,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--paper)",
                    boxShadow: `0 4px 12px ${card.glow}40`,
                  }}
                >
                  <IconComponent size={20} />
                </div>
                <div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: card.glow,
                    }}
                  >
                    {card.location}
                  </span>
                  <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                    {card.badge}
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "var(--line)",
                  opacity: 0.6,
                }}
              >
                {card.idx}
              </div>
            </div>

            <h3
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "var(--stone)",
                marginBottom: "0.4rem",
                letterSpacing: "-0.01em",
              }}
            >
              {card.title}
            </h3>
            <p
              style={{
                fontSize: "0.92rem",
                color: "var(--stone-deep)",
                lineHeight: 1.6,
                marginBottom: "1.25rem",
                maxWidth: "720px",
                opacity: 0.9,
              }}
            >
              {card.description}
            </p>
          </div>

          {/* Code & Logic Snippet */}
          <div style={{ position: "relative", zIndex: 2 }}>
            <div
              style={{
                background: "rgba(10, 11, 12, 0.75)",
                borderRadius: "12px",
                padding: "0.9rem 1.15rem",
                border: "1px solid var(--line)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.78rem",
                color: "#a3e635",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "var(--ink-soft)",
                  fontSize: "0.7rem",
                  marginBottom: "0.4rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                <CheckCircle2 size={13} style={{ color: card.glow }} /> Execution Contract Specification
              </div>
              {card.code}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const StackedCards = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    gsap.fromTo(
      container,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 1,
        ease: "power2.out",
      }
    );
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
      <div style={{ color: "var(--stone)", width: "100%" }}>
        {cardData.map((card, index) => (
          <Card
            key={card.id}
            card={card}
            index={index}
            totalCards={cardData.length}
          />
        ))}
      </div>
    </div>
  );
};

export default StackedCards;
