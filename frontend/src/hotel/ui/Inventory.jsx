import { useEffect, useMemo, useState } from 'react';
import { furniApi } from '../../services/furniApi.js';
import FurniPreview from './FurniPreview.jsx';

/**
 * Inventario dei mobili non ancora posizionati. Si ricarica quando il server avvisa che e'
 * cambiato (mobile posizionato o raccolto) tramite `version`.
 */
export default function Inventory({ catalogByType, canPlace, version, onPlace, onClose }) {
  const [items, setItems] = useState(null);

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

  return (
    <div className="hotel-panel hotel-inventory" role="dialog" aria-label="Inventario">
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-package" /> Inventario</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      {!canPlace && <p className="hotel-panel-hint">Entra nella tua stanza per posizionare i mobili.</p>}
      <ul className="hotel-furni-grid">
        {items === null && <li className="hotel-room-empty">Carico l&apos;inventario…</li>}
        {items && groups.length === 0 && <li className="hotel-room-empty">Inventario vuoto: compra qualcosa nel negozio!</li>}
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
    </div>
  );
}
