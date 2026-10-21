import { useEffect, useRef, useState } from 'react';
import { getJukebox } from '../music.js';
import { GUITARS, GUITAR_STYLES } from '../sprites/avatar.js';
import { hotelApi } from '../../services/hotelApi.js';
import { findCardById } from '../../data/cards.js';
import { resolveCardImage } from '../../utils/cardUtils.js';
import { ROCK_LEGENDS, rivalLive } from './rockLegends.js';
import { DIFFICULTIES, SONGS, multOf } from './rockSongs.js';
import { isSafeMode } from '../../services/accessibility.js';

/**
 * Schermate della gara rock (rockGame.jsx): scelta della canzone, tastiera in prospettiva su
 * canvas con le gemme, i tasti, le fiammate, punteggio, moltiplicatore, pubblico e star power,
 * e il riepilogo finale con le stelle.
 */

function starsFor(s) {
  const ratio = s.points / s.perfect;
  if (s.failed) return 0;
  if (ratio >= 0.9) return 5;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.55) return 3;
  if (ratio >= 0.35) return 2;
  return 1;
}

/** I migliori voti della canzone scelta, per difficolta' e strumento. */
function Leaderboard({ song, diff, instrument }) {
  const [top, setTop] = useState(null);
  useEffect(() => {
    let cancelled = false;
    hotelApi.rockScores(SONGS[song].id, DIFFICULTIES[diff].id, instrument)
      .then((res) => { if (!cancelled) setTop(res.top || []); })
      .catch(() => { if (!cancelled) setTop([]); });
    return () => { cancelled = true; };
  }, [song, diff, instrument]);
  return (
    <div className="rock-board">
      <strong><i className="ph-fill ph-trophy" /> Classifica: {SONGS[song].title} · {DIFFICULTIES[diff].label}</strong>
      {top === null && <small>Carico…</small>}
      {top?.length === 0 && <small>Nessuno ancora: sii il primo!</small>}
      <ol>{(top || []).map((row) => <li key={row.username}><span>{row.username}</span><b>{row.score}</b></li>)}</ol>
    </div>
  );
}

