"""
Scarica da Sketchfab i controller chitarra stile Guitar Hero / Rock Band (formato .glb), li
alleggerisce (texture a 512 px in WebP, con gltf-transform) e li mette in
frontend/public/models/guitars/, con i crediti degli autori (licenza CC Attribution: vanno citati).

La chiave API si legge dalla variabile d'ambiente "Sketchfab API KEY" (oppure SKETCHFAB_API_KEY)
e non viene mai stampata. I file scaricati si tengono nel repository: l'app non chiama Sketchfab.

    python tools/sketchfab_guitars.py

Ogni modello corrisponde a una chitarra del Rock Store (parte "g" del codice aspetto, avatar.js).
"""
import json
import os
import sys
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'frontend', 'public', 'models', 'guitars'))

# chitarra (parte "g") -> uid del modello su Sketchfab
CARS = {
    3: '49e162cd7b744ec2b735eb16b9980daf',  # Rock Band 4 - Fender Jaguar Guitar Controller
    4: '6817e7baaa5d458481fb0b205346853c',  # Gibson Les Paul Guitar Controllers (Guitar Hero)
    5: 'd5020c096ecf4403956ac38d9360de87',  # Death Magnetic Flying V Guitar Controller
    6: 'a184739035e64d1fba7a01543bbf04be',  # Guitar Hero - Warriors of Rock Guitar Controller
    9: '3f067c0fc296425087a2a86655f6d04f',  # Gibson SG PS2 Guitar Controllers (Guitar Hero)
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
        path = os.path.join(OUT, f'g{ride}.glb')
        raw = path + '.raw.glb'
        fetch_file(url, raw)
        # Texture a 512 px in WebP: da 20-40 MB a qualche centinaio di KB.
        subprocess.run(['npx', '--yes', '@gltf-transform/cli', 'optimize', raw, path, '--texture-size', '512',
                        '--texture-compress', 'webp', '--simplify', 'false'], check=True, shell=os.name == 'nt')
        os.remove(raw)
        credits[f'g{ride}'] = {
            'name': info['name'],
            'author': info['user']['displayName'] or info['user']['username'],
            'license': license_.get('label'),
            'url': info['viewerUrl'],
        }
        print(f'g{ride}: {info["name"]} di {credits[f"g{ride}"]["author"]} ({os.path.getsize(path) // 1024} KB)')
    with open(os.path.join(OUT, 'credits.json'), 'w', encoding='utf-8') as f:
        json.dump(credits, f, ensure_ascii=False, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
