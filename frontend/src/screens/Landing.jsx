import { useScrollReveal } from "../lib/animations";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import Starfield from "../components/ui/Starfield";
import SiteNav from "../components/landing/SiteNav";
import Hero from "../components/landing/Hero";
import StatsBand from "../components/landing/StatsBand";
import Problem from "../components/landing/Problem";
import Simulator from "../components/landing/Simulator";
import PromiseBand from "../components/landing/Promise";
import Architecture from "../components/landing/Architecture";
import CaseStudies from "../components/landing/CaseStudies";
import Faq from "../components/landing/Faq";
import Footer from "../components/landing/Footer";
import StickyCTA from "../components/landing/StickyCTA";

export default function Landing() {
  useScrollReveal([]);
  useDocumentMeta(
    null,
    "When a satellite goes dark, the refund doesn't wait for a human. SpaceShield detects outages, verifies them cryptographically via Attestcoin, and settles compensation from an operator's bond on Creditcoin — automatically, in about fifteen seconds."
  );

  return (
    <div className="landing-dark">
      <Starfield />
      <SiteNav home />
      <Hero />
      <StatsBand />
      <Problem />
      <Simulator />
      <PromiseBand />
      <Architecture />
      <CaseStudies />
      <Faq />
      <Footer home />
      <StickyCTA />
    </div>
  );
}
