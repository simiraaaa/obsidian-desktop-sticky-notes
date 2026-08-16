# Project agent instructions

## Working approach

- Read the project documentation and existing code before making changes.
- Preserve established architecture and conventions unless the task explicitly requires changing them.
- Keep changes focused on the requested outcome.
- Do not modify unrelated files or overwrite existing user changes.
- Make small, coherent, incremental commits as work progresses.
- Do not push commits or branches to a remote.
- Do not GPG-sign commits. If signing is enabled by Git configuration, disable it only for the individual commit command; do not change or disable the user's global GPG-signing configuration.
- Prefer simple, maintainable solutions over unnecessary abstractions.
- Verify changes with the project's documented lint, test, type-check, and build commands as appropriate.
- Report which checks were run and disclose any checks that could not be completed.

## Code readability

- Structure and author code so that a human reader can understand it without unnecessary effort.
- Use clear names, cohesive functions, explicit control flow, and logical module boundaries.
- Add ample comments where they improve readability, especially around intent, invariants, security assumptions, non-obvious decisions, edge cases, and external constraints.
- Comments should explain why the code exists or behaves a certain way rather than merely restating the syntax.
- Keep comments accurate when changing the surrounding code.

## Independent review

- For every non-trivial change, spawn a blind review agent with no prior conversation or project context.
- Give the blind reviewer only the task requirements and the resulting files or diff needed for review; do not provide the implementing agent's reasoning or conclusions.
- Ask the reviewer to independently assess correctness and completeness; human readability and maintainability; security and privacy risks; scalability and performance implications; and missing tests, regressions, and edge cases.
- Address valid findings before completing the task.
- Report the reviewer's material findings and how they were resolved.
- If a blind review agent cannot be started, disclose that limitation explicitly instead of implying that independent review occurred.

## Documentation

- When starting work in a new project, create a project-root `AGENTS.md` and copy the applicable global agent rules into it before adding project-specific instructions. If the project already provides an `AGENTS.md`, preserve its instructions and add any missing applicable global rules.
- Treat project documentation as living documentation.
- Update affected documentation when behavior, APIs, configuration, security boundaries, or operational requirements change.
- Preserve accepted architectural decisions and their history.
- When replacing an accepted decision, add or update an architectural decision record instead of silently contradicting the existing one.
- Keep detailed product documentation in the appropriate documentation files; reserve `AGENTS.md` for durable workflow rules and invariants.

## Security and privacy

- Scope access to the authenticated user, active project, and authorized workspace.
- Do not reveal whether resources owned by another user exist.
- Never store or expose secrets, credentials, access tokens, encryption keys, or sensitive personal information in source files, plain configuration, logs, audit metadata, test fixtures, or responses.
- Do not print environment variables or credential-bearing configuration during diagnostics.
- Audit metadata may contain identifiers and policy context, but must not contain raw credentials, private content, media bytes, or complete command output.
- Preserve authentication, authorization, validation, and audit boundaries across every entry point to the same capability.
- Keep privileged and high-impact capabilities default-deny unless the project explicitly specifies otherwise.
- Do not weaken security controls merely to make a test pass.
- Treat development-only authentication and bypass mechanisms as unsafe for production.
- Clearly document temporary trust boundaries or missing isolation.

## Filesystem and command safety

- Keep filesystem and command operations within the authorized project workspace.
- Reject or carefully validate absolute paths, parent traversal, symlinks, and paths that resolve outside the workspace.
- Never write through an untrusted symlink.
- Keep command execution permission-gated, time-bounded, output-bounded, and supplied with a minimal environment.
- Do not claim that a process is sandboxed unless process, filesystem, and network isolation are actually enforced.
- Avoid destructive commands when a recoverable alternative is available.
- Confirm exact targets before deleting or overwriting material data.

## Configuration

- Preserve the project's documented configuration precedence.
- Keep deployment-owner or environment-locked settings read-only to lower-precedence configuration layers.
- Keep ordinary settings separate from secrets.
- Do not write secrets back to plain configuration files.
- Do not reveal stored secret values after saving them.
- Prefer explicit configuration sources and validation errors over silent fallback behavior.

## External services and providers

- Keep service identity, authentication profile, model or resource selection, and runtime implementation as separate concepts.
- Use stable canonical identifiers.
- Make integrations explicitly advertise their supported capabilities.
- Reject unsupported inputs instead of silently dropping or misrepresenting them.
- Normalize external-service errors without exposing sensitive request or response contents.
- Validate network destinations and reject URLs containing embedded credentials or targeting prohibited networks.

## User data and memory

- Do not silently persist long-term user facts, project knowledge, or conversation summaries.
- Require explicit user intent or an enabled project policy before storing durable memory.
- Scope retrieval by the active user and project context.
- Make policy-relevant storage and retrieval auditable.
- Preserve user controls for viewing, deleting, and disabling stored data.

## Dependencies

- Reuse existing dependencies and project utilities when practical.
- Ask before adding a new production dependency unless the request clearly requires it.
- Avoid changing lockfiles unless dependency resolution or the requested change requires it.
- Explain the purpose and tradeoffs of any new production dependency.

## User interfaces

- Preserve accessibility, keyboard interaction, and existing navigation behavior.
- Prefer non-blocking, inline confirmation for ordinary destructive UI actions.
- Render untrusted rich text safely; do not enable raw HTML without an explicit requirement and appropriate sanitization.
- Use the project's design tokens and established component patterns.
- Verify meaningful visual changes in the running interface when suitable tooling is available.
