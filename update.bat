@echo off
chcp 65001 >nul
setlocal
set "DIR=%~dp0"
set "ZIP=%TEMP%\sanad-sync.zip"
set "NEW=%TEMP%\sanad-sync-new"
echo.
echo  Sanad Sync - update / تحديث مزامنة سند
echo  ----------------------------------------
echo  Downloading the latest version...
powershell -NoProfile -Command "try { [Net.ServicePointManager]::SecurityProtocol='Tls12'; Invoke-WebRequest -UseBasicParsing 'https://github.com/makh1551/sanad-sync/archive/refs/heads/main.zip' -OutFile '%ZIP%'; if (Test-Path '%NEW%') { Remove-Item -Recurse -Force '%NEW%' }; Expand-Archive -Force '%ZIP%' '%NEW%'; Copy-Item -Recurse -Force '%NEW%\sanad-sync-main\*' '%DIR%'; Remove-Item -Recurse -Force '%NEW%'; Remove-Item -Force '%ZIP%'; $v = (Get-Content -Raw -Encoding UTF8 (Join-Path '%DIR%' 'manifest.json') | ConvertFrom-Json).version; Write-Host ''; Write-Host ('  OK - version ' + $v) } catch { Write-Host ''; Write-Host ('  ERROR: ' + $_.Exception.Message); exit 1 }"
if errorlevel 1 (
  echo  Update failed. Check the internet connection and try again.
) else (
  echo  The extension reloads itself within 5 minutes,
  echo  or open the Sanad Sync window in Chrome to reload it now.
)
echo.
pause
