import { useEffect, useMemo, useState } from 'react';
import { furniApi } from '../../services/furniApi.js';
import { PACKS } from '../../data/packs.js';
import { PACK_GRADIENT, PACK_ICON, PACK_IMAGE } from '../../components/pack/packArt.js';
import FurniPreview from './FurniPreview.jsx';

/**
 * Borsa: i mobili non ancora posizionati e i pacchetti da aprire (comprati in edicola o
 * regalati da missioni e livelli). I mobili si ricaricano quando il server avvisa che sono
 * cambiati (mobile posizionato o raccolto) tramite `version`.
 */
export default function Inventory({ catalogByType, canPlace, version, packs, initialTab = 'furni', onPlace, onOpenPack, onClose }) {
  const [items, setItems] = useState(null);
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    let cancelled = false;
    furniApi.inventory()
      .then((res) => { if (!cancelled) setItems(res.items || []); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [version]);

  // Stesso tipo raggruppato: "Sedia neon ×3" invece di tre righe uguali.
  const groups = useMemo(() => {
    const map = new Map();
    (items || []).forEach((item) => {
      if (!map.has(item.type)) map.set(item.type, []);
      map.get(item.type).push(item);
    });
    return [...map.entries()];
  }, [items]);

  const ownedPacks = PACKS.filter((pack) => (packs[pack.id] || 0) > 0);
  const packCount = ownedPacks.reduce((sum, pack) => sum + packs[pack.id], 0);

  return (
    <div className="hotel-panel hotel-inventory" role="dialog" aria-label="Borsa">
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-package" /> Borsa</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      <div className="hotel-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'furni'} className={`hotel-tab${tab === 'furni' ? ' active' : ''}`} onClick={() => setTab('furni')}>
          Mobili
        </button>
        <button type="button" role="tab" aria-selected={tab === 'packs'} className={`hotel-tab${tab === 'packs' ? ' active' : ''}`} onClick={() => setTab('packs')}>
          Pacchetti {packCount > 0 && <span className="hotel-count">{packCount}</span>}
        </button>
      </div>

      {tab === 'furni' && (
        <>
          {!canPlace && <p className="hotel-panel-hint">Entra nella tua stanza per posizionare i mobili.</p>}
          <ul className="hotel-furni-grid">
            {items === null && <li className="hotel-room-empty">Carico la borsa…</li>}
            {items && groups.length === 0 && <li className="hotel-room-empty">Nessun mobile: compra qualcosa nel negozio!</li>}
            {groups.map(([type, list]) => {
              const def = catalogByType.get(type);
              return (
                <li key={type} className="hotel-furni-card">
                  <FurniPreview type={type} def={def} />
                  <strong>{def?.name || type} {list.length > 1 && <span className="hotel-count">×{list.length}</span>}</strong>
                  <button type="button" className="btn btn-primary btn-small" disabled={!canPlace} onClick={() => onPlace(list[0])}>
                    <i className="ph-fill ph-hand-grabbing" /> Posiziona
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {tab === 'packs' && (
        <ul className="hotel-pack-grid">
          {ownedPacks.length === 0 && (
            <li className="hotel-room-empty">Nessun pacchetto nella borsa: passa dall&apos;Edicola per comprarne uno!</li>
          )}
          {ownedPacks.map((pack) => (
            <li key={pack.id} className="hotel-pack-card">
              <div className="hotel-pack-art" style={{ background: PACK_IMAGE[pack.id] ? undefined : PACK_GRADIENT[pack.id] }}>
                {PACK_IMAGE[pack.id]
                  ? <img src={PACK_IMAGE[pack.id]} alt="" />
                  : <i className={`ph-fill ${PACK_ICON[pack.id] || 'ph-gift'}`} />}
                <b className="hotel-pack-owned">×{packs[pack.id]}</b>
              </div>
              <strong>{pack.name}</strong>
              <small>{pack.cardCount} carte</small>
              <button type="button" className="btn btn-primary btn-small" onClick={() => onOpenPack(pack.id)}>
                <i className="ph-fill ph-gift" /> Apri
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
