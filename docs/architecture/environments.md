# Environments

## Local Development

Local development uses:

```text
Apps in Toss WebView local dev server
Apps in Toss sandbox app
Python crawler scripts
Supabase Local with Docker
Saved crawler HTML fixtures
```

Purpose:

- Develop schema and migrations safely.
- Run the mini app locally in browser for fast checks.
- Test the mini app in the Apps in Toss sandbox app for platform-real WebView behavior.
- Run crawler/parser tests locally.
- Test DB upserts without touching production.

Parser tests should not require Docker when they only read saved fixtures.

## Production

Production uses:

```text
Apps in Toss mini app bundle
Supabase Cloud
GitHub Actions scheduled crawler jobs
Server/API hosting where server-only access or Apps in Toss mTLS is required
```

Purpose:

- Serve the mini app inside Toss.
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
Apps in Toss mini app:
- public client-safe config only

Server/API hosting:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- Apps in Toss server certificates/keys when required

GitHub Actions:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.

## Deployment Flow

Planned flow:

```text
Local Supabase migration
→ Local mini app/browser verification
→ Apps in Toss sandbox verification
→ Apply migration to Supabase Cloud
→ Build Apps in Toss mini app bundle
→ Upload/test through Toss app
→ Run/enable GitHub Actions crawler schedules
```
