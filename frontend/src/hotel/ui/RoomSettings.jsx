import { useState } from 'react';
import { roomApi } from '../../services/roomApi.js';
import { hotelApi } from '../../services/hotelApi.js';

const FLOORS = [
  ['neon', 'Piastrelle neon'], ['parquet', 'Parquet scuro'], ['carpet', 'Moquette'],
  ['checker', 'Scacchiera'], ['marble', 'Marmo'], ['arena', 'Ring'], ['grass', 'Prato'], ['pooldeck', 'Bordo piscina'],
  ['terracotta', 'Cotto'], ['wooddeck', 'Pedana in legno'], ['sand', 'Sabbia'], ['cobble', 'Sampietrini'],
  ['cinema', 'Moquette del cinema'], ['rubber', 'Gomma da palestra'], ['pitch', 'Campo da calcio'], ['court', 'Parquet da basket'], ['kart', 'Pista go-kart']
];
const WALLS = [
  ['neon', 'Carta da parati neon'], ['brick', 'Mattoni'], ['teal', 'Verde caffetteria'],
  ['wood', 'Boiserie in legno'], ['windows', 'Vetrate'], ['arena', 'Pannelli arena'], ['hedge', 'Siepe'],
  ['pooltile', 'Piastrelle da piscina'], ['skyline', 'Skyline notturno'], ['seaside', 'Orizzonte sul mare'],
  ['shops', 'Vetrine dei negozi'], ['curtain', 'Sipario di velluto'], ['mirror', 'Specchi da palestra'],
  ['stadium', 'Tribune dello stadio'], ['comics', 'Negozio di fumetti']
];

/** Impostazioni della propria stanza. Le modifiche arrivano subito a chi e' dentro. */
export default function RoomSettings({ room, onClose }) {
  const [name, setName] = useState(room.name || '');
  const [description, setDescription] = useState(room.description || '');
  const [doorMode, setDoorMode] = useState(room.doorMode || 'open');
  const [maxUsers, setMaxUsers] = useState(room.maxUsers || 20);
  const [floorStyle, setFloorStyle] = useState(room.floorStyle || 'neon');
  const [wallStyle, setWallStyle] = useState(room.wallStyle || 'neon');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [partyTitle, setPartyTitle] = useState('');
  const [partyNotice, setPartyNotice] = useState(null);

  async function party() {
    try {
      await hotelApi.startParty(room.id, partyTitle.trim());
      setPartyNotice("Festa lanciata! Per mezz'ora la tua stanza e' in cima al navigatore e chi viene prende XP.");
    } catch {
      setPartyNotice('Festa non lanciata, riprova.');
    }
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await roomApi.updateSettings(room.id, { name, description, doorMode, maxUsers: Number(maxUsers), floorStyle, wallStyle });
      onClose();
    } catch {
      setError('Salvataggio non riuscito. Controlla il nome e riprova.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="hotel-panel hotel-settings" onSubmit={save} aria-label="Impostazioni stanza">
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-gear-six" /> La mia stanza</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      <div className="hotel-settings-body">
        <label>Nome
          <input className="hotel-chat-input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>Descrizione
          <input className="hotel-chat-input" value={description} maxLength={255} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>Porta
          <select className="hotel-chat-input" value={doorMode} onChange={(e) => setDoorMode(e.target.value)}>
            <option value="open">Aperta: entra chiunque</option>
            <option value="closed">Chiusa: solo io</option>
          </select>
        </label>
        <label>Pavimento
          <select className="hotel-chat-input" value={floorStyle} onChange={(e) => setFloorStyle(e.target.value)}>
            {FLOORS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Pareti
          <select className="hotel-chat-input" value={wallStyle} onChange={(e) => setWallStyle(e.target.value)}>
            {WALLS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Capienza: {maxUsers}
          <input type="range" min="1" max="25" value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} />
        </label>
      </div>
      <fieldset className="hotel-party-box">
        <legend><i className="ph-fill ph-confetti" /> Festa</legend>
        <input value={partyTitle} onChange={(e) => setPartyTitle(e.target.value)} maxLength={60} placeholder="Titolo della festa" aria-label="Titolo della festa" />
        <button type="button" className="btn btn-gold btn-small" onClick={party}>Lancia (30 min)</button>
        {partyNotice && <small>{partyNotice}</small>}
      </fieldset>
      {error && <p className="hotel-panel-error">{error}</p>}
      <footer className="hotel-panel-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <i className="ph-fill ph-floppy-disk" /> {saving ? 'Salvataggio…' : 'Salva'}
        </button>
      </footer>
    </form>
  );
}
