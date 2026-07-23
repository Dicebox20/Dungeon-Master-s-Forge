param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $PSScriptRoot "module.json"
$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
$version = [string]$manifest.version
$archivePath = Join-Path $PSScriptRoot "releases/dungeon-masters-forge-v2-$version.zip"
$buildRoot = Join-Path ([System.IO.Path]::GetTempPath()) "dmf-$version-$([guid]::NewGuid().ToString('N'))"
$packageRoot = Join-Path $buildRoot "dungeon-masters-forge"

if (Test-Path -LiteralPath $archivePath) {
  if (-not $Force) { throw "Archive already exists: $archivePath. Re-run with -Force to replace it." }
  Remove-Item -LiteralPath $archivePath -Force
}
New-Item -ItemType Directory -Path (Split-Path -Parent $archivePath) -Force | Out-Null

try {
  New-Item -ItemType Directory -Path $packageRoot | Out-Null
  # Keep tests, examples, backups, and release helpers out of the tester archive.
  $packageItems = @(
    "module.json",
    "README.md",
    "CHANGELOG.md",
    "ROADMAP.md",
    "docs",
    "scripts",
    "styles",
    "templates",
    "LICENSE"
  )
  foreach ($relativePath in $packageItems) {
    $sourcePath = Join-Path $repoRoot "module/$relativePath"
    if (-not (Test-Path -LiteralPath $sourcePath)) {
      throw "Tester package source was not found: $sourcePath"
    }
    Copy-Item -LiteralPath $sourcePath -Destination $packageRoot -Recurse -Force
  }
  Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $packageRoot "module.json") -Force
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot "overrides/hosted-release-config.js") `
    -Destination (Join-Path $packageRoot "scripts/hosted-release-config.js") -Force

  $versioningPath = Join-Path $packageRoot "scripts/versioning.js"
  $versioning = Get-Content -Raw $versioningPath
  $versioning = $versioning -replace 'const BUILD_VERSION = "[^"]+";', "const BUILD_VERSION = `"$version`";"
  [System.IO.File]::WriteAllText($versioningPath, $versioning, [System.Text.UTF8Encoding]::new($false))

  Compress-Archive -LiteralPath $packageRoot -DestinationPath $archivePath -CompressionLevel Optimal
  Get-FileHash -LiteralPath $archivePath -Algorithm SHA256
} finally {
  if (Test-Path -LiteralPath $buildRoot) {
    Remove-Item -LiteralPath $buildRoot -Recurse -Force
  }
}
