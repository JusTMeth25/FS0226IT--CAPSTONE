/**
 * Menu di un mobile cliccato. Il proprietario della stanza lo ruota, lo sposta, lo rimette
 * nell'inventario e sceglie la carta da esporre; tutti possono guardare la carta in 3D.
 */
export default function ItemMenu({ item, def, isOwner, onRotate, onMove, onPickup, onChooseCard, onViewCard, onClose }) {
  return (
    <div className="hotel-panel hotel-item-menu" role="dialog" aria-label={def?.name || 'Mobile'}>
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-cube" /> {def?.name || item.type}</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      <div className="hotel-item-actions">
        {item.card && (
          <button type="button" className="btn btn-primary btn-small" onClick={onViewCard}>
            <i className="ph-fill ph-cards" /> Guarda {item.card.name}
          </button>
        )}
        {isOwner && def?.cardDisplay && (
          <button type="button" className="btn btn-secondary btn-small" onClick={onChooseCard}>
            <i className="ph-fill ph-image-square" /> {item.card ? 'Cambia carta' : 'Scegli carta'}
          </button>
        )}
        {isOwner && !def?.wall && (
          <button type="button" className="btn btn-secondary btn-small" onClick={onRotate}>
            <i className="ph-fill ph-arrow-clockwise" /> Ruota
          </button>
        )}
        {isOwner && (
          <>
            <button type="button" className="btn btn-secondary btn-small" onClick={onMove}>
              <i className="ph-fill ph-arrows-out-cardinal" /> Sposta
            </button>
            <button type="button" className="btn btn-secondary btn-small" onClick={onPickup}>
              <i className="ph-fill ph-package" /> Nell&apos;inventario
            </button>
          </>
        )}
        {!isOwner && !item.card && <p className="hotel-panel-hint">Solo il proprietario della stanza puo&apos; spostarlo.</p>}
      </div>
    </div>
  );
}
