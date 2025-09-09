/**
 * Antfly SDK for TypeScript
 *
 * A TypeScript SDK for interacting with the Antfly API, suitable for both
 * frontend and backend applications.
 *
 * @example
 * ```typescript
 * import { AntflyClient } from '@antfly/sdk';
 *
 * const client = new AntflyClient({
 *   baseUrl: 'http://localhost:8080',
 *   auth: {
 *     username: 'admin',
 *     password: 'password'
 *   }
 * });
 *
 * // Query data
 * const results = await client.query({
 *   table: 'products',
 *   limit: 10
 * });
 *
 * // Create a table
 * await client.tables.create('products', {
 *   num_shards: 3,
 *   schema: {
 *     key: 'id',
 *     default_type: 'product'
 *   }
 * });
 * ```
 */

// Main client export
export { AntflyClient } from "./client.js";

export { providers } from "./types.js";

// Type exports
export type {
  // Configuration
  AntflyConfig,
  QueryOptions,

  // Core types
  QueryRequest,
  QueryResult,
  QueryHit,
  BatchRequest, // Now using our custom type

  // Table types
  Table,
  CreateTableRequest,
  TableSchema,
  TableStatus,

  // Index types
  IndexConfig,
  IndexStatus,
  CreateIndexRequest,

  // User and permission types
  User,
  CreateUserRequest,
  UpdatePasswordRequest,
  Permission,
  ResourceType,
  PermissionType,

  // Backup/Restore types
  BackupRequest,
  RestoreRequest,

  // Schema types
  ValueType,
  ValueSchema,
  DocumentSchema,

  // Search and facet types
  FacetOption,
  FacetResult,

  // Model and reranker types
  ModelConfig,
  RerankerConfig,
  Provider,

  // Error type
  AntflyError,

  // Utility type for response data
  ResponseData,
} from "./types.js";

// Re-export the generated types for advanced users
export type { paths, components, operations } from "./antfly-api.js";

// Default export for convenience
import { AntflyClient } from "./client.js";
export default AntflyClient;
