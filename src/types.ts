/**
 * Type exports and utilities for the Antfly SDK
 * Re-exports commonly used types from the generated OpenAPI types
 */

import type { components, operations } from "./antfly-api.js";

// Request/Response types
export type QueryRequest = components["schemas"]["QueryRequest"];
export type QueryResult = components["schemas"]["QueryResult"];
export type QueryHit = components["schemas"]["QueryHit"];

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
export type CreateIndexRequest = components["schemas"]["CreateIndexRequest"];

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
export type ValueType = components["schemas"]["ValueType"];
export type ValueSchema = components["schemas"]["ValueSchema"];
export type DocumentSchema = components["schemas"]["DocumentSchema"];

// Search and facet types
export type FacetOption = components["schemas"]["FacetOption"];
export type FacetResult = components["schemas"]["FacetResult"];

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

// Helper type for query building
export interface QueryOptions {
  table?: string;
  fullTextSearch?: Record<string, unknown>;
  semanticSearch?: string;
  limit?: number;
  offset?: number;
  fields?: string[];
  orderBy?: Record<string, boolean>;
  facets?: Record<string, FacetOption>;
}
