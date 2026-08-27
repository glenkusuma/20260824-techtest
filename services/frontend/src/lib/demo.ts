const storageKey = "solar-telemetry-demo-mode";

/**
 * Whether demo mode is active. Demo mode is enabled when `VITE_DEMO_MODE` is
 * `"true"`, when the URL carries `?demo=1` (which then persists to session
 * storage), or when it was previously enabled this session. When disabled no UI
 * becomes available from demo-only code paths.
 * @returns `true` when demo mode is currently active.
 */
export const isDemoMode = (): boolean => {
  if (import.meta.env.VITE_DEMO_MODE === "true") return true;
  const queryEnabled =
    new URLSearchParams(window.location.search).get("demo") === "1";
  if (queryEnabled) sessionStorage.setItem(storageKey, "true");
  return queryEnabled || sessionStorage.getItem(storageKey) === "true";
};
