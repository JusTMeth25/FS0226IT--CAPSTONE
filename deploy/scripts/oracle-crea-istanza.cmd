@echo off
rem Riprova a creare il server Oracle gratuito finche' non c'e' posto (vedi deploy\README.md).
rem SDK Oracle installato in %USERPROFILE%\.oci-cli (python -m venv + pip install oci).
"%USERPROFILE%\.oci-cli\Scripts\python.exe" "%~dp0oracle_crea_istanza.py" %*
pause
