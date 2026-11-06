Param(
    [string]$Endpoint = "http://127.0.0.1:3000",
    [string]$Token = ""
)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   大肥鱼 OneBot 连通性测试脚本" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "正在请求: $Endpoint/get_login_info ..." -ForegroundColor Gray

$headers = @{}
if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
}

try {
    $res = Invoke-RestMethod -Uri "$Endpoint/get_login_info" -Method Post -Headers $headers -ContentType "application/json" -TimeoutSec 5
    Write-Host "`n[成功] 已成功连接到 OneBot 服务！" -ForegroundColor Green
    Write-Host "当前登录机器人账号信息：" -ForegroundColor Yellow
    $res | ConvertTo-Json -Depth 4 | Write-Host
} catch {
    Write-Host "`n[失败] 无法连通 OneBot 接口 ($Endpoint)" -ForegroundColor Red
    Write-Host "可能原因：" -ForegroundColor Yellow
    Write-Host "1. SnowLuma 尚未启动（请进入 snowluma 文件夹双击 launcher.bat）"
    Write-Host "2. WebUI (http://127.0.0.1:5099) 中的 OneBot HTTP 端口配置与脚本不一致（默认 3000）"
    Write-Host "3. 尚未在 WebUI 中扫码登录 QQ 账号"
}
