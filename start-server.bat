@echo off
echo Starting CampusIQ Development Server...
echo.
cd /d "%~dp0"
set PATH=%PATH%;C:\Program Files\nodejs
npm run dev
pause
