"use client";

import { motion } from "framer-motion";

/*
 * Large sweeping orbital arcs inspired by the GAIL logo's oval geometry.
 * Prominent, visible curves that slowly rotate.
 */
const orbitals = [
  {
    cx: "70%",
    cy: "35%",
    rx: 320,
    ry: 200,
    rotation: -20,
    color: "rgba(200,166,60,0.18)",
    duration: 50,
    strokeWidth: 1.2,
  },
  {
    cx: "30%",
    cy: "50%",
    rx: 380,
    ry: 220,
    rotation: 15,
    color: "rgba(200,166,60,0.14)",
    duration: 60,
    strokeWidth: 1,
  },
  {
    cx: "50%",
    cy: "45%",
    rx: 500,
    ry: 300,
    rotation: -6,
    color: "rgba(200,166,60,0.1)",
    duration: 80,
    strokeWidth: 0.8,
  },
  {
    cx: "75%",
    cy: "65%",
    rx: 250,
    ry: 160,
    rotation: 30,
    color: "rgba(200,60,50,0.1)",
    duration: 45,
    strokeWidth: 0.8,
  },
];

export default function OrbitalArcs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {orbitals.map((orbit, i) => (
        <motion.div
          key={`orbit-${i}`}
          className="absolute"
          style={{
            left: orbit.cx,
            top: orbit.cy,
            transform: "translate(-50%, -50%)",
          }}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 2, delay: i * 0.3, ease: "easeOut" }}
        >
          <motion.svg
            width={orbit.rx * 2 + 40}
            height={orbit.ry * 2 + 40}
            viewBox={`0 0 ${orbit.rx * 2 + 40} ${orbit.ry * 2 + 40}`}
            style={{ overflow: "visible" }}
            animate={{ rotate: 360 }}
            transition={{ duration: orbit.duration, repeat: Infinity, ease: "linear" }}
          >
            <ellipse
              cx={orbit.rx + 20}
              cy={orbit.ry + 20}
              rx={orbit.rx}
              ry={orbit.ry}
              fill="none"
              stroke={orbit.color}
              strokeWidth={orbit.strokeWidth}
              transform={`rotate(${orbit.rotation} ${orbit.rx + 20} ${orbit.ry + 20})`}
            />

            {/* Bright traveling node on orbit */}
            <motion.circle
              cx={orbit.rx + 20 + orbit.rx * 0.95}
              cy={orbit.ry + 20}
              r={3}
              fill={orbit.color.replace(/[\d.]+\)$/, "0.5)")}
              style={{
                filter: `drop-shadow(0 0 4px ${orbit.color.replace(/[\d.]+\)$/, "0.3)")})`,
              }}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}
            />
          </motion.svg>
        </motion.div>
      ))}
    </div>
  );
}
