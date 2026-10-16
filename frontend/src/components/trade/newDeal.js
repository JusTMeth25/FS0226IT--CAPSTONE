let seq = 0;

/** Esito per DealBanner, con un identificativo nuovo: due acquisti uguali di fila fanno ripartire il banner. */
export const newDeal = (title, text) => ({ id: ++seq, title, text });
