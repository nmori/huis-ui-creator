@echo off
cd /d %~dp0

if "%1"=="" (
    echo Usage: build-for-windows.bat {ia32 or x64} [skip]
    exit /B
)
if not "%1"=="ia32" (
    if not "%1"=="x64" (
        echo Invalid argument. set ia32 or x64
        exit /B
    )
)

set TAG=[cmd]
set ARCH=%1

rem environment build (skip: use existing node_modules)
if not "%2"=="skip" (
    echo %TAG% call npm install
    call npm install
    if errorlevel 1 exit /B 1
) else (
    echo skip environment build
)

rem build and package (output: dist\HUIS UI CREATOR-win32-%ARCH%)
echo %TAG% call npm run package -- --platform=win32 --arch=%ARCH%
call npm run package -- --platform=win32 --arch=%ARCH%

pause
