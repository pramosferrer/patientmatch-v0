'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MagicLinkDialog } from "@/components/auth/MagicLinkDialog";

export default function AccountGuest() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <h1 className="text-3xl font-semibold text-pm-ink">Sign in to manage your alerts</h1>
      <p className="mt-3 text-sm text-pm-muted">
        Save trial preferences, manage weekly alerts, and export your data once you&apos;re signed in.
      </p>
      <div className="mt-6 flex justify-center">
        <Button onClick={() => setOpen(true)}>Send me a magic link</Button>
      </div>
      <MagicLinkDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