export default function RockView({ s, act, grade, guitar = 0 }) {
  // Mentre si suona la musica della stanza tace; la canzone si ferma chiudendo il gioco.
  const audioRef = useRef(null);
  useEffect(() => {
    audioRef.current = s.audio;
  });
  useEffect(() => {
    getJukebox().setMuted(true);
    return () => {
      getJukebox().setMuted(false);
      audioRef.current?.stop();
    };
  }, []);

  if (s.phase === 'select') {
    return (
      <div className="rock-select">
        <div className="rock-songs">
          {SONGS.map((song, i) => (
            <button key={song.id} type="button" className={`rock-song${s.song === i ? ' active' : ''}`} onClick={() => act(`song:${i}`)}>
              <strong>{song.title}</strong>
              <span>{song.band} · {song.genre}</span>
              {song.style && <em className="rock-song-style">stile {song.style}</em>}
              <small>{song.bpm} bpm · {Array.from({ length: song.level }, (_, k) => <i key={k} className="ph-fill ph-fire" />)}</small>
            </button>
          ))}
        </div>
        <div className="rock-diffs">
          {DIFFICULTIES.map((d, i) => (
            <button key={d.id} type="button" className={`rock-diff${s.diff === i ? ' active' : ''}`} onClick={() => act(`diff:${i}`)}>
              {d.label}<small>{s.instrument === 'drums' ? ['cassa e rullante', '+ charleston', 'tutto'][i] : `${d.lanes} tasti`}</small>
            </button>
          ))}
        </div>
        <div className="rock-rivals" role="radiogroup" aria-label="Sfidante">
          <strong><i className="ph-fill ph-sword" /> Sfida una leggenda del locale</strong>
          <div className="rock-rival-list">
            <button type="button" role="radio" aria-checked={s.rival < 0} className={`rock-rival${s.rival < 0 ? ' active' : ''}`} onClick={() => act('rival:-1')}>
              <span className="rock-rival-none"><i className="ph ph-user" /></span>
              <small>Da solo</small>
            </button>
            {ROCK_LEGENDS.map((legend, i) => {
              const card = findCardById(legend.card);
              return (
                <button key={legend.key} type="button" role="radio" aria-checked={s.rival === i} title={`${legend.name} · ${legend.role} · di solito fa ${legend.skill}`}
                  className={`rock-rival${s.rival === i ? ' active' : ''}`} onClick={() => act(`rival:${i}`)}>
                  <img src={resolveCardImage({ ...card, source: 'original', rarity: 'legendary' })} alt="" />
                  <small>{legend.name}</small>
                  <b>{legend.skill}</b>
                </button>
              );
            })}
          </div>
        </div>
        <Leaderboard song={s.song} diff={s.diff} instrument={s.instrument} />
        {s.instrument === 'guitar' && (
          <p className="rock-gear">
            <i className="ph-fill ph-guitar" /> {guitar ? `Suoni con la tua ${GUITARS[guitar]}` : 'Suoni con la chitarra del locale (al Rock Store trovi la tua)'}
          </p>
        )}
        <button type="button" className="btn btn-primary rock-go" onClick={() => act(`go:${guitar}`)}>
          <i className="ph-fill ph-lightning" /> {s.instrument === 'drums' ? 'Suona la batteria!' : 'Suona!'}
        </button>
      </div>
    );
  }
  return (
    <div className="rock-stage-view">
      <RockHighway s={s} />
      {s.phase === 'results' && (
        <div className="rock-results">
          <h4>{s.failed ? 'Il pubblico ti ha fischiato!' : 'Canzone finita!'}</h4>
          <div className="rock-stars">
            {[1, 2, 3, 4, 5].map((n) => <i key={n} className={`ph-fill ph-star${n <= starsFor(s) ? ' on' : ''}`} />)}
          </div>
          <p>{Math.round(s.points).toLocaleString('it-IT')} punti · {s.hits}/{s.chart.length} note · serie migliore {s.best}</p>
          <p className="rock-grade">Voto rock: <strong>{grade}</strong>/1000</p>
          {s.rival >= 0 && <p className="rock-gear"><i className="ph-fill ph-sword" /> Sfida a {ROCK_LEGENDS[s.rival].name}: consegna il voto e la band annuncia chi ha vinto!</p>}
          <button type="button" className="btn btn-primary" onClick={() => act('finish')}>Consegna il voto</button>
        </div>
      )}
    </div>
  );
}

const W = 640;
const H = 400;
const HORIZON = 46;
const STRIKE = 336;
const TOP_W = 150;
const BOTTOM_W = 500;
const DEPTH = 2.6;

/** Prospettiva: da 0 (linea dei tasti) a 1 (orizzonte) a y e larghezza della tastiera. */
function persp(u) {
  const p = 1 / (1 + DEPTH * Math.max(0, u));
  const pmin = 1 / (1 + DEPTH);
  const f = (p - pmin) / (1 - pmin);
  return { y: HORIZON + (STRIKE - HORIZON) * f, w: TOP_W + (BOTTOM_W - TOP_W) * f, f };
}

/** Tasti della tastiera: 5 per la chitarra, 4 per la batteria (lo imposta drawScene). */
let LANES = 5;

function laneX(lane, w) {
  return W / 2 + (lane - (LANES - 1) / 2) * (w / LANES);
}

function RockHighway({ s }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== W * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(ctx, s);
  });
  return <canvas ref={ref} className="rock-canvas" style={{ aspectRatio: `${W} / ${H}` }} aria-label="Tastiera della gara rock" />;
}

