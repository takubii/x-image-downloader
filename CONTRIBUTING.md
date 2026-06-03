# Contributing

## Commit Messages

Use Conventional Commits for all commits.

Format:

```text
type(scope): summary
```

Examples:

```text
feat(content): add per-image save state
fix(content): hide save button when image leaves hover
refactor(content): split image visibility checks
test(shared): cover filename sanitization
docs: add contribution guidelines
ci: run checks on pull requests
chore(deps): update development dependencies
```

Common types:

- `feat`: user-visible feature
- `fix`: bug fix
- `refactor`: behavior-preserving code change
- `test`: test-only change
- `docs`: documentation-only change
- `ci`: CI workflow change
- `build`: build or packaging configuration
- `chore`: maintenance that does not fit the other types

Keep the summary short, imperative, and specific. Use a scope when it clarifies the affected area, such as `content`, `background`, `shared`, `options`, `ci`, or `deps`.

For breaking changes, add a footer:

```text
BREAKING CHANGE: describe the migration impact
```

## Change Scope

Keep commits focused. Prefer separate commits for unrelated code, tests, documentation, tooling, and dependency changes.

Do not commit generated build output unless it is explicitly requested.

## Verification

Before committing, run the checks that match the change:

- TypeScript changes: `pnpm type`
- Source or test changes: `pnpm lint`
- Formatting-sensitive changes: `pnpm format:check`
- Behavior changes: `pnpm test`
- Extension behavior changes: `pnpm build`

For browser behavior, load `dist/` in Chrome or Edge with Developer mode enabled and verify the affected flow manually.
