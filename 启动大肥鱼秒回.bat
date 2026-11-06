@echo off
title 大肥鱼 QQ 全自动秒回守护进程
cd /d "%~dp0"
echo 正在启动大肥鱼自动秒回守护进程...
node .\scripts\dafeiyu_daemon.mjs
pause
