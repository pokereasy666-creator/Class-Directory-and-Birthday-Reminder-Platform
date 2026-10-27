<#
.SYNOPSIS
  管理后台服务：开机自动运行、无需保持窗口打开。

.DESCRIPTION
  使用 Windows 自带的「任务计划程序」以 SYSTEM 身份运行平台（不需要额外安装 NSSM、pm2 等工具）：
    - 开机 30 秒后自动启动（等待 MySQL 先启动）
    - 进程异常退出时每分钟自动重试
    - 日志写入 server\logs\server.log
  需要管理员权限，非管理员运行时会自动请求提升。不带参数运行时显示菜单。

.EXAMPLE
  .\service.ps1 install
  .\service.ps1 status
#>
param(
  [ValidateSet('', 'install', 'start', 'stop', 'restart', 'status', 'logs', 'uninstall')]
  [string]$Action = '',
  [switch]$Elevated
)

. (Join-Path $PSScriptRoot 'common.ps1')

$FirewallRuleName = 'ClassDirectory'

if (-not $OnWindows) { Stop-WithError '此脚本只能在 Windows 上运行。' }

if (-not (Test-IsAdmin)) {
  Write-Host '需要管理员权限，正在请求提升（请在弹出的窗口中点击「是」）……'
  $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"'))
  if ($Action) { $argList += $Action }
  $argList += '-Elevated'
  try {
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $argList
    Write-Host '已在新的管理员窗口中继续，本窗口可以关闭。'
  } catch {
    Stop-WithError '未获得管理员权限，操作已取消。'
  }
  exit 0
}

function Get-AppTask { return Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue }

