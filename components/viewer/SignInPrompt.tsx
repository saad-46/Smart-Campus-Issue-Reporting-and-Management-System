"use client";

import React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import Button, { buttonClasses } from "@/components/ui/Button";

/**
 * Shown instead of performing an action in Viewer Mode. It says plainly
 * that nothing was changed and offers the real sign-in page.
 */
export default function SignInPrompt({ feature, onClose }: { feature: string | null; onClose: () => void }) {
  return (
    <Dialog
      open={feature !== null}
      onClose={onClose}
      title="Sign in to use this feature"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep exploring
          </Button>
          <Link href="/login" className={buttonClasses("primary")}>
            Sign in
          </Link>
        </>
      }
    >
      <div className="flex gap-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
        <p className="text-sm text-fg-muted">
          <span className="font-medium text-fg">{feature}</span> needs a signed-in account with the right role. Viewer Mode is read-only, so nothing
          was changed.
        </p>
      </div>
    </Dialog>
  );
}
