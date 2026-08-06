// Native (Capacitor) initialisation. No-ops on the web build — every call is
// guarded by isNativePlatform() and uses dynamic imports so the plugins never
// weigh down the web bundle.
export async function initNative(): Promise<void> {
  const Cap = (window as any).Capacitor;
  if (!Cap?.isNativePlatform?.()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    /* plugin missing on this platform — ignore */
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    // Hide once the web app has actually rendered (nicer than a fixed timer).
    await SplashScreen.hide();
  } catch {
    /* ignore */
  }
}
