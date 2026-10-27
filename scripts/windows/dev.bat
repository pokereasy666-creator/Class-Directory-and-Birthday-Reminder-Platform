@echo off
rem Double-click to run. Calls the PowerShell script of the same name with
rem ExecutionPolicy Bypass for this process only (system policy is unchanged).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
pause
