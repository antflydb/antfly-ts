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

// Re-export the generated types for advanced users
export type { components, operations, paths } from "./antfly-api.js";
export type { components as bleve_components } from "./bleve-query.js";
// Main client export
export { AntflyClient } from "./client.js";
// Query helper functions
export {
  boolean,
  conjunction,
  dateRange,
  disjunction,
  docIds,
  fuzzy,
  geoBoundingBox,
  geoDistance,
  match,
  matchAll,
  matchNone,
  matchPhrase,
  numericRange,
  prefix,
  queryString,
  term,
} from "./query-helpers.js";
// Type exports
export type {
  // Answer Agent types
  AnswerAgentRequest,
  AnswerAgentResult,
  AnswerAgentStreamCallbacks,
  AnswerConfidence,
  // Configuration
  AntflyConfig,
  // Error type
  AntflyError,
  AntflyType,
  // Backup/Restore types
  BackupRequest,
  BatchRequest, // Now using our custom type
  // Chat Agent types
  ChatAgentRequest,
  ChatAgentResult,
  ChatAgentSteps,
  ChatAgentStreamCallbacks,
  ChatMessage,
  ChatMessageRole,
  ChatToolCall,
  ChatToolName,
  ChatToolResult,
  ChatToolsConfig,
  ClarificationRequest,
  ClassificationTransformationResult,
  CreateTableRequest,
  CreateUserRequest,
  // Schema types
  DocumentSchema,
  // Model and reranker types
  EmbedderConfig,
  EmbedderProvider,
  // Search and facet types
  FacetOption,
  FacetResult,
  FetchConfig,
  FilterSpec,
  GeneratorConfig,
  GeneratorProvider,
  // Index types
  IndexConfig,
  IndexStatus,
  Permission,
  PermissionType,
  // Query Builder Agent types
  QueryBuilderRequest,
  QueryBuilderResult,
  QueryHit,
  QueryOptions,
  QueryRequest,
  // Core types
  QueryResponses,
  QueryResult,
  QueryStrategy,
  // RAG types
  RAGRequest,
  RAGResult,
  RAGStreamCallbacks,
  RerankerConfig,
  ResourceType,
  // Utility type for response data
  ResponseData,
  RestoreRequest,
  RouteType,
  SemanticQueryMode,
  SummarizeResult,
  // Table types
  Table,
  TableSchema,
  TableStatus,
  TermFacetResult,
  UpdatePasswordRequest,
  // User and permission types
  User,
  // Web search types
  WebSearchConfig,
  WebSearchResultItem,
} from "./types.js";
export { embedderProviders, generatorProviders } from "./types.js";

// Default export for convenience
import { AntflyClient } from "./client.js";
export default AntflyClient;
