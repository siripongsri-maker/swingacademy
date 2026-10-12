# Database rules tests

`research-rules.test.mjs` checks the CVSK research rules (consent registry, capture sessions, raw-audio access, the collection lock) on a real Postgres that runs in memory ([PGlite](https://pglite.dev)). It never touches the live database.

Run it from the repo root:

```bash
cd supabase/tests && npm install --no-package-lock && npm test
```

It loads the research section and `audit_events` from `20261011120000`, then `20261012150000`, then `20261012180000` twice (the second run proves the migration is safe to run twice), and checks each rule as the database role the app uses (`authenticated` with a user id, `service_role`, `anon`). Supabase's own pieces (`auth.uid()`, `auth.users`, `user_roles`/`has_role`, `storage.buckets`) are small stand-ins. The script exits with code 1 if any check fails.

When a new research migration changes these rules, add it to the loader at the top of the script and add checks for the new behaviour.
