@echo off
setlocal

set RELEASE_DIR=release
set UPLOAD_DIR=release\upload

echo Preparing release files for upload...

if exist "%UPLOAD_DIR%" rmdir /s /q "%UPLOAD_DIR%"
mkdir "%UPLOAD_DIR%"

for %%f in (%RELEASE_DIR%\*.exe %RELEASE_DIR%\*.exe.blockmap %RELEASE_DIR%\*.msi %RELEASE_DIR%\*.zip %RELEASE_DIR%\latest.yml) do (
  if exist "%%f" (
    copy "%%f" "%UPLOAD_DIR%\" > nul
    echo   + %%~nxf
  )
)

echo.
echo Done. Upload the files in "%UPLOAD_DIR%\" to GitHub Releases.
pause
