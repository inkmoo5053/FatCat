# ==============================================================================
# ★ 大肥鱼 (DaFeiYu) QQ 智能体一键全自动重启恢复脚本 ★
# ==============================================================================
$ErrorActionPreference = "Continue"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   Starting DaFeiYu QQ Agent Service Restart...       " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkspaceRoot = (Get-Item $ScriptDir).Parent.FullName
$SnowLumaDir = Join-Path $WorkspaceRoot "snowluma"
$DaemonScript = Join-Path $WorkspaceRoot "scripts\dafeiyu_daemon.mjs"
$ProxyDir = "C:\Users\fyy26\.gemini\gemini_proxy"
$OneBotToken = "2KLZUoF6jBpV0OkMEu44wPMSogEX4I0cWqRm8p2Z5LY"

# Step 1: Kill stale node processes
Write-Host "`n[1/4] Stopping stale SnowLuma and Daemon node processes..." -ForegroundColor Yellow
$killedCount = 0
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | ForEach-Object {
    $cmd = $_.CommandLine
    if ($cmd -and ($cmd.Contains("snowluma") -or $cmd.Contains("dafeiyu_daemon") -or $cmd.Contains("index.mjs"))) {
        try {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "  -> Stopped stale process (PID: $($_.ProcessId))" -ForegroundColor Gray
            $killedCount++
        } catch {}
    }
}
Start-Sleep -Milliseconds 800
Write-Host "  -> Done! Cleared $killedCount stale process(es)." -ForegroundColor Green

# Step 2: Check Gemini Proxy (Port 49281)
Write-Host "`n[2/4] Checking Gemini Proxy (127.0.0.1:49281)..." -ForegroundColor Yellow
$proxyAlive = $false
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:49281/v1beta/models" -TimeoutSec 3 -ErrorAction Stop
    $proxyAlive = $true
} catch {
    $conn = Get-NetTCPConnection -LocalPort 49281 -State Listen -ErrorAction SilentlyContinue
    if ($conn) { $proxyAlive = $true }
}

if ($proxyAlive) {
    Write-Host "  -> Gemini Proxy is ACTIVE and ready!" -ForegroundColor Green
} else {
    Write-Host "  -> Starting Gemini Proxy..." -ForegroundColor Yellow
    if (Test-Path "$ProxyDir\沉浸式翻译Gemini网桥.exe") {
        Start-Process "$ProxyDir\沉浸式翻译Gemini网桥.exe" -WorkingDirectory $ProxyDir
    } elseif (Test-Path "$ProxyDir\启动网桥.bat") {
        Start-Process "cmd.exe" -ArgumentList "/c `"$ProxyDir\启动网桥.bat`"" -WorkingDirectory $ProxyDir -WindowStyle Hidden
    } elseif (Test-Path "$ProxyDir\start_silent.vbs") {
        Start-Process "wscript.exe" -ArgumentList "`"$ProxyDir\start_silent.vbs`"" -WorkingDirectory $ProxyDir
    }
    Start-Sleep -Seconds 2
    Write-Host "  -> Gemini Proxy launch command issued." -ForegroundColor Green
}

# Step 3: Check QQ NT Process & Launch SnowLuma
Write-Host "`n[3/4] Launching SnowLuma NTQQ Hook runtime..." -ForegroundColor Yellow

# Check if QQ is running
$qqProc = Get-Process -Name "*qq*" -ErrorAction SilentlyContinue
if (-not $qqProc) {
    Write-Host "  -> [Notice] QQ process not detected yet." -ForegroundColor DarkYellow
    Write-Host "     Please make sure to open and log in to QQ so SnowLuma can hook." -ForegroundColor DarkYellow
} else {
    Write-Host "  -> QQ process is running (PID: $($qqProc[0].Id))" -ForegroundColor Green
}

$snowNode = Join-Path $SnowLumaDir "node.exe"
if (-not (Test-Path $snowNode)) {
    $snowNode = "node.exe"
}

# Inject environment variables into calling process so child inherits
$env:SNOWLUMA_ACCEPT_EULA = "1"
$env:SNOWLUMA_ACCEPT_PRIVACY = "1"

# Launch SnowLuma decoupled as independent process
$snowIndex = Join-Path $SnowLumaDir "index.mjs"
$snowCmd = "/k set SNOWLUMA_ACCEPT_EULA=1 & set SNOWLUMA_ACCEPT_PRIVACY=1 & chcp 65001 >nul & title SnowLuma OneBot NTQQ & `"$snowNode`" `"$snowIndex`""
$snowProc = Start-Process -FilePath "cmd.exe" -ArgumentList $snowCmd -WorkingDirectory $SnowLumaDir -WindowStyle Minimized -PassThru
Write-Host "  -> SnowLuma started in independent window (PID: $($snowProc.Id))" -ForegroundColor Green

# Wait for OneBot HTTP ready
Write-Host "  -> Waiting for QQ Hook attachment and OneBot HTTP API..." -ForegroundColor Gray
$loginOk = $false
$headers = @{ "Authorization" = "Bearer $OneBotToken" }

for ($i = 1; $i -le 10; $i++) {
    Start-Sleep -Seconds 1
    try {
        $loginRes = Invoke-RestMethod -Uri "http://127.0.0.1:3000/get_login_info" -Headers $headers -TimeoutSec 2 -ErrorAction Stop
        if ($loginRes.status -eq "ok" -and $loginRes.data.user_id) {
            $loginOk = $true
            $uin = $loginRes.data.user_id
            $nick = $loginRes.data.nickname
            Write-Host "  -> [SUCCESS] QQ Logged in: $nick ($uin)" -ForegroundColor Green
            break
        }
    } catch {}
    Write-Host "     Waiting for OneBot API ($i/10s)..." -ForegroundColor Gray
}

if (-not $loginOk) {
    Write-Host "  -> [Standby] SnowLuma is running in background." -ForegroundColor Yellow
    Write-Host "     If QQ is not yet logged in, once you log in, it will connect automatically." -ForegroundColor Yellow
}

# Step 4: Start Auto-Reply Daemon in an independent keep-open console
Write-Host "`n[4/4] Starting Gemini Catgirl Auto-Reply Daemon..." -ForegroundColor Yellow

$daemonArgs = "/k chcp 65001 >nul & title DaFeiYu QQ Bot Daemon & node `"$DaemonScript`""
Start-Process -FilePath "cmd.exe" -ArgumentList $daemonArgs -WorkingDirectory $WorkspaceRoot

Write-Host "  -> Auto-Reply Daemon console opened in a separate window!" -ForegroundColor Green

Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host "   Restart Complete! All DaFeiYu services restored!   " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
