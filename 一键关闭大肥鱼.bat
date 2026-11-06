@echo off
chcp 65001 >nul
title 大肥鱼 QQ 智能体一键关闭
color 0c

echo ======================================================
echo    ★ 正在一键停止大肥鱼 (基米喵) QQ 智能体生态 ★
echo ======================================================
echo.

cd /d "%~dp0"

echo [1/2] 正在关闭秒回控制台窗口...
taskkill /F /FI "WINDOWTITLE eq *大肥鱼*" >nul 2>nul
echo       已关闭秒回控制台。
echo.

echo [2/2] 正在精准停止关联的 SnowLuma 底座与守护进程...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -and ($_.CommandLine.Contains('snowluma') -or $_.CommandLine.Contains('dafeiyu_daemon')) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
timeout /t 1 >nul
echo       所有后台协议服务已安全退出。
echo.

echo ======================================================
echo    ★ 停止成功！大肥鱼所有服务已全部安全退出 ★
echo ======================================================
echo.
timeout /t 3
