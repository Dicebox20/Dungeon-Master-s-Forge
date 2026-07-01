param(
  [int]$Port = 0
)

$serviceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $serviceRoot ".env"

if (-not (Test-Path $envFile)) {
  Write-Error "Missing .env file at $envFile"
  exit 1
}

$envContent = Get-Content $envFile -Raw
$apiKeyLine = ($envContent -split "`r?`n" | Where-Object { $_ -match '^OPENAI_API_KEY=' } | Select-Object -First 1)
$tokenLine = ($envContent -split "`r?`n" | Where-Object { $_ -match '^DMF_CLIENT_TOKEN=' } | Select-Object -First 1)

$apiKey = if ($apiKeyLine) { $apiKeyLine.Substring("OPENAI_API_KEY=".Length).Trim() } else { "" }
$clientToken = if ($tokenLine) { $tokenLine.Substring("DMF_CLIENT_TOKEN=".Length).Trim() } else { "" }

if (-not $apiKey) {
  Write-Warning "OPENAI_API_KEY is blank in $envFile. The service will start in client-key mode and expect a personal OpenAI key in Foundry's API token field."
}

if ($apiKey -and (-not $clientToken -or $clientToken -eq "replace-with-a-long-random-service-token")) {
  Write-Warning "DMF_CLIENT_TOKEN is still a placeholder. Set a real shared token in .env and use the same value in Foundry's API token field."
}

Push-Location $serviceRoot
try {
  foreach ($line in ($envContent -split "`r?`n")) {
    if (-not $line) { continue }
    if ($line.TrimStart().StartsWith("#")) { continue }
    $separator = $line.IndexOf("=")
    if ($separator -lt 1) { continue }
    $name = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1)
    Set-Item -Path "Env:$name" -Value $value
  }
  $env:DMF_AI_MODE = "openai"
  if ($Port -gt 0) {
    $env:DMF_PORT = [string]$Port
  }
  node src/cli.mjs
}
finally {
  Pop-Location
}
