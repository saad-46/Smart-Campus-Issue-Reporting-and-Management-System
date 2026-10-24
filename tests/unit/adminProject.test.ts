import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("firebase admin project isolation", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.FIRESTORE_EMULATOR_HOST;
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it("refuses a service account that belongs to a different project than the client config", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "unifix-otp-test";
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: "service_account", project_id: "some-other-project", client_email: "x@y.iam.gserviceaccount.com", private_key: "not-a-key" });
    const { adminAuth, AdminNotConfigured } = await import("@/lib/server/admin");
    expect(() => adminAuth()).toThrow(AdminNotConfigured);
  });

  it("refuses to start without a project id or without credentials", async () => {
    delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    delete process.env.GCLOUD_PROJECT;
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: "unifix-otp-test" });
    const mod = await import("@/lib/server/admin");
    expect(() => mod.adminAuth()).toThrow(mod.AdminNotConfigured);
    vi.resetModules();
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "unifix-otp-test";
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const again = await import("@/lib/server/admin");
    expect(() => again.adminDb()).toThrow(again.AdminNotConfigured);
  });
});
