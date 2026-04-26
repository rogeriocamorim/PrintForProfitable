@echo off
:: PrintForProfitable Deployment — Windows launcher
:: Finds Git Bash and runs deploy.sh

setlocal

:: ── Locate Git Bash ────────────────────────────────────────────────────────
set "BASH="

:: Common Git for Windows install locations
for %%G in (
    "C:\Program Files\Git\bin\bash.exe"
    "C:\Program Files (x86)\Git\bin\bash.exe"
    "%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
    "%ProgramW6432%\Git\bin\bash.exe"
) do (
    if exist %%G (
        set "BASH=%%~G"
        goto :found
    )
)

:: Try PATH
where bash >nul 2>&1
if %errorlevel% == 0 (
    set "BASH=bash"
    goto :found
)

echo [error] Git Bash not found.
echo        Install Git for Windows from https://git-scm.com
echo        or run deploy.sh directly from Git Bash / WSL.
exit /b 1

:found
echo [launcher] Using bash: %BASH%
echo.

:: ── Forward all arguments to the shell script ──────────────────────────────
"%BASH%" -c "./deploy.sh %*"

endlocal
