'use client'
import clsx from 'clsx'

export default function NetworkBG({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={clsx("absolute inset-0 -z-10 h-full w-full pointer-events-none", className)}
      viewBox="0 0 1440 720"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {/* Teal→Blue stroke */}
        <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>

        {/* Soft glow */}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Fade mask so lines taper at edges and behind text */}
        <radialGradient id="fade" cx="25%" cy="30%" r="75%">
          <stop offset="0%" stopColor="white" stopOpacity="0.95" />
          <stop offset="60%" stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="mask">
          <rect width="1440" height="720" fill="url(#fade)" />
        </mask>
      </defs>

      {/* Radial color washes under the network */}
      <g opacity="0.18">
        <circle cx="220" cy="80" r="300" fill="#22d3ee" />
        <circle cx="1220" cy="200" r="320" fill="#60a5fa" />
        <circle cx="600" cy="640" r="380" fill="#14b8a6" />
      </g>

      {/* Network lines */}
      <g mask="url(#mask)" filter="url(#glow)" opacity="0.18">
        {[
          // Smooth bezier strands (feel free to tweak)
          "M-40 140 C 280 60, 540 220, 980 120 S 1580 220, 1480 60",
          "M-40 260 C 360 180, 520 320, 960 260 S 1580 360, 1500 240",
          "M-40 380 C 260 340, 600 420, 1040 360 S 1580 460, 1520 380",
          "M-40 500 C 220 520, 560 520, 1020 480 S 1580 560, 1500 520",
          "M-40 620 C 260 600, 540 660, 980 600 S 1580 700, 1480 640"
        ].map((d, i) => (
          <g key={i} opacity={0.55 - i * 0.07}>
            {/* Glow stroke */}
            <path d={d} stroke="url(#stroke)" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.8"/>
            {/* Subtle duplicate for depth */}
            <path d={d} stroke="url(#stroke)" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.5"/>
          </g>
        ))}

        {/* Nodes */}
        {[
          [260,170],[520,230],[860,200],[1120,260],
          [320,340],[700,380],[1040,340],
          [280,540],[620,520],[980,500],[1280,560]
        ].map(([x,y],i)=>(
          <circle key={i} cx={x} cy={y} r="2.6" fill="#a7f3d0" opacity="0.9" />
        ))}
      </g>
    </svg>
  )
}
