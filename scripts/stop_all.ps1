# DaFeiYu QQ Agent Service Stopper
$ErrorActionPreference = "Continue"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   Stopping DaFeiYu QQ Agent Services...              " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# Step 1: Kill daemon and snowluma node processes
Write-Host "`n[1/3] Stopping SnowLuma and Auto-Reply Daemon processes..." -ForegroundColor Yellow
$killedCount = 0
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | ForEach-Object {
    $cmd = $_.CommandLine
    if ($cmd -and ($cmd.Contains("snowluma") -or $cmd.Contains("dafeiyu_daemon") -or $cmd.Contains("index.mjs"))) {
        try {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "  -> Stopped process (PID: $($_.ProcessId))" -ForegroundColor Gray
            $killedCount++
        } catch {}
    }
}
Start-Sleep -Milliseconds 600
Write-Host "  -> Cleared $killedCount active service process(es)." -ForegroundColor Green

# Step 2: Close console windows by title if still lingering
Write-Host "`n[2/3] Closing associated console windows..." -ForegroundColor Yellow
try {
    taskkill /F /FI "WINDOWTITLE eq *大肥鱼*" 2>$null | Out-Null
    taskkill /F /FI "WINDOWTITLE eq *DaFeiYu*" 2>$null | Out-Null
    taskkill /F /FI "WINDOWTITLE eq *SnowLuma*" 2>$null | Out-Null
} catch {}
Write-Host "  -> Console windows closed." -ForegroundColor Green

# Step 3: Stop Gemini Proxy if running
Write-Host "`n[3/3] Stopping Gemini Proxy processes..." -ForegroundColor Yellow
$proxyKilled = 0
Get-CimInstance Win32_Process | Where-Object { $_.Name -like '*沉浸式*' -or $_.CommandLine -like '*gemini_proxy*' } | ForEach-Object {
    try {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "  -> Stopped Proxy process (PID: $($_.ProcessId))" -ForegroundColor Gray
        $proxyKilled++
    } catch {}
}
Write-Host "  -> Cleared $proxyKilled proxy process(es)." -ForegroundColor Green

Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host "   All DaFeiYu QQ Agent services stopped safely!      " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