function Wait-Port([int]$Port, [bool]$Open, [int]$Seconds) {
  for ($i = 0; $i -lt $Seconds; $i++) {
    if ((Test-TcpPort '127.0.0.1' $Port 500) -eq $Open) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

function Install-AppService {
  if (-not (Test-Path -LiteralPath (Join-Path $ServerDir 'dist/main.js')) -or
      -not (Test-Path -LiteralPath (Join-Path $WebDir 'dist/index.html'))) {
    Stop-WithError '尚未部署，请先运行 setup.bat。'
  }
  $port = Get-AppPort
  if (-not (Get-AppTask) -and (Test-TcpPort '127.0.0.1' $port)) {
    Stop-WithError "端口 $port 已被占用，请先关闭 start.bat 窗口或其他占用该端口的程序。"
  }

  $node = (Get-Command node -ErrorAction SilentlyContinue)
  if (-not $node) { Stop-WithError '未找到 Node.js。' }
  $launcher = Join-Path $PSScriptRoot 'server-launcher.cjs'

  $taskAction = New-ScheduledTaskAction -Execute $node.Source -Argument ('"' + $launcher + '"') -WorkingDirectory $ServerDir
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $trigger.Delay = 'PT30S'
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

  if (Get-AppTask) { Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue }
  Register-ScheduledTask -TaskName $TaskName -Description '班级通讯录与生日提醒平台' -Action $taskAction `
    -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  Write-Ok "已注册计划任务 $TaskName（开机自动启动）"

  if (Read-YesNo '是否允许局域网内其他设备（如同学的手机、电脑）访问？' $true) {
    Get-NetFirewallRule -DisplayName $FirewallRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -DisplayName $FirewallRuleName -Description '班级通讯录与生日提醒平台' -Direction Inbound `
      -Protocol TCP -LocalPort $port -Action Allow -Profile Private, Domain | Out-Null
    Write-Ok "已在防火墙中放行 TCP $port（专用网络、域网络）"
    Write-Note '若当前网络被识别为「公用网络」，请在 设置 > 网络和 Internet 中将其改为「专用网络」，否则其他设备仍无法访问。'
  }
  Start-AppService
}

function Start-AppService {
  if (-not (Get-AppTask)) { Stop-WithError '后台服务尚未安装，请先选择「安装」。' }
  $port = Get-AppPort
  if (Test-TcpPort '127.0.0.1' $port) { Write-Ok "服务已在运行：http://localhost:$port"; return }
  Start-ScheduledTask -TaskName $TaskName
  Write-Host '正在启动……'
  if (Wait-Port $port $true 60) {
    Write-Ok "启动成功：http://localhost:$port"
    foreach ($ip in Get-LanAddresses) { Write-Ok "局域网访问：http://${ip}:$port" }
  } else {
    Write-Note '60 秒内未启动成功，以下是最近的日志：'
    Show-AppLogs 30
  }
}

function Stop-AppService {
  if (-not (Get-AppTask)) { Write-Note '后台服务尚未安装。'; return }
  Stop-ScheduledTask -TaskName $TaskName
  if (Wait-Port (Get-AppPort) $false 15) { Write-Ok '服务已停止' } else { Write-Note '端口仍被占用，可能有其他程序在使用该端口。' }
}

function Show-AppStatus {
  $task = Get-AppTask
  $port = Get-AppPort
  if (-not $task) { Write-Note '后台服务：未安装' } else {
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Host "后台服务：已安装（状态 $($task.State)）"
    Write-Host "上次启动：$($info.LastRunTime)    上次结果：$($info.LastTaskResult)"
  }
  if (Test-TcpPort '127.0.0.1' $port) {
    Write-Ok "端口 $port 正在监听：http://localhost:$port"
  } else {
    Write-Note "端口 $port 未在监听，平台当前未运行。"
  }
  $rule = Get-NetFirewallRule -DisplayName $FirewallRuleName -ErrorAction SilentlyContinue
  if ($rule) { Write-Host '防火墙：已放行局域网访问' } else { Write-Host '防火墙：未放行（仅本机可访问）' }
}

function Show-AppLogs([int]$Lines = 50) {
  $logFile = Join-Path $ServerDir 'logs/server.log'
  if (-not (Test-Path -LiteralPath $logFile)) { Write-Note '暂无日志。'; return }
  Get-Content -LiteralPath $logFile -Tail $Lines -Encoding UTF8
  Write-Host ''
  Write-Host "完整日志：$logFile"
}

function Uninstall-AppService {
  if (Get-AppTask) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Ok '已删除后台服务（数据库和数据不受影响）'
  } else {
    Write-Note '后台服务未安装。'
  }
  $rule = Get-NetFirewallRule -DisplayName $FirewallRuleName -ErrorAction SilentlyContinue
  if ($rule) { $rule | Remove-NetFirewallRule; Write-Ok '已删除防火墙规则' }
}

function Invoke-AppAction([string]$Name) {
  switch ($Name) {
    'install' { Install-AppService }
    'start' { Start-AppService }
    'stop' { Stop-AppService }
    'restart' { Stop-AppService; Start-AppService }
    'status' { Show-AppStatus }
    'logs' { Show-AppLogs 50 }
    'uninstall' { Uninstall-AppService }
  }
}

if ($Action) {
  Invoke-AppAction $Action
} else {
  $menu = [ordered]@{
    '1' = @('install', '安装并启动后台服务（开机自动运行）')
    '2' = @('start', '启动')
    '3' = @('stop', '停止')
    '4' = @('restart', '重启（修改 .env 或更新代码后使用）')
    '5' = @('status', '查看状态')
    '6' = @('logs', '查看最近日志')
    '7' = @('uninstall', '卸载后台服务')
  }
  while ($true) {
    Write-Host ''
    Write-Host '====== 班级通讯录 - 后台服务管理 ======' -ForegroundColor Cyan
    foreach ($key in $menu.Keys) { Write-Host "  $key. $($menu[$key][1])" }
    Write-Host '  0. 退出'
    $choice = (Read-Host '请输入序号').Trim()
    if ($choice -eq '0' -or $choice -eq '') { break }
    if ($menu.Contains($choice)) { Invoke-AppAction $menu[$choice][0] } else { Write-Note '无效的序号' }
  }
}

if ($Elevated) { Wait-ForKey }
