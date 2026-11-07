@echo off
title DaFeiYu QQ Bot Stopper
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop_all.ps1"

if errorlevel 1 (
    pause
) else (
    ping -n 3 127.0.0.1 >nul
)
