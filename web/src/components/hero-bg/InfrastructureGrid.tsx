"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function InfrastructureGrid() {
  const prefersReducedMotion = useReducedMotion();
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="grid-main" width="80" height="80" patternUnits="userSpaceOnUse">
            <line x1="0" y1="80" x2="80" y2="80" stroke="#d0d4dc" strokeWidth="0.5" opacity="0.5" />
            <line x1="80" y1="0" x2="80" y2="80" stroke="#d0d4dc" strokeWidth="0.5" opacity="0.5" />
          </pattern>

          {/* Radial mask — grid fades from edges, clear center */}
          <radialGradient id="grid-fade" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="white" stopOpacity="0.05" />
            <stop offset="35%" stopColor="white" stopOpacity="0.35" />
            <stop offset="65%" stopColor="white" stopOpacity="0.55" />
            <stop offset="100%" stopColor="white" stopOpacity="0.15" />
          </radialGradient>
          <mask id="grid-mask">
            <rect width="100%" height="100%" fill="url(#grid-fade)" />
          </mask>
        </defs>

        <g mask="url(#grid-mask)">
          <rect width="100%" height="100%" fill="url(#grid-main)" />
        </g>

        {/* Bright intersection nodes */}
        <g mask="url(#grid-mask)" opacity="0.35">
          {Array.from({ length: 10 }).map((_, row) =>
            Array.from({ length: 20 }).map((_, col) => (
              <circle
                key={`dot-${row}-${col}`}
                cx={col * 80 + 80}
                cy={row * 80 + 80}
                r="1.5"
                fill="#b0b4bc"
              />
            ))
          )}
        </g>
      </svg>

      {/* Warm horizontal scan line (suppressed under reduced motion) */}
      {!prefersReducedMotion && (
        <motion.div
          className="absolute left-0 right-0 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(200,166,60,0.15) 20%, rgba(200,166,60,0.35) 50%, rgba(200,166,60,0.15) 80%, transparent 100%)",
            boxShadow: "0 0 20px 4px rgba(200,166,60,0.08)",
          }}
          animate={{ y: ["-5vh", "105vh"] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  );
}
