"use client";

import { motion } from "framer-motion";

export default function MotionOverlay() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Large warm center glow */}
      <motion.div
        className="absolute"
        style={{
          left: "50%",
          top: "40%",
          width: "700px",
          height: "700px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(200,166,60,0.1) 0%, rgba(200,166,60,0.04) 40%, transparent 70%)",
          transform: "translate(-50%, -50%)",
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Secondary red glow — bottom right */}
      <motion.div
        className="absolute"
        style={{
          left: "70%",
          top: "75%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(200,60,50,0.06) 0%, transparent 60%)",
          transform: "translate(-50%, -50%)",
        }}
        animate={{ scale: [1.1, 0.9, 1.1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* Top-left golden glow */}
      <motion.div
        className="absolute"
        style={{
          left: "20%",
          top: "20%",
          width: "450px",
          height: "450px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(200,166,60,0.06) 0%, transparent 60%)",
          transform: "translate(-50%, -50%)",
        }}
        animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />

      {/* Warm gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, rgba(200,166,60,0.03) 0%, transparent 35%, transparent 65%, rgba(200,60,50,0.02) 100%)",
        }}
      />
    </div>
  );
}
