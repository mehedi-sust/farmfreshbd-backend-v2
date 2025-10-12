@echo off
echo ========================================
echo Restarting FarmFresh BD Backend
echo ========================================
echo.
echo This will restart the backend server with the new changes
echo.
cd /d "%~dp0"
echo Starting server...
npm start
