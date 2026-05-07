"use client";

import React from "react";
import {
  FlaskConical,
  MapPin,
  UserRound,
  ActivitySquare,
  Globe,
} from "lucide-react";

export interface ChipProps {
  label: string;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  accentColor?: string | null;
  "data-testid"?: string;
}

export function Chip({
  label,
  icon,
  className = "",
  onClick,
  accentColor,
  ...props
}: ChipProps) {
  const interactive = typeof onClick === "function";
  const baseClasses = [
    "group inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-[12px] font-medium leading-tight text-slate-600 transition",
    interactive ? "hover:border-foreground/40 hover:text-foreground" : "",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={baseClasses}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onClick();
            }
          }
          : undefined
      }
      {...props}
    >
      {accentColor && (
        <span
          aria-hidden
          className={["h-4 w-1 rounded-sm", accentColor.startsWith('#') || accentColor.startsWith('rgb') ? '' : accentColor].filter(Boolean).join(' ')}
          style={accentColor.startsWith('#') || accentColor.startsWith('rgb') ? { backgroundColor: accentColor } : undefined}
        />
      )}
      {icon}
      <span>{label}</span>
    </span>
  );
}

export const ChipIcons = {
  phase: <FlaskConical size={14} aria-hidden className="text-primary/70" />,
  location: <MapPin size={14} aria-hidden className="text-primary/70" />,
  sex: <UserRound size={14} aria-hidden className="text-primary/70" />,
  diagnosis: <ActivitySquare size={14} aria-hidden className="text-primary/70" />,
  remote: <Globe size={14} aria-hidden className="text-primary/70" />,
};
