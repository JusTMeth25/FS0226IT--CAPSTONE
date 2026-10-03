"""
Prepara i set dei DJ della Disco (BE/src/main/resources/music/djs.json): per ogni brano cerca su
iTunes Search API (gratuita, senza chiave) l'anteprima ufficiale di 30 secondi, la copertina e il
link ad Apple Music, che l'app mostra mentre il brano suona.

    python BE/scripts/disco_djs.py

I DJ sono personaggi dell'hotel ispirati a DJ e cantanti veri: suonano i brani originali degli
artisti a cui sono ispirati (anteprime di Apple), con un nome di fantasia. I cantanti ("role":
"singer") si presentano al microfono invece che in consolle. Si sceglie sempre la versione
originale (esplicita), mai quella censurata ("clean", "amended", radio edit).
"""
import json
import os
import subprocess
import time
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'src', 'main', 'resources', 'music', 'djs.json'))

MAX_TRACKS = 12

DJS = [
    # I due robot si danno il cambio alla consolle: un brano il casco argento, uno quello oro.
    {'key': 'robots', 'name': 'Les Robots', 'tribute': 'Daft Punk', 'look': 's0.h0.hc0.sh0.p1.t2.f0.a0.d1',
     'altLook': 's0.h0.hc0.sh0.p1.t2.f0.a0.d4',
     'artist': 'Daft Punk',
     'tracks': ['One More Time', 'Around the World', 'Get Lucky', 'Harder, Better, Faster, Stronger',
                'Instant Crush', 'Lose Yourself to Dance', 'Digital Love', 'Robot Rock', 'Technologic',
                'Da Funk']},
    {'key': 'mello', 'name': 'DJ Mello', 'tribute': 'Marshmello', 'look': 's0.h0.hc0.sh0.p1.t3.f0.a0.d2',
     'artist': 'Marshmello',
     'tracks': ['Alone', 'Happier', 'Silence', 'FRIENDS', 'Wolves', 'Here With Me', 'Summer', 'Keep It Mello', 'Numb',
                'Miles On It', 'Spotlight']},
    {'key': 'mau5', 'name': 'Mau5 Head', 'tribute': 'deadmau5', 'look': 's0.h0.hc0.sh6.p1.t2.f0.a0.d3',
     'artist': 'deadmau5',
     'tracks': ["Ghosts 'n' Stuff", 'Strobe', 'I Remember', 'Some Chords', 'The Veldt', 'Raise Your Weapon',
                'Professional Griefers', 'Sofi Needs a Ladder', 'Faxing Berlin', 'Raise Your Weapon']},
    {'key': 'avi', 'name': 'Avi Tim', 'tribute': 'Avicii', 'look': 's0.h4.hc3.sh1.p1.t0.f0.a6',
     'artist': 'Avicii',
     'tracks': ['Levels', 'Wake Me Up', 'Hey Brother', 'The Nights', 'Waiting for Love', 'Without You',
                'Addicted to You', 'Lonely Together', 'SOS', 'Fade Into Darkness', 'Silhouettes']},
    {'key': 'guetta', 'name': 'DJ Davide', 'tribute': 'David Guetta', 'look': 's1.h9.hc5.sh9.p1.t3.f0.a2',
     'artist': 'David Guetta',
     'tracks': ['Titanium', 'Without You', 'Memories', "I'm Good (Blue)", 'Play Hard', 'Hey Mama',
                "Baby Don't Hurt Me", 'When Love Takes Over', 'Where Them Girls At', 'Lovers on the Sun']},
    {'key': 'calvin', 'name': 'Calvino', 'tribute': 'Calvin Harris', 'look': 's0.h1.hc1.sh4.p1.t1.f0.a0',
     'artist': 'Calvin Harris',
     'tracks': ['Summer', 'Feel So Close', 'This Is What You Came For', 'One Kiss', 'Outside', 'Blame',
                'How Deep Is Your Love', 'We Found Love', 'Slide', 'I Need Your Love']},
    {'key': 'garrix', 'name': 'Martino G.', 'tribute': 'Martin Garrix', 'look': 's0.h2.hc2.sh2.p1.t0.f0.a0',
     'artist': 'Martin Garrix',
     'tracks': ['Animals', 'Scared to Be Lonely', 'In the Name of Love', 'High on Life', 'Ocean', 'Summer Days',
                'There for You', 'Forbidden Voices', 'Tremor', 'Gold Skies']},
    {'key': 'skrilla', 'name': 'Skrilla', 'tribute': 'Skrillex', 'look': 's0.h2.hc7.sh9.p1.t0.f0.a1',
     'artist': 'Skrillex',
     'tracks': ['Bangarang', 'Scary Monsters and Nice Sprites', 'First of the Year (Equinox)', 'Kill Everybody',
                'Make It Bun Dem', 'Where Are Ü Now', 'Rumble', 'Purple Lamborghini', 'Cinema', 'Ragga Bomb',
                'Summit']},
    {'key': 'duepac', 'name': 'Due Pac', 'tribute': '2Pac', 'role': 'singer', 'look': 's4.h9.hc7.sh7.p0.t4.f1.a6',
     'artist': '2Pac',
     'tracks': ['California Love', 'Changes', 'All Eyez on Me', 'Hit Em Up', 'Dear Mama', 'Keep Ya Head Up',
                'I Get Around', 'Ambitionz Az a Ridah', 'Hail Mary', '2 of Amerikaz Most Wanted', "Picture Me Rollin'",
                'How Do U Want It', 'Life Goes On', 'Do for Love', "Brenda's Got a Baby", 'Until the End of Time']},
    {'key': 'biggie', 'name': 'Notorio Grande', 'tribute': 'The Notorious B.I.G.', 'role': 'singer',
     'look': 's5.h9.hc7.sh8.p1.t3.f0.a2', 'artist': 'Notorious B.I.G.',
     'tracks': ['Juicy', 'Hypnotize', 'Big Poppa', 'Mo Money Mo Problems', 'One More Chance', "Sky's the Limit",
                'Going Back to Cali', 'Notorious Thugs', 'Warning', 'Unbelievable', 'Ready to Die']},
    {'key': 'slim', 'name': 'Slim Ombroso', 'tribute': 'Eminem', 'role': 'singer', 'look': 's0.h9.hc3.sh9.p0.t1.f1.a0',
     'artist': 'Eminem',
     'tracks': ['Lose Yourself', 'Without Me', 'The Real Slim Shady', 'Mockingbird', 'Not Afraid',
                'Love the Way You Lie', "Till I Collapse", 'Rap God', 'Stan', 'Superman', "When I'm Gone"]},
    {'key': 'draghetto', 'name': 'Draghetto', 'tribute': 'Drake', 'role': 'singer', 'look': 's3.h0.hc7.sh9.p1.t1.f1.a0',
     'artist': 'Drake',
     'tracks': ['Hotline Bling', "God's Plan", 'One Dance', 'Started From the Bottom', 'In My Feelings',
                'Passionfruit', 'Nice For What', "Hold On, We're Going Home", 'Take Care', 'Controlla']},
    {'key': 'scotto', 'name': 'Travis Scotto', 'tribute': 'Travis Scott', 'role': 'singer',
     'look': 's4.h6.hc7.sh8.p7.t3.f4.a0', 'artist': 'Travis Scott',
     'tracks': ['SICKO MODE', 'goosebumps', 'HIGHEST IN THE ROOM', 'Antidote', 'BUTTERFLY EFFECT', 'STARGAZING',
                'FE!N', 'TELEKINESIS', 'YOSEMITE', '90210', 'Pick Up the Phone', 'Know No Better', 'TKN']},
    {'key': 'miguelito', 'name': 'Miguelito', 'tribute': 'Miguel', 'role': 'singer', 'look': 's3.h6.hc7.sh9.p1.t2.f0.a2',
     'artist': 'Miguel',
     'tracks': ["Don't Forget My Love", 'All I Want Is You', 'Sure Thing', 'Adorn', 'Sky Walker', 'Come Through and Chill',
                'Pineapple Skies', 'How Many Drinks?', 'Coffee', 'Do You...', 'Waves', 'Told You So', 'Banana Clip',
                'Arch & Point', 'Kaleidoscope Dream']},
    {'key': 'jacko', 'name': 'Michele Jackson', 'tribute': 'Michael Jackson', 'role': 'singer',
     'look': 's1.h2.hc7.sh6.p1.t3.f0.a0', 'artist': 'Michael Jackson',
     'tracks': ['Billie Jean', 'Thriller', 'Beat It', 'Smooth Criminal', 'Bad', "Don't Stop 'Til You Get Enough",
                'Rock with You', 'Man in the Mirror', 'Black or White', 'Remember the Time']},
    {'key': 'diploma', 'name': 'Diploma', 'tribute': 'Diplo', 'look': 's0.h0.hc2.sh7.p0.t2.f1.a2',
     'artist': 'Diplo',
     'tracks': ["Don't Forget My Love", 'Revolution', 'Express Yourself', 'Get It Right', 'Heartless', 'On My Mind',
                'Electricity', 'Genius', 'Thunderclouds', 'Lean On', 'Where Are Ü Now', 'Earthquake', 'Lose Control']},
    {'key': 'escissione', 'name': 'Escissione', 'tribute': 'Excision', 'look': 's0.h9.hc7.sh9.p1.t1.f0.a1',
     'artist': 'Excision',
     'tracks': ['X Rated', 'Throwin Elbows', 'Rumble', 'Robo Kitty', 'Shake the Ground', 'Bring the Madness',
                'Sleepless', 'Night Shade', 'Destroid 8 Annihilate', 'The Paradox', 'Swagga', 'Get Up']},
    {'key': 'padiglione', 'name': 'Padiglione Flux', 'tribute': 'Flux Pavilion', 'look': 's0.h1.hc2.sh3.p0.t0.f1.a3',
     'artist': 'Flux Pavilion',
     'tracks': ["I Can't Stop", 'Bass Cannon', 'Gold Dust', 'Daydreamer', 'Blow the Roof', 'Cracks', 'Superhero',
                'Do or Die', 'Emotional', 'Voscillate', 'Got 2 Know', 'Feel This Way']},
    {'key': 'zombetto', 'name': 'Zombetto', 'tribute': 'Zomboy', 'look': 's1.h5.hc7.sh5.p1.t1.f2.a0',
     'artist': 'Zomboy',
     'tracks': ['Nuclear (Hands Up)', 'Like a Bitch', 'Organ Donor', 'Here to Stay', 'Lone Wolf', 'Rotten', 'Delirium',
                'Survivors', 'Saints & Sinners', 'Neon Grave', 'Beast in the Belly', 'Dead Presidents']},
    {'key': 'coltelli', 'name': 'Festa dei Coltelli', 'tribute': 'Knife Party', 'look': 's0.h0.hc0.sh6.p1.t3.f0.a2',
     'artist': 'Knife Party',
     'tracks': ['Bonfire', 'Internet Friends', 'Centipede', 'Rage Valley', 'Antidote', 'Fire Hive', 'LRAD',
                'Power Glove', 'Resistance', 'Give It Up', 'Begin Again', 'Sleaze']},
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


def catalog(artist):
    # La ricerca per titolo di iTunes rende spesso solo la versione censurata dei brani rap: il
    # catalogo dell'artista (lookup per artistId) ha anche le versioni originali esplicite.
    query = urllib.parse.urlencode({'term': artist, 'entity': 'musicArtist', 'limit': 5, 'country': 'it'})
    artists = fetch(f'https://itunes.apple.com/search?{query}').get('results', [])
    time.sleep(3)
    match = next((a for a in artists if a.get('artistName', '').lower() in (artist.lower(), f'the {artist.lower()}')), None)
    if not match:
        return []
    query = urllib.parse.urlencode({'id': match['artistId'], 'entity': 'song', 'limit': 200, 'country': 'it'})
    songs = fetch(f'https://itunes.apple.com/lookup?{query}').get('results', [])
    time.sleep(3)
    return [s for s in songs if s.get('wrapperType') == 'track']


def find(artist, title, songs=()):
    query = urllib.parse.urlencode({'term': f'{artist} {title}', 'entity': 'song', 'limit': 25, 'country': 'it'})
    results = list(songs) + fetch(f'https://itunes.apple.com/search?{query}').get('results', [])
    want = title.lower().split(' (')[0]
    remix = ('remix', 'mix]', 'mix)', 'live', 'extended', 'radio edit', 'radio mix', 'clean')
    # Versioni senza la voce o in un'altra lingua: mai.
    other = ('instrumental', 'a cappella', 'acapella', 'karaoke', 'spanish', 'amended', 'clean version', 'censored')

    def rank(r):
        # Prima la versione originale: titolo uguale, poi senza remix o live, poi il resto.
        name = r.get('trackName', '').lower()
        if name.split(' (')[0].split(' [')[0] == want and not any(w in name for w in remix):
            return 0
        if name.startswith(want) and not any(w in name for w in remix):
            return 1
        return 2 if name.startswith(want) else 3

    # Solo il brano cercato: se Apple non ce l'ha si salta, invece di prendere un brano qualsiasi.
    found = [r for r in results if artist.lower() in r.get('artistName', '').lower() and r.get('previewUrl')
             and r.get('trackName', '').lower().startswith(want)
             and not any(w in r.get('trackName', '').lower() for w in other)]
    # Mai la versione censurata: a parita' di titolo prima l'esplicita, poi quella non esplicita.
    found = [r for r in found if r.get('trackExplicitness') != 'cleaned']
    order = {'explicit': 0, 'notExplicit': 1}
    return min(found, key=lambda r: (rank(r), order.get(r.get('trackExplicitness'), 2))) if found else None


def main():
    out = []
    for dj in DJS:
        tracks, seen = [], set()
        songs = catalog(dj['artist'])
        # I titoli in piu' fanno da riserva: si tengono i primi MAX_TRACKS trovati.
        for title in dj['tracks']:
            if len(tracks) >= MAX_TRACKS:
                break
            r = find(dj['artist'], title, songs)
            time.sleep(3)
            same = r and r['trackName'].lower().split(' (')[0].split(' [')[0]
            if not r or r['trackId'] in seen or same in seen:
                print('  non trovato:', dj['artist'], '-', title)
                continue
            seen.update({r['trackId'], same})
            tracks.append({'id': r['trackId'], 'title': r['trackName'], 'artist': r['artistName'],
                           'preview': r['previewUrl'], 'artwork': r.get('artworkUrl100', '').replace('100x100', '300x300'),
                           'url': r.get('trackViewUrl', '').split('?')[0]})
        out.append({k: dj[k] for k in ('key', 'name', 'tribute', 'role', 'look', 'altLook') if k in dj} | {'tracks': tracks})
        print(dj['name'], len(tracks), 'brani')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
