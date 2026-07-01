import { useEffect, useState } from 'react';
import { soundService } from '../services/soundService.js';
import { SoundContext } from './sound-context.js';

export function SoundProvider({ children }) {
  const [enabled, setEnabledState] = useState(soundService.isEnabled());

  useEffect(() => soundService.subscribe(setEnabledState), []);

  const value = { enabled, toggle: () => soundService.toggle(), sound: soundService };

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}
