@echo off
setlocal
chcp 65001 >nul
title VinylDex - avvio

rem ===========================================================================
rem  Avvia backend e frontend in due finestre separate.
rem
rem  Backend  Spring Boot  http://localhost:4000
rem  Frontend Vite         http://localhost:5173
rem
rem  Chiudere una finestra ferma il servizio corrispondente.
rem  Le finestre usano "cmd /k" cosi' restano aperte anche in caso di errore
rem  e il log resta leggibile.
rem ===========================================================================

set "RADICE=%~dp0"
set "MVNW=%RADICE%BE\mvnw.cmd"

echo.
echo   VinylDex
echo   ========
echo.

rem --- Controlli preliminari ------------------------------------------------

where java >nul 2>&1
if errorlevel 1 (
    echo   [ERRORE] Java non trovato nel PATH. Serve il JDK 25.
    echo.
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo   [ERRORE] Node.js non trovato nel PATH. Serve Node 18 o superiore.
    echo.
    pause
    exit /b 1
)

if not exist "%MVNW%" (
    echo   [ERRORE] Manca BE\mvnw.cmd. Lanciare questo file dalla cartella del progetto.
    echo.
    pause
    exit /b 1
)

if not exist "%RADICE%BE\.env" (
    echo   [ERRORE] Manca BE\.env con le credenziali del database.
    echo            Copiare BE\.env.example in BE\.env e compilare
    echo            DB_PASSWORD e JWT_SECRET.
    echo.
    pause
    exit /b 1
)

rem Alla prima esecuzione le dipendenze del frontend non ci sono ancora.
if not exist "%RADICE%frontend\node_modules" (
    echo   Prima esecuzione: installo le dipendenze del frontend...
    echo.
    pushd "%RADICE%frontend"
    call npm.cmd install
    popd
    echo.
)

rem --- Backend --------------------------------------------------------------

rem Il percorso di mvnw.cmd e' esplicito e non relativo: se la variabile di sistema
rem NoDefaultCurrentDirectoryInExePath vale 1, cmd non cerca gli eseguibili nella
rem cartella corrente e il nome nudo "mvnw.cmd" non verrebbe trovato.
echo   Avvio backend su http://localhost:4000 ...
start "VinylDex backend :4000" /D "%RADICE%BE" cmd /k ""%MVNW%" spring-boot:run"

rem Il browser va aperto solo quando il backend risponde, altrimenti la prima
rem schermata si carica con tutte le chiamate in errore.
echo   Attendo che il backend risponda (di norma 10-20 secondi)...
set /a tentativi=0

:attesa
curl -s -o NUL --max-time 2 http://localhost:4000/health
if not errorlevel 1 goto pronto
set /a tentativi+=1
if %tentativi% geq 90 goto scaduto
rem ping al posto di timeout: timeout fallisce se stdin e' rediretto.
ping -n 3 127.0.0.1 >nul
goto attesa

:scaduto
echo.
echo   [ATTENZIONE] Il backend non risponde dopo 3 minuti.
echo                Controllare la finestra "VinylDex backend :4000".
echo                Avvio comunque il frontend.
echo.
goto frontend

:pronto
echo   Backend pronto.
echo.

rem --- Frontend -------------------------------------------------------------

:frontend
echo   Avvio frontend su http://localhost:5173 ...
start "VinylDex frontend :5173" /D "%RADICE%frontend" cmd /k npm.cmd run dev

echo   Attendo che Vite sia in ascolto...
set /a tentativi=0

:attesafe
curl -s -o NUL --max-time 2 http://localhost:5173/
if not errorlevel 1 goto aprire
set /a tentativi+=1
if %tentativi% geq 30 goto aprire
ping -n 3 127.0.0.1 >nul
goto attesafe

:aprire
start "" http://localhost:5173

echo.
echo   Fatto. Due finestre aperte:
echo     - VinylDex backend :4000
echo     - VinylDex frontend :5173
echo.
echo   Per fermare tutto, chiudere le due finestre.
echo.
ping -n 6 127.0.0.1 >nul
endlocal
