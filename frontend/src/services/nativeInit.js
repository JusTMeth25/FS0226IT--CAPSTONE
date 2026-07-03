import { Capacitor } from '@capacitor/core';

/**
 * Inizializzazione nativa (solo dentro l'app Capacitor, no-op sul web):
 * stila la status bar per il tema scuro e nasconde lo splash screen
 * una volta che React ha montato l'app.
 */
export async function initNativeApp() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    // plugin non disponibile su questa piattaforma: ignora
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    // plugin non disponibile su questa piattaforma: ignora
  }
}
