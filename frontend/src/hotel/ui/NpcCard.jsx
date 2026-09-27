import { resolveCardImage } from '../../utils/cardUtils.js';
import AvatarPreview from './AvatarPreview.jsx';

/** Cosa si puo' ordinare, con il nome e l'icona da mostrare sul pulsante. */
const ITEMS = {
  coffee: { label: 'Caffe\'', icon: 'ph-coffee' },
  tea: { label: 'Te\'', icon: 'ph-coffee' },
  cola: { label: 'Cola', icon: 'ph-drop' },
  juice: { label: 'Succo', icon: 'ph-orange-slice' },
  bubble: { label: 'Frizzante', icon: 'ph-sparkle' },
  cocktail: { label: 'Cocktail', icon: 'ph-martini' },
  gelato: { label: 'Gelato', icon: 'ph-ice-cream' },
  pizza: { label: 'Pizza', icon: 'ph-pizza' },
  book: { label: 'Un libro', icon: 'ph-book-open' },
  popcorn: { label: 'Popcorn', icon: 'ph-popcorn' },
  water: { label: 'Acqua', icon: 'ph-drop' },
  latte: { label: 'Caffellatte', icon: 'ph-coffee' },
  frappe: { label: 'Frappè', icon: 'ph-brandy' }
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
  chef: 'Al forno a legna: ordina un trancio e te lo sforna.',
  librarian: 'Conosce ogni libro dello scaffale. Chiedile un consiglio.',
  guest: 'Un ospite dell\'hotel: salutalo, balla con lui o scambiate carte.',
  fighter: 'Sfidante dell\'Arena: gioca a carte con chiunque abbia coraggio, e scambia le sue doppie.',
  newsagent: 'Vende giornali, fumetti e i pacchetti di carte VinylDex.',
  usher: 'La maschera del cinema: ti porta popcorn e cola al posto.',
  trainer: 'Istruttrice della palestra: ti allena e ti porta l\'acqua.'
};

/**
 * Scheda di un NPC, aperta cliccando il suo avatar. Al posto di rispetto, scambi e sfide ci sono
 * le azioni del suo mestiere: ordinare, chiacchierare, chiedere un consiglio, ballare, musica.
 * Le stesse cose si possono chiedere anche scrivendo in chat ("un caffe' per favore, Marco").
 */
export default function NpcCard({ npc, send, inArena, onClose, onWhisper, onChallenge, onTrade, onBuyPacks }) {
  const info = npc.npc || {};
  const act = (action, item) => send({ type: 'npc', npcId: npc.id, action, item });
  const canDance = info.role === 'guest' || info.role === 'dj';
  const trades = info.role === 'guest' || info.role === 'fighter';
  const fights = info.role === 'fighter' && inArena;

  return (
    <div className="hotel-panel hotel-user-card hotel-npc-card" role="dialog" aria-label={`${npc.username}, ${info.title}`}>
      <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      <div className="hotel-user-card-top">
        <AvatarPreview look={npc.look} scale={1} />
        {info.legend && npc.bestCard && (
          <img className="hotel-npc-legend-card" src={resolveCardImage(npc.bestCard)} alt={`Carta ${npc.bestCard.name}`} />
        )}
        <div className="hotel-user-card-info">
          <strong>{npc.username}</strong>
          <span className="hotel-npc-role"><i className="ph-fill ph-identification-badge" /> {info.title}</span>
          <span>{info.legend
            ? 'Leggenda di VinylDex, dalla sua carta leggendaria. Sfidala alla gara rock: sali sulla pedana e sceglila come sfidante.'
            : DESCRIPTIONS[info.role]}</span>
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
        {fights && onChallenge && (
          <button type="button" className="btn btn-primary btn-small" onClick={onChallenge}>
            <i className="ph-fill ph-sword" /> Sfida
          </button>
        )}
        {info.role === 'newsagent' && (
          <button type="button" className="btn btn-gold btn-small" onClick={onBuyPacks}>
            <i className="ph-fill ph-cards" /> Pacchetti e vendita carte
          </button>
        )}
        {trades && (
          <button type="button" className="btn btn-primary btn-small" onClick={onTrade}>
            <i className="ph-fill ph-arrows-left-right" /> Scambia carte
          </button>
        )}
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
