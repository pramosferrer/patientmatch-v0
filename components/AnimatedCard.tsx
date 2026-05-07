"use client";
import { motion } from "framer-motion";
import { HTMLAttributes } from "react";
import clsx from "clsx";

export default function AnimatedCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
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
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: "0 16px 40px rgba(16,24,40,0.10)" }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={clsx("pm-card", className)}
      {...safeProps}
    />
  );
}


