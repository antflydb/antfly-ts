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
  AggregationBucket,
  AggregationDateRange,
  AggregationRange,
  AggregationRequest,
  AggregationResult,
  // Search and aggregation types
  AggregationType,
  AnswerConfidence,
  // Configuration
  AntflyConfig,
  // Error type
  AntflyError,
  AntflyType,
  // Backup/Restore types
  BackupRequest,
  BatchRequest, // Now using our custom type
  CalendarInterval,
  // Chat types (used by retrieval agent)
  // Retrieval Agent result types
  Citation,
  CitationStyle,
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
  DistanceRange,
  DistanceUnit,
  // Schema types
  DocumentSchema,
  // Graph index types
  Edge,
  EdgeDirection,
  EdgesResponse,
  EdgeTopology,
  EdgeTypeConfig,
  // Model and reranker types
  EmbedderConfig,
  EmbedderProvider,
  // Eval types
  EvalConfig,
  EvalResult,
  EvalScores,
  EvalSummary,
  EvaluatorName,
  EvaluatorScore,
  FetchConfig,
  FilterSpec,
  GeneratorConfig,
  GeneratorProvider,
  GraphIndexV0Config,
  GraphNodeSelector,
  GraphQuery,
  GraphQueryParams,
  GraphQueryResult,
  GraphQueryType,
  GraphResultNode,
  // Index types
  IndexConfig,
  IndexStatus,
  IndexType,
  // Join types
  JoinClause,
  JoinCondition,
  JoinFilters,
  JoinOperator,
  JoinResult,
  JoinStrategy,
  JoinType,
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
  RerankerConfig,
  ResourceType,
  // Retrieval Agent types
  RetrievalAgentRequest,
  RetrievalAgentResult,
  RetrievalAgentSteps,
  RetrievalAgentStreamCallbacks,
  // Utility type for response data
  ResponseData,
  RestoreRequest,
  RouteType,
  SemanticQueryMode,
  SignificanceAlgorithm,
  // Table types
  Table,
  TableSchema,
  TableStatus,
  TraversalResult,
  TraversalRules,
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
