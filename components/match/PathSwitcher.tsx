"use client";
import { motion } from "framer-motion";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-pm-secondary";
const idle  = "border-pm-border bg-white hover:shadow-md";
const active = "border-pm-primary ring-2 ring-pm-primary/60 bg-white";

type PathMode = "chat" | "condition";

type PathSwitcherProps = {
  mode: PathMode;
  onChange: (mode: PathMode) => void;
};

export default function PathSwitcher({ mode, onChange }: PathSwitcherProps) {
  return (
    <div className="flex items-center gap-2 p-1 bg-pm-bg/50 rounded-2xl border border-pm-border/30">
      {/* Chat Path */}
      <button
        onClick={() => onChange("chat")}
        className={`relative flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${focus} ${
          mode === "chat" ? active : idle
        }`}
        aria-label="Switch to chat-based matching"
      >
        <div className="h-10 w-10 rounded-xl bg-pm-primary/10 text-pm-primary flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div className="text-left">
          <div className="font-medium text-sm">Chat</div>
          <div className="text-xs text-pm-muted">Guided conversation</div>
        </div>
        {mode === "chat" && (
          <span className="text-[10px] text-white bg-pm-primary rounded-full px-2 py-0.5">Recommended</span>
        )}
      </button>

      {/* Quick Path */}
      <button
        onClick={() => onChange("condition")}
        className={`relative flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${focus} ${
          mode === "condition" ? active : idle
        }`}
        aria-label="Switch to quick screening"
      >
        <div className="h-10 w-10 rounded-xl bg-pm-primary/10 text-pm-primary flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          </svg>
        </div>
        <div className="text-left">
          <div className="font-medium text-sm">Quick Screening</div>
          <div className="text-xs text-pm-muted">Fast form-based</div>
        </div>
      </button>
    </div>
  );
}
