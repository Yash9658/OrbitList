$serverRoot = Split-Path -Parent $PSScriptRoot
$legacyDataDir = Join-Path $serverRoot "postgres\data"
$dataDir = if ($env:POSTGRES_DATA_DIR) {
  $env:POSTGRES_DATA_DIR
} else {
  Join-Path $serverRoot "postgres\runtime-data"
}
$pidFile = Join-Path $dataDir "postmaster.pid"
$postgresBin = if ($env:POSTGRES_BIN_PATH) {
  $env:POSTGRES_BIN_PATH
} else {
  "C:\Program Files\PostgreSQL\18\bin\postgres.exe"
}
$port = if ($env:POSTGRES_PORT) { [int]$env:POSTGRES_PORT } else { 5433 }

function Test-DatabasePort {
  param([int]$Port)

  $client = New-Object System.Net.Sockets.TcpClient

  try {
    $asyncResult = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $connected = $asyncResult.AsyncWaitHandle.WaitOne(1000, $false)

    if (-not $connected) {
      return $false
    }

    $client.EndConnect($asyncResult)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Get-PidFromFile {
  if (-not (Test-Path $pidFile)) {
    return $null
  }

  $firstLine = Get-Content $pidFile -TotalCount 1 -ErrorAction SilentlyContinue
  [int]$parsedPid = 0

  if ([int]::TryParse($firstLine, [ref]$parsedPid)) {
    return $parsedPid
  }

  return $null
}

if (-not (Test-Path $dataDir)) {
  if (Test-Path $legacyDataDir) {
    Copy-Item -Path $legacyDataDir -Destination $dataDir -Recurse
  } else {
    Write-Error "PostgreSQL data directory was not found at '$dataDir' or '$legacyDataDir'."
    exit 1
  }
}

if (Test-DatabasePort -Port $port) {
  Write-Output "PostgreSQL is already accepting connections on port $port."
  exit 0
}

$existingPid = Get-PidFromFile

if ($existingPid) {
  $existingProcess = Get-Process -Id $existingPid -ErrorAction SilentlyContinue

  if (-not $existingProcess -and (Test-Path $pidFile)) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  }
} elseif (Test-Path $pidFile) {
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Start-Process -FilePath $postgresBin -ArgumentList @("-D", $dataDir, "-p", "$port") -WorkingDirectory $serverRoot -WindowStyle Hidden

for ($attempt = 0; $attempt -lt 20; $attempt++) {
  Start-Sleep -Milliseconds 500

  if (Test-DatabasePort -Port $port) {
    Write-Output "PostgreSQL started on port $port."
    exit 0
  }
}

Write-Error "PostgreSQL did not become ready in time."
exit 1
