@echo off
title DéliNote - Build installer
cd /d "%~dp0"

echo ================================
echo  Construction de l'installer Windows...
echo ================================
echo.

if not exist "node_modules\" (
    echo Installation des dependances...
    call npm install --no-audit --no-fund
)

call npm run dist

echo.
if errorlevel 1 (
    echo ECHEC de la construction.
) else (
    echo.
    echo OK ! L'installer est dans le dossier "dist\".
    explorer dist
)
pause
