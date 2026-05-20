# Codex Project Operation

## Status

Accepted

## Context

The project will be developed with Codex as a long-running collaborator across planning, implementation, review, and reporting. Work may happen across multiple sessions or machines, so project-specific Codex files should live in the repository.

## Decision

- Keep `AGENTS.md`, `docs/codex/`, and `.codex/skills/` versioned.
- Do not ignore `.codex/` for this repository.
- Use a spec-driven workflow for meaningful work.
- Use subagents selectively for product, backend, frontend, crawler, code review, and QA perspectives.
- Use the code review agent mindset for maintainability, type safety, domain modeling, and testability.

## Consequences

- Project operation rules travel with the repo.
- Codex can resume consistently across sessions.
- The repository includes process files, not only app source.
- The team should keep docs concise so process does not become overhead.
