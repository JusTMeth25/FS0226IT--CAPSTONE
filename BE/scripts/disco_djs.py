"""
Prepara i set dei DJ della Disco (BE/src/main/resources/music/djs.json): per ogni brano cerca su
iTunes Search API (gratuita, senza chiave) l'anteprima ufficiale di 30 secondi, la copertina e il
link ad Apple Music, che l'app mostra mentre il brano suona.

    python BE/scripts/disco_djs.py

I DJ sono personaggi dell'hotel ispirati a DJ veri: suonano i brani originali degli artisti a cui
sono ispirati (anteprime di Apple), con un nome di fantasia.
"""
import json
import os
import subprocess
import time
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'src', 'main', 'resources', 'music', 'djs.json'))

DJS = [
    # I due robot si danno il cambio alla consolle: un brano il casco argento, uno quello oro.
    {'key': 'robots', 'name': 'Les Robots', 'tribute': 'Daft Punk', 'look': 's0.h0.hc0.sh0.p1.t2.f0.a0.d1',
     'altLook': 's0.h0.hc0.sh0.p1.t2.f0.a0.d4',
     'artist': 'Daft Punk',
     'tracks': ['One More Time', 'Around the World', 'Get Lucky', 'Harder, Better, Faster, Stronger',
                'Instant Crush', 'Lose Yourself to Dance', 'Digital Love', 'Robot Rock']},
    {'key': 'mello', 'name': 'DJ Mello', 'tribute': 'Marshmello', 'look': 's0.h0.hc0.sh0.p1.t3.f0.a0.d2',
     'artist': 'Marshmello',
     'tracks': ['Alone', 'Happier', 'Silence', 'FRIENDS', 'Wolves', 'Here With Me', 'Summer', 'Keep It Mello']},
    {'key': 'mau5', 'name': 'Mau5 Head', 'tribute': 'deadmau5', 'look': 's0.h0.hc0.sh6.p1.t2.f0.a0.d3',
     'artist': 'deadmau5',
     'tracks': ["Ghosts 'n' Stuff", 'Strobe', 'I Remember', 'Some Chords', 'The Veldt', 'Raise Your Weapon',
                'Professional Griefers', 'Sofi Needs a Ladder']},
    {'key': 'avi', 'name': 'Avi Tim', 'tribute': 'Avicii', 'look': 's0.h4.hc3.sh1.p1.t0.f0.a6',
     'artist': 'Avicii',
     'tracks': ['Levels', 'Wake Me Up', 'Hey Brother', 'The Nights', 'Waiting for Love', 'Without You',
                'Addicted to You', 'Lonely Together']},
    {'key': 'guetta', 'name': 'DJ Davide', 'tribute': 'David Guetta', 'look': 's1.h9.hc5.sh9.p1.t3.f0.a2',
     'artist': 'David Guetta',
     'tracks': ['Titanium', 'Without You', 'Memories', "I'm Good (Blue)", 'Play Hard', 'Hey Mama',
                "Baby Don't Hurt Me", 'When Love Takes Over']},
    {'key': 'calvin', 'name': 'Calvino', 'tribute': 'Calvin Harris', 'look': 's0.h1.hc1.sh4.p1.t1.f0.a0',
     'artist': 'Calvin Harris',
     'tracks': ['Summer', 'Feel So Close', 'This Is What You Came For', 'One Kiss', 'Outside', 'Blame',
                'How Deep Is Your Love', 'We Found Love']},
    {'key': 'garrix', 'name': 'Martino G.', 'tribute': 'Martin Garrix', 'look': 's0.h2.hc2.sh2.p1.t0.f0.a0',
     'artist': 'Martin Garrix',
     'tracks': ['Animals', 'Scared to Be Lonely', 'In the Name of Love', 'High on Life', 'Ocean', 'Summer Days',
                'There for You', 'Forbidden Voices']},
]


def fetch(url):
    # curl: il Python di questa macchina ha certificati scaduti. iTunes limita le richieste
    # (circa 20 al minuto): se risponde vuoto si aspetta e si riprova.
    for attempt in range(6):
        out = subprocess.run(['curl', '-s', '--max-time', '30', url], capture_output=True)
        try:
            return json.loads(out.stdout)
        except ValueError:
            time.sleep(15 + attempt * 10)
    return {}


def find(artist, title):
    query = urllib.parse.urlencode({'term': f'{artist} {title}', 'entity': 'song', 'limit': 25, 'country': 'it'})
    results = fetch(f'https://itunes.apple.com/search?{query}').get('results', [])
    want = title.lower().split(' (')[0]
    remix = ('remix', 'mix]', 'mix)', 'live', 'extended')

    def rank(r):
        # Prima la versione originale: titolo uguale, poi senza remix o live, poi il resto.
        name = r.get('trackName', '').lower()
        if name.split(' (')[0].split(' [')[0] == want and not any(w in name for w in remix):
            return 0
        if name.startswith(want) and not any(w in name for w in remix):
            return 1
        return 2 if name.startswith(want) else 3

    found = [r for r in results if artist.lower() in r.get('artistName', '').lower() and r.get('previewUrl')]
    return min(found, key=rank) if found else None


def main():
    out = []
    for dj in DJS:
        tracks, seen = [], set()
        for title in dj['tracks']:
            r = find(dj['artist'], title)
            time.sleep(3)
            if not r or r['trackId'] in seen:
                print('  non trovato:', dj['artist'], '-', title)
                continue
            seen.add(r['trackId'])
            tracks.append({'id': r['trackId'], 'title': r['trackName'], 'artist': r['artistName'],
                           'preview': r['previewUrl'], 'artwork': r.get('artworkUrl100', '').replace('100x100', '300x300'),
                           'url': r.get('trackViewUrl', '').split('?')[0]})
        out.append({k: dj[k] for k in ('key', 'name', 'tribute', 'look', 'altLook') if k in dj} | {'tracks': tracks})
        print(dj['name'], len(tracks), 'brani')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
