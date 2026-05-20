# Environments

## Local Development

Local development uses:

```text
Next.js local dev server
Python crawler scripts
Supabase Local with Docker
Saved crawler HTML fixtures
```

Purpose:

- Develop schema and migrations safely.
- Run the web app locally.
- Run crawler/parser tests locally.
- Test DB upserts without touching production.

Parser tests should not require Docker when they only read saved fixtures.

## Production

Production uses:

```text
Vercel
Supabase Cloud
GitHub Actions scheduled crawler jobs
```

Purpose:

- Serve the mobile web app.
- Store production data.
- Run scheduled KBO sync jobs.

## Environment Policy

- Use Supabase Local with Docker for development DB.
- Use Supabase Cloud for production DB.
- Do not create dev/prod schemas or prefixed tables inside one Supabase Cloud project.
- Do not write local experiments to production.
- Keep production service-role credentials only in server-side or GitHub Actions secret contexts.

## Secrets

Local development:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Production:

```text
Vercel:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

GitHub Actions:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.

## Deployment Flow

Planned flow:

```text
Local Supabase migration
→ Local app/crawler verification
→ Apply migration to Supabase Cloud
→ Deploy web to Vercel
→ Run/enable GitHub Actions crawler schedules
```

