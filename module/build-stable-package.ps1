param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $PSScriptRoot "module.json"
$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
$version = [string]$manifest.version
$archivePath = Join-Path $repoRoot "releases/dungeon-masters-forge-v2-$version.zip"
$buildRoot = Join-Path ([System.IO.Path]::GetTempPath()) "dmf-stable-$version-$([guid]::NewGuid().ToString('N'))"
$packageRoot = Join-Path $buildRoot "dungeon-masters-forge"

if (Test-Path -LiteralPath $archivePath) {
  if (-not $Force) { throw "Archive already exists: $archivePath. Re-run with -Force to replace it." }
  Remove-Item -LiteralPath $archivePath -Force
}

try {
  New-Item -ItemType Directory -Path $packageRoot | Out-Null
  Copy-Item -Path (Join-Path $PSScriptRoot "*") -Destination $packageRoot -Recurse

  $versioningPath = Join-Path $packageRoot "scripts/versioning.js"
  if (Test-Path -LiteralPath $versioningPath) {
    $versioning = Get-Content -Raw $versioningPath
    $versioning = $versioning -replace 'const BUILD_VERSION = "[^"]+";', "const BUILD_VERSION = `"$version`";"
    [System.IO.File]::WriteAllText($versioningPath, $versioning, [System.Text.UTF8Encoding]::new($false))
  }

  Compress-Archive -LiteralPath $packageRoot -DestinationPath $archivePath -CompressionLevel Optimal
  Get-FileHash -LiteralPath $archivePath -Algorithm SHA256
} finally {
  if (Test-Path -LiteralPath $buildRoot) {
    Remove-Item -LiteralPath $buildRoot -Recurse -Force
  }
}
