"use client";
import { motion, useReducedMotion } from "framer-motion";

export default function AnimatedGradient() {
  const reduce = useReducedMotion();

  const blob = (className: string, animate: any) => (
    <motion.div
      className={className}
      initial={{ x: 0, y: 0, opacity: 0.7 }}
      animate={reduce ? { opacity: 0.6 } : animate}
      transition={{ duration: 22, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
    />
  );

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      {/* soft angular wash */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.65]"
           style={{
             background:
               "conic-gradient(from 120deg at 50% 50%, rgba(18,106,175,0.08), rgba(255,255,255,0.0) 30%, rgba(233,180,117,0.08) 60%, rgba(255,255,255,0.0) 85%, rgba(18,106,175,0.08))"
           }}
      />

      {/* drifting blobs */}
      {blob(
        "absolute -top-20 -left-16 h-96 w-96 rounded-full blur-3xl bg-pm-primary/20",
        { x: 40, y: 20 }
      )}
      {blob(
        "absolute top-24 right-[-120px] h-[28rem] w-[28rem] rounded-full blur-3xl bg-pm-accent/20",
        { x: -30, y: 10 }
      )}
      {blob(
        "absolute bottom-[-140px] left-1/3 h-[26rem] w-[26rem] rounded-full blur-3xl bg-pm-sky/30",
        { x: 20, y: -35 }
      )}

      {/* subtle noise texture (optional): */}
      <div className="pointer-events-none absolute inset-0 opacity-5"
           style={{ backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2244%22 height=%2244%22 viewBox=%220 0 44 44%22><path fill=%22%23fff%22 fill-opacity=%220.08%22 d=%22M0 0h2v2H0zM22 22h2v2h-2zM11 33h2v2h-2zM33 11h2v2h-2z%22/></svg>')"}}
      />
    </div>
  );
}
