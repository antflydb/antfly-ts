# Changelog

All notable changes to the Antfly TypeScript SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- GitHub issue templates for bug reports and feature requests
- Changelog file to track version history

## [0.1.0] - 2024-01-XX

### Added
- Initial release of the Antfly TypeScript SDK
- Full TypeScript support with auto-generated types from OpenAPI spec
- Support for both Node.js and browser environments
- Basic authentication support
- Table operations (list, create, drop, query, batch, backup, restore, lookup)
- Index management (list, get, create, drop)
- User management (create, delete, update password, manage permissions)
- Global query support
- Examples for browser and Node.js usage
- Comprehensive test suite
- CI/CD pipeline with GitHub Actions

### Features
- Type-safe API client using `openapi-fetch`
- Automatic type generation from OpenAPI specification
- Tree-shakeable ES modules
- CommonJS and ESM dual package support
- Zero runtime dependencies (only `openapi-fetch`)

[Unreleased]: https://github.com/antfly/antfly-sdk-ts/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/antfly/antfly-sdk-ts/releases/tag/v0.1.0
