"use client";
import { motion } from "framer-motion";
import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "accent" | "ghost";
};

export default function AnimatedButton({ className, variant = "accent", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition will-change-transform";
  const styles: Record<string, string> = {
    primary: "bg-pm-primary text-white hover:bg-pm-primaryHover",
    secondary: "bg-pm-secondary text-white hover:bg-pm-secondaryHover",
    accent: "bg-pm-accent text-white hover:bg-pm-accentHover",
    ghost: "bg-transparent text-pm-primary hover:bg-white/80 border border-pm-border",
  };

  // Filter out incompatible props that cause type conflicts
  const {
    onDrag,
    onDragStart,
    onDragEnd,
    onAnimationStart,
    onAnimationEnd,
    onTransitionEnd,
    ...safeProps
  } = props;

  return (
    <motion.button
      whileHover={{ y: -1, boxShadow: "0 10px 30px rgba(16,24,40,0.10)" }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={clsx(base, styles[variant], className)}
      {...safeProps}
    />
  );
}


