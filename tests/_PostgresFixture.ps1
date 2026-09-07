function New-TestPostgresStartInfo {
    param([Parameter(Mandatory)][string]$SqlPath, [switch]$TuplesOnly)

    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $env:DST_TEST_POSTGRES_PSQL
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true

    # Validate the same environment snapshot that the child would inherit.
    $blocked = @(
        foreach ($name in @('PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGSYSCONFDIR')) {
            if (-not [string]::IsNullOrEmpty($start.Environment[$name])) { $name }
        }
    )
    $database = $env:DST_TEST_POSTGRES_DATABASE
    $fixtureHost = $start.Environment['PGHOST']
    if ($database -cnotmatch '^dst_inventory(?:_[A-Za-z0-9_-]+)?$' -or
        $fixtureHost -cnotin @('127.0.0.1', 'localhost', '::1') -or
        $start.Environment['PGPORT'] -cne '55439' -or
        $start.Environment['PGUSER'] -cne 'dst_inventory' -or
        ($start.Environment['PGDATABASE'] -and $start.Environment['PGDATABASE'] -cne $database) -or
        $blocked.Count -gt 0) {
        throw "PostgreSQL tests require the explicit disposable loopback dst_inventory fixture on port 55439 with role dst_inventory. Blocked libpq overrides: $($blocked -join ', ')."
    }

    $password = $start.Environment['PGPASSWORD']
    foreach ($name in @($start.Environment.Keys)) {
        if ($name -like 'PG*') { [void]$start.Environment.Remove($name) }
    }
    if ($password) { $start.Environment['PGPASSWORD'] = $password }
    $start.Environment['PGPASSFILE'] = Join-Path $TestDrive 'unused-fixture-pgpass'
    $start.Environment['PGCONNECT_TIMEOUT'] = '5'
    $start.Environment['PGSSLMODE'] = 'disable'
    $start.Environment['PGGSSENCMODE'] = 'disable'
    # Pin localhost numerically: neither DNS nor inherited libpq routing can
    # change the destination, including for asynchronous game-session probes.
    $address = if ($fixtureHost -ceq '::1') { '::1' } else { '127.0.0.1' }
    foreach ($argument in @('-X', '-w', '-q', '-h', $address, '-p', '55439',
        '-U', 'dst_inventory', '-d', $database, '-v', 'ON_ERROR_STOP=1', '-f', $SqlPath)) {
        $start.ArgumentList.Add($argument)
    }
    if ($TuplesOnly) {
        $start.ArgumentList.Add('-A')
        $start.ArgumentList.Add('-t')
    } else {
        $start.ArgumentList.Add('--csv')
    }
    return $start
}

function Invoke-TestPostgresFile {
    param([Parameter(Mandatory)][string]$SqlPath, [switch]$TuplesOnly)

    $start = New-TestPostgresStartInfo -SqlPath $SqlPath -TuplesOnly:$TuplesOnly
    $process = [Diagnostics.Process]::Start($start)
    try {
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(90000)) {
            throw 'Disposable PostgreSQL fixture query timed out.'
        }
        return @{
            ExitCode = $process.ExitCode
            Output = $stdout.GetAwaiter().GetResult()
            Error = $stderr.GetAwaiter().GetResult()
        }
    } finally {
        if (-not $process.HasExited) { Stop-Process -Id $process.Id }
        $process.Dispose()
    }
}
