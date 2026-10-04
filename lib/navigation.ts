/**
 * A post-login redirect target taken from the URL, accepted only if it is a
 * same-site path ("/dashboard/report?location=lab-204"). Anything that could
 * leave the site (scheme, "//host", backslashes, control characters) is
 * rejected so the login page can't be used as an open redirect.
 */
export function safeRedirectPath(value: string | null | undefined): string | null {
  if (!value || value.length > 500) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;
  if (value.startsWith("/login") || value.startsWith("/register")) return null;
  try {
    const url = new URL(value, "https://unifix.invalid");
    if (url.origin !== "https://unifix.invalid") return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
