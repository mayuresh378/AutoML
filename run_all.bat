@echo off
REM Launch backend and frontend in separate PowerShell windows
SET ROOT_DIR=%~dp0
SET BACKEND_DIR=%ROOT_DIR%backend
SET FRONTEND_DIR=%ROOT_DIR%frontend

start "Backend" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location -Path '%BACKEND_DIR%'; .\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"
start "Frontend" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location -Path '%FRONTEND_DIR%'; .\node_modules\.bin\vite.cmd --host 127.0.0.1 --port 5173"

echo Launched backend and frontend in separate PowerShell windows.