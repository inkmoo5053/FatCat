@echo off
chcp 65001 >nul
title 大肥鱼 QQ 智能体一键重启修复
color 0b

echo ======================================================
echo    ★ 正在一键重启大肥鱼 (基米喵) QQ 智能体生态 ★
echo ======================================================
echo.

cd /d "%~dp0"

echo [1/4] 正在清理旧的 SnowLuma 与守护进程...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -and ($_.CommandLine.Contains('snowluma') -or $_.CommandLine.Contains('dafeiyu_daemon')) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
timeout /t 1 >nul
echo       已完成旧残留进程清理。
echo.

echo [2/4] 正在检测 Gemini 模型反代服务 (49281)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $c = Get-NetTCPConnection -LocalPort 49281 -State Listen -ErrorAction Stop; Write-Host '      Gemini 代理服务在线正常！' -ForegroundColor Green } catch { Start-Process 'C:\Users\fyy26\.gemini\gemini_proxy\start_silent.vbs'; Write-Host '      已拉起 Gemini 代理服务。' -ForegroundColor Yellow }"
echo.

echo [3/4] 正在启动 SnowLuma 底座协议服务并重新挂载 Hook...
set "SNOWLUMA_ACCEPT_EULA=1"
set "SNOWLUMA_ACCEPT_PRIVACY=1"
cd /d "%~dp0snowluma"
start "SnowLuma QQ底座" /min "%~dp0snowluma\node.exe" index.mjs
cd /d "%~dp0"

echo       正在等待 QQ 账号登录识别与 OneBot 接口就绪...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$h = @{ 'Authorization' = 'Bearer 2KLZUoF6jBpV0OkMEu44wPMSogEX4I0cWqRm8p2Z5LY' }; for ($i=1; $i -le 15; $i++) { Start-Sleep -Seconds 1; try { $res = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/get_login_info' -Headers $h -TimeoutSec 2 -ErrorAction Stop; if ($res.status -eq 'ok' -and $res.data.user_id) { Write-Host ('      [成功] QQ 账号挂载就绪: ' + $res.data.nickname + ' (' + $res.data.user_id + ')') -ForegroundColor Green; break } } catch {} Write-Host ('      等待 OneBot 就绪 (' + $i + '/15s)...') -ForegroundColor Gray }"
echo.

echo [4/4] 正在启动大肥鱼 (基米喵) 秒回守护进程...
start "大肥鱼 QQ 全自动秒回守护进程" cmd /k "chcp 65001 >nul && title 大肥鱼 QQ 全自动秒回守护进程 && node scripts\dafeiyu_daemon.mjs"

echo.
echo ======================================================
echo    ★ 重启成功！秒回守护窗口已单独打开，请保持其运行 ★
echo ======================================================
echo.
timeout /t 5
