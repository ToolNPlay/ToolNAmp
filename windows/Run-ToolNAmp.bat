@echo off
:: ToolNAmp Windows Launcher & SmartScreen Unblocker
:: Developed by ToolNPlay.com • Developers: Pardeep Kumar & Harsh Suman
title ToolNAmp Launcher

set EXE_PATH=%~dp0ToolNAmp.exe

if not exist "%EXE_PATH%" (
    echo [ERROR] ToolNAmp.exe not found in current directory!
    pause
    exit /b 1
)

:: Automatically remove Windows Mark-of-the-Web (MOTW) to bypass SmartScreen warning
powershell -NoProfile -Command "if (Test-Path '%EXE_PATH%') { Unblock-File -Path '%EXE_PATH%' }" >nul 2>&1

:: Launch ToolNAmp directly
start "" "%EXE_PATH%"
exit
