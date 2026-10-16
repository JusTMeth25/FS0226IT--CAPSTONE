import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@phosphor-icons/web/regular'
import '@phosphor-icons/web/fill'
import '@fontsource-variable/archivo/standard.css'
import './styles/global.css'
import './styles/shell.css'
import './styles/pages/collection.css'
import './styles/pages/game.css'
import './styles/pages/social.css'
import './styles/fx.css'
import './styles/holo-finish.css'
// Stile Phantom (Persona 5) per tutto il sito tranne l'hotel: dopo gli altri, cosi' vince.
import './styles/phantom/phantom.css'
import './styles/phantom/phantom-shell.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { GameProvider } from './context/GameContext.jsx'
import { SoundProvider } from './context/SoundContext.jsx'
import { initNativeApp } from './services/nativeInit.js'
import { registerServiceWorker } from './services/pwa.js'
import { applyPerfMode } from './utils/perfMode.js'
import { handleSpotifyCallback } from './hotel/spotify.js'
import { installImageFallback } from './utils/imageFallback.js'

applyPerfMode()
installImageFallback()
initNativeApp()
registerServiceWorker()

// Ritorno dal login di Spotify (jukebox delle stanze): prima si salvano i token, poi parte l'app.
handleSpotifyCallback().catch(() => false).finally(() => createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <GameProvider>
          <SoundProvider>
            <App />
          </SoundProvider>
        </GameProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
))
