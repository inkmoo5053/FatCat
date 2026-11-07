@echo off
title DaFeiYu QQ Bot Restarter
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\restart_all.ps1"

if errorlevel 1 (
    pause
) else (
    ping -n 4 127.0.0.1 >nul
)
