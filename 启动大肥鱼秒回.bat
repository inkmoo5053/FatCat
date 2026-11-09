@echo off
chcp 65001 >nul
title DaFeiYu QQ Bot Daemon
cd /d "%~dp0"
echo ======================================================
echo    DaFeiYu QQ Bot Daemon (Antigravity Internal Quota)
echo ======================================================
node .\scripts\dafeiyu_daemon.mjs
pause
