"""
Crea il server gratuito di VinylDex su Oracle Cloud (Ampere A1, Always Free) riprovando finche'
non si libera capacita' ("Out of host capacity").

Usa l'SDK Python di Oracle e la configurazione in ~/.oci/config (vedi deploy/README.md, "Server
introvabile"). Resta sempre dentro i limiti gratuiti: al massimo 4 OCPU e 24 GB di RAM, boot
volume totale entro 200 GB, una sola istanza A1. Si ferma da solo appena il server esiste.

    python deploy/scripts/oracle_crea_istanza.py
    python deploy/scripts/oracle_crea_istanza.py --sizes 2:12,1:6 --every 600
"""
import argparse
import sys
import time
from datetime import datetime
from pathlib import Path

import oci

SHAPE = "VM.Standard.A1.Flex"
FREE_OCPUS, FREE_MEMORY, FREE_BOOT_GB = 4, 24, 200
NAME = "vinyldex"


def log(message):
    print(f"[{datetime.now():%H:%M:%S}] {message}", flush=True)


def patient(fn, *args, **kwargs):
    """Chiamata all'API che tollera i 401 dei primi minuti: una chiave API nuova si propaga piano."""
    for wait in range(20):
        try:
            return fn(*args, **kwargs)
        except oci.exceptions.ServiceError as e:
            if e.status != 401:
                raise
            log("Oracle non riconosce ancora la chiave API (401): riprovo fra un minuto.")
            time.sleep(60)
    sys.exit("Chiave API rifiutata per 20 minuti: controlla ~/.oci/config e la chiave in My profile > API keys.")


def parse_sizes(raw):
    sizes = []
    for part in raw.split(","):
        ocpus, memory = (float(x) for x in part.split(":"))
        if ocpus > FREE_OCPUS or memory > FREE_MEMORY:
            sys.exit(f"{part}: oltre il limite gratuito ({FREE_OCPUS} OCPU, {FREE_MEMORY} GB)")
        sizes.append((ocpus, memory))
    return sizes


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sizes", default="4:24,2:12,1:6",
                        help="OCPU:GB da provare a rotazione, una per giro (default 4:24,2:12,1:6)")
    parser.add_argument("--every", type=int, default=300, help="secondi fra un giro e l'altro (minimo 120)")
    parser.add_argument("--boot-gb", type=int, default=100, help="dimensione del disco (default 100 GB)")
    parser.add_argument("--ssh-key", default=str(Path.home() / ".ssh" / "vinyldex.key.pub"),
                        help="chiave SSH pubblica (default ~/.ssh/vinyldex.key.pub)")
    parser.add_argument("--profile", default="DEFAULT", help="profilo di ~/.oci/config")
    args = parser.parse_args()
    sizes = parse_sizes(args.sizes)
    every = max(120, args.every)

    config = oci.config.from_file(profile_name=args.profile)
    oci.config.validate_config(config)
    tenancy = config["tenancy"]
    identity = oci.identity.IdentityClient(config)
    compute = oci.core.ComputeClient(config)
    network = oci.core.VirtualNetworkClient(config)
    storage = oci.core.BlockstorageClient(config)
    ssh_key = Path(args.ssh_key).read_text(encoding="utf-8").strip()

    # Un'istanza A1 c'e' gia': niente doppioni (e niente uscita dai limiti gratuiti).
    existing = [i for i in patient(oci.pagination.list_call_get_all_results, compute.list_instances, tenancy).data
                if i.shape == SHAPE and i.lifecycle_state not in ("TERMINATED", "TERMINATING")]
    if existing:
        log(f"C'e' gia' un'istanza A1: {existing[0].display_name} ({existing[0].lifecycle_state}). Non ne creo un'altra.")
        return

    ads = patient(identity.list_availability_domains, tenancy).data
    boot_used = sum(v.size_in_gbs for ad in ads
                    for v in patient(storage.list_boot_volumes, availability_domain=ad.name, compartment_id=tenancy).data
                    if v.lifecycle_state not in ("TERMINATED", "TERMINATING"))
    if boot_used + args.boot_gb > FREE_BOOT_GB:
        sys.exit(f"Dischi gia' usati {boot_used} GB: con altri {args.boot_gb} si supera il gratuito ({FREE_BOOT_GB} GB).")

    subnets = [s for s in patient(oci.pagination.list_call_get_all_results, network.list_subnets, tenancy).data
               if not s.prohibit_public_ip_on_vnic and s.lifecycle_state == "AVAILABLE"]
    if not subnets:
        sys.exit("Nessuna subnet pubblica: crea prima la rete col VCN Wizard (README, passo 2).")
    subnet = subnets[0]

    images = patient(compute.list_images, tenancy, operating_system="Canonical Ubuntu", operating_system_version="24.04",
                                 shape=SHAPE, sort_by="TIMECREATED", sort_order="DESC").data
    if not images:
        sys.exit("Immagine Ubuntu 24.04 per A1 non trovata.")
    image = images[0]

    log(f"Regione {config['region']}, subnet {subnet.display_name}, immagine {image.display_name}")
    log(f"Provo {', '.join(f'{o:g} OCPU/{m:g} GB' for o, m in sizes)} su {', '.join(a.name for a in ads)} ogni {every} s. Ctrl+C per fermare.")

    # Oracle accetta un tentativo di creazione ogni qualche minuto: a ogni giro si prova una sola
    # misura, a rotazione, cosi' nessun tentativo si spreca in un "troppe richieste".
    attempt = 0
    while True:
        ocpus, memory = sizes[attempt % len(sizes)]
        ad = ads[(attempt // len(sizes)) % len(ads)]
        attempt += 1
        details = oci.core.models.LaunchInstanceDetails(
            availability_domain=ad.name,
            compartment_id=tenancy,
            display_name=NAME,
            shape=SHAPE,
            shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(ocpus=ocpus, memory_in_gbs=memory),
            source_details=oci.core.models.InstanceSourceViaImageDetails(
                image_id=image.id, boot_volume_size_in_gbs=args.boot_gb),
            create_vnic_details=oci.core.models.CreateVnicDetails(subnet_id=subnet.id, assign_public_ip=True),
            metadata={"ssh_authorized_keys": ssh_key},
        )
        try:
            instance = compute.launch_instance(details).data
        except oci.exceptions.ServiceError as e:
            if e.code == "LimitExceeded":
                sys.exit(f"Limite del gratuito raggiunto: {e.message}")
            if e.status == 401:
                log(f"Giro {attempt}: chiave API non ancora riconosciuta (401).")
            elif e.status == 429:
                log(f"Giro {attempt}: troppe richieste ({ocpus:g} OCPU), aspetto il doppio.")
                time.sleep(every)
            elif "capacity" in (e.message or "").lower():
                log(f"Giro {attempt}: niente posto per {ocpus:g} OCPU/{memory:g} GB.")
            else:
                raise
            time.sleep(every)
            continue
        log(f"Creata! {ocpus:g} OCPU / {memory:g} GB. Aspetto che parta...")
        instance = oci.wait_until(compute, compute.get_instance(instance.id), "lifecycle_state", "RUNNING",
                                  max_wait_seconds=900).data
        vnic_id = compute.list_vnic_attachments(tenancy, instance_id=instance.id).data[0].vnic_id
        ip = network.get_vnic(vnic_id).data.public_ip
        print("", end="")
        log(f"Server pronto. IP pubblico: {ip}")
        log(f"Entra con:  ssh -i {Path(args.ssh_key).with_suffix('')} ubuntu@{ip}")
        return

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Fermato.")
