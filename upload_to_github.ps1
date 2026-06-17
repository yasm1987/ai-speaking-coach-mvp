$ErrorActionPreference = "Stop"

$repoUrl = "https://github.com/yasm1987/ai-speaking-coach-mvp.git"

Write-Host "Checking local safety rules..."
if (-not (Test-Path -LiteralPath ".gitignore")) {
  throw ".gitignore not found. Please run this script from the project root."
}

$ignoredEnv = git check-ignore .env 2>$null
if (-not $ignoredEnv) {
  throw ".env is not ignored. Stop upload to avoid leaking keys."
}

Write-Host "Setting local Git identity..."
git config user.name "yasm1987"
git config user.email "yasm1987@users.noreply.github.com"

Write-Host "Setting GitHub remote..."
$remote = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
  git remote add origin $repoUrl
} else {
  git remote set-url origin $repoUrl
}

Write-Host "Preparing files..."
git add .

$stagedFiles = git diff --cached --name-only
$stagedEnv = $stagedFiles | Where-Object {
  $_ -eq ".env" -or $_ -like ".env.*.local" -or $_ -like "*.env.local"
}
if ($stagedEnv) {
  throw ".env is staged. Stop upload to avoid leaking keys."
}

$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = "Continue"
git rev-parse --verify HEAD *> $null
$hasCommit = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $previousErrorAction
if (-not $hasCommit) {
  Write-Host "Creating first commit..."
  git commit -m "Initial AI speaking coach MVP"
} else {
  $changes = git diff --cached --name-only
  if ($changes) {
    Write-Host "Creating update commit..."
    git commit -m "Prepare AI speaking coach MVP for deployment"
  } else {
    Write-Host "No staged changes to commit."
  }
}

Write-Host "Pushing to GitHub..."
git branch -M main
git push -u origin main

Write-Host ""
Write-Host "Done. GitHub upload completed:"
Write-Host $repoUrl
