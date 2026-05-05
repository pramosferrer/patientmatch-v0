"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import type { ToastMessage, ToastType } from "@/hooks/useToast";

type ToastProps = {
  toast: ToastMessage;
  onClose: () => void;
};

export default function Toast({ toast, onClose }: ToastProps) {
  const { message, type = "info", duration = 5000 } = toast;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const isError = type === "error";
  const isSuccess = type === "success";
  const a11yRole = isError ? "alert" : "status";
  const ariaLive = isError ? "assertive" : "polite";

  const icons: Record<ToastType, typeof Info> = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
  };

  const Icon = icons[type] || Info;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`relative flex items-start gap-3 p-4 rounded-lg shadow-pm max-w-sm
          ${isError ? 'bg-red-50' : isSuccess ? 'bg-green-50' : 'bg-white'}`}
        role={a11yRole}
        aria-live={ariaLive}
      >
        <Icon
          size={20}
          className={`mt-0.5 ${isError ? 'text-red-600' : isSuccess ? 'text-green-600' : 'text-pm-secondary'}`}
        />
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${isError ? 'text-red-700' : isSuccess ? 'text-green-700' : 'text-pm-ink'}`}>{message}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-black/5 transition-colors"
          aria-label="Close toast"
        >
          <X size={16} className="text-pm-muted" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
