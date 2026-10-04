"use client";

import { useEffect } from "react";
import StatusScreen from "@/components/shell/StatusScreen";
import Button from "@/components/ui/Button";

// Route-level error boundary: a rendering error shows this instead of a
// blank page. Details go to the console only — never to the user.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[render] unexpected error", { name: error.name, digest: error.digest });
  }, [error]);

  return (
    <StatusScreen
      tone="danger"
      title="Something went wrong"
      description="An unexpected error occurred. Your data is safe — please try again."
      actions={<Button onClick={reset}>Try again</Button>}
    />
  );
}
