Param(
    [string]$Endpoint = "http://127.0.0.1:3000",
    [string]$Token = "2KLZUoF6jBpV0OkMEu44wPMSogEX4I0cWqRm8p2Z5LY"
)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   FatCat OneBot Connectivity Test       " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Requesting: $Endpoint/get_login_info ..." -ForegroundColor Gray

$headers = @{}
if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
}

try {
    $res = Invoke-RestMethod -Uri "$Endpoint/get_login_info" -Method Post -Headers $headers -ContentType "application/json" -TimeoutSec 3
    Write-Host "`n[SUCCESS] Connected to OneBot Service!" -ForegroundColor Green
    Write-Host "Logged-in Bot Info:" -ForegroundColor Yellow
    $res | ConvertTo-Json -Depth 4 | Write-Host
} catch {
    Write-Host "`n[OFFLINE] Cannot connect to OneBot ($Endpoint)" -ForegroundColor DarkYellow
    Write-Host "Notice: SnowLuma is not currently running." -ForegroundColor Gray
    Write-Host "You can launch SnowLuma and NTQQ by double-clicking: 一键重启大肥鱼.bat" -ForegroundColor Gray
}
