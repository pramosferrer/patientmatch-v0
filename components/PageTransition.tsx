"use client";
import { AnimatePresence, motion } from "framer-motion";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.main
        key={typeof window !== 'undefined' ? location.pathname : 'server'}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="flex-1"
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
}


