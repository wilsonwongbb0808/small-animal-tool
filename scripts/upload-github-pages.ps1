param(
  [string]$Owner = "wilsonwongbb0808",
  [string]$Repo = "small-animal-tool",
  [string]$Branch = "main",
  [string]$PageUrl = "https://wilsonwongbb0808.github.io/small-animal-tool/",
  [int]$WaitSeconds = 180
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

function Get-UploadToken {
  if ($env:GITHUB_TOKEN) { return $env:GITHUB_TOKEN.Trim() }
  if ($env:GH_TOKEN) { return $env:GH_TOKEN.Trim() }

  $tokenFile = Join-Path $root ".github-upload-token"
  if (Test-Path $tokenFile) {
    return (Get-Content -Raw -Path $tokenFile).Trim()
  }

  throw "Missing GitHub token. Put it in .github-upload-token or set GITHUB_TOKEN, then run this tool again."
}

function Invoke-GitHubApi {
  param(
    [string]$Method,
    [string]$Uri,
    [object]$Body = $null
  )

  $params = @{
    Method = $Method
    Uri = $Uri
    Headers = $script:Headers
  }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
    $params.ContentType = "application/json"
  }
  Invoke-RestMethod @params
}

function New-GitBlob {
  param(
    [string]$Path,
    [byte[]]$Bytes
  )

  $body = @{
    content = [Convert]::ToBase64String($Bytes)
    encoding = "base64"
  }
  Invoke-GitHubApi -Method "Post" -Uri "https://api.github.com/repos/$Owner/$Repo/git/blobs" -Body $body
}

function Test-OnlineFiles {
  param([string]$Url)

  try {
    $cacheBust = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $base = $Url.TrimEnd("/")
    $checkFiles = @("index.html", "app.js", "styles.css", "data/latest-review.json")
    foreach ($file in $checkFiles) {
      $tmp = Join-Path ([IO.Path]::GetTempPath()) ("gh-pages-check-" + [guid]::NewGuid().ToString("N") + ".tmp")
      Invoke-WebRequest -UseBasicParsing -Uri "$base/$($file)?v=$cacheBust" -OutFile $tmp -TimeoutSec 30
      $localHash = (Get-FileHash -Algorithm SHA256 -Path $file).Hash
      $onlineHash = (Get-FileHash -Algorithm SHA256 -Path $tmp).Hash
      Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
      if ($localHash -ne $onlineHash) { return $false }
    }
    return $true
  } catch {
    return $false
  }
}

$token = Get-UploadToken
$script:Headers = @{
  Authorization = "Bearer $token"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
  "User-Agent" = "daily-animal-uploader"
}

$files = @(
  ".gitignore",
  "index.html",
  "app.js",
  "styles.css",
  "README.md",
  "data/history.json",
  "data/latest-review.json",
  "scripts/upload-github-pages.ps1",
  "upload-to-github.bat"
)

Write-Host "Uploading latest static site to GitHub Pages..." -ForegroundColor Cyan

$ref = Invoke-GitHubApi -Method "Get" -Uri "https://api.github.com/repos/$Owner/$Repo/git/ref/heads/$Branch"
$baseCommitSha = $ref.object.sha
$baseCommit = Invoke-GitHubApi -Method "Get" -Uri "https://api.github.com/repos/$Owner/$Repo/git/commits/$baseCommitSha"

$treeItems = New-Object System.Collections.Generic.List[object]
foreach ($file in $files) {
  if (-not (Test-Path $file)) { throw "Missing file: $file" }
  $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $file))
  $blob = New-GitBlob -Path $file -Bytes $bytes
  $treeItems.Add(@{
    path = ($file -replace "\\", "/")
    mode = "100644"
    type = "blob"
    sha = $blob.sha
  })
  Write-Host "Prepared $file"
}

$emptyBlob = New-GitBlob -Path ".nojekyll" -Bytes ([byte[]]@())
$treeItems.Add(@{
  path = ".nojekyll"
  mode = "100644"
  type = "blob"
  sha = $emptyBlob.sha
})

$tree = Invoke-GitHubApi -Method "Post" -Uri "https://api.github.com/repos/$Owner/$Repo/git/trees" -Body @{
  base_tree = $baseCommit.tree.sha
  tree = $treeItems
}

$commit = Invoke-GitHubApi -Method "Post" -Uri "https://api.github.com/repos/$Owner/$Repo/git/commits" -Body @{
  message = "Update daily animal tool latest site"
  tree = $tree.sha
  parents = @($baseCommitSha)
}

Invoke-GitHubApi -Method "Patch" -Uri "https://api.github.com/repos/$Owner/$Repo/git/refs/heads/$Branch" -Body @{
  sha = $commit.sha
  force = $false
} | Out-Null

Write-Host "Pushed commit $($commit.sha.Substring(0, 7)). Waiting for GitHub Pages..." -ForegroundColor Green

$deadline = (Get-Date).AddSeconds($WaitSeconds)
$lastStatus = ""
do {
  Start-Sleep -Seconds 8
  $pages = Invoke-GitHubApi -Method "Get" -Uri "https://api.github.com/repos/$Owner/$Repo/pages"
  $runs = Invoke-GitHubApi -Method "Get" -Uri "https://api.github.com/repos/$Owner/$Repo/actions/runs?per_page=5"
  $run = $runs.workflow_runs | Where-Object { $_.name -eq "pages build and deployment" } | Select-Object -First 1
  $lastStatus = "Pages=$($pages.status), Action=$($run.status)/$($run.conclusion)"
  Write-Host $lastStatus

  if ($run.status -eq "completed" -and $run.conclusion -eq "success") {
    if (Test-OnlineFiles -Url $PageUrl) {
      Write-Host "Done. Online page updated: $PageUrl" -ForegroundColor Green
      exit 0
    }
    Write-Host "Deploy succeeded; waiting for CDN cache to refresh..."
  }

  if ($run.status -eq "completed" -and $run.conclusion -and $run.conclusion -ne "success") {
    throw "GitHub Pages deployment failed: $($run.conclusion). $($run.html_url)"
  }
} while ((Get-Date) -lt $deadline)

throw "Timed out waiting for GitHub Pages. Last status: $lastStatus"
