# Local Supabase Docker And Production Cloud

## Status

Accepted

## Date

2026-05-20

## Context

The project uses Supabase, but the free tier has a limited number of active projects. The user already has another Supabase project, so keeping separate cloud `dev` and `prod` projects may not be practical. The project will continue development after launch, so experiments against production data should be avoided.

## Options

- Use two Supabase Cloud projects: `dev` and `prod`.
- Use one Supabase Cloud project and treat it as both dev and prod until launch.
- Use Supabase Local with Docker for development and Supabase Cloud for production.
- Split dev/prod inside one Supabase project using schemas or prefixes.

## Decision

Use Supabase Local with Docker for development and Supabase Cloud for production.

Local development:

- Next.js runs locally.
- Python crawler runs locally.
- Supabase Local runs through Docker.
- Parser tests should still work from saved fixtures without DB or Docker.
- DB integration/upsert tests can use the local Supabase database.

Production:

- Vercel hosts the web app.
- Supabase Cloud hosts the production database.
- GitHub Actions runs scheduled crawler jobs against Supabase Cloud.

Do not use one Supabase Cloud project with dev/prod schemas or table prefixes.

## Consequences

- Production data stays safer after launch.
- The project can stay within the free cloud project limit more easily.
- Docker becomes part of the local development path.
- Migrations and seed data must work cleanly against Supabase Local before being applied to production.
- Supabase Local and Supabase Cloud differences should be watched during setup and release.

