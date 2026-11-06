# DaFeiYu QQ Agent Service Restarter
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
    if ($cmd -and ($cmd.Contains("snowluma") -or $cmd.Contains("dafeiyu_daemon"))) {
        try {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "  -> Killed process (PID: $($_.ProcessId))" -ForegroundColor Gray
            $killedCount++
        } catch {}
    }
}
Start-Sleep -Seconds 1
Write-Host "  -> Cleared $killedCount stale process(es)." -ForegroundColor Green

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
    if (Test-Path "$ProxyDir\start_silent.vbs") {
        Start-Process "wscript.exe" -ArgumentList "`"$ProxyDir\start_silent.vbs`"" -WorkingDirectory $ProxyDir
    } elseif (Test-Path "$ProxyDir\沉浸式翻译Gemini网桥.exe") {
        Start-Process "$ProxyDir\沉浸式翻译Gemini网桥.exe" -WorkingDirectory $ProxyDir
    }
    Start-Sleep -Seconds 2
    Write-Host "  -> Gemini Proxy launch command issued." -ForegroundColor Green
}

# Step 3: Start SnowLuma Protocol Layer
Write-Host "`n[3/4] Launching SnowLuma NTQQ Hook runtime..." -ForegroundColor Yellow
$snowNode = Join-Path $SnowLumaDir "node.exe"
if (-not (Test-Path $snowNode)) {
    $snowNode = "node.exe"
}

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $snowNode
$psi.Arguments = ".\index.mjs"
$psi.WorkingDirectory = $SnowLumaDir
$psi.EnvironmentVariables["SNOWLUMA_ACCEPT_EULA"] = "1"
$psi.EnvironmentVariables["SNOWLUMA_ACCEPT_PRIVACY"] = "1"
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($psi)
Write-Host "  -> SnowLuma started in background (PID: $($proc.Id))" -ForegroundColor Green

# Wait for OneBot HTTP ready
Write-Host "  -> Waiting for QQ Hook attachment and OneBot HTTP API..." -ForegroundColor Gray
$loginOk = $false
$headers = @{ "Authorization" = "Bearer $OneBotToken" }

for ($i = 1; $i -le 15; $i++) {
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
    Write-Host "     Connecting to OneBot ($i/15s)..." -ForegroundColor Gray
}

if (-not $loginOk) {
    Write-Host "  -> [Notice] SnowLuma is running. If QQ is not logged in, please confirm login on QQ client." -ForegroundColor Yellow
}

# Step 4: Start Auto-Reply Daemon
Write-Host "`n[4/4] Starting Gemini Catgirl Auto-Reply Daemon..." -ForegroundColor Yellow

$daemonPsi = New-Object System.Diagnostics.ProcessStartInfo
$daemonPsi.FileName = "cmd.exe"
$daemonPsi.Arguments = "/c node `"$DaemonScript`""
$daemonPsi.WorkingDirectory = $WorkspaceRoot
$daemonPsi.UseShellExecute = $true
$daemonPsi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Normal

[System.Diagnostics.Process]::Start($daemonPsi) | Out-Null
Write-Host "  -> Auto-Reply Daemon launched in a separate window!" -ForegroundColor Green

Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host "   Restart Complete! All DaFeiYu services restored!   " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