function drawScene(ctx, s) {
  LANES = s.laneCount || 5;
  const song = SONGS[s.song];
  const diff = DIFFICULTIES[s.diff];
  const t = s.t;
  const beatPhase = ((t % s.beat) + s.beat) % s.beat / s.beat;
  // Modalita' sicura (fotosensibilita'): la fiammata sul tasto e' tenue e senza bianco, il conto
  // alla rovescia non pulsa a tempo.
  const safe = isSafeMode();

  // Palco: fondo scuro con i fasci di luce che si muovono a tempo.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a0628');
  bg.addColorStop(1, '#07030d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const beams = s.starOn ? ['rgba(96,165,250,0.18)', 'rgba(147,197,253,0.14)'] : ['rgba(239,68,68,0.14)', 'rgba(250,204,21,0.1)'];
  for (let i = 0; i < 4; i += 1) {
    const a = Math.sin(t / 900 + i * 1.7) * 0.5;
    const x = 80 + i * 160;
    ctx.fillStyle = beams[i % 2];
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + Math.sin(a) * 260 - 60, H);
    ctx.lineTo(x + Math.sin(a) * 260 + 60, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Tastiera in prospettiva.
  const top = persp(1);
  const bottom = persp(-0.08);
  ctx.beginPath();
  ctx.moveTo(W / 2 - top.w / 2, top.y);
  ctx.lineTo(W / 2 + top.w / 2, top.y);
  ctx.lineTo(W / 2 + bottom.w / 2, bottom.y);
  ctx.lineTo(W / 2 - bottom.w / 2, bottom.y);
  ctx.closePath();
  const board = ctx.createLinearGradient(0, top.y, 0, bottom.y);
  board.addColorStop(0, '#120a08');
  board.addColorStop(1, '#3b2415');
  ctx.fillStyle = board;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = s.starOn ? '#60a5fa' : (GUITAR_STYLES[s.guitar]?.body || '#9ca3af');
  ctx.stroke();

  // Linee delle battute che scorrono verso chi suona.
  const firstBeat = Math.floor(t / s.beat);
  for (let b = firstBeat; b < firstBeat + 12; b += 1) {
    const u = (b * s.beat - t) / diff.travel;
    if (u < -0.05 || u > 1) continue;
    const p = persp(u);
    ctx.strokeStyle = b % 4 === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = b % 4 === 0 ? 2.5 * p.f + 0.5 : 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - p.w / 2, p.y);
    ctx.lineTo(W / 2 + p.w / 2, p.y);
    ctx.stroke();
  }
  // Corde: le linee dei cinque tasti (o meno) dall'orizzonte ai tasti.
  const lanes = s.instrument === 'drums' ? LANES : diff.lanes;
  for (let lane = 0; lane < LANES; lane += 1) {
    const used = s.instrument === 'drums' || lane < diff.lanes;
    ctx.strokeStyle = used ? 'rgba(229,231,235,0.35)' : 'rgba(229,231,235,0.08)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(laneX(lane, top.w), top.y);
    ctx.lineTo(laneX(lane, bottom.w), bottom.y);
    ctx.stroke();
  }

  // Note lunghe: la scia colorata fino alla fine della nota.
  s.chart.forEach((note) => {
    if (!note.sustain || note.missed) return;
    const u0 = Math.max(0, (note.time - t) / diff.travel);
    const u1 = (note.time + note.sustain - t) / diff.travel;
    if (u1 < 0 || u0 > 1) return;
    const holding = s.sustaining.some((sus) => sus.note === note);
    if (note.hit && !holding) return;
    note.lanes.forEach((lane) => {
      ctx.beginPath();
      const steps = 12;
      for (let i = 0; i <= steps; i += 1) {
        const u = u0 + ((Math.min(1, u1) - u0) * i) / steps;
        const p = persp(u);
        const wobble = holding ? Math.sin(t / 30 + i) * 2 * p.f : 0;
        const x = laneX(lane, p.w) + wobble;
        const half = 7 * p.f + 2;
        if (i === 0) ctx.moveTo(x - half, p.y);
        else ctx.lineTo(x - half, p.y);
      }
      for (let i = steps; i >= 0; i -= 1) {
        const u = u0 + ((Math.min(1, u1) - u0) * i) / steps;
        const p = persp(u);
        ctx.lineTo(laneX(lane, p.w) + 7 * p.f + 2, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = note.star ? 'rgba(147,197,253,0.8)' : s.laneColors[lane];
      ctx.globalAlpha = holding ? 1 : 0.75;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  });

  // Tasti in fondo: anello colorato, pieno se premuto, fiammata quando si prende una nota.
  for (let lane = 0; lane < lanes; lane += 1) {
    const x = laneX(lane, persp(0).w);
    const y = STRIKE;
    const pressed = s.held[lane];
    ctx.beginPath();
    ctx.ellipse(x, y, 30, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#0b0b0f';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = s.laneColors[lane];
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y, 20, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = pressed ? s.laneColors[lane] : '#27272a';
    ctx.fill();
    const since = t - s.flash[lane];
    if (since >= 0 && since < 260) {
      const k = 1 - since / 260;
      const flame = ctx.createRadialGradient(x, y - 20, 2, x, y - 20, 50);
      flame.addColorStop(0, safe ? `rgba(251,146,60,${0.3 * k})` : `rgba(255,255,220,${0.9 * k})`);
      flame.addColorStop(0.4, `rgba(251,146,60,${(safe ? 0.2 : 0.7) * k})`);
      flame.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = flame;
      ctx.beginPath();
      ctx.ellipse(x, y - 24 - (1 - k) * 20, 34, 46 * k + 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Gemme: dall'orizzonte ai tasti, piu' grandi avvicinandosi. Le note stella sono bianche e azzurre.
  const visible = s.chart.filter((n) => !n.hit && n.time - t < diff.travel && n.time - t > -300);
  visible.sort((a, b) => b.time - a.time);
  visible.forEach((note) => {
    const u = (note.time - t) / diff.travel;
    const p = persp(u);
    note.lanes.forEach((lane) => {
      const x = laneX(lane, p.w);
      const rx = 24 * p.f + 4;
      const ry = 12 * p.f + 2;
      ctx.globalAlpha = note.missed ? 0.35 : 1;
      const color = note.star || s.starOn ? '#dbeafe' : s.laneColors[lane];
      ctx.beginPath();
      ctx.ellipse(x, p.y + ry * 0.5, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, p.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = note.star ? '#3b82f6' : 'rgba(255,255,255,0.8)';
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x - rx * 0.25, p.y - ry * 0.35, rx * 0.45, ry * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, p.y, rx * 0.22, ry * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#111';
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  });

  // Punteggio, moltiplicatore, barra del pubblico, star power, titolo e avanzamento.
  const mult = multOf(s.streak) * (s.starOn ? 2 : 1);
  ctx.fillStyle = '#fff';
  ctx.font = '800 26px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(Math.round(s.points).toLocaleString('it-IT'), 18, 36);
  ctx.font = '600 12px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#d4d4d8';
  ctx.fillText(`Serie ${s.streak}`, 18, 54);
  // Sfida a una leggenda: il tuo voto contro il suo, mentre la canzone va avanti.
  if (s.rival >= 0 && s.perfect) {
    const legend = ROCK_LEGENDS[s.rival];
    const mine = Math.round((s.points / s.perfect) * 1000);
    const theirs = rivalLive(legend, t, s.length);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(12, 62, 170, 40);
    ctx.font = '700 11px "Trebuchet MS", sans-serif';
    [[`Tu ${mine}`, mine, '#22c55e'], [`${legend.name} ${theirs}`, theirs, '#f472b6']].forEach(([label, value, color], row) => {
      ctx.fillStyle = '#27272a';
      ctx.fillRect(18, 70 + row * 16, 100, 6);
      ctx.fillStyle = color;
      ctx.fillRect(18, 70 + row * 16, Math.min(100, value / 10), 6);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, 124, 76 + row * 16);
    });
  }

  const mx = 50;
  const my = 250;
  ctx.beginPath();
  ctx.arc(mx, my, 34, 0, Math.PI * 2);
  ctx.fillStyle = '#0b0b0f';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#3f3f46';
  ctx.stroke();
  const progress = multOf(s.streak) >= 4 ? 1 : (s.streak % 10) / 10;
  ctx.beginPath();
  ctx.arc(mx, my, 34, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.strokeStyle = s.starOn ? '#60a5fa' : ['#e5e7eb', '#f97316', '#22c55e', '#a855f7'][multOf(s.streak) - 1];
  ctx.stroke();
  ctx.fillStyle = s.starOn ? '#93c5fd' : '#fff';
  ctx.font = '900 24px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`x${mult}`, mx, my + 8);

  // Barra del pubblico: rosso, giallo, verde, con la lancetta.
  const rx = W - 62;
  const ry = 250;
  [['#ef4444', Math.PI, Math.PI * 1.33], ['#facc15', Math.PI * 1.33, Math.PI * 1.66], ['#22c55e', Math.PI * 1.66, Math.PI * 2]].forEach(([c, a0, a1]) => {
    ctx.beginPath();
    ctx.arc(rx, ry, 44, a0, a1);
    ctx.lineWidth = 12;
    ctx.strokeStyle = c;
    ctx.stroke();
  });
  const needle = Math.PI + s.rock * Math.PI;
  ctx.beginPath();
  ctx.moveTo(rx, ry);
  ctx.lineTo(rx + Math.cos(needle) * 40, ry + Math.sin(needle) * 40);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.font = '700 11px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#e5e7eb';
  ctx.fillText('PUBBLICO', rx, ry + 18);

  // Star power: barra azzurra; piena a meta' si puo' attivare.
  ctx.fillStyle = '#18181b';
  ctx.fillRect(W - 118, 286, 104, 10);
  ctx.fillStyle = s.starOn ? '#93c5fd' : s.star >= 0.5 ? '#60a5fa' : '#1d4ed8';
  ctx.fillRect(W - 118, 286, 104 * s.star, 10);
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 1;
  ctx.strokeRect(W - 118, 286, 104, 10);
  ctx.fillStyle = '#bfdbfe';
  ctx.fillText('STAR POWER', W - 66, 310);

  ctx.textAlign = 'right';
  ctx.font = '800 15px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(song.title, W - 16, 26);
  ctx.font = '600 12px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#d4d4d8';
  ctx.fillText(`${song.band} · ${diff.label}`, W - 16, 44);
  ctx.fillStyle = '#27272a';
  ctx.fillRect(W - 176, 52, 160, 4);
  ctx.fillStyle = '#f97316';
  ctx.fillRect(W - 176, 52, 160 * Math.max(0, Math.min(1, t / s.length)), 4);

  // Conteggio iniziale e scritte a comparsa.
  ctx.textAlign = 'center';
  if (t < 0) {
    ctx.font = '900 64px "Trebuchet MS", sans-serif';
    ctx.fillStyle = safe ? 'rgba(255,255,255,0.9)' : `rgba(255,255,255,${0.4 + 0.6 * (1 - beatPhase)})`;
    ctx.fillText(String(Math.ceil(-t / s.beat)), W / 2, 190);
  }
  s.popups.forEach((p, i) => {
    const age = t - p.at;
    if (age > 1400 || age < 0) return;
    ctx.globalAlpha = 1 - age / 1400;
    ctx.font = '900 22px "Trebuchet MS", sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    const y = 150 - i * 26 - age / 40;
    ctx.strokeText(p.text, W / 2, y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, W / 2, y);
    ctx.globalAlpha = 1;
  });
}
