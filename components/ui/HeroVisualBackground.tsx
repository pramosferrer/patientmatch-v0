"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function HeroVisualBackground() {
  const reduce = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute right-0 top-0 h-[24rem] md:h-[30rem] w-[125%] md:w-[70%]">
        <svg
          viewBox="0 0 1200 600"
          className="h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* stroke gradient */}
            <linearGradient id="pmStroke" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(28,126,214,0.85)" />
              <stop offset="100%" stopColor="rgba(15,58,94,0.85)" />
            </linearGradient>

            {/* subtle grid */}
            <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
              <path d="M36 0H0V36" fill="none" stroke="rgba(16,24,40,0.06)" strokeWidth="1" />
            </pattern>

            {/* soft blur */}
            <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" />
            </filter>

            {/* fade mask (white = visible) */}
            <linearGradient id="fadeMask" x1="0" x2="1" y1="1" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity="0" />
              <stop offset="45%" stopColor="white" stopOpacity="0.65" />
              <stop offset="100%" stopColor="white" stopOpacity="1" />
            </linearGradient>

            {/* safe area mask: hide the left column where text lives */}
            {/* We compose: white full rect (visible) MINUS black safe rect (hidden), then multiply by fadeMask */}
            <mask id="safeMask">
              {/* start from fully visible */}
              <rect width="1200" height="600" fill="white" />
              {/* hide left text column (sizes tuned to your layout) */}
              <rect x="0" y="0" width="620" height="420" fill="black" />
            </mask>

            <mask id="finalMask">
              {/* apply fade into white, then subtract safe area */}
              <g>
                <rect width="1200" height="600" fill="url(#fadeMask)" />
                <rect x="0" y="0" width="620" height="420" fill="black" />
              </g>
            </mask>

            {/* md+ override via CSS variables by stretching the safe area on bigger screens */}
            <style>{`
              @media (min-width: 768px) {
                #finalMask rect[x="0"][width="620"] { width: 720px; height: 420px; }
                #safeMask  rect[x="0"][width="620"] { width: 720px; height: 420px; }
              }
            `}</style>
          </defs>

          {/* background grid (already masked so it never hits text) */}
          <g mask="url(#finalMask)">
            <rect width="1200" height="600" fill="url(#grid)" />
          </g>

          {/* curves */}
          <motion.path
            d="M -60 360 C 180 260, 360 220, 560 300 S 960 440, 1260 320"
            fill="none"
            stroke="url(#pmStroke)"
            strokeWidth="3"
            strokeLinecap="round"
            style={{ filter: "url(#soft)" }}
            mask="url(#finalMask)"
            initial={{ pathLength: 0 }}
            animate={reduce ? { pathLength: 1 } : { pathLength: 1, pathOffset: [0, -0.15, 0] }}
            transition={{ duration: 8, repeat: reduce ? 0 : Infinity, ease: "easeInOut" }}
            opacity="0.45"
          />
          <motion.path
            d="M -90 300 C 120 380, 340 160, 580 240 S 980 420, 1300 360"
            fill="none"
            stroke="url(#pmStroke)"
            strokeWidth="2"
            strokeLinecap="round"
            mask="url(#finalMask)"
            initial={{ pathLength: 0 }}
            animate={reduce ? { pathLength: 1 } : { pathLength: 1, pathOffset: [0, 0.15, 0] }}
            transition={{ duration: 8, repeat: reduce ? 0 : Infinity, ease: "easeInOut" }}
            opacity="0.32"
          />

          {/* sparse nodes */}
          {[260, 540, 820, 1080].map((cx, i) => (
            <motion.circle
              key={i}
              cx={cx}
              cy={i % 2 ? 260 : 330}
              r="4"
              fill="rgba(28,126,214,0.9)"
              mask="url(#finalMask)"
              initial={{ y: 0, opacity: 0.9 }}
              animate={reduce ? { opacity: 0.9 } : { y: [0, -8, 0], opacity: [0.9, 1, 0.9] }}
              transition={{ duration: 10 + i * 2, repeat: reduce ? 0 : Infinity, ease: "easeInOut" }}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
