import CardTile from '../card/CardTile.jsx';
import '../../styles/home/shelf.css';

/** Traguardi dell'album in percentuale. */
const MILESTONES = [25, 50, 75, 100];

const intFmt = new Intl.NumberFormat('it-IT');

/**
 * Percentuale leggibile anche quando e' minuscola: col catalogo da oltre centomila carte
 * l'arrotondamento all'intero darebbe quasi sempre "0%", che non e' vero e non motiva.
 */
function formatPercent(owned, total) {
  if (!owned || !total) return '0%';
  const pct = (owned / total) * 100;
  if (pct >= 100) return '100%';
  if (pct < 0.01) return 'meno dello 0,01%';
  const digits = pct < 1 ? 2 : 1;
  return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: digits }).format(pct)}%`;
}

/** Click normale: navigazione interna. Ctrl/Cmd/centrale: lascia fare al browser (nuova scheda). */
function linkHandler(onNavigate, path) {
  return (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(path);
  };
}

/** Il contatore della cassa: quante carte diverse hai, su quante esistono, e il prossimo traguardo. */
function ShelfCounter({ ownedCount, totalCards }) {
  const owned = Math.max(0, ownedCount || 0);
  const total = Math.max(0, totalCards || 0);
  const exact = total > 0 ? Math.min(100, (owned / total) * 100) : 0;
  const target = MILESTONES.find((m) => m > exact);
  const missing = target && total > 0 ? Math.max(0, Math.ceil((target / 100) * total) - owned) : null;

  return (
    <div className="hs-counter">
      <h3 className="h-kicker">Album</h3>
      <p className="hs-count">
        <span className="hs-count-own h-num">{intFmt.format(owned)}</span>
        <span className="hs-count-sep" aria-hidden="true">/</span>
        <span className="sr-only"> su </span>
        <span className="hs-count-tot h-num">{intFmt.format(total)}</span>
      </p>
      <p className="hs-count-cap">
        carte diverse · <strong className="h-num">{formatPercent(owned, total)}</strong> del catalogo
      </p>

      {/* La barra e' solo un disegno: i numeri sopra e sotto dicono gia' tutto. */}
      <div className="hs-meter" aria-hidden="true">
        <div className="hs-meter-track">
          <span className="hs-meter-fill" style={{ width: `${exact}%` }} />
          {owned > 0 && <span className="hs-meter-pin" style={{ left: `${exact}%` }} />}
        </div>
        <ol className="hs-meter-ticks">
          {MILESTONES.map((m) => (
            <li key={m} className={exact >= m ? 'is-reached' : m === target ? 'is-next' : ''} style={{ left: `${m}%` }}>
              {m}%
            </li>
          ))}
        </ol>
      </div>

      <p className="hs-count-next">
        {/* Senza carte il "mancano 35.000" scoraggerebbe e basta: si dice da dove si parte. */}
        {owned === 0 ? (
          <>Il contatore parte dalla prima carta che trovi.</>
        ) : target ? (
          <>
            Prossimo traguardo <strong className="h-num">{target}%</strong>
            {missing !== null && <>: mancano <strong className="h-num">{intFmt.format(missing)}</strong> {missing === 1 ? 'carta' : 'carte'}</>}
          </>
        ) : (
          <><i className="ph-fill ph-trophy" aria-hidden="true" /> Album completato</>
        )}
      </p>
    </div>
  );
}

/** Lo scaffale delle ultime carte: scorre dentro di se', la carta tagliata al bordo dice che c'e' altro. */
function ShelfRack({ cards, onNavigate }) {
  return (
    <div className="hs-rack">
      <div className="hs-rack-head">
        <h3 className="hs-subtitle">Ultime trovate</h3>
        <a className="h-link hs-link" href="#/collection" onClick={linkHandler(onNavigate, '/collection')}>
          Tutta la collezione <i className="ph-fill ph-arrow-right" aria-hidden="true" />
        </a>
      </div>

      {cards.length > 0 ? (
        <div className="hs-rack-board">
          <ul className="hs-rack-row" aria-label="Ultime carte trovate">
            {cards.map((c) => (
              <li key={c.id} className="hs-rack-item">
                <a
                  className="hs-rack-card"
                  href={`#/card/${encodeURIComponent(c.id)}`}
                  aria-label={c.quantity > 1 ? `${c.name}, ${c.quantity} copie` : c.name}
                  onClick={linkHandler(onNavigate, `/card/${c.id}`)}
                >
                  <CardTile card={c} quantity={c.quantity} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="hs-rack-board hs-rack-empty">
          <div className="hs-rack-slots" aria-hidden="true">
            <span /><span /><span />
          </div>
          <div className="hs-rack-empty-text">
            <p className="hs-rack-empty-title">Lo scaffale è ancora vuoto</p>
            <p>Le carte che trovi nei pacchetti finiscono qui, dalla più recente.</p>
            <button type="button" className="hs-cta" onClick={() => onNavigate('/packs')}>
              <i className="ph-fill ph-vinyl-record" aria-hidden="true" /> Apri il primo pacchetto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Tacche per i traguardi piccoli (1/3 si legge meglio a pezzi), barra per quelli grandi. */
