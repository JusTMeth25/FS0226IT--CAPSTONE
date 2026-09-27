import { useState } from 'react';
import {
  disableFreePackNotifications, enableFreePackNotifications, freePackNotificationsOn, notificationsSupported
} from '../../services/pwa.js';

/** Interruttore della notifica "pacchetto gratis pronto" (chiede il permesso al browser). */
export default function NotifyToggle() {
  const [on, setOn] = useState(freePackNotificationsOn);
  const [denied, setDenied] = useState(false);
  if (!notificationsSupported()) return null;

  const toggle = async () => {
    if (on) {
      disableFreePackNotifications();
      setOn(false);
      return;
    }
    const granted = await enableFreePackNotifications();
    setOn(granted);
    setDenied(!granted);
  };

  return (
    <button type="button" className={`btn btn-small ${on ? 'btn-gold' : 'btn-secondary'} notify-toggle`} onClick={toggle} aria-pressed={on}
      title={denied ? 'Il browser ha bloccato le notifiche: riattivale dalle impostazioni del sito' : undefined}>
      <i className={`ph-fill ${on ? 'ph-bell-ringing' : 'ph-bell-slash'}`} /> {on ? 'Ti avviso quando il pacchetto gratis è pronto' : 'Avvisami quando il pacchetto gratis è pronto'}
    </button>
  );
}
