# 公共函数，由其他脚本通过 ". $PSScriptRoot\common.ps1" 引用。
# 兼容 Windows 自带的 PowerShell 5.1：不使用 ??、三元运算符、&& 等 PowerShell 7 语法。
# 本文件需以 UTF-8 with BOM 保存，否则 PowerShell 5.1 会按 GBK 读取导致中文乱码。

$ErrorActionPreference = 'Stop'

$script:RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script:ServerDir = Join-Path $script:RepoRoot 'server'
$script:WebDir = Join-Path $script:RepoRoot 'web'
$script:EnvFile = Join-Path $script:ServerDir '.env'
$script:TaskName = 'ClassDirectory'
$script:OnWindows = ($env:OS -eq 'Windows_NT')
# npm 在 Windows 上是批处理文件 npm.cmd；直接写 npm 可能解析到 npm.ps1 而受执行策略限制
if ($script:OnWindows) { $script:Npm = 'npm.cmd' } else { $script:Npm = 'npm' }

function Write-Step([string]$Message) {
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) { Write-Host "    $Message" -ForegroundColor Green }

function Write-Note([string]$Message) { Write-Host "    $Message" -ForegroundColor Yellow }

function Stop-WithError([string]$Message) {
  Write-Host ''
  Write-Host "[失败] $Message" -ForegroundColor Red
  exit 1
}

# 在指定目录运行外部程序，退出码非 0 时终止脚本
function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$ArgumentList = @(),
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string]$ErrorMessage
  )
  Push-Location $WorkingDirectory
  try {
    & $FilePath @ArgumentList
    $code = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  if ($code -ne 0) { Stop-WithError "$ErrorMessage（退出码 $code）" }
}

# Node.js 版本需满足 Vite 7 的要求：20.19+ 或 22.12+
function Assert-Node {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Stop-WithError ('未找到 Node.js。请安装 Node.js 22 LTS（https://nodejs.org/zh-cn ，或在终端运行 winget install OpenJS.NodeJS.LTS），' +
      '安装完成后关闭本窗口重新运行。')
  }
  $version = (& node -v).Trim().TrimStart('v')
  $parts = $version.Split('.')
  $major = [int]$parts[0]
  $minor = [int]$parts[1]
  $ok = ($major -eq 20 -and $minor -ge 19) -or ($major -eq 22 -and $minor -ge 12) -or ($major -ge 23)
  if (-not $ok) { Stop-WithError "Node.js 版本过低（当前 v$version），需要 20.19 以上或 22.12 以上，建议安装 22 LTS。" }
  Write-Ok "Node.js v$version"
}

function Test-TcpPort([string]$HostName, [int]$Port, [int]$TimeoutMs = 2000) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $task = $client.ConnectAsync($HostName, $Port)
    return ($task.Wait($TimeoutMs) -and $client.Connected)
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

# 读取 .env 为哈希表（只处理本项目用到的 KEY=VALUE 写法，去掉两端引号）
function Read-DotEnv([string]$Path) {
  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $map }
  foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
    $text = $line.Trim()
    if ($text -eq '' -or $text.StartsWith('#')) { continue }
    $index = $text.IndexOf('=')
    if ($index -lt 1) { continue }
    $key = $text.Substring(0, $index).Trim()
    $value = $text.Substring($index + 1).Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $map[$key] = $value
  }
  return $map
}

# 写入 UTF-8（无 BOM）文本；带 BOM 会让 .env 的第一行无法被识别
function Write-Utf8File([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

# 生成随机字符串（去掉易混淆的 0/O、1/l/I）
function New-RandomString([int]$Length = 32) {
  $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  $bytes = New-Object byte[] $Length
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $result = ''
  foreach ($b in $bytes) { $result += $chars[$b % $chars.Length] }
  return $result
}

# 生成满足系统密码规则（同时包含字母和数字）的随机密码
function New-RandomPassword([int]$Length = 10) {
  do { $pw = New-RandomString $Length } until ($pw -cmatch '[A-Za-z]' -and $pw -match '\d')
  return $pw
}

function ConvertTo-PlainText([System.Security.SecureString]$Secure) {
  return (New-Object System.Net.NetworkCredential('', $Secure)).Password
}

# 是/否提问，直接回车取默认值
function Read-YesNo([string]$Question, [bool]$Default) {
  if ($Default) { $hint = '[Y/n]' } else { $hint = '[y/N]' }
  $answer = (Read-Host "$Question $hint").Trim().ToLower()
  if ($answer -eq '') { return $Default }
  return ($answer -eq 'y' -or $answer -eq 'yes')
}

function Test-IsAdmin {
  if (-not $script:OnWindows) { return $false }
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-AppPort {
  $envMap = Read-DotEnv $script:EnvFile
  if ($envMap.ContainsKey('PORT') -and $envMap['PORT'] -match '^\d+$') { return [int]$envMap['PORT'] }
  return 3000
}

# 本机局域网 IPv4 地址，供同学用手机或其他电脑访问
function Get-LanAddresses {
  $addresses = @()
  foreach ($ip in [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName())) {
    $text = $ip.ToString()
    if ($ip.AddressFamily -eq 'InterNetwork' -and -not $text.StartsWith('127.') -and -not $text.StartsWith('169.254.')) {
      $addresses += $text
    }
  }
  return $addresses
}

function Wait-ForKey {
  # 双击运行时窗口会在脚本结束后关闭，这里停一下方便查看输出
  if ($script:OnWindows -and [Environment]::UserInteractive) {
    Write-Host ''
    Read-Host '按回车键关闭窗口' | Out-Null
  }
}
