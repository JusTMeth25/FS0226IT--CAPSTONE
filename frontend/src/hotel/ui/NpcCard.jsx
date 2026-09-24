import AvatarPreview from './AvatarPreview.jsx';

/** Cosa si puo' ordinare, con il nome e l'icona da mostrare sul pulsante. */
const ITEMS = {
  coffee: { label: 'Caffe\'', icon: 'ph-coffee' },
  tea: { label: 'Te\'', icon: 'ph-coffee' },
  cola: { label: 'Cola', icon: 'ph-drop' },
  juice: { label: 'Succo', icon: 'ph-orange-slice' },
  bubble: { label: 'Frizzante', icon: 'ph-sparkle' },
  cocktail: { label: 'Cocktail', icon: 'ph-martini' },
  gelato: { label: 'Gelato', icon: 'ph-ice-cream' }
};

const DESCRIPTIONS = {
  receptionist: 'Accoglie chi arriva e conosce tutti i segreti dell\'hotel.',
  barista: 'Dietro al bancone: ordina e ti chiama per ritirare.',
  waiter: 'Gira fra i tavoli e ti porta l\'ordinazione dove sei.',
  lifeguard: 'Tiene d\'occhio la vasca. Niente tuffi di testa!',
  dj: 'Chiedigli un pezzo e cambia la musica della stanza.',
  ice_cream: 'Il carretto dei gelati del giardino.',
  gardener: 'Cura le aiuole e sa tutto delle piante.',
  referee: 'Arbitra le sfide dell\'Arena.',
  guest: 'Un ospite dell\'hotel: salutalo, magari balla con te.'
};

/**
 * Scheda di un NPC, aperta cliccando il suo avatar. Al posto di rispetto, scambi e sfide ci sono
 * le azioni del suo mestiere: ordinare, chiacchierare, chiedere un consiglio, ballare, musica.
 * Le stesse cose si possono chiedere anche scrivendo in chat ("un caffe' per favore, Marco").
 */
export default function NpcCard({ npc, send, onClose, onWhisper }) {
  const info = npc.npc || {};
  const act = (action, item) => send({ type: 'npc', npcId: npc.id, action, item });
  const canDance = info.role === 'guest' || info.role === 'dj';

  return (
    <div className="hotel-panel hotel-user-card hotel-npc-card" role="dialog" aria-label={`${npc.username}, ${info.title}`}>
      <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      <div className="hotel-user-card-top">
        <AvatarPreview look={npc.look} scale={1} />
        <div className="hotel-user-card-info">
          <strong>{npc.username}</strong>
          <span className="hotel-npc-role"><i className="ph-fill ph-identification-badge" /> {info.title}</span>
          <span>{DESCRIPTIONS[info.role]}</span>
        </div>
      </div>

      {info.menu?.length > 0 && (
        <div className="hotel-npc-menu">
          <span className="hotel-npc-menu-title">Ordina</span>
          <div className="hotel-npc-menu-items">
            {info.menu.map((item) => (
              <button key={item} type="button" className="hotel-npc-order" onClick={() => act('order', item)}>
                <i className={`ph-fill ${ITEMS[item]?.icon || 'ph-drop'}`} /> {ITEMS[item]?.label || item}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="hotel-user-actions">
        <button type="button" className="btn btn-secondary btn-small" onClick={() => act('talk')}>
          <i className="ph-fill ph-chat-circle-dots" /> Chiacchiera
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => act('help')}>
          <i className="ph-fill ph-lightbulb" /> Un consiglio
        </button>
        {canDance && (
          <button type="button" className="btn btn-secondary btn-small" onClick={() => act('dance')}>
            <i className="ph-fill ph-music-notes" /> Balla
          </button>
        )}
        {info.role === 'dj' && (
          <button type="button" className="btn btn-primary btn-small" onClick={() => act('music')}>
            <i className="ph-fill ph-vinyl-record" /> Cambia musica
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-small" onClick={onWhisper}>
          <i className="ph-fill ph-chat-teardrop-text" /> Sussurra
        </button>
      </div>
    </div>
  );
}
