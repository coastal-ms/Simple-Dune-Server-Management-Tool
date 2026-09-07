# Persisted vehicle reads, independently implemented against the Red-Blink
# vehicle model documented in docs/vehicle-lifecycle.md. The game DB is authority.

function Get-DuneVehicleHostScope {
    param([string]$Ip)
    $probe = Invoke-DuneBackupShell -Ip $Ip -Script @'
kubectl get namespaces -o jsonpath='{range .items[*]}DST_VEHICLE_SCOPE={.metadata.name}|{.metadata.uid}{"\n"}{end}'
'@ -TimeoutSec 30
    if ($null -eq $probe -or $probe.rc -ne 0) { throw 'Vehicle database namespace could not be observed.' }
    $scopes = @([regex]::Matches([string]$probe.out, '(?m)^DST_VEHICLE_SCOPE=(funcom-seabass-sh-[a-z0-9-]+)\|([a-f0-9-]{36})\r?$'))
    if ($scopes.Count -ne 1) { throw 'Vehicle reads require exactly one proven battlegroup namespace.' }
    $ns = $scopes[0].Groups[1].Value
    $pod = Find-V6DbPod -Ip $Ip -Force
    if ($pod.ns -cne $ns) { throw 'The discovered database does not belong to the proven vehicle namespace.' }
    $hash = [Security.Cryptography.SHA256]::Create()
    try {
        $scope = ([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes("$Ip|$ns|$($scopes[0].Groups[2].Value)")))).Replace('-', '').ToLowerInvariant()
    } finally { $hash.Dispose() }
    return @{ key = $scope; namespace = $ns; world = $ns.Substring('funcom-seabass-'.Length) }
}

function Get-DuneVehicleTargetRevisionSql {
    param([Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$DatabaseScope)
    # Exclude transient actor state and durability: stopping a map flushes those.
    # Identity, access, installed modules, their inventory scope, and recovery ownership must still match.
    return @'
md5(jsonb_build_array('__DATABASE_SCOPE__', a.id::text, a.class, a.map, pa.actor_name,
    (SELECT jsonb_agg(jsonb_build_array(r.player_id::text, r.rank) ORDER BY r.player_id, r.rank)
     FROM dune.permission_actor_rank r WHERE r.permission_actor_id = a.id),
    (SELECT jsonb_agg(jsonb_build_array(m.id::text, m.template_id) ORDER BY m.id)
     FROM dune.vehicle_modules m WHERE m.vehicle_id = a.id),
    (SELECT jsonb_agg(rv.character_id::text ORDER BY rv.character_id)
     FROM dune.recovered_vehicles rv WHERE rv.vehicle_id = a.id),
    (SELECT jsonb_agg(bv.character_id::text ORDER BY bv.character_id)
     FROM dune.backup_vehicles bv WHERE bv.vehicle_id = a.id),
    (SELECT jsonb_agg(jsonb_build_array(to_jsonb(inv),
        (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id)
         FROM dune.items i WHERE i.inventory_id = inv.id)) ORDER BY inv.id)
     FROM dune.inventories inv
     WHERE inv.actor_id = a.id
        OR inv.vehicle_module_id IN (SELECT m.id FROM dune.vehicle_modules m WHERE m.vehicle_id = a.id))
)::text)
'@.Replace('__DATABASE_SCOPE__', $DatabaseScope)
}

function ConvertTo-DuneVehicleNumber {
    param($Value)
    $number = 0.0
    if ([double]::TryParse([string]$Value, [Globalization.NumberStyles]::Float,
        [Globalization.CultureInfo]::InvariantCulture, [ref]$number) -and
        -not [double]::IsNaN($number) -and -not [double]::IsInfinity($number) -and $number -ge 0) {
        return $number
    }
    return $null
}

