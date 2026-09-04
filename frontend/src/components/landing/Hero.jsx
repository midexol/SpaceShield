import { Link } from "react-router-dom";
import { motion } from "motion/react";
import OrbitSat from "../ui/OrbitSat";

export default function Hero() {
  return (
    <motion.header
      className="hero relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <OrbitSat />

      <div className="wrap hero-inner relative z-10">
        {/* Staggered Animated Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          When a satellite goes dark,
          <br />
          <span className="fade">the refund doesn't wait for a </span>
          <span className="accent">human.</span>
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
      </div>
    </motion.header>
  );
}
