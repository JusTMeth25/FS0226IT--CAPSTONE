import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@phosphor-icons/web/regular'
import '@phosphor-icons/web/fill'
import './styles/global.css'
import './styles/fx.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { GameProvider } from './context/GameContext.jsx'
import { SoundProvider } from './context/SoundContext.jsx'
import { initNativeApp } from './services/nativeInit.js'
import { registerServiceWorker } from './services/pwa.js'
import { applyPerfMode } from './utils/perfMode.js'

applyPerfMode()
initNativeApp()
registerServiceWorker()

createRoot(document.getElementById('root')).render(
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
)
