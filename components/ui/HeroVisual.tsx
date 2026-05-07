"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

export default function HeroVisual() {
  const reduce = useReducedMotion();

  // gentle timings
  const floatDuration = 10;
  const dashDuration = 7;

  return (
    <div
      aria-hidden="true"
      className="relative h-80 md:h-[28rem] w-full overflow-hidden rounded-lg border border-pm-border/60 bg-white shadow-[0_4px_18px_rgba(16,24,40,0.06)]"
    >
      <svg
        viewBox="0 0 800 480"
        role="img"
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Subtle brand gradient */}
          <linearGradient id="pmStroke" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(28,126,214,0.8)" />
            <stop offset="100%" stopColor="rgba(15,58,94,0.8)" />
          </linearGradient>

          {/* Very light fill veil */}
          <linearGradient id="veil" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.9)" />
          </linearGradient>

          {/* Dotted lab/grid pattern */}
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" fill="none" stroke="rgba(16,24,40,0.06)" strokeWidth="1" />
          </pattern>

          {/* Soft blur for glints */}
          <filter id="blur5" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Background layers */}
        <rect width="100%" height="100%" fill="url(#grid)" />
        <rect width="100%" height="100%" fill="url(#veil)" />

        {/* "Protocol helix": two sinusoids crossing – reads as DNA/data signal */}
        {/* Path A */}
        <motion.path
          d="M 40 360
             C 140 300, 220 200, 320 240
             S 520 360, 640 300
             S 760 140, 860 200"
          fill="none"
          stroke="url(#pmStroke)"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={reduce ? { pathLength: 1 } : { pathLength: 1, pathOffset: [0, -0.2, 0] }}
          transition={{ duration: dashDuration, repeat: reduce ? 0 : Infinity, ease: "easeInOut" }}
          style={{ filter: "url(#blur5)" }}
          opacity="0.6"
        />

        {/* Path B (phase-shifted) */}
        <motion.path
          d="M 0 300
             C 120 260, 220 340, 320 280
             S 520 140, 640 220
             S 780 360, 900 300"
          fill="none"
          stroke="url(#pmStroke)"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={reduce ? { pathLength: 1 } : { pathLength: 1, pathOffset: [0, 0.2, 0] }}
          transition={{ duration: dashDuration, repeat: reduce ? 0 : Infinity, ease: "easeInOut" }}
          opacity="0.45"
        />

        {/* Connecting "trial links" */}
        {[
          { x1: 160, y1: 310, x2: 200, y2: 220 },
          { x1: 310, y1: 270, x2: 360, y2: 200 },
          { x1: 520, y1: 230, x2: 580, y2: 300 },
          { x1: 680, y1: 270, x2: 720, y2: 200 },
        ].map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="rgba(28,126,214,0.25)"
            strokeWidth="1.5"
          />
        ))}

        {/* Floating "sites/patients" nodes */}
        {[
          { cx: 200, baseY: 220, r: 4 },
          { cx: 360, baseY: 200, r: 4 },
          { cx: 580, baseY: 300, r: 4 },
          { cx: 720, baseY: 200, r: 4 },
        ].map((n, i) => (
          <motion.circle
            key={i}
            cx={n.cx}
            cy={n.baseY}
            r={n.r}
            fill="rgba(28,126,214,0.9)"
            initial={{ y: 0, opacity: 0.8 }}
            animate={
              reduce
                ? { opacity: 0.8 }
                : { y: [0, -6, 0], opacity: [0.8, 1, 0.8] }
            }
            transition={{
              duration: floatDuration + i,
              repeat: reduce ? 0 : Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </svg>
    </div>
  );
}
