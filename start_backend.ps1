$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvDir = Join-Path $root ".venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"

function Get-PythonCommand {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCommand -and $pythonCommand.Source -notlike "*WindowsApps*") {
        return "python"
    }

    $pyCommand = Get-Command py -ErrorAction SilentlyContinue
    if ($pyCommand) {
        return "py"
    }

    throw "Python 3.10+ was not found. Please install Python and select the interpreter in VS Code."
}

if (-not (Test-Path $venvPython)) {
    $pythonCmd = Get-PythonCommand
    if ($pythonCmd -eq "py") {
        & py -3 -m venv $venvDir
    }
    else {
        & python -m venv $venvDir
    }
}

& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r (Join-Path $root "requirements.txt")
& $venvPython -m uvicorn app.main:app --reload
