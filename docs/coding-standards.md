# Coding Standards

## Baseline

All TypeScript should follow the existing project style in [Code Style Guide](code-style.md):

- strict TypeScript
- explicit public APIs on classes
- private fields/methods prefixed with `_`
- constructor injection for systems/services
- narrow Babylon imports
- Prettier formatting

## Testing Requirement

Every TypeScript change must include unit test coverage unless the change is documentation-only.

Required checks before considering work complete:

```bash
npm run typecheck
npm run test:coverage
npm run build
```

Coverage is enforced at **100%** for:

- statements
- branches
- functions
- lines

Coverage applies to `src/**/*.ts` and excludes dependencies such as `node_modules`.

## Test Design Guidelines

- Prefer unit tests for pure domain logic and data-layer code.
- Use mocks/fakes for Babylon engine objects where real rendering is not necessary.
- Keep database access behind repository interfaces so data behavior can be tested with in-memory repositories.
- Cover error/fallback branches, not just happy paths.
- If a new branch is added, add a test for both sides of the branch.

## Pull Request / Change Expectations

A change is not complete until:

1. Code is formatted.
2. TypeScript passes.
3. Unit tests pass.
4. Coverage remains at 100%.
5. The build succeeds.
