# TTL on the per-project states and labels caches

## Motivation

`StatesService` and `LabelsService` cache their lists **without a TTL**
(`cache.set(key, value)` with no expiry), so once a project's states/labels are
cached they are served until `plc cache clear` runs. A state or label created in
Plane after the first fetch never shows up in the pickers — a confusing "where's
my new label?" that we already hit once (the poisoned-empty-users incident is the
same class of stale-cache surprise). A short TTL fixes it with one argument.

## Design

- Cache states and labels with a **bounded TTL** instead of forever, matching the
  issues page cache which already uses a TTL (`cache.set(key, issues, 60)`).
- Pick a sensible default (e.g. 300s, the profile's `cache.ttl`) — long enough to
  keep the pickers snappy within a session, short enough that a freshly-created
  state/label appears without a manual clear. Prefer reusing the configured
  `cache.ttl` so it is tunable rather than a new magic number.
- This also bounds the assignee/members and projects caches if we choose to apply
  the same rule there; scope this item to states + labels, and note the others as
  a follow-up if they prove stale in practice.

## Implementation sketch

- Thread the effective TTL into `StatesService` / `LabelsService` (constructor or
  the `set` call) and pass it to `cache.set(key, value, ttl)`.
- Confirm the value comes from the profile `cache.ttl` (already in config) rather
  than a hardcoded constant, falling back to a documented default.
- Update the tests to assert the TTL is passed (the memory store already honours
  expiry, so a clock-advance test proves re-fetch after expiry).

## Acceptance checklist

- [ ] States and labels are cached with a finite TTL, not forever.
- [ ] After the TTL expires, the next list re-fetches (a new state/label appears
      without `plc cache clear`).
- [ ] The TTL derives from the configured `cache.ttl` (tunable), with a default.
- [ ] Tests: a clock-advanced cache shows expiry → re-fetch for both services.

## References

- `src/plane/states.ts`, `src/plane/labels.ts` — the `cache.set` calls to bound.
- `src/plane/work-items.ts` — `cache.set(key, issues, 60)`, the TTL precedent.
- `src/cache/memory.ts` — honours `ttlSeconds` + a `now()` clock for testing.
