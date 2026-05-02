@echo off
title DéliNote
cd /d "%~dp0"

echo ================================
echo  Lancement de DéliNote...
echo ================================
echo.

if not exist "node_modules\" (
    echo Installation des dependances ^(une seule fois^)...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo ECHEC de l'installation. Verifie que Node.js est installe.
        pause
        exit /b 1
    )
)

call npm run dev

echo.
echo DéliNote s'est ferme.
pause
