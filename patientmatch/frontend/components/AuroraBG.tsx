"use client";

import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

type AuroraIntensity = "default" | "calm";

type AuroraBGProps = {
  className?: string;
  intensity?: AuroraIntensity;
  blendMode?: "screen" | "normal";
};

const MASK_GRADIENT =
  "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 14%, rgba(0,0,0,0.7) 46%, rgba(0,0,0,0.9) 72%, rgba(0,0,0,1) 100%)";

export default function AuroraBG({
  className = "",
  intensity = "default",
  blendMode = "screen",
}: AuroraBGProps) {
  const blurScale = intensity === "calm" ? "blur-[68px]" : "blur-[88px]";
  const speed = intensity === "calm" ? "32s" : "26s";
  const shouldBlend = blendMode === "screen";

  const maskStyles: CSSProperties = {
    maskImage: MASK_GRADIENT,
    WebkitMaskImage: MASK_GRADIENT,
  };

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className
      )}
      style={{
        ...maskStyles,
        backgroundColor: "transparent",
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.52]"
        style={{
          backgroundImage: "var(--aurora-gradient)",
          backgroundSize: "130% 130%",
          backgroundPosition: "center",
        }}
      />
      <div
        className={cn(
          "absolute inset-[-24%] animate-aurora",
          blurScale,
          "opacity-40",
          shouldBlend && "mix-blend-screen"
        )}
        style={{
          background: "var(--aurora-gradient)",
          "--aurora-speed": speed,
        } as CSSProperties}
      />
      <div
        className={cn(
          "absolute inset-[-28%] animate-aurora-soft blur-[110px] opacity-28",
          shouldBlend && "mix-blend-screen"
        )}
        style={{
          background:
            "radial-gradient(60% 60% at 65% 22%, rgba(188,231,214,0.28), transparent 72%)",
          "--aurora-speed": speed,
        } as CSSProperties}
      />
      <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(120deg,rgba(255,255,255,0.55)_0,transparent_70%)]" />
    </div>
  );
}
