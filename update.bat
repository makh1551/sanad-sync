@echo off
setlocal
set "DIR=%~dp0"
set "ZIP=%TEMP%\sanad-sync.zip"
set "NEW=%TEMP%\sanad-sync-new"
echo.
echo  Sanad Sync - update
echo  -------------------
echo  Downloading the latest version...
curl.exe -L -s -S -o "%ZIP%" "https://github.com/makh1551/sanad-sync/archive/refs/heads/main.zip"
if errorlevel 1 goto fail
if exist "%NEW%" rmdir /S /Q "%NEW%"
mkdir "%NEW%"
tar -xf "%ZIP%" -C "%NEW%"
if errorlevel 1 goto fail
if not exist "%NEW%\sanad-sync-main\manifest.json" goto fail
xcopy "%NEW%\sanad-sync-main\*" "%DIR%." /E /Y /Q >nul
if errorlevel 1 goto fail
rmdir /S /Q "%NEW%"
del "%ZIP%"
echo.
echo  OK - updated. New version:
findstr /C:"\"version\"" "%DIR%manifest.json"
echo.
echo  The extension reloads itself within 5 minutes,
echo  or open the Sanad Sync window in Chrome to reload it now.
goto end
:fail
echo.
echo  ERROR - update failed. Check the internet connection and try again.
:end
echo.
pause
