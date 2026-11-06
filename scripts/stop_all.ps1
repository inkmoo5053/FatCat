# DaFeiYu QQ Agent Service Stopper
$ErrorActionPreference = "Continue"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   Stopping DaFeiYu QQ Agent Services...              " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# Step 1: Kill daemon and snowluma node processes
Write-Host "`n[1/2] Stopping SnowLuma and Auto-Reply Daemon processes..." -ForegroundColor Yellow
$killedCount = 0
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | ForEach-Object {
    $cmd = $_.CommandLine
    if ($cmd -and ($cmd.Contains("snowluma") -or $cmd.Contains("dafeiyu_daemon"))) {
        try {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "  -> Stopped process (PID: $($_.ProcessId))" -ForegroundColor Gray
            $killedCount++
        } catch {}
    }
}
Start-Sleep -Seconds 1
Write-Host "  -> Cleared $killedCount active service process(es)." -ForegroundColor Green

# Step 2: Close console windows by title if still lingering
Write-Host "`n[2/2] Closing associated console windows..." -ForegroundColor Yellow
try {
    taskkill /F /FI "WINDOWTITLE eq *大肥鱼*" 2>$null | Out-Null
    taskkill /F /FI "WINDOWTITLE eq *SnowLuma*" 2>$null | Out-Null
} catch {}
Write-Host "  -> Console windows closed." -ForegroundColor Green

Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host "   All DaFeiYu QQ Agent services stopped safely!      " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
