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
  Write-Error "OPENAI_API_KEY is blank in $envFile. Add your key there before starting the live service."
  exit 1
}

if (-not $clientToken -or $clientToken -eq "replace-with-a-long-random-service-token") {
  Write-Warning "DMF_CLIENT_TOKEN is still a placeholder. Set a real shared token in .env and use the same value in Foundry's API token field."
}

Push-Location $serviceRoot
try {
  node --env-file=.env src/cli.mjs
}
finally {
  Pop-Location
}
