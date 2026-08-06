# Game Timer 一键启动脚本
#   .\start.ps1              生产模式，单端口 http://localhost:3001，自动开浏览器
#   .\start.ps1 -NoBrowser   不自动开浏览器
#   .\start.ps1 -Dev         开发模式，前端 5173 + 后端 3001，改代码热更新
#   .\start.ps1 -Port 4000   换端口

param(
    [switch]$Dev,
    [switch]$NoBrowser,
    [int]$Port = 3001
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $Root

# ---- 定位 Node ----
$NodeExe = $null
$Candidates = @(
    'C:\Users\Lenovo\.workbuddy\binaries\node\versions\22.22.2\node.exe'
)
foreach ($c in $Candidates) {
    if (Test-Path $c) { $NodeExe = $c; break }
}
if (-not $NodeExe) {
    $sys = Get-Command node -ErrorAction SilentlyContinue
    if ($sys) { $NodeExe = $sys.Source }
}
if (-not $NodeExe) {
    Write-Host ''
    Write-Host '[错误] 找不到 Node.js。' -ForegroundColor Red
    Write-Host '       请到 https://nodejs.org 安装 Node 18 或更高版本后重试。'
    Write-Host ''
    exit 1
}

$NodeDir = Split-Path -Parent $NodeExe
$NpmCli  = Join-Path $NodeDir 'node_modules\npm\bin\npm-cli.js'
$env:PATH = "$NodeDir;$Root\node_modules\.bin;$env:PATH"

Write-Host ''
Write-Host "Node: $NodeExe" -ForegroundColor DarkGray

function Invoke-Npm {
    param([string[]]$NpmArgs)
    & $NodeExe $NpmCli @NpmArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[错误] npm $($NpmArgs -join ' ') 执行失败" -ForegroundColor Red
        exit 1
    }
}

# ---- 依赖 ----
if (-not (Test-Path (Join-Path $Root 'node_modules\tsx\dist\cli.mjs'))) {
    Write-Host '[准备] 首次运行，正在安装依赖（可能需要几分钟）...' -ForegroundColor Yellow
    Invoke-Npm @('install')
}

$TsxCli = Join-Path $Root 'node_modules\tsx\dist\cli.mjs'

if ($Dev) {
    # ---------- 开发模式 ----------
    Write-Host ''
    Write-Host '==========================================' -ForegroundColor Cyan
    Write-Host '  开发模式' -ForegroundColor Cyan
    Write-Host '  前端  http://localhost:5173' -ForegroundColor Cyan
    Write-Host "  后端  http://localhost:$Port" -ForegroundColor Cyan
    Write-Host '  Ctrl+C 停止' -ForegroundColor Cyan
    Write-Host '==========================================' -ForegroundColor Cyan
    Write-Host ''
    $env:PORT = "$Port"
    Invoke-Npm @('run', 'dev')
    exit 0
}

# ---------- 生产模式（单端口） ----------
if (-not (Test-Path (Join-Path $Root 'dist\index.html'))) {
    Write-Host '[准备] 正在构建前端...' -ForegroundColor Yellow
    Invoke-Npm @('run', 'build')
}

$env:NODE_ENV = 'production'
$env:PORT = "$Port"
$Url = "http://localhost:$Port"

Write-Host ''
Write-Host '==========================================' -ForegroundColor Green
Write-Host '  五游活动倒计时台' -ForegroundColor Green
Write-Host "  $Url" -ForegroundColor Green
Write-Host '  Ctrl+C 停止' -ForegroundColor Green
Write-Host '==========================================' -ForegroundColor Green
Write-Host ''

if (-not $NoBrowser) {
    $job = Start-Job -ScriptBlock {
        param($u)
        Start-Sleep -Seconds 4
        try {
            $r = Invoke-WebRequest -Uri $u -TimeoutSec 5 -UseBasicParsing
            if ($r.StatusCode -eq 200) { Start-Process $u }
        } catch {
            Start-Sleep -Seconds 4
            Start-Process $u
        }
    } -ArgumentList $Url
    $null = $job
}

& $NodeExe $TsxCli (Join-Path $Root 'server\index.ts')

Write-Host ''
Write-Host '服务已停止。' -ForegroundColor DarkGray
