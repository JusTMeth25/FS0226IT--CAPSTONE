"""
Elenco fisso delle carte EA FC 27 Ultimate Team, sempre disponibile anche senza rete.

Da dove vengono i dati:
- i giocatori e le giocatrici: i primi PLAYERS della classifica ufficiale EA
  (https://www.ea.com/games/ea-sports-fc/ratings), con valutazione, ruolo, club, nazione,
  le sei statistiche e la foto. Sono gli stessi dati che l'import dal pannello admin legge
  dal sito EA, con lo stesso id ("ea-<id EA>"), quindi un import successivo aggiorna queste carte.
- le icone: EA non le pubblica nella classifica. Valutazione dai tracker delle icone FC 27,
  ruolo noto, le sei statistiche stimate dal ruolo e dalla valutazione; foto ufficiale EA
  quando l'id del giocatore e' noto.

Dati e foto: EA SPORTS FC(TM) 27 Player Ratings, (c) Electronic Arts Inc. Uso didattico, non
ufficiale, non affiliato ne' approvato da Electronic Arts.
- i prezzi in crediti delle icone sono STIME (FUTBIN e FUT.GG non si possono leggere in
  automatico). Quelli dei giocatori li stima il backend (Fc27Importer.estimateCoins) dalla
  valutazione, dal ritmo e dal ruolo; con la chiave FutDB l'import usa i prezzi veri.

Uso:  python BE/scripts/fc27_cards.py   (scrive BE/src/main/resources/fc27/cards.json)
"""
import json
import os
import re
import unicodedata
import urllib.request

RATINGS_URL = 'https://www.ea.com/games/ea-sports-fc/ratings'
PLAYERS = 100
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'main', 'resources', 'fc27', 'cards.json')

# Icone: nome | nazione | ruolo | OVR della versione migliore (tracker delle icone FC 27) | id EA.
# L'id EA serve per la foto ufficiale (ratings-images-prod.pulse.ea.com/.../p<id>.png): EA non
# pubblica le icone nella classifica, gli id sono stati controllati uno a uno confrontando la foto.
# Senza id la carta usa la sagoma disegnata dal server.
ICONS = """
Pelé | Brazil | CAM | 95 | 237067
Diego Maradona | Argentina | CAM | 95 |
Ronaldo Nazário | Brazil | ST | 94 | 37576
Zinedine Zidane | France | CAM | 94 | 1397
Franz Beckenbauer | Germany | CB | 93 |
Garrincha | Brazil | RW | 93 |
Johan Cruyff | Netherlands | ST | 93 | 190045
Mia Hamm | United States | ST | 93 |
Paolo Maldini | Italy | CB | 93 | 238439
Ronaldinho | Brazil | CAM | 93 | 28130
Andrés Iniesta | Spain | CM | 92 |
Bobby Charlton | England | CAM | 92 |
Ferenc Puskás | Hungary | ST | 92 | 254642
Gianluigi Buffon | Italy | GK | 92 | 1179
Gerd Müller | Germany | ST | 92 | 190048
Birgit Prinz | Germany | ST | 92 |
Carlos Alberto | Brazil | RB | 91 |
Cafú | Brazil | RB | 91 |
Eusébio | Portugal | ST | 91 | 242519
Franco Baresi | Italy | CB | 91 |
Oliver Kahn | Germany | GK | 91 |
Roberto Baggio | Italy | CAM | 91 |
Ruud Gullit | Netherlands | CAM | 91 | 214100
Thierry Henry | France | ST | 91 | 1625
Marco van Basten | Netherlands | ST | 91 |
Xavi | Spain | CM | 91 | 10535
Zlatan Ibrahimović | Sweden | ST | 91 |
Zico | Brazil | CAM | 91 |
Sócrates | Brazil | CAM | 91 | 190046
Lothar Matthäus | Germany | CM | 91 | 238435
Andrea Pirlo | Italy | CM | 90 |
Sergio Agüero | Argentina | ST | 90 |
Karl-Heinz Rummenigge | Germany | ST | 90 |
Raphaël Varane | France | CB | 90 | 201535
Roberto Carlos | Brazil | LB | 90 | 238430
Peter Schmeichel | Denmark | GK | 90 | 238428
Alessandro Nesta | Italy | CB | 90 | 1088
Fabio Cannavaro | Italy | CB | 90 | 1183
Alan Shearer | England | ST | 90 | 51
Frank Lampard | England | CM | 90 | 5471
Luís Figo | Portugal | RM | 90 | 5589
Marcel Desailly | France | CB | 90 | 1116
Javier Zanetti | Argentina | RB | 90 | 1041
Claude Makélélé | France | CDM | 90 | 1668
Miroslav Klose | Germany | ST | 90 | 242510
Hernán Crespo | Argentina | ST | 90 | 7512
Michael Owen | England | ST | 90 | 5419
"""

