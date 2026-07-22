param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $PSScriptRoot "module.json"
$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
$version = [string]$manifest.version
$licenseReference = [string]$manifest.license
if ([string]::IsNullOrWhiteSpace($licenseReference)) {
  throw "Stable package build blocked: choose a software license and add its module-relative path to module.json before packaging."
}
$licensePath = Join-Path $PSScriptRoot $licenseReference
if (-not (Test-Path -LiteralPath $licensePath -PathType Leaf)) {
  throw "Stable package build blocked: manifest license file was not found at $licensePath."
}
$archivePath = Join-Path $repoRoot "releases/dungeon-masters-forge-v2-$version.zip"
$buildRoot = Join-Path ([System.IO.Path]::GetTempPath()) "dmf-stable-$version-$([guid]::NewGuid().ToString('N'))"
$packageRoot = Join-Path $buildRoot "dungeon-masters-forge"

if (Test-Path -LiteralPath $archivePath) {
  if (-not $Force) { throw "Archive already exists: $archivePath. Re-run with -Force to replace it." }
  Remove-Item -LiteralPath $archivePath -Force
}
New-Item -ItemType Directory -Path (Split-Path -Parent $archivePath) -Force | Out-Null

try {
  New-Item -ItemType Directory -Path $packageRoot | Out-Null
  # Keep repository tests, local examples, and build helpers out of the public module archive.
  $packageItems = @(
    "module.json",
    "README.md",
    "CHANGELOG.md",
    "ROADMAP.md",
    "docs",
    "scripts",
    "styles",
    "templates"
  )
  if ($licenseReference -notmatch "^docs[\\/]") {
    $packageItems += $licenseReference
  }
  foreach ($relativePath in $packageItems | Select-Object -Unique) {
    $sourcePath = Join-Path $PSScriptRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath)) {
      throw "Stable package source was not found: $sourcePath"
    }
    Copy-Item -LiteralPath $sourcePath -Destination $packageRoot -Recurse -Force
  }
  $testerOnlyFiles = @(
    "scripts/verification-harness.js"
  )
  foreach ($relativePath in $testerOnlyFiles) {
    $packagePath = Join-Path $packageRoot $relativePath
    if (Test-Path -LiteralPath $packagePath) {
      Remove-Item -LiteralPath $packagePath -Force
    }
  }

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
