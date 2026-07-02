"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import InfrastructureGrid from "./InfrastructureGrid";
import EnergyFlowPaths from "./EnergyFlowPaths";
import OrbitalArcs from "./OrbitalArcs";
import AmbientParticles from "./AmbientParticles";
import MotionOverlay from "./MotionOverlay";

/**
 * Animated, GAIL-themed hero background.
 *
 * Renders ONLY the decorative animation layers as a fixed, full-viewport
 * backdrop. It is purely presentational (pointer-events: none) so page
 * content layered above it remains fully interactive. Respects the user's
 * reduced-motion preference by rendering a static grid only.
 */
export default function HeroBackground() {
  const prefersReducedMotion = useReducedMotion();
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const handleMouseMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      setMousePos({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [prefersReducedMotion]);

  const px = (mousePos.x - 0.5) * 15;
  const py = (mousePos.y - 0.5) * 10;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      style={{ backgroundColor: "#f4f5f7" }}
    >
      {/* Warm base gradients */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 40%, rgba(200,166,60,0.06) 0%, transparent 60%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 75% 30%, rgba(200,60,50,0.03) 0%, transparent 50%)",
        }}
      />

      {/* Mouse-reactive warm spotlight */}
      {!prefersReducedMotion && (
        <motion.div
          className="absolute"
          style={{
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(200,166,60,0.05) 0%, transparent 70%)",
            transform: "translate(-50%, -50%)",
          }}
          animate={{ left: `${mousePos.x * 100}%`, top: `${mousePos.y * 100}%` }}
          transition={{ type: "spring", stiffness: 40, damping: 25 }}
        />
      )}

      {/* Animation layers with parallax depth */}
      {!prefersReducedMotion ? (
        <>
          <motion.div
            className="absolute inset-0"
            animate={{ x: px * 0.2, y: py * 0.2 }}
            transition={{ type: "spring", stiffness: 40, damping: 25 }}
          >
            <InfrastructureGrid />
          </motion.div>
          <motion.div
            className="absolute inset-0"
            animate={{ x: px * 0.5, y: py * 0.5 }}
            transition={{ type: "spring", stiffness: 40, damping: 25 }}
          >
            <EnergyFlowPaths />
          </motion.div>
          <motion.div
            className="absolute inset-0"
            animate={{ x: px * 0.7, y: py * 0.7 }}
            transition={{ type: "spring", stiffness: 40, damping: 25 }}
          >
            <OrbitalArcs />
          </motion.div>
          <motion.div
            className="absolute inset-0"
            animate={{ x: px * 0.35, y: py * 0.35 }}
            transition={{ type: "spring", stiffness: 40, damping: 25 }}
          >
            <AmbientParticles />
          </motion.div>
          <MotionOverlay />
        </>
      ) : (
        <InfrastructureGrid />
      )}

      {/* Center clarity zone — softens animations behind centered content */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 40% 35% at 50% 45%, rgba(244,245,247,0.55) 0%, transparent 80%)",
        }}
      />

      {/* Top edge fade */}
      <div
        className="absolute top-0 left-0 right-0 h-24"
        style={{
          background: "linear-gradient(to bottom, #f4f5f7 0%, transparent 100%)",
        }}
      />
      {/* Bottom edge fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32"
        style={{
          background: "linear-gradient(to top, #f4f5f7 0%, transparent 100%)",
        }}
      />
    </div>
  );
}
