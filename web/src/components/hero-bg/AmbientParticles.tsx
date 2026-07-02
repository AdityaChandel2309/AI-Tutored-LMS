"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
  glowColor: string;
  driftX: number;
  driftY: number;
}

const PARTICLE_CONFIGS = [
  { color: "rgba(200,166,60,0.6)", glow: "rgba(200,166,60,0.3)" },   // Bright gold
  { color: "rgba(200,166,60,0.4)", glow: "rgba(200,166,60,0.2)" },   // Medium gold
  { color: "rgba(200,60,50,0.45)", glow: "rgba(200,60,50,0.2)" },    // GAIL red
  { color: "rgba(200,60,50,0.3)", glow: "rgba(200,60,50,0.15)" },    // Soft red
  { color: "rgba(160,165,175,0.35)", glow: "rgba(160,165,175,0.15)" }, // Neutral
];

function createSeededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function generateParticles(count: number): Particle[] {
  const random = createSeededRandom(20260531);

  return Array.from({ length: count }, (_, i) => {
    const config =
      PARTICLE_CONFIGS[Math.floor(random() * PARTICLE_CONFIGS.length)];
    return {
      id: i,
      x: random() * 100,
      y: random() * 100,
      size: random() * 4 + 2,
      duration: random() * 6 + 5,
      delay: random() * 4,
      color: config.color,
      glowColor: config.glow,
      driftX: (random() - 0.5) * 80,
      driftY: (random() - 0.5) * 50,
    };
  });
}

export default function AmbientParticles() {
  const particles = useMemo(() => generateParticles(45), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 4}px ${p.size}px ${p.glowColor}`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 0.9, 0.5, 0.9, 0],
            scale: [0, 1, 1.3, 1, 0],
            x: [0, p.driftX * 0.3, p.driftX * 0.6, p.driftX],
            y: [0, p.driftY * 0.3, p.driftY * 0.6, p.driftY],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Network connection lines */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {particles.slice(0, 15).map((p, i) => {
          const next = particles[(i + 2) % particles.length];
          const dist = Math.hypot(p.x - next.x, p.y - next.y);
          if (dist > 25) return null;
          return (
            <motion.line
              key={`conn-${i}`}
              x1={`${p.x}%`} y1={`${p.y}%`}
              x2={`${next.x}%`} y2={`${next.y}%`}
              stroke="rgba(200,166,60,0.12)"
              strokeWidth="0.8"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.4, 0] }}
              transition={{ duration: 5, delay: p.delay + 1, repeat: Infinity, ease: "easeInOut" }}
            />
          );
        })}
      </svg>
    </div>
  );
}
