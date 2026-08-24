# Weekly snapshot

A snapshot is a full, read-only dump of every table to one timestamped JSON
file. It is the safety net: if a migration, a bulk edit, or a bad admin action
damages data, the snapshot is what the correct values get read back out of.

## Take one

```bash
cd "GSD Sessions/Georges Predictor"
npx tsx scripts/snapshot.ts
```

Add a label when you are about to change something, so the file says what it
was taken before:

```bash
npx tsx scripts/snapshot.ts --label pre-favourite-club
```

Output lands in `scripts/_backups/snapshot-<ISO>[-<label>].json`.

## When to take one

- **Before every migration**, bulk script, or season reset. Always.
- **Once a week during the season.** Sunday evening, after the weekend
  fixtures have settled, is the natural slot — that is the point at which a
  week's predictions and scores exist and would be painful to lose.

Roughly 36 MB per snapshot at 50 members. Cheap to keep, so keep them.

## What it captures

All 30 tables the app owns, currently ~82,500 rows. The list lives in
`TABLES` in `scripts/snapshot.ts`.

**Keep that list current.** When a migration adds a table, add it to `TABLES`
in the same change. A table missing from the list is silently absent from every
backup, which is the one failure mode a snapshot must not have. The script
reports anything it cannot read as `SKIPPED` rather than passing over it
quietly, so re-read the tail of the output — a new `SKIPPED` line means either
a table was renamed or the list has drifted.

The snapshot does **not** capture Supabase Auth users, storage objects, RLS
policies, or schema. It is row data only. Schema lives in
`supabase/migrations/`, which is what git is for.

## Restoring

Deliberately not automated. A blind full restore would wipe out every
legitimate prediction, score, and signup that happened after the snapshot was
taken, which is usually far worse than the problem being fixed.

To roll something back:

1. Open the snapshot JSON and find the affected rows under `tables.<name>`.
2. Work out the narrowest possible fix — usually a handful of rows, not a table.
3. Write a small script (see `scripts/` for the idiom: load `.env.local`, use
   the service role, print before and after) or a migration if it is schema.
4. **Take a fresh snapshot first**, labelled, so the repair itself is reversible.
5. Verify by re-reading the rows, not by assuming the write worked.

## Related

- `scripts/backup-2025-26-season.ts` — the older, season-scoped predecessor.
  `snapshot.ts` supersedes it; it covers every table rather than a fixed list
  and does not assume a season boundary.
- `PICKUP.md` — the migration workflow. DDL has to be pasted into the Supabase
  SQL editor by hand; DML can go through the service role from a script.
