$root = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "Starting AutoML Platform..." -ForegroundColor Cyan

$backendJob = Start-Job -ScriptBlock {
    Set-Location -Path "$using:root\backend"
    & ".\\.venv\Scripts\python.exe" -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
}

Start-Sleep -Seconds 2

Write-Host "Backend: http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "Frontend: http://127.0.0.1:3000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop both servers." -ForegroundColor Yellow

try {
    Set-Location -Path "$root\frontend"
    & ".\node_modules\.bin\vite.cmd" --host 127.0.0.1 --port 3000
} finally {
    Write-Host "Shutting down backend..." -ForegroundColor Yellow
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
}
