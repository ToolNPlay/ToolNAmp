@echo off
echo === Building ToolNAmp for Windows (.exe) ===

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js and npm are required to build the Windows executable.
    exit /b 1
)

if not exist node_modules (
    echo Installing build dependencies...
    call npm install --save-dev electron electron-builder
)

echo Packaging Windows 64-bit installer (.exe) & portable (.exe)...
call npx electron-builder --win --x64

echo === Windows Build Complete! ===
echo Output files located in: dist\
pause