function Get-DuneVehicleFleetLive {
    param([string]$Ip, [long]$VehicleId = 0)
    $filter = if ($VehicleId -gt 0) { "AND a.id = $VehicleId::bigint" } else { '' }
    $hostScope = Get-DuneVehicleHostScope -Ip $Ip
    $revisionSql = Get-DuneVehicleTargetRevisionSql -DatabaseScope $hostScope.key
    $sql = @"
SELECT a.id::text AS vehicle_id, a.class, COALESCE(a.map, '') AS map,
       COALESCE(pa.actor_name, '') AS vehicle_name,
       COALESCE((SELECT string_agg(DISTINCT s.state::text, ', ' ORDER BY s.state::text)
                 FROM dune.actor_state s WHERE s.actor_id = a.id), '') AS actor_state,
       COALESCE((SELECT jsonb_agg(jsonb_build_object(
           'player_id', par.player_id::text, 'rank', par.rank,
           'character_name', (SELECT CASE WHEN count(*) = 1 THEN min(ps.character_name) END
                              FROM dune.player_state ps WHERE ps.player_controller_id = par.player_id)
       ) ORDER BY par.rank, par.player_id)
       FROM dune.permission_actor_rank par WHERE par.permission_actor_id = a.id), '[]'::jsonb)::text AS permissions,
       (SELECT count(*) FROM dune.vehicle_modules vm WHERE vm.vehicle_id = a.id)::text AS module_count,
       (SELECT count(*) FROM dune.recovered_vehicles rv WHERE rv.vehicle_id = a.id)::text AS recovery_count,
       (SELECT CASE WHEN count(*) = 1 THEN min(rv.chassis_durability::text) END
        FROM dune.recovered_vehicles rv WHERE rv.vehicle_id = a.id) AS recovery_durability,
       (SELECT count(*) FROM dune.backup_vehicles bv WHERE bv.vehicle_id = a.id)::text AS backup_count,
       (SELECT count(*) FROM dune.inventories inv WHERE inv.actor_id = a.id AND inv.inventory_type = 0)::text AS cargo_hold_count,
       (SELECT count(*) FROM dune.inventories inv
        WHERE inv.actor_id = a.id AND inv.inventory_type = 0
          AND (inv.exchange_id IS NOT NULL OR inv.item_id IS NOT NULL OR inv.vehicle_module_id IS NOT NULL))::text AS cargo_conflict_count,
       (SELECT count(*) FROM dune.inventories inv
        WHERE (inv.vehicle_module_id IN (SELECT vm.id FROM dune.vehicle_modules vm WHERE vm.vehicle_id = a.id)
               AND inv.actor_id IS NOT NULL AND inv.actor_id <> a.id)
           OR (inv.actor_id = a.id AND inv.vehicle_module_id IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM dune.vehicle_modules vm
                               WHERE vm.id = inv.vehicle_module_id AND vm.vehicle_id = a.id)))::text AS closure_owner_conflict_count,
       (SELECT count(*) FROM dune.items i JOIN dune.inventories inv ON inv.id = i.inventory_id
        WHERE inv.actor_id = a.id AND inv.inventory_type = 0)::text AS cargo_stack_count,
       (SELECT CASE WHEN count(*) = 1 THEN min(inv.max_item_count)::text END FROM dune.inventories inv
        WHERE inv.actor_id = a.id AND inv.inventory_type = 0) AS cargo_max_item_count,
       (SELECT CASE WHEN count(*) = 1 THEN min(inv.max_item_volume)::text END FROM dune.inventories inv
        WHERE inv.actor_id = a.id AND inv.inventory_type = 0) AS cargo_max_item_volume,
       $revisionSql AS target_revision
