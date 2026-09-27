import { useEffect, useState } from 'react';
import { canPromptInstall, isInstalled, promptInstall } from '../../services/pwa.js';

const IOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/**
 * Installare VinylDex sul telefono (o sul computer). Dove il browser lo permette c'e' il bottone;
 * altrimenti le istruzioni: su iPhone da Safari, su Android dal menu di Chrome.
 */
export default function InstallApp() {
  const [ready, setReady] = useState(canPromptInstall);
  const [installed, setInstalled] = useState(isInstalled);

  useEffect(() => {
    const update = () => { setReady(canPromptInstall()); setInstalled(isInstalled()); };
    window.addEventListener('vinyldex-install-ready', update);
    return () => window.removeEventListener('vinyldex-install-ready', update);
  }, []);

  return (
    <div className="glass-panel install-app">
      <h3 className="panel-title"><i className="ph-fill ph-device-mobile" /> Installa l&apos;app</h3>
      {installed ? (
        <p><i className="ph-fill ph-check-circle" /> Stai già usando VinylDex come app installata.</p>
      ) : (
        <>
          <p>VinylDex si installa come un&apos;app: icona sulla schermata Home, schermo intero e avviso quando il pacchetto gratis è pronto.</p>
          {ready && (
            <button type="button" className="btn btn-primary" onClick={() => promptInstall().then(() => setInstalled(isInstalled()))}>
              <i className="ph-fill ph-download-simple" /> Installa VinylDex
            </button>
          )}
          <ul className="install-steps">
            <li className={IOS ? 'current' : ''}><strong>iPhone / iPad</strong>: apri il sito con <em>Safari</em>, tocca <i className="ph-fill ph-export" /> Condividi e poi <em>Aggiungi alla schermata Home</em>.</li>
            <li className={!IOS ? 'current' : ''}><strong>Android</strong>: apri il sito con <em>Chrome</em>, tocca il menu <i className="ph-fill ph-dots-three-vertical" /> e poi <em>Installa app</em> (o <em>Aggiungi a schermata Home</em>).</li>
            <li><strong>Computer</strong>: in Chrome o Edge c&apos;è l&apos;icona <i className="ph-fill ph-download-simple" /> nella barra dell&apos;indirizzo.</li>
          </ul>
          <p className="install-note">Serve il sito pubblicato in HTTPS (o aperto su localhost dal computer): da un indirizzo di rete locale tipo http://192.168… il telefono non permette l&apos;installazione.</p>
        </>
      )}
    </div>
  );
}
