# Esporta il database locale (PostgreSQL su Windows) in deploy\backups\locale.dump, da copiare sul
# server e caricare con restore.sh. Dalla cartella del progetto:
#   powershell -ExecutionPolicy Bypass -File deploy\scripts\export-local-db.ps1
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$envFile = Join-Path $root 'BE\.env'
$line = Get-Content $envFile | Where-Object { $_ -match '^DB_PASSWORD=' } | Select-Object -First 1
if (-not $line) { throw "DB_PASSWORD non trovata in BE\.env" }
$env:PGPASSWORD = $line.Substring('DB_PASSWORD='.Length)

$pgDump = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe' | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $pgDump) { throw "pg_dump non trovato in C:\Program Files\PostgreSQL" }

$outDir = Join-Path $root 'deploy\backups'
New-Item -ItemType Directory -Force $outDir | Out-Null
$out = Join-Path $outDir 'locale.dump'
& $pgDump.FullName -h localhost -U postgres -d 'FS0226IT-CAPSTONE' -Fc -f $out
Remove-Item Env:\PGPASSWORD
"Creato $out ($([math]::Round((Get-Item $out).Length / 1MB, 1)) MB)"
"Copialo sul server:  scp -i <chiave> `"$out`" ubuntu@<IP>:~/vinyldex/deploy/backups/"
