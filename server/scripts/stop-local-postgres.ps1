$serverRoot = Split-Path -Parent $PSScriptRoot
$legacyDataDir = Join-Path $serverRoot "postgres\data"
$dataDir = if ($env:POSTGRES_DATA_DIR) {
  $env:POSTGRES_DATA_DIR
} else {
  Join-Path $serverRoot "postgres\runtime-data"
}
if (-not (Test-Path $dataDir) -and (Test-Path $legacyDataDir)) {
  $dataDir = $legacyDataDir
}
$pidFile = Join-Path $dataDir "postmaster.pid"
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

if (-not (Test-Path $pidFile)) {
  if (Test-DatabasePort -Port $port) {
    Write-Error "A PostgreSQL server is responding on port $port, but it is not the project-managed instance."
    exit 1
  }

  Write-Output "PostgreSQL is already stopped."
  exit 0
}

$firstLine = Get-Content $pidFile -TotalCount 1 -ErrorAction SilentlyContinue
[int]$parsedPid = 0

if (-not [int]::TryParse($firstLine, [ref]$parsedPid)) {
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  Write-Output "Removed stale PostgreSQL pid file."
  exit 0
}

$process = Get-Process -Id $parsedPid -ErrorAction SilentlyContinue

if (-not $process) {
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  Write-Output "Removed stale PostgreSQL pid file."
  exit 0
}

Stop-Process -Id $parsedPid -Force

for ($attempt = 0; $attempt -lt 20; $attempt++) {
  Start-Sleep -Milliseconds 500

  if (-not (Test-DatabasePort -Port $port)) {
    if (Test-Path $pidFile) {
      Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }

    Write-Output "PostgreSQL stopped on port $port."
    exit 0
  }
}

Write-Error "PostgreSQL did not stop in time."
exit 1
