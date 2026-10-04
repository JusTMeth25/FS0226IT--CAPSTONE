/**
 * La smorfia napoletana: il significato tradizionale di ogni numero, che il banditore annuncia
 * mentre estrae le palline (come alla tombola di Natale). Alcune voci sono addolcite.
 */
export const SMORFIA = [
  null,
  "L'Italia", 'La bambina', 'La gatta', 'Il maiale', 'La mano', 'Quella che guarda in terra', 'Il vasetto', 'La Madonna',
  'La figliolanza', 'I fagioli', 'I topolini', 'Il soldato', "Sant'Antonio", "L'ubriaco", 'Il ragazzo', 'Il fondoschiena',
  'La disgrazia', 'Il sangue', 'La risata', 'La festa', 'La donna nuda', 'Il pazzo', 'Lo scemo', 'Le guardie', 'Natale',
  'Nannina', 'Il vaso da notte', 'Le belle forme', 'Il padre dei bambini', 'I bottoni del tenente', 'Il padrone di casa',
  'Il capitone', 'Gli anni di Cristo', 'La testa', "L'uccellino", 'Le nacchere', 'Il monaco', 'Le botte', 'La corda al collo',
  'La noia', 'Il coltello', 'Il caffè', 'La donna al balcone', 'Le prigioni', 'Il vino buono', 'I soldi', 'Il morto',
  'Il morto che parla', 'Il pezzo di carne', 'Il pane', 'Il giardino', 'La mamma', 'Il vecchio', 'Il cappello', 'La musica',
  'La caduta', 'Il gobbo', 'Il pacco', 'I peli', 'Si lamenta', 'Il cacciatore', 'Il morto ammazzato', 'La sposa',
  'La marsina', 'Il pianto', 'Le due zitelle', 'Il totano nella chitarra', 'La zuppa cotta', 'Sottosopra', 'Il palazzo',
  "L'uomo da niente", 'La meraviglia', "L'ospedale", 'La grotta', 'Pulcinella', 'La fontana', 'Le gambe delle donne',
  'La bella ragazza', 'Il ladro', 'La bocca', 'I fiori', 'La tavola imbandita', 'Il maltempo', 'La chiesa',
  "Le anime del purgatorio", 'La bottega', 'I pidocchi', 'I caciocavalli', 'La vecchia', 'La paura'
];

/** Come lo annuncia il banditore: "Il 90, la paura!". */
export function callLine(n) {
  return `Il ${n}, ${SMORFIA[n]?.toLowerCase() || ''}!`;
}
