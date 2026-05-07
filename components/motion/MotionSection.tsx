"use client";

import { cn } from "@/lib/utils";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type MotionSectionProps = Omit<HTMLMotionProps<"section">, "children"> & {
  children?: ReactNode;
  noBlur?: boolean;
};

export function MotionSection({
  className,
  children,
  noBlur = false,
  ...props
}: MotionSectionProps) {
  const prefersReducedMotion = useReducedMotion();

  const easeOutCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];

  return (
    <motion.section
      className={cn(className)}
      initial={
        prefersReducedMotion
          ? false
          : noBlur
          ? { opacity: 0, y: 16 }
          : { opacity: 0, y: 16, filter: "blur(10px)" }
      }
      whileInView={
        prefersReducedMotion
          ? undefined
          : noBlur
          ? { opacity: 1, y: 0 }
          : { opacity: 1, y: 0, filter: "blur(0px)" }
      }
      viewport={prefersReducedMotion ? undefined : { once: true, amount: 0.3 }}
      transition={
        prefersReducedMotion ? { duration: 0 } : { duration: 0.45, ease: easeOutCurve }
      }
      {...props}
    >
      {children}
    </motion.section>
  );
}
