import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import OrbitSat from "../ui/OrbitSat";
import Starfield from "../ui/Starfield";
import { scrambleText } from "../../lib/animations";
import { Radio, AlertTriangle, ShieldCheck, Activity, Zap, RefreshCw } from "lucide-react";

const INITIAL_STATS = [
  { final: "2.6B", lab: "Underserved users targeted", qual: "Spacecoin's stated addressable population" },
  { final: "~15s", lab: "Detection to settlement", qual: "One precompile call, one block" },
  { final: "0x0FD2", lab: "Block Prover precompile", qual: "Native to Creditcoin, not a bridge" },
  { final: "0", lab: "Manual claims filed", qual: "Settlement requires no user action" },
];

export default function Hero() {
  const numRefs = useRef([]);
  const [isOutageSimulated, setIsOutageSimulated] = useState(false);
  const [telemetryEvent, setTelemetryEvent] = useState(null);

  useEffect(() => {
    const cleanups = INITIAL_STATS.map((s, i) => {
      const el = numRefs.current[i];
      if (!el) return () => {};
      let stop = () => {};
      const to = setTimeout(() => {
        stop = scrambleText(el, s.final, { duration: 620 });
      }, 520 + i * 110);
      return () => {
        clearTimeout(to);
        stop();
      };
    });
    return () => cleanups.forEach((c) => c());
  }, []);

  const handleSimulateOutageToggle = () => {
    if (!isOutageSimulated) {
      setIsOutageSimulated(true);
      setTelemetryEvent("SAT-014 Outage Detected: Attestcoin 0x0FD2 precompile verifying proof...");
      setTimeout(() => {
        setTelemetryEvent("Outage Confirmed! Settlement #8942 executed in 14.8s. Payout dispatched.");
      }, 1800);
    } else {
      setIsOutageSimulated(false);
      setTelemetryEvent("System restored. Telemetry normal across CTC-0 & CTC-1 constellations.");
      setTimeout(() => setTelemetryEvent(null), 3000);
    }
  };

  return (
    <motion.header
      className="hero relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <Starfield />
      <OrbitSat />

      <div className="wrap hero-inner relative z-10">
        {/* Interactive Eyebrow & Live Status Pill */}
        <motion.div
          className="hero-eyebrow cursor-pointer select-none inline-flex items-center gap-2"
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          whileHover={{ scale: 1.02 }}
          onClick={handleSimulateOutageToggle}
        >
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${isOutageSimulated ? "bg-amber-500 animate-ping" : "bg-emerald-400"}`}>
            ●
          </span>
          <span>
            {isOutageSimulated ? "SIMULATED OUTAGE ACTIVE — CLICK TO RESET" : "Autonomous SLA enforcement for satellite internet"}
          </span>
          <span className="ml-2 text-xs opacity-75 underline flex items-center gap-1">
            <Zap size={12} /> {isOutageSimulated ? "Reset" : "Simulate Outage"}
          </span>
        </motion.div>

        {/* Live Telemetry Banner Notification */}
        <AnimatePresence>
          {telemetryEvent && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className={`my-3 p-3 rounded-lg text-xs font-mono border ${
                isOutageSimulated
                  ? "bg-amber-950/40 text-amber-200 border-amber-500/40"
                  : "bg-emerald-950/40 text-emerald-200 border-emerald-500/40"
              } flex items-center justify-between gap-2 max-w-xl`}
            >
              <div className="flex items-center gap-2">
                {isOutageSimulated ? <AlertTriangle size={15} className="text-amber-400 animate-pulse" /> : <ShieldCheck size={15} className="text-emerald-400" />}
                <span>{telemetryEvent}</span>
              </div>
              <button
                onClick={() => setTelemetryEvent(null)}
                className="text-xs opacity-60 hover:opacity-100 px-1"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Staggered Animated Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          When a satellite goes dark,
          <br />
          <span className="fade">the refund doesn't wait for a human.</span>
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          className="hero-sub"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          SpaceShield watches Spacecoin's network, verifies outages cryptographically through
          Attestcoin, and settles compensation from an operator's bond on Creditcoin —
          automatically, in about fifteen seconds.
        </motion.p>

        {/* Interactive CTA Buttons with Spring Physics */}
        <motion.div
          className="hero-cta"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Link className="btn green flex items-center gap-2" to="/app">
              <span>Launch app</span> →
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <a className="btn" href="#simulate">
              Run the simulator
            </a>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <a className="btn ghost" href="#architecture">
              See the architecture
            </a>
          </motion.div>
        </motion.div>

        {/* Live Protocol Badges */}
        <motion.div
          className="hero-badges"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <motion.span className="badge" whileHover={{ y: -2 }}>
            <span className="dot" />
            CTC-0 &amp; CTC-1 live constellations
          </motion.span>
          <motion.span className="badge" whileHover={{ y: -2 }}>
            <span className="dot" />
            No manual claims
          </motion.span>
          <motion.span className="badge" whileHover={{ y: -2 }}>
            <span className="dot" />
            Precompile-verified proofs
          </motion.span>
        </motion.div>

        {/* Interactive Stat Cards Grid with 3D Tilt Hover Physics */}
        <motion.div
          className="stat-grid reveal-stagger in"
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
        >
          {INITIAL_STATS.map((s, i) => (
            <motion.div
              className="stat transition-all duration-300 relative group overflow-hidden"
              key={s.lab}
              whileHover={{
                y: -6,
                boxShadow: "0 14px 34px -6px rgba(63,224,138,0.45)",
                borderColor: "var(--green)",
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className="num" ref={(el) => (numRefs.current[i] = el)}>
                ···
              </div>
              <div className="lab">{s.lab}</div>
              <div className="qual">{s.qual}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.header>
  );
}
