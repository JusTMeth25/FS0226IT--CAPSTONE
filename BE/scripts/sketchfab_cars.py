"""
Scarica da Sketchfab i modelli 3D delle auto sportive del quartiere (formato .glb) e li mette in
frontend/public/models/cars/, con i crediti degli autori (licenza CC Attribution: vanno citati).

La chiave API si legge dalla variabile d'ambiente "Sketchfab API KEY" (oppure SKETCHFAB_API_KEY)
e non viene mai stampata. I file scaricati si tengono nel repository: l'app non chiama Sketchfab.

    python BE/scripts/sketchfab_cars.py

Ogni auto corrisponde a un veicolo del catalogo (LuxuryCatalog.java, parte "r"). Si scelgono
modelli leggeri (poche migliaia di poligoni) e senza marchi di case vere.
"""
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'frontend', 'public', 'models', 'cars'))

# ride -> uid del modello su Sketchfab
CARS = {
    5: '178014a09458423c9547712c6c09cd82',  # Venom '90 - Retro Styled model (spider rossa)
    6: '23dfdeb55dc24970b36065afaab7a8a5',  # Low-poly sports car (gialla)
    7: '8109fdf5b4104e3299fe1738e1a349d5',  # Paragon '95 - Retro Styled model (coupe' bianca)
    8: '885a9c05854c45759ae22933274087bc',  # Pagasim Yudha (hypercar nera)
    9: 'bc0c2de8426741ad8713246dbce90bb7',  # Tarzaan The Wonder Car, Metallic Blue (coupe' blu)
}


def api_key():
    key = os.environ.get('Sketchfab API KEY') or os.environ.get('SKETCHFAB_API_KEY')
    if not key:
        sys.exit('Manca la variabile d\'ambiente "Sketchfab API KEY".')
    return key.strip()


def get_json(url, key):
    req = urllib.request.Request(url, headers={'Authorization': 'Token ' + key})
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)


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
        path = os.path.join(OUT, f'r{ride}.glb')
        with urllib.request.urlopen(url, timeout=120) as res, open(path, 'wb') as f:
            f.write(res.read())
        credits[f'r{ride}'] = {
            'name': info['name'],
            'author': info['user']['displayName'] or info['user']['username'],
            'license': license_.get('label'),
            'url': info['viewerUrl'],
        }
        print(f'r{ride}: {info["name"]} di {credits[f"r{ride}"]["author"]} ({os.path.getsize(path) // 1024} KB)')
    with open(os.path.join(OUT, 'credits.json'), 'w', encoding='utf-8') as f:
        json.dump(credits, f, ensure_ascii=False, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
