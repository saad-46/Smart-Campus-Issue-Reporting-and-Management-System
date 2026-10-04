"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "./AuthProvider";
import StatusScreen from "./shell/StatusScreen";
import Button from "./ui/Button";

/**
 * Shown when someone is signed in but their profile couldn't be loaded
 * (network failure, interrupted registration). Offers a retry.
 */
export default function ProfileUnavailable() {
  const { reloadProfile, signOut } = useAuthContext();
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    await reloadProfile();
    setRetrying(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <StatusScreen
      tone="danger"
      title="We couldn't load your account"
      description="Please check your connection and try again."
      actions={
        <>
          <Button variant="secondary" onClick={handleSignOut} disabled={retrying}>
            Sign out
          </Button>
          <Button onClick={handleRetry} isLoading={retrying}>
            Try again
          </Button>
        </>
      }
    />
  );
}
