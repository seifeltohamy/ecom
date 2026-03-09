@echo off
cd /d "%~dp0\frontend"
call npm run build
echo Build complete. Run "python -m uvicorn main:app --port 8080" from the sku-app folder to serve.
pause
