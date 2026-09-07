# Vehicle Lifecycle

The Vehicles workspace reads the authoritative game database, including unclaimed
vehicles. Its observation time describes a database read, **not** live game memory:
the running game may not have persisted its latest changes.

## Fleet, integrity and cargo

- Vehicle membership requires `dune.vehicles.id = dune.actors.id`, not a class-name
  guess. Subtypes use exact DST vehicle-catalog class matches; unknown classes stay
  visible as unknown catalog subtypes.
- Only persisted rank **1** is an Owner. Rank **2** is Co-Owner and **3** is
  Associate. Names resolve through the exact player-controller identity. Multiple
  owners, unresolved identities and unknown ranks are not silently repaired.
- Inspect shows persisted module durability, recovery chassis durability and
  recovery/backup record counts. Missing values mean **not reported**, not healthy.
- Cargo uses the vehicle's single actor-owned inventory with `inventory_type = 0`.
  NULL-type component holds, player backpacks and unrelated placeables are excluded.
  Multiple or conflicting cargo holds fail closed. Cargo is per vehicle, not per
  module. Capacity is the hold's persisted item-count and volume limits.
- Cargo reuses the Shared Inventory Explorer with exact vehicle scopes and
  canonical owner filters. It is read-only even for administrators. Vehicle
  queries bypass the player/storage cache, so an older cache cannot masquerade as
  an empty cargo hold. Existing player/storage browsing and refresh are unchanged.

## Guarded removal

Queue, cancel, queue history and processing are host-local. Remote authorized
viewers can still inspect fleet, integrity and cargo independently.

Queuing requires `DELETE <actor ID>` and a fresh matching target snapshot. The
snapshot binds the current host/namespace identity, actor, permission roster,
installed modules, recovery ownership and complete actor-owned inventory contents.
Processing requires `RESTART AND DELETE` plus the exact reviewed queue revision.
Legacy entries without this binding must be cancelled and queued again.

Before disruption, every target is re-read. Travel, VehicleBackup, VehicleRecovery
and ambiguous ownership/cargo are refused. A uniquely named full database safety
backup must succeed and be found on disk with a nontrivial byte count; its recovery
path is retained with the queue outcome.

DST then stops the battlegroup. Every target requires a fresh matching namespace,
an explicit Stopped phase, and no connected DuneSandbox database sessions. The
transaction locks the structural vehicle, rechecks protected states and the exact
snapshot, calls the game's permission cleanup before actor deletion, and verifies
dependent records before commit. It checks game sessions again before commit and
performs a separate strict postflight read. Failures remain visible; completed
outcomes are persisted before restart. Restart is attempted even if the stop or
delete operation fails.

Use this window without concurrent external battlegroup controls. DST serializes
its HTTP maintenance admission and queue operations, but does not control an
independent operator's shell or external orchestration. It never treats a
Kubernetes stop report alone as permission for a live database mutation.

## Deliberate limits

The game permission roster is read-only here. This change does not grant/revoke
permissions, change caps, repair vehicles or introduce online-safe cargo writes.
The reference's Server/GM custodian is a provisioned game identity and ownership
transfer, not a harmless DST-local label. DST has no matching custodian metadata
mechanism; no policy store or inferred game access is created.

## Provenance

Vehicle Lifecycle is based on the approved
[Red-Blink MIT reference](https://github.com/Red-Blink/dune-awakening-selfhost-docker),
baseline `16e4b01a4a9d7cac8025c1f8d4a5c601c9cff316`, specifically its vehicle
storage, permissions and deletion model. This implementation is independently
written using DST's own helpers and UI; it does not vendor reference code or
private research data.

The bounded upstream comparison through
`627121a0490dcac2fe620a56880a8880a0618f93` confirmed the same cargo/rank model.
Fresh per-entry safety observations and explicit outcomes follow the later
restart-queue guidance. DST deliberately does **not** adopt upstream's
`allowBlockedState` deletion bypass or background retry architecture.
