"use client";

import { motion } from "framer-motion";

/*
 * Bold, sweeping energy flow curves.
 * Each path has a visible base stroke + animated energy streak + glow layer.
 * Colors: golden-yellow primary, GAIL red accents.
 */
const flowPaths = [
  {
    d: "M -100 180 Q 200 80, 450 200 T 800 160 T 1200 220 T 1600 180",
    strokeWidth: 2,
    delay: 0,
    duration: 7,
    baseColor: "rgba(200,166,60,0.28)",
    streakColor: "rgba(200,166,60,0.7)",
    glowColor: "rgba(200,166,60,0.15)",
  },
  {
    d: "M -80 420 Q 250 300, 500 400 Q 750 500, 1000 380 T 1500 420",
    strokeWidth: 1.8,
    delay: 1,
    duration: 9,
    baseColor: "rgba(200,166,60,0.22)",
    streakColor: "rgba(200,166,60,0.6)",
    glowColor: "rgba(200,166,60,0.12)",
  },
  {
    d: "M 1600 120 Q 1300 200, 1000 150 Q 700 100, 400 220 Q 100 340, -100 280",
    strokeWidth: 1.5,
    delay: 2,
    duration: 10,
    baseColor: "rgba(200,166,60,0.18)",
    streakColor: "rgba(200,166,60,0.5)",
    glowColor: "rgba(200,166,60,0.1)",
  },
  // Red parallel pipeline streaks — bottom section
  {
    d: "M 600 750 Q 800 700, 1000 720 Q 1200 740, 1400 690 T 1700 710",
    strokeWidth: 2,
    delay: 0.5,
    duration: 6,
    baseColor: "rgba(200,60,50,0.25)",
    streakColor: "rgba(200,60,50,0.65)",
    glowColor: "rgba(200,60,50,0.12)",
  },
  {
    d: "M 550 780 Q 780 730, 1020 755 Q 1250 780, 1450 725 T 1750 745",
    strokeWidth: 1.8,
    delay: 0.8,
    duration: 6.5,
    baseColor: "rgba(200,60,50,0.2)",
    streakColor: "rgba(200,60,50,0.55)",
    glowColor: "rgba(200,60,50,0.1)",
  },
  {
    d: "M 500 810 Q 760 760, 1040 790 Q 1300 820, 1500 760 T 1800 780",
    strokeWidth: 1.5,
    delay: 1.1,
    duration: 7,
    baseColor: "rgba(200,60,50,0.15)",
    streakColor: "rgba(200,60,50,0.45)",
    glowColor: "rgba(200,60,50,0.08)",
  },
  {
    d: "M 480 840 Q 740 795, 1060 825 Q 1320 855, 1530 800 T 1830 815",
    strokeWidth: 1.2,
    delay: 1.4,
    duration: 7.5,
    baseColor: "rgba(200,60,50,0.12)",
    streakColor: "rgba(200,60,50,0.4)",
    glowColor: "rgba(200,60,50,0.06)",
  },
  // Large sweeping arc — top right
  {
    d: "M 800 -50 Q 1100 100, 1300 300 Q 1500 500, 1400 700 T 1200 900",
    strokeWidth: 1.4,
    delay: 1.5,
    duration: 11,
    baseColor: "rgba(200,166,60,0.15)",
    streakColor: "rgba(200,166,60,0.45)",
    glowColor: "rgba(200,166,60,0.08)",
  },
  // Left side curve
  {
    d: "M -50 600 Q 100 400, 250 350 Q 400 300, 350 150 Q 300 50, 200 -50",
    strokeWidth: 1.2,
    delay: 3,
    duration: 12,
    baseColor: "rgba(200,166,60,0.12)",
    streakColor: "rgba(200,166,60,0.4)",
    glowColor: "rgba(200,166,60,0.06)",
  },
];

export default function EnergyFlowPaths() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {flowPaths.map((path, i) => (
          <g key={`flow-${i}`}>
            {/* Static visible base path */}
            <motion.path
              d={path.d}
              fill="none"
              stroke={path.baseColor}
              strokeWidth={path.strokeWidth}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                pathLength: { duration: 2.5, delay: path.delay * 0.4, ease: "easeInOut" },
                opacity: { duration: 1, delay: path.delay * 0.4 },
              }}
            />

            {/* Animated energy streak — bright, moving along the path */}
            <motion.path
              d={path.d}
              fill="none"
              stroke={path.streakColor}
              strokeWidth={path.strokeWidth * 1.5}
              strokeLinecap="round"
              strokeDasharray="80 1800"
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: -1880 }}
              transition={{
                duration: path.duration,
                delay: path.delay,
                repeat: Infinity,
                ease: "linear",
              }}
            />

            {/* Glow trail behind streak */}
            <motion.path
              d={path.d}
              fill="none"
              stroke={path.glowColor}
              strokeWidth={path.strokeWidth * 6}
              strokeLinecap="round"
              strokeDasharray="60 1820"
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: -1880 }}
              transition={{
                duration: path.duration,
                delay: path.delay,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{ filter: "blur(6px)" }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