PORTRAIT_URL = 'https://ratings-images-prod.pulse.ea.com/FC25/full/player-portraits/p{}.png?padding=0.7'

# Statistiche tipiche per ruolo, come scarto dalla valutazione (o valore fisso se preceduto da "=").
TEMPLATES = {
    'ST': ['-1', '+1', '-9', '-2', '=42', '-8'],
    'CAM': ['-6', '-4', '+1', '+1', '=52', '-16'],
    'CM': ['-12', '-9', '+1', '-1', '-16', '-12'],
    'LM': ['+0', '-6', '-4', '+0', '=55', '-20'],
    'RW': ['+1', '-5', '-6', '+1', '=45', '-20'],
    'CB': ['-12', '=50', '-20', '-18', '+1', '-4'],
    'RB': ['-2', '=66', '-6', '-6', '-3', '-8'],
    'LB': ['+0', '=70', '-8', '-4', '-6', '-10'],
    'RM': ['-2', '-6', '-2', '+0', '=48', '-22'],
    'CDM': ['-20', '=62', '-8', '-10', '+0', '-4'],
    'GK': ['-3', '-1', '-12', '+0', '=50', '-2'],
}


def slug(text):
    plain = unicodedata.normalize('NFD', text).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', plain).strip('-')


def estimated_stats(position, ovr, seed):
    stats = []
    for i, rule in enumerate(TEMPLATES[position]):
        value = int(rule[1:]) if rule.startswith('=') else ovr + int(rule)
        # Un po' di varieta' fra giocatori con lo stesso ruolo, sempre la stessa per nome.
        value += (seed * (i + 3)) % 5 - 2
        stats.append(max(25, min(99, value)))
    return stats


# Prezzi indicativi in crediti delle icone, per valutazione.
ICON_PRICE = {90: 900_000, 91: 1_500_000, 92: 2_500_000, 93: 4_000_000, 94: 6_000_000, 95: 9_000_000}


def round_price(price):
    """I prezzi del mercato UT hanno scatti fissi: 50, 100, 250, 1000 crediti a seconda della fascia."""
    step = 50 if price < 10_000 else 100 if price < 50_000 else 250 if price < 100_000 else 1_000
    return int(round(price / step) * step)


def rows(block):
    return [[part.strip() for part in line.split('|')] for line in block.strip().splitlines()]


def ea_page(page):
    """Una pagina (100 giocatori) della classifica EA: i dati stanno nel JSON __NEXT_DATA__ della pagina."""
    request = urllib.request.Request(f'{RATINGS_URL}?page={page}', headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(request, timeout=30).read().decode('utf-8')
    data = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S).group(1)
    return json.loads(data)['props']['pageProps']['ratingDetails']['items']


def player(item):
    """Stessi campi che legge Fc27Importer.fromEa, ma gia' ridotti alla carta."""
    stats = item['stats']
    position = item['position']['shortLabel']
    if position == 'GK':
        keys = ['gkDiving', 'gkHandling', 'gkKicking', 'gkReflexes', 'pac', 'gkPositioning']
    else:
        keys = ['pac', 'sho', 'pas', 'dri', 'def', 'phy']
    values = [stats[k]['value'] for k in keys]
    name = item.get('commonName') or f"{item['firstName']} {item['lastName']}"
    return {
        'id': f"ea-{item['id']}",
        'name': name,
        'club': item['team']['label'],
        'nation': item['nationality']['label'],
        'position': position,
        'ovr': item['overallRating'],
        'pac': values[0], 'sho': values[1], 'pas': values[2], 'dri': values[3], 'def': values[4], 'phy': values[5],
        'version': 'gold_rare',
        'rank': item['rank'],
        'women': item['gender']['id'] == 1,
        'photoUrl': item['avatarUrl'],
    }


def main():
    cards = []
    page = 1
    while len(cards) < PLAYERS:
        cards += [player(item) for item in ea_page(page)]
        page += 1
    cards = cards[:PLAYERS]
    for name, nation, pos, ovr, ea_id in rows(ICONS):
        ovr = int(ovr)
        stats = estimated_stats(pos, ovr, len(name))
        women = name in ('Mia Hamm', 'Birgit Prinz')
        cards.append({
            'id': f'icon-{slug(name)}',
            'name': name,
            'club': 'ICON',
            'nation': nation,
            'position': pos,
            'ovr': ovr,
            'pac': stats[0], 'sho': stats[1], 'pas': stats[2], 'dri': stats[3], 'def': stats[4], 'phy': stats[5],
            'version': 'icon',
            'women': women,
            'coinPrice': round_price(ICON_PRICE[ovr] * (0.4 if women else 1)),
        })
        if ea_id:
            cards[-1]['photoUrl'] = PORTRAIT_URL.format(ea_id)

    ids = [c['id'] for c in cards]
    assert len(ids) == len(set(ids)), 'id duplicati'
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(cards, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'{len(cards)} carte in {os.path.normpath(OUT)}')


if __name__ == '__main__':
    main()
