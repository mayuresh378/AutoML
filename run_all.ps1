# Run both backend (FastAPI/uvicorn) and frontend (Vite) in separate PowerShell windows
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

# Start backend in a new PowerShell window
Start-Process -FilePath 'powershell' -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-Command',"Set-Location -Path '$backend'; .\\.venv\\Scripts\\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000" -WindowStyle Normal

# Start frontend in a new PowerShell window
Start-Process -FilePath 'powershell' -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-Command',"Set-Location -Path '$frontend'; .\\node_modules\\.bin\\vite.cmd --host 127.0.0.1 --port 5173" -WindowStyle Normal

Write-Output "Launched backend and frontend in separate PowerShell windows."