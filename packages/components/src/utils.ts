import type {
  AnswerAgentStreamCallbacks,
  AnswerConfidence,
  ClassificationTransformationResult,
  EvalResult,
  QueryHit,
  RAGStreamCallbacks,
} from "@antfly/sdk";
import {
  type AnswerAgentRequest,
  type AnswerAgentResult,
  AntflyClient,
  type QueryRequest,
  type QueryResponses,
  type RAGRequest,
  type RAGResult,
} from "@antfly/sdk";
import qs from "qs";

export interface MultiqueryRequest {
  query: QueryRequest;
}

let defaultClient: AntflyClient | null = null;

export function initializeAntflyClient(
  url: string,
  headers: Record<string, string> = {}
): AntflyClient {
  defaultClient = new AntflyClient({
    baseUrl: url,
    headers,
  });
  return defaultClient;
}

export function getAntflyClient(): AntflyClient {
  if (!defaultClient) {
    throw new Error("AntflyClient not initialized. Call initializeAntflyClient first.");
  }
  return defaultClient;
}

export async function multiquery(
  url: string,
  msearchData: MultiqueryRequest[],
  headers: Record<string, string> = {}
): Promise<QueryResponses | undefined> {
  try {
    let client = defaultClient;

    if (!client) {
      client = initializeAntflyClient(url, headers);
    }

    const queries = msearchData.map((item) => item.query);
    const result = await client.multiquery(queries);
    return result;
  } catch (error) {
    console.error("Failed to connect to Antfly:", error);

    return {
      responses: msearchData.map(() => ({
        status: 500,
        took: 0,
        error: error instanceof Error ? error.message : "Connection failed",
      })),
    };
  }
}

export function conjunctsFrom(queries?: Map<string, unknown>): Record<string, unknown> {
  if (!queries) return { match_all: {} };
  if (queries.size === 0) return { match_none: {} };
  if (queries.size === 1) return queries.values().next().value as Record<string, unknown>;
  const conjuncts = Array.from(queries.values()).filter(
    (a) => !(a && typeof a === "object" && "match_all" in a && Object.keys(a).length === 1)
  );
  if (conjuncts.length === 0) return { match_all: {} };
  if (conjuncts.length === 1) return conjuncts[0] as Record<string, unknown>;
  return { conjuncts };
}

export function disjunctsFrom(queries?: Array<Record<string, unknown>>): Record<string, unknown> {
  if (!queries) return { match_all: {} };
  if (queries.length === 0) return { match_none: {} };
  if (queries.length === 1) return queries[0];
  const disjuncts = Array.from(queries.values()).filter(
    (a) => !(a && typeof a === "object" && "match_all" in a && Object.keys(a).length === 1)
  );
  if (disjuncts.length === 0) return { match_all: {} };
  if (disjuncts.length === 1) return disjuncts[0] as Record<string, unknown>;
  return { disjuncts };
}

export function toTermQueries(
  fields: string[] = [],
  selectedValues: string[] = []
): Array<Record<string, unknown>> {
  const queries = fields.flatMap((field) =>
    selectedValues.map((value) => {
      return { field, match: value };
    })
  );
  if (queries.length === 0) return [{ match_all: {} }];
  return queries;
}

export function fromUrlQueryString(str = ""): Map<string, unknown> {
  return new Map([
    ...Object.entries(qs.parse(str?.replace(/^\?/, "") || "")).map(([k, v]) => {
      try {
        return [k, typeof v === "string" ? JSON.parse(v) : v] as [string, unknown];
      } catch {
        return [k, v] as [string, unknown];
      }
    }),
  ]);
}

export function toUrlQueryString(params: Map<string, unknown>): string {
  return qs.stringify(
    Object.fromEntries(
      Array.from(params)
        .filter(([, v]) => (Array.isArray(v) ? v.length : v))
        .map(([k, v]) => [k, JSON.stringify(v)])
    )
  );
}

export const defer = (f: () => void): void => {
  queueMicrotask(f);
};

// Table resolution helpers for Option 3 (multi-table support)

/**
 * Normalize table parameter to array format (internal use)
 * Supports future multi-table queries while maintaining backwards compatibility
 */
export function normalizeTable(table?: string | string[]): string[] {
  if (!table) return [];
  return Array.isArray(table) ? table : [table];
}

/**
 * Resolve which table to use for a widget query
 * Priority: widget.table > defaultTable
 * Returns single table for Phase 1 (can be extended to return array in Phase 2)
 */
export function resolveTable(
  widgetTable: string | string[] | undefined,
  defaultTable: string
): string {
  if (widgetTable) {
    // If widget has table override, use it (take first if array)
    const tables = normalizeTable(widgetTable);
    return tables[0] || defaultTable;
  }
  return defaultTable;
}

// RAG-related types and functions
export interface RAGCallbacks {
  onHit?: (hit: QueryHit) => void;
  onSummary?: (chunk: string) => void;
  onComplete?: () => void;
  onError?: (error: Error | string) => void;
  onRAGResult?: (result: RAGResult) => void;
}

/**
 * Stream RAG results from the Antfly /rag endpoint using Server-Sent Events or JSON
 * @param url - Base URL of the Antfly server (e.g., http://localhost:8080/api/v1)
 * @param tableName - Required table name for the RAG query
 * @param request - RAG request containing queries and summarizer config
 * @param headers - Optional HTTP headers for authentication
 * @param callbacks - Structured callbacks for RAG events (hit, summary, citation, complete, error, ragResult)
 * @returns AbortController to cancel the stream
 */
export async function streamRAG(
  url: string,
  tableName: string,
  request: RAGRequest,
  headers: Record<string, string> = {},
  callbacks: RAGCallbacks
): Promise<AbortController> {
  try {
    // Always create a fresh client with the base URL
    // (don't reuse defaultClient as it may have been initialized with a different base URL)
    const client = new AntflyClient({
      baseUrl: url,
      headers,
    });

    // Determine if we should stream based on presence of streaming callbacks
    const shouldStream = !!(callbacks.onHit || callbacks.onSummary);

    // Add table to each query in the queries array
    const queriesWithTable = (request.queries || []).map((query) => ({
      ...query,
      table: tableName,
    }));

    // Build the request with streaming flag and table-enriched queries
    const ragRequest = {
      ...request,
      queries: queriesWithTable,
      with_streaming: shouldStream,
    };

    // Build SDK callbacks if streaming
    const sdkCallbacks: RAGStreamCallbacks | undefined = shouldStream
      ? {
          onHit: callbacks.onHit
            ? (hit: QueryHit) => {
                callbacks.onHit?.(hit);
              }
            : undefined,
          onSummary: callbacks.onSummary
            ? (chunk: string) => {
                callbacks.onSummary?.(chunk);
              }
            : undefined,
          onDone: () => {
            if (callbacks.onComplete) {
              callbacks.onComplete();
            }
          },
          onError: (error: string) => {
            if (callbacks.onError) {
              callbacks.onError(error);
            }
          },
        }
      : undefined;

    // Use global RAG endpoint (table is specified in queries array)
    const result = await client.rag(ragRequest, sdkCallbacks);

    // Handle non-streaming response (RAGResult)
    if (result && typeof result === "object" && "query_result" in result) {
      if (callbacks.onRAGResult) {
        callbacks.onRAGResult(result as RAGResult);
      }
      if (callbacks.onComplete) {
        callbacks.onComplete();
      }
      return new AbortController(); // Return a dummy controller for consistency
    }

    // Handle streaming response (AbortController)
    if (result && typeof result === "object" && "abort" in result) {
      return result as AbortController;
    }

    // Fallback
    if (callbacks.onComplete) {
      callbacks.onComplete();
    }
    return new AbortController();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        // Stream was aborted - this is expected behavior
      } else if (callbacks.onError) {
        callbacks.onError(error);
      }
    } else if (callbacks.onError) {
      callbacks.onError(new Error("Unknown error occurred during RAG streaming"));
    }
    return new AbortController();
  }
}

