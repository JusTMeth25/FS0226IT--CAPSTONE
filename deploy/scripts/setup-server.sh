#!/usr/bin/env bash
# Prepara un server Ubuntu nuovo (Oracle Cloud Always Free) per VinylDex: Docker, porte 80 e 443,
# swap, aggiornamenti di sicurezza automatici e backup notturno del database.
# Si lancia una volta sola, dalla cartella del progetto:  sudo bash deploy/scripts/setup-server.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Lancialo con sudo." >&2
  exit 1
fi
APP_USER="${SUDO_USER:-ubuntu}"
PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

echo "== Pacchetti e aggiornamenti automatici"
apt-get update -y
apt-get install -y ca-certificates curl git unattended-upgrades iptables-persistent
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker "$APP_USER"
systemctl enable --now docker

echo "== Porte 80 e 443"
# Le immagini Ubuntu di Oracle hanno regole iptables che bloccano tutto tranne SSH: si aprono
# 80 (http, serve anche a Let's Encrypt) e 443 (https), prima della regola che rifiuta il resto.
for port in 80 443; do
  iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null \
    || iptables -I INPUT 5 -p tcp --dport "$port" -m state --state NEW -j ACCEPT
done
iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT 5 -p udp --dport 443 -j ACCEPT
netfilter-persistent save

echo "== Swap da 4 GB"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== Backup notturno del database (alle 3:30, si tengono gli ultimi 14)"
mkdir -p "$PROJECT_DIR/deploy/backups"
chown "$APP_USER":"$APP_USER" "$PROJECT_DIR/deploy/backups"
CRON_LINE="30 3 * * * cd $PROJECT_DIR && bash deploy/scripts/backup.sh >> deploy/backups/backup.log 2>&1"
( crontab -u "$APP_USER" -l 2>/dev/null | grep -v 'deploy/scripts/backup.sh' ; echo "$CRON_LINE" ) | crontab -u "$APP_USER" -

echo
echo "Fatto. Esci e rientra via SSH (per il gruppo docker), poi:"
echo "  cd $PROJECT_DIR/deploy && cp .env.example .env && nano .env"
echo "  docker compose up -d --build"
