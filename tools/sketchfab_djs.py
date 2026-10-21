"""
Scarica da Sketchfab i caschi dei DJ della Disco (formato .glb) e li mette in
frontend/public/models/djs/, con i crediti degli autori (licenza CC Attribution: vanno citati).

La chiave API si legge dalla variabile d'ambiente "Sketchfab API KEY" (oppure SKETCHFAB_API_KEY)
e non viene mai stampata. I file scaricati si tengono nel repository: l'app non chiama Sketchfab.

    python tools/sketchfab_djs.py

Ogni casco corrisponde alla parte "d" del codice aspetto (avatar.js, DJ_HEADS): li portano i DJ
ispirati a Daft Punk, Marshmello e deadmau5.
"""
import json
import os
import sys
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'frontend', 'public', 'models', 'djs'))

# testa -> uid del modello su Sketchfab
CARS = {
    1: 'cbcea62f4655451cac60b979e6d556ec',  # Daft Punk Helmet (Thomas Bangalter)
    2: '3006a337592c4d0e8dbf9284fcc10141',  # Marshmello Helmet Textured
    3: '2a6d025f0b69439db02c157c26a433f1',  # Deadmau5
    4: '68834dab6d6c46bb8fb7ca4d5c218b67',  # Daft Punk Guy Helmet
}


def api_key():
    key = os.environ.get('Sketchfab API KEY') or os.environ.get('SKETCHFAB_API_KEY')
    if not key:
        sys.exit('Manca la variabile d\'ambiente "Sketchfab API KEY".')
    return key.strip()


def get_json(url, key):
    # curl invece di urllib: su alcune macchine i certificati di Python sono scaduti.
    out = subprocess.run(['curl', '-s', '--max-time', '60', '-H', 'Authorization: Token ' + key, url], capture_output=True)
    return json.loads(out.stdout)


def fetch_file(url, path):
    subprocess.run(['curl', '-s', '-L', '--max-time', '300', '-o', path, url], check=True)


def main():
    key = api_key()
    os.makedirs(OUT, exist_ok=True)
    credits = {}
    for ride, uid in CARS.items():
        info = get_json(f'https://api.sketchfab.com/v3/models/{uid}', key)
        license_ = info.get('license') or {}
        if 'Attribution' not in (license_.get('label') or '') or 'NonCommercial' in (license_.get('label') or ''):
            sys.exit(f'{info["name"]}: licenza non adatta ({license_.get("label")})')
        download = get_json(f'https://api.sketchfab.com/v3/models/{uid}/download', key)
        url = download['glb']['url']
        path = os.path.join(OUT, f'd{ride}.glb')
        fetch_file(url, path)
        credits[f'd{ride}'] = {
            'name': info['name'],
            'author': info['user']['displayName'] or info['user']['username'],
            'license': license_.get('label'),
            'url': info['viewerUrl'],
        }
        print(f'd{ride}: {info["name"]} di {credits[f"d{ride}"]["author"]} ({os.path.getsize(path) // 1024} KB)')
    with open(os.path.join(OUT, 'credits.json'), 'w', encoding='utf-8') as f:
        json.dump(credits, f, ensure_ascii=False, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
