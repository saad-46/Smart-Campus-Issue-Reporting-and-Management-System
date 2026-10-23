// While a person is signing out on purpose, the route guards must not treat
// the vanishing session as "someone opened a protected page signed out" and
// send them to /login?next=...: sign-out goes straight to the home page.

let ending = false;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Call before signing out. The mark clears itself shortly after navigation. */
export function beginSessionEnd(): void {
  ending = true;
  if (timer) clearTimeout(timer);
}

/** Call once the home page has been requested (or sign-out failed). */
export function finishSessionEnd(afterMs = 2000): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    ending = false;
  }, afterMs);
}

export function isSessionEnding(): boolean {
  return ending;
}