function MissionMeter({ progress, target }) {
  if (target > 0 && target <= 10) {
    return (
      <span className="hs-set-ticks" aria-hidden="true">
        {Array.from({ length: target }, (_, i) => <span key={i} className={i < progress ? 'is-on' : ''} />)}
      </span>
    );
  }
  const pct = target > 0 ? Math.round((progress / target) * 100) : 0;
  return (
    <span className="hs-set-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
  );
}

/** La scaletta del concerto: le missioni di oggi, numerate, con la spunta quando sono fatte. */
function ShelfSetlist({ missions, loading, onNavigate }) {
  const done = missions.filter((m) => m.progress >= m.target).length;

  let body;
  if (loading) {
    body = (
      <ol className="hs-set-list is-loading" aria-busy="true">
        {[1, 2, 3].map((n) => (
          <li key={n} className="hs-set-row">
            <span className="hs-set-num h-num" aria-hidden="true">{String(n).padStart(2, '0')}</span>
            <span className="hs-set-skel" />
          </li>
        ))}
        <li className="sr-only">Carico le missioni di oggi…</li>
      </ol>
    );
  } else if (missions.length === 0) {
    body = <p className="hs-set-empty">Oggi non ci sono missioni in scaletta.</p>;
  } else {
    body = (
      <ol className="hs-set-list">
        {missions.map((m, i) => {
          const progress = Math.min(m.progress, m.target);
          const completed = progress >= m.target;
          return (
            <li key={m.id} className={`hs-set-row${completed ? ' is-done' : ''}`}>
              <span className="hs-set-num h-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <span className="hs-set-main">
                <span className="hs-set-title">
                  {m.title}
                  {completed && <span className="sr-only"> (completata)</span>}
                </span>
                <span className="hs-set-progress">
                  <MissionMeter progress={progress} target={m.target} />
                  <span className="hs-set-count h-num">{progress}/{m.target}</span>
                </span>
              </span>
              <span className="hs-set-state" aria-hidden="true">
                {completed
                  ? <i className="ph-fill ph-check-circle" />
                  : <i className={`ph-fill ${m.icon || 'ph-target'}`} />}
              </span>
              {completed && !m.claimed && <span className="hs-set-claim">Da ritirare</span>}
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div className="hs-setlist">
      <div className="hs-set-head">
        <h3 className="hs-subtitle">Scaletta di oggi</h3>
        {!loading && missions.length > 0 && (
          <span className="hs-set-sum h-num">{done} di {missions.length} fatte</span>
        )}
      </div>
      {body}
      <a className="h-link hs-link hs-set-all" href="#/missions" onClick={linkHandler(onNavigate, '/missions')}>
        Tutte le missioni <i className="ph-fill ph-arrow-right" aria-hidden="true" />
      </a>
    </div>
  );
}

/**
 * Lo scaffale: il retro del negozio, dove sta la tua collezione. Contatore dell'album,
 * ultime carte trovate su uno scaffale che scorre, scaletta delle missioni di oggi.
 *
 * Props (fissate dal coordinatore, non cambiarle: se serve altro, segnalalo):
 * - progressPercent: number 0-100 · ownedCount: number · totalCards: number
 * - recentCards: fino a 12 carte (come CardTile le vuole, con .quantity)
 * - missions: fino a 3 missioni giornaliere { id, title, icon, progress, target }
 * - missionsLoading: boolean
 * - onNavigate: (path) => void   /collection · /missions · /card/<id> · /packs (stato vuoto)
 *
 * progressPercent non si usa: e' arrotondato all'intero, e col catalogo enorme varrebbe quasi
 * sempre 0. La percentuale esatta si ricava da ownedCount e totalCards.
 */
export default function HomeShelf({ ownedCount, totalCards, recentCards = [], missions = [], missionsLoading, onNavigate }) {
  return (
    <section className="hs h-sleeve" aria-labelledby="hs-title">
      <div className="hs-body">
        <header className="hs-head">
          <p className="h-kicker">Il retro del negozio</p>
          <h2 id="hs-title" className="h-title">Lo scaffale</h2>
        </header>
        <ShelfCounter ownedCount={ownedCount} totalCards={totalCards} />
        <ShelfRack cards={recentCards} onNavigate={onNavigate} />
        <ShelfSetlist missions={missions} loading={missionsLoading} onNavigate={onNavigate} />
      </div>
    </section>
  );
}
