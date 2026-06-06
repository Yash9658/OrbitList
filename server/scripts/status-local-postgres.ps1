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

$reachable = Test-DatabasePort -Port $port

if (-not (Test-Path $pidFile)) {
  if ($reachable) {
    Write-Output "A PostgreSQL server is accepting connections on port $port, but it is not the project-managed instance."
    exit 1
  }

  Write-Output "PostgreSQL is stopped on port $port."
  exit 1
}

$firstLine = Get-Content $pidFile -TotalCount 1 -ErrorAction SilentlyContinue
[int]$parsedPid = 0

if (-not [int]::TryParse($firstLine, [ref]$parsedPid)) {
  Write-Output "PostgreSQL pid file is invalid."
  exit 1
}

$process = Get-Process -Id $parsedPid -ErrorAction SilentlyContinue

if ($process -and $reachable) {
  Write-Output "PostgreSQL is running on port $port (PID $parsedPid)."
  exit 0
}

if ($process) {
  Write-Output "PostgreSQL process $parsedPid exists but is not accepting connections on port $port yet."
  exit 1
}

if ($reachable) {
  Write-Output "A PostgreSQL server is accepting connections on port $port, but it is not the project-managed instance."
  exit 1
}

Write-Output "PostgreSQL is stopped on port $port."
exit 1