FROM dune.vehicles v
JOIN dune.actors a ON a.id = v.id
LEFT JOIN dune.permission_actor pa ON pa.actor_id = a.id AND pa.actor_type = 2
WHERE true $filter
ORDER BY COALESCE(NULLIF(pa.actor_name, ''), a.class), a.id;
"@
    $result = Invoke-DuneSqlQuery -Ip $Ip -Sql $sql -ReadOnly $true -MaxRows 10001 -TimeoutSec 30
    if (-not $result.ok) { return @{ ok = $false; error = $result.error } }
    $rows = ConvertTo-DuneRowMaps -Result $result
    if ($rows.Count -gt 10000) { return @{ ok = $false; error = 'Fleet exceeds the 10,000 vehicle read limit; no partial fleet is returned.' } }
    $catalog = Get-DuneVehicleKitCatalog
    $vehicles = @()
    $seen = @{}
    foreach ($row in $rows) {
        $id = [int64](ConvertTo-DuneInt $row['vehicle_id'])
        if ($id -le 0 -or $id -gt 9007199254740991 -or $seen.ContainsKey($id)) { throw 'Vehicle fleet returned an invalid or ambiguous actor identity.' }
        $seen[$id] = $true
        $permissions = @(([string]$row['permissions']) | ConvertFrom-Json -ErrorAction Stop)
        $owners = @($permissions | Where-Object { $null -ne $_.rank -and $_.rank -eq 1 })
        $ownership = if ($permissions.Count -eq 0) { 'unowned' } elseif ($owners.Count -ne 1 -or -not $owners[0].character_name) { 'ambiguous' } else { 'owned' }
        $invalidRoster = @($permissions | Where-Object { $_.rank -notin @(1,2,3) -or -not $_.character_name }).Count -gt 0 -or
            @($permissions | Group-Object player_id | Where-Object Count -gt 1).Count -gt 0
        $short = ConvertTo-DuneVehicleShortClass ([string]$row['class'])
        $subtypes = @($catalog.vehicles | Where-Object {
            (ConvertTo-DuneVehicleShortClass ([string]$_.className)) -eq $short
        })
        $recoveryCount = [int](ConvertTo-DuneInt $row['recovery_count'])
        $cargoHolds = [int](ConvertTo-DuneInt $row['cargo_hold_count'])
        $cargoConflicts = [int](ConvertTo-DuneInt $row['cargo_conflict_count'])
        $closureOwnerConflicts = [int](ConvertTo-DuneInt $row['closure_owner_conflict_count'])
        $blockedState = @(([string]$row['actor_state'] -split ', ') | Where-Object { $_ -in @('Travel','VehicleBackup','VehicleRecovery') })
        $revision = [string]$row['target_revision']
        if ($revision -notmatch '^[a-f0-9]{32}$') { throw 'Vehicle target revision is unavailable.' }
        $vehicles += @{
            id = $id
            class = $short
            vehicle_name = [string]$row['vehicle_name']
            map = [string]$row['map']
            actor_state = [string]$row['actor_state']
            subtype = if ($subtypes.Count -eq 1) { [string]$subtypes[0].label } else { $short }
            subtype_source = if ($subtypes.Count -eq 1) { 'catalog' } else { 'actor-class' }
            owners = (@($owners | ForEach-Object {
                if ($_.character_name) { [string]$_.character_name } else { "Unresolved controller $($_.player_id)" }
            }) -join ', ')
            ownership_status = $ownership
            permissions = @($permissions)
            module_count = [int](ConvertTo-DuneInt $row['module_count'])
            recovery_count = $recoveryCount
            recovery_durability = ConvertTo-DuneVehicleNumber $row['recovery_durability']
            backup_count = [int](ConvertTo-DuneInt $row['backup_count'])
            cargo_hold_count = $cargoHolds
            cargo_stack_count = [int](ConvertTo-DuneInt $row['cargo_stack_count'])
            cargo_max_item_count = ConvertTo-DuneVehicleNumber $row['cargo_max_item_count']
            cargo_max_item_volume = ConvertTo-DuneVehicleNumber $row['cargo_max_item_volume']
            target_revision = $revision
            deletion_blocked_reason = if ($blockedState.Count -gt 0) {
                "Vehicle is in $($blockedState -join ', '). Finish travel or recovery in-game before queuing removal."
            } elseif ($ownership -eq 'ambiguous' -or $invalidRoster -or $recoveryCount -gt 1 -or
                $cargoHolds -gt 1 -or $cargoConflicts -gt 0 -or $closureOwnerConflicts -gt 0) {
                'Ownership, recovery, or cargo scope is ambiguous. Resolve it in-game before queuing removal.'
            } else { $null }
        }
    }
    return @{
        ok = $true; vehicles = $vehicles; total = $vehicles.Count; source = 'live'
        observed_at = [datetimeoffset]::UtcNow.ToString('o'); stale_after_seconds = 20
        database_scope = $hostScope.key
    }
}

function Get-DuneVehicleIntegrityLive {
    param([string]$Ip, [long]$VehicleId)
    if ($VehicleId -le 0) { return @{ ok = $false; error = 'vehicle_id is required.' } }
    [void](Get-DuneVehicleHostScope -Ip $Ip)
    $sql = @"
SELECT vm.id::text AS module_id, vm.template_id,
       vm.stats->'FVehicleModuleDurabilityStats'->1->>'CurrentDurability' AS current_durability,
       vm.stats->'FVehicleModuleDurabilityStats'->1->>'MaxDurability' AS max_durability,
       vm.stats->'FVehicleModuleDurabilityStats'->1->>'DecayedMaxDurability' AS decayed_max_durability
FROM dune.vehicle_modules vm
JOIN dune.vehicles v ON v.id = vm.vehicle_id
JOIN dune.actors a ON a.id = v.id
WHERE vm.vehicle_id = $VehicleId::bigint
ORDER BY vm.id
LIMIT 501;
"@
    $result = Invoke-DuneSqlQuery -Ip $Ip -Sql $sql -ReadOnly $true -MaxRows 501 -TimeoutSec 20
    if (-not $result.ok) { return @{ ok = $false; error = $result.error } }
    $rows = ConvertTo-DuneRowMaps -Result $result
    if ($rows.Count -gt 500) { return @{ ok = $false; error = 'Module detail exceeds the 500 module read limit.' } }
    $modules = @($rows | ForEach-Object {
        @{
            id = [string]$_['module_id']
            template_id = [string]$_['template_id']
            current_durability = ConvertTo-DuneVehicleNumber $_['current_durability']
            max_durability = ConvertTo-DuneVehicleNumber $_['max_durability']
            decayed_max_durability = ConvertTo-DuneVehicleNumber $_['decayed_max_durability']
        }
    })
    return @{ ok = $true; modules = $modules; source = 'live'; observed_at = [datetimeoffset]::UtcNow.ToString('o') }
}
