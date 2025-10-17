/**
 * Type exports and utilities for the Antfly SDK
 * Re-exports commonly used types from the generated OpenAPI types
 */

import type { components, operations } from "./antfly-api.js";
import type { components as BleveComponents } from "./bleve-query.js";

// Bleve Query type for type-safe query construction
export type BleveQuery = BleveComponents["schemas"]["Query"];

// Export individual Bleve query types for convenience
export type TermQuery = BleveComponents["schemas"]["TermQuery"];
export type MatchQuery = BleveComponents["schemas"]["MatchQuery"];
export type MatchPhraseQuery = BleveComponents["schemas"]["MatchPhraseQuery"];
export type PhraseQuery = BleveComponents["schemas"]["PhraseQuery"];
export type MultiPhraseQuery = BleveComponents["schemas"]["MultiPhraseQuery"];
export type FuzzyQuery = BleveComponents["schemas"]["FuzzyQuery"];
export type PrefixQuery = BleveComponents["schemas"]["PrefixQuery"];
export type RegexpQuery = BleveComponents["schemas"]["RegexpQuery"];
export type WildcardQuery = BleveComponents["schemas"]["WildcardQuery"];
export type QueryStringQuery = BleveComponents["schemas"]["QueryStringQuery"];
export type NumericRangeQuery = BleveComponents["schemas"]["NumericRangeQuery"];
export type TermRangeQuery = BleveComponents["schemas"]["TermRangeQuery"];
export type DateRangeStringQuery = BleveComponents["schemas"]["DateRangeStringQuery"];
export type BooleanQuery = BleveComponents["schemas"]["BooleanQuery"];
export type ConjunctionQuery = BleveComponents["schemas"]["ConjunctionQuery"];
export type DisjunctionQuery = BleveComponents["schemas"]["DisjunctionQuery"];
export type MatchAllQuery = BleveComponents["schemas"]["MatchAllQuery"];
export type MatchNoneQuery = BleveComponents["schemas"]["MatchNoneQuery"];
export type DocIdQuery = BleveComponents["schemas"]["DocIdQuery"];
export type BoolFieldQuery = BleveComponents["schemas"]["BoolFieldQuery"];
export type IPRangeQuery = BleveComponents["schemas"]["IPRangeQuery"];
export type GeoBoundingBoxQuery = BleveComponents["schemas"]["GeoBoundingBoxQuery"];
export type GeoDistanceQuery = BleveComponents["schemas"]["GeoDistanceQuery"];
export type GeoBoundingPolygonQuery = BleveComponents["schemas"]["GeoBoundingPolygonQuery"];
export type GeoShapeQuery = BleveComponents["schemas"]["GeoShapeQuery"];
export type Boost = BleveComponents["schemas"]["Boost"];
export type Fuzziness = BleveComponents["schemas"]["Fuzziness"];

// Request/Response types - Override with proper Bleve query types
export type QueryRequest = Omit<
  components["schemas"]["QueryRequest"],
  "full_text_search" | "filter_query" | "exclusion_query"
> & {
  /** Full JSON Bleve search query with proper type checking */
  full_text_search?: BleveQuery;
  /** Full JSON Bleve filter query with proper type checking */
  filter_query?: BleveQuery;
  /** Full JSON Bleve exclusion query with proper type checking */
  exclusion_query?: BleveQuery;
};
export type QueryResult = components["schemas"]["QueryResult"];
export type QueryHit = components["schemas"]["QueryHit"];
export type QueryResponses = components["schemas"]["QueryResponses"];

// Fix BatchRequest to allow any object for inserts
export interface BatchRequest {
  inserts?: Record<string, unknown>;
  deletes?: string[];
}

// Table types
export type Table = components["schemas"]["Table"];
export type CreateTableRequest = components["schemas"]["CreateTableRequest"];
export type TableSchema = components["schemas"]["TableSchema"];
export type TableStatus = components["schemas"]["TableStatus"];

// Index types
export type IndexConfig = components["schemas"]["IndexConfig"];
export type IndexStatus = components["schemas"]["IndexStatus"];

// User and permission types
export type User = components["schemas"]["User"];
export type CreateUserRequest = components["schemas"]["CreateUserRequest"];
export type UpdatePasswordRequest = components["schemas"]["UpdatePasswordRequest"];
export type Permission = components["schemas"]["Permission"];
export type ResourceType = components["schemas"]["ResourceType"];
export type PermissionType = components["schemas"]["PermissionType"];

// Backup/Restore types
export type BackupRequest = components["schemas"]["BackupRequest"];
export type RestoreRequest = components["schemas"]["RestoreRequest"];

// Schema types
export type DocumentSchema = components["schemas"]["DocumentSchema"];

// Search and facet types
export type FacetOption = components["schemas"]["FacetOption"];
export type FacetResult = components["schemas"]["FacetResult"];
export type TermFacetResult = components["schemas"]["TermFacetResult"];
export type AntflyType = components["schemas"]["AntflyType"];

// Model and reranker types
export type ModelConfig = components["schemas"]["ModelConfig"];
export type RerankerConfig = components["schemas"]["RerankerConfig"];
export type Provider = components["schemas"]["Provider"];
export const providers: components["schemas"]["Provider"][] = [
  "ollama",
  "gemini",
  "openai",
  "bedrock",
];

// Error type
export type AntflyError = components["schemas"]["Error"];

// Utility type for extracting response data
export type ResponseData<T extends keyof operations> = operations[T]["responses"] extends {
  200: infer R;
}
  ? R extends { content: { "application/json": infer D } }
    ? D
    : never
  : never;

// Configuration types for the client
export interface AntflyConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  auth?: {
    username: string;
    password: string;
  };
}

// Helper type for query building with proper Bleve query types
export interface QueryOptions {
  table?: string;
  fullTextSearch?: BleveQuery;
  semanticSearch?: string;
  limit?: number;
  offset?: number;
  fields?: string[];
  orderBy?: Record<string, boolean>;
  facets?: Record<string, FacetOption>;
}