// Answer Agent-related types and functions
export interface AnswerCallbacks {
  onClassification?: (data: ClassificationTransformationResult) => void;
  onReasoning?: (chunk: string) => void;
  onHit?: (hit: QueryHit) => void;
  onAnswer?: (chunk: string) => void;
  onConfidence?: (data: AnswerConfidence) => void;
  onFollowUpQuestion?: (question: string) => void;
  onEvalResult?: (data: EvalResult) => void;
  onComplete?: () => void;
  onError?: (error: Error | string) => void;
  onAnswerAgentResult?: (result: AnswerAgentResult) => void;
}

/**
 * Stream Answer Agent results from the Antfly /agents/answer endpoint using Server-Sent Events or JSON
 * @param url - Base URL of the Antfly server (e.g., http://localhost:8080/api/v1)
 * @param request - Answer agent request containing query and generator config
 * @param headers - Optional HTTP headers for authentication
 * @param callbacks - Structured callbacks for answer events (classification, keywords, query, hits, reasoning, answer, follow-up, complete, error)
 * @returns AbortController to cancel the stream
 */
export async function streamAnswer(
  url: string,
  request: AnswerAgentRequest,
  headers: Record<string, string> = {},
  callbacks: AnswerCallbacks
): Promise<AbortController> {
  try {
    // Always create a fresh client with the base URL
    const client = new AntflyClient({
      baseUrl: url,
      headers,
    });

    // Determine if we should stream based on presence of streaming callbacks
    const shouldStream = !!(
      callbacks.onClassification ||
      callbacks.onReasoning ||
      callbacks.onHit ||
      callbacks.onAnswer ||
      callbacks.onConfidence ||
      callbacks.onFollowUpQuestion
    );

    // Build the request with streaming flag
    const answerRequest = {
      ...request,
      with_streaming: shouldStream,
    };

    // Build SDK callbacks if streaming
    const sdkCallbacks: AnswerAgentStreamCallbacks | undefined = shouldStream
      ? {
          onClassification: callbacks.onClassification,
          onReasoning: callbacks.onReasoning,
          onHit: callbacks.onHit,
          onAnswer: callbacks.onAnswer,
          onConfidence: callbacks.onConfidence,
          onFollowUpQuestion: callbacks.onFollowUpQuestion,
          onEvalResult: callbacks.onEvalResult,
          onDone: () => {
            if (callbacks.onComplete) {
              callbacks.onComplete();
            }
          },
          onError: (error: string) => {
            if (callbacks.onError) {
              callbacks.onError(error);
            }
          },
        }
      : undefined;

    // Call the answer agent endpoint
    const result = await client.answerAgent(answerRequest, sdkCallbacks);

    // Handle non-streaming response (AnswerAgentResult)
    if (result && typeof result === "object" && "answer" in result) {
      if (callbacks.onAnswerAgentResult) {
        callbacks.onAnswerAgentResult(result as AnswerAgentResult);
      }
      if (callbacks.onComplete) {
        callbacks.onComplete();
      }
      return new AbortController(); // Return a dummy controller for consistency
    }

    // Handle streaming response (AbortController)
    if (result && typeof result === "object" && "abort" in result) {
      return result as AbortController;
    }

    // Fallback
    if (callbacks.onComplete) {
      callbacks.onComplete();
    }
    return new AbortController();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        // Stream was aborted - this is expected behavior
      } else if (callbacks.onError) {
        callbacks.onError(error);
      }
    } else if (callbacks.onError) {
      callbacks.onError(new Error("Unknown error occurred during Answer Agent streaming"));
    }
    return new AbortController();
  }
}
