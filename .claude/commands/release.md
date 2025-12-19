# Release Package

Release one or more npm packages from this monorepo.

## Arguments

- `$ARGUMENTS` - Package(s) to release: "sdk", "components", or "both"

## Workflow

1. **Determine packages to release** from arguments (default: ask user)

2. **For each package**, in order (SDK first if both):

   a. Read current version from `packages/{pkg}/package.json`

   b. Check npm registry for latest published version

   c. If current version is already published, bump patch version

   d. Build and test the package:
      - SDK: `pnpm --filter @antfly/sdk run build && pnpm --filter @antfly/sdk run test`
      - Components: `pnpm --filter @antfly/components run build && pnpm --filter @antfly/components run test`

   e. Track the version for tagging

3. **Commit version bumps** (if any):
   ```
   git add packages/*/package.json
   git commit -m "Release {package versions}"
   ```

4. **Push commit**:
   ```
   git push
   ```

5. **Create and push tags** (SDK first, then components):
   - SDK: `git tag sdk-v{version} && git push origin sdk-v{version}`
   - Components: `git tag components-v{version} && git push origin components-v{version}`

   **Important**: If releasing both packages, push SDK tag first and wait for user confirmation before pushing components tag (components depends on SDK).

6. **Report** the GitHub Actions URL for monitoring: `https://github.com/antflydb/antfly-ts/actions`

## Package Details

| Package | Directory | npm Name | Tag Pattern |
|---------|-----------|----------|-------------|
| SDK | `packages/sdk` | `@antfly/sdk` | `sdk-v*` |
| Components | `packages/components` | `@antfly/components` | `components-v*` |

## Notes

- Publishing is handled by GitHub Actions on tag push (see `.github/workflows/npm-publish.yml`)
- Uses npm Trusted Publishing (OIDC) - no secrets required
- Components has a peer dependency on SDK, so SDK must be published first when releasing both
