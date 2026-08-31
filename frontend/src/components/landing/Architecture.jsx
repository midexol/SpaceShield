import React from "react";
import StackedCards from "../ui/glass-cards";

export default function Architecture() {
  return (
    <section id="architecture" style={{ paddingBottom: "6rem" }}>
      <div className="wrap" style={{ marginBottom: "2rem" }}>
        <div className="eyebrow reveal">03 · Architecture</div>
        <h2 className="reveal">Five components. Each does exactly one job.</h2>
        <p className="lede reveal">
          No component makes a judgment call. The AI agent detects and cross-checks; the precompile
          verifies; the settlement contract pays. Nothing in the chain is asked to be trusted.
        </p>
      </div>

      {/* GSAP Stacked Glass Cards Section */}
      <div className="wrap" style={{ position: "relative" }}>
        <StackedCards />
      </div>
    </section>
  );
}
