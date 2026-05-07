'use client';

import { useEffect, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/auth/supabaseClient";
import { cn } from "@/lib/utils";

type MagicLinkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
  onSuccess?: () => void;
};

type Status = "idle" | "sending" | "success" | "error";

const emailSchema = z.string().email();

export function MagicLinkDialog({
  open,
  onOpenChange,
  defaultEmail,
  onSuccess,
}: MagicLinkDialogProps) {
  const supabase = useMemo(() => {
    try {
      return getSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  const [email, setEmail] = useState<string>(defaultEmail ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const isSending = status === "sending";
  const isSuccess = status === "success";

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setError(null);
      setEmail(defaultEmail ?? "");
      return;
    }
    if (defaultEmail && status === "idle") {
      setEmail(defaultEmail);
    }
  }, [defaultEmail, open, status]);

  const submit = async () => {
    if (!supabase) {
      setError("Authentication is temporarily unavailable. Please try again shortly.");
      setStatus("error");
      return;
    }

    const result = emailSchema.safeParse(email.toLowerCase());
    if (!result.success) {
      setError("Enter a valid email address to continue.");
      setStatus("error");
      return;
    }

    setStatus("sending");
    setError(null);

    const redirectTo = typeof window !== "undefined" ? window.location.href : undefined;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: result.data,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });

    if (signInError) {
      setError(signInError.message);
      setStatus("error");
      return;
    }

    setStatus("success");
    onSuccess?.();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-pm-ink/40 backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/60 bg-white/95 p-6 shadow-[0_40px_120px_-45px_rgba(15,23,42,0.45)] backdrop-blur-lg",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <DialogPrimitive.Title className="text-lg font-semibold text-pm-ink">
            Sign in to save your progress
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-sm text-pm-muted">
            We&apos;ll email you a secure magic link so you can pick up where you left off.
          </DialogPrimitive.Description>
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full p-1 text-pm-muted transition hover:text-pm-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-aurora-coral"
            onClick={() => onOpenChange(false)}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mt-6 space-y-4">
            {isSuccess ? (
              <div className="space-y-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4 text-emerald-900">
                <p className="font-medium">Check your email</p>
                <p className="text-sm text-emerald-800/90">
                  We sent you a secure magic link. Open it on this device to finish signing in.
                </p>
              </div>
            ) : (
              <>
                <label className="flex flex-col gap-2 text-sm font-medium text-pm-ink">
                  Email address
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    disabled={isSending}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button
                  type="button"
                  onClick={submit}
                  disabled={isSending}
                  className="w-full"
                >
                  {isSending ? "Sending..." : "Send me a magic link"}
                </Button>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
