/**
 * Antfly SDK Client
 * Provides a high-level interface for interacting with the Antfly API
 */

import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./antfly-api.js";
import type {
  AnswerAgentRequest,
  AnswerAgentResult,
  AnswerAgentStreamCallbacks,
  AntflyConfig,
  BackupRequest,
  BatchRequest,
  ChatAgentRequest,
  ChatAgentResult,
  ChatAgentStreamCallbacks,
  CreateTableRequest,
  CreateUserRequest,
  IndexConfig,
  Permission,
  QueryBuilderRequest,
  QueryBuilderResult,
  QueryHit,
  QueryRequest,
  QueryResponses,
  QueryResult,
  RAGRequest,
  RAGResult,
  RAGStreamCallbacks,
  ResourceType,
  RestoreRequest,
  ScanKeysRequest,
  TableSchema,
} from "./types.js";

export class AntflyClient {
  private client: Client<paths>;
  private config: AntflyConfig;

  constructor(config: AntflyConfig) {
    this.config = config;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config.headers,
    };

    // Add basic auth if provided
    if (config.auth) {
      const auth = btoa(`${config.auth.username}:${config.auth.password}`);
      headers["Authorization"] = `Basic ${auth}`;
    }

    this.client = createClient<paths>({
      baseUrl: config.baseUrl,
      headers,
      bodySerializer: (body) => {
        // Check if this is already a string (NDJSON case)
        if (typeof body === "string") {
          return body;
        }
        // Otherwise use default JSON serialization
        return JSON.stringify(body);
      },
    });
  }

  /**
   * Update authentication credentials
   */
  setAuth(username: string, password: string) {
    this.config.auth = { username, password };
    const auth = btoa(`${username}:${password}`);

    this.client = createClient<paths>({
      baseUrl: this.config.baseUrl,
      headers: {
        ...this.config.headers,
        Authorization: `Basic ${auth}`,
      },
      bodySerializer: (body) => {
        // Check if this is already a string (NDJSON case)
        if (typeof body === "string") {
          return body;
        }
        // Otherwise use default JSON serialization
        return JSON.stringify(body);
      },
    });
  }

  /**
   * Get cluster status
   */
  async getStatus() {
    const { data, error } = await this.client.GET("/status");
    if (error) throw new Error(`Failed to get status: ${error.error}`);
    return data;
  }

  /**
   * Private helper for query requests to avoid code duplication
   */
  private async performQuery(
    path: "/query" | "/tables/{tableName}/query",
    request: QueryRequest,
    tableName?: string
  ): Promise<QueryResponses | undefined> {
    if (path === "/tables/{tableName}/query" && tableName) {
      const { data, error } = await this.client.POST("/tables/{tableName}/query", {
        params: { path: { tableName } },
        body: request,
      });
      if (error) throw new Error(`Table query failed: ${error.error}`);
      return data;
    } else {
      const { data, error } = await this.client.POST("/query", {
        body: request,
      });
      if (error) throw new Error(`Query failed: ${error.error}`);
      return data;
    }
  }

  /**
   * Private helper for multiquery requests to avoid code duplication
   */
  private async performMultiquery(
    path: "/query" | "/tables/{tableName}/query",
    requests: QueryRequest[],
    tableName?: string
  ): Promise<QueryResponses | undefined> {
    const ndjson = requests.map((request) => JSON.stringify(request)).join("\n") + "\n";

    if (path === "/tables/{tableName}/query" && tableName) {
      const { data, error } = await this.client.POST("/tables/{tableName}/query", {
        params: { path: { tableName } },
        body: ndjson,
        headers: {
          "Content-Type": "application/x-ndjson",
        },
      });
      if (error) throw new Error(`Table multi-query failed: ${error.error}`);
      return data;
    } else {
      const { data, error } = await this.client.POST("/query", {
        body: ndjson,
        headers: {
          "Content-Type": "application/x-ndjson",
        },
      });
      if (error) throw new Error(`Multi-query failed: ${error.error}`);
      return data;
    }
  }

  /**
   * Global query operations
   */
  async query(request: QueryRequest): Promise<QueryResult | undefined> {
    const data = await this.performQuery("/query", request);
    // The global query returns QueryResponses, extract the first result
    return data?.responses?.[0];
  }

  /**
   * Execute multiple queries in a single request
   */
  async multiquery(requests: QueryRequest[]): Promise<QueryResponses | undefined> {
    return this.performMultiquery("/query", requests);
  }

  /**
   * Private helper for RAG requests to avoid code duplication
   */
  private async performRag(
    path: string,
    request: RAGRequest,
    callbacks?: RAGStreamCallbacks
  ): Promise<RAGResult | AbortController> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json",
    };

    // Add auth header if configured
    if (this.config.auth) {
      const auth = btoa(`${this.config.auth.username}:${this.config.auth.password}`);
      headers["Authorization"] = `Basic ${auth}`;
    }

    // Merge with any additional headers
    Object.assign(headers, this.config.headers);

    const abortController = new AbortController();
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RAG request failed: ${response.status} ${errorText}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    // Check content type to determine response format
    const contentType = response.headers.get("content-type") || "";
    const isJSON = contentType.includes("application/json");

    // Handle JSON response with citations and query hits
    if (isJSON) {
      const ragResult = (await response.json()) as RAGResult;
      return ragResult;
    }

    // Handle SSE streaming response
    if (callbacks) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      // Start reading the stream in the background
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim()) {
                // Empty line marks end of an event
                currentEvent = "";
                continue;
              }

              if (line.startsWith("event: ")) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();

                try {
                  // Dispatch based on event type
                  switch (currentEvent) {
                    case "hits_start":
                      if (callbacks.onHitsStart) {
                        const hitsStartData = JSON.parse(data);
                        callbacks.onHitsStart(hitsStartData);
                      }
                      break;
                    case "hit":
                      if (callbacks.onHit) {
                        const hit = JSON.parse(data);
                        callbacks.onHit(hit);
                      }
                      break;
                    case "hits_end":
                      if (callbacks.onHitsEnd) {
                        const hitsEndData = JSON.parse(data);
                        callbacks.onHitsEnd(hitsEndData);
                      }
                      break;
                    case "table_result":
                      // Keep for backwards compatibility (deprecated)
                      if (callbacks.onHit) {
                        const result = JSON.parse(data);
                        const hits = result?.hits?.hits || [];
                        hits.forEach((hit: QueryHit) => callbacks.onHit!(hit));
                      }
                      break;
                    case "summary":
                      if (callbacks.onSummary) {
                        const chunk = JSON.parse(data);
                        callbacks.onSummary(chunk);
                      }
                      break;
                    case "done":
                      if (callbacks.onDone) {
                        const doneData = JSON.parse(data);
                        callbacks.onDone(doneData);
                      }
                      return;
                    case "error":
                      if (callbacks.onError) {
                        const error = JSON.parse(data);
                        callbacks.onError(error);
                      }
                      throw new Error(data);
                  }
                } catch (e) {
                  console.warn("Failed to parse SSE data:", currentEvent, data, e);
                }
              }
            }
          }
        } catch (error) {
          if ((error as Error).name !== "AbortError") {
            console.error("RAG streaming error:", error);
          }
        }
      })();
    }

    return abortController;
  }

  /**
   * Private helper for Answer Agent requests to avoid code duplication
   */
  private async performAnswerAgent(
    path: string,
    request: AnswerAgentRequest,
    callbacks?: AnswerAgentStreamCallbacks
  ): Promise<AnswerAgentResult | AbortController> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json",
    };

    // Add auth header if configured
    if (this.config.auth) {
      const auth = btoa(`${this.config.auth.username}:${this.config.auth.password}`);
      headers["Authorization"] = `Basic ${auth}`;
    }

    // Merge with any additional headers
    Object.assign(headers, this.config.headers);

    const abortController = new AbortController();
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Answer agent request failed: ${response.status} ${errorText}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    // Check content type to determine response format
    const contentType = response.headers.get("content-type") || "";
    const isJSON = contentType.includes("application/json");

    // Handle JSON response (non-streaming)
    if (isJSON) {
      const result = (await response.json()) as AnswerAgentResult;
      return result;
    }

    // Handle SSE streaming response
    if (callbacks) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      // Start reading the stream in the background
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim()) {
                // Empty line marks end of an event
                currentEvent = "";
                continue;
              }

              if (line.startsWith("event: ")) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();

                try {
                  // Dispatch based on event type
                  switch (currentEvent) {
                    case "classification":
                      if (callbacks.onClassification) {
                        const classData = JSON.parse(data);
                        callbacks.onClassification(classData);
                      }
                      break;
                    case "reasoning":
                      if (callbacks.onReasoning) {
                        // Reasoning is JSON-encoded to preserve newlines in SSE format
                        callbacks.onReasoning(JSON.parse(data));
                      }
                      break;
                    case "hits_start":
                      if (callbacks.onHitsStart) {
                        const hitsStartData = JSON.parse(data);
                        callbacks.onHitsStart(hitsStartData);
                      }
                      break;
                    case "hit":
                      if (callbacks.onHit) {
                        const hit = JSON.parse(data);
                        callbacks.onHit(hit);
                      }
                      break;
                    case "hits_end":
                      if (callbacks.onHitsEnd) {
                        const hitsEndData = JSON.parse(data);
                        callbacks.onHitsEnd(hitsEndData);
                      }
                      break;
                    case "answer":
                      if (callbacks.onAnswer) {
                        // Answer is JSON-encoded to preserve newlines in SSE format
                        callbacks.onAnswer(JSON.parse(data));
                      }
                      break;
                    case "confidence":
                      if (callbacks.onConfidence) {
                        const confidence = JSON.parse(data);
                        callbacks.onConfidence(confidence);
                      }
                      break;
                    case "followup_question":
                      if (callbacks.onFollowUpQuestion) {
                        // Follow-up question is JSON-encoded to preserve newlines in SSE format
                        callbacks.onFollowUpQuestion(JSON.parse(data));
                      }
                      break;
                    case "eval":
                      if (callbacks.onEvalResult) {
                        const evalResult = JSON.parse(data);
                        callbacks.onEvalResult(evalResult);
                      }
                      break;
                    case "done":
                      if (callbacks.onDone) {
                        const doneData = JSON.parse(data);
                        callbacks.onDone(doneData);
                      }
                      return;
                    case "error":
                      if (callbacks.onError) {
                        const error = JSON.parse(data);
                        callbacks.onError(error);
                      }
                      throw new Error(data);
                  }
                } catch (e) {
                  console.warn("Failed to parse SSE data:", currentEvent, data, e);
                }
              }
            }
          }
        } catch (error) {
          if ((error as Error).name !== "AbortError") {
            console.error("Answer agent streaming error:", error);
          }
        }
      })();
    }

    return abortController;
  }

  /**
   * RAG (Retrieval-Augmented Generation) query with streaming or citations
   * @param request - RAG request with query and summarizer config (set with_streaming: true to enable streaming)
   * @param callbacks - Optional callbacks for structured SSE events (hit, summary, citation, done, error)
   * @returns Promise with RAG result (JSON) or AbortController (when streaming)
   */
  async rag(
    request: RAGRequest,
    callbacks?: RAGStreamCallbacks
  ): Promise<RAGResult | AbortController> {
    return this.performRag("/rag", request, callbacks);
  }

  /**
   * Answer Agent - Intelligent query routing and generation
   * Automatically classifies queries, generates optimal searches, and provides answers
   * @param request - Answer agent request with query and generator config
   * @param callbacks - Optional callbacks for SSE events (classification, hits_start, hit, hits_end, reasoning, answer, followup_question, done, error)
   * @returns Promise with AnswerAgentResult (JSON) or AbortController (when streaming)
   */
  async answerAgent(
    request: AnswerAgentRequest,
    callbacks?: AnswerAgentStreamCallbacks
  ): Promise<AnswerAgentResult | AbortController> {
    return this.performAnswerAgent("/agents/answer", request, callbacks);
  }

  /**
   * Query Builder Agent - Translates natural language into structured search queries
   * Uses an LLM to generate optimized Bleve queries from user intent
   * @param request - Query builder request with intent and optional table/schema context
   * @returns Promise with QueryBuilderResult containing the generated query, explanation, and confidence
   */
  async queryBuilderAgent(request: QueryBuilderRequest): Promise<QueryBuilderResult> {
    const { data, error } = await this.client.POST("/agents/query-builder", {
      body: request,
    });
    if (error) throw new Error(`Query builder agent failed: ${error.error}`);
    return data!;
  }

  /**
   * Private helper for Chat Agent requests to handle streaming and non-streaming responses
   */
  private async performChatAgent(
    path: string,
    request: ChatAgentRequest,
    callbacks?: ChatAgentStreamCallbacks
  ): Promise<ChatAgentResult | AbortController> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json",
    };

    // Add auth header if configured
    if (this.config.auth) {
      const auth = btoa(`${this.config.auth.username}:${this.config.auth.password}`);
      headers["Authorization"] = `Basic ${auth}`;
    }

    // Merge with any additional headers
    Object.assign(headers, this.config.headers);

    const abortController = new AbortController();
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chat agent request failed: ${response.status} ${errorText}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    // Check content type to determine response format
    const contentType = response.headers.get("content-type") || "";
    const isJSON = contentType.includes("application/json");

    // Handle JSON response (non-streaming)
    if (isJSON) {
      const result = (await response.json()) as ChatAgentResult;
      return result;
    }

    // Handle SSE streaming response
    if (callbacks) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      // Start reading the stream in the background
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim()) {
                // Empty line marks end of an event
                currentEvent = "";
                continue;
              }

              if (line.startsWith("event: ")) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();

                try {
                  // Dispatch based on event type
                  switch (currentEvent) {
                    case "classification":
                      if (callbacks.onClassification) {
                        const classData = JSON.parse(data);
                        callbacks.onClassification(classData);
                      }
                      break;
                    case "clarification_required":
                      if (callbacks.onClarificationRequired) {
                        const clarification = JSON.parse(data);
                        callbacks.onClarificationRequired(clarification);
                      }
                      break;
                    case "filter_applied":
                      if (callbacks.onFilterApplied) {
                        const filter = JSON.parse(data);
                        callbacks.onFilterApplied(filter);
                      }
                      break;
                    case "search_executed":
                      if (callbacks.onSearchExecuted) {
                        const searchData = JSON.parse(data);
                        callbacks.onSearchExecuted(searchData);
                      }
                      break;
                    case "websearch_executed":
                      if (callbacks.onWebSearchExecuted) {
                        const webSearchData = JSON.parse(data);
                        callbacks.onWebSearchExecuted(webSearchData);
                      }
                      break;
                    case "fetch_executed":
                      if (callbacks.onFetchExecuted) {
                        const fetchData = JSON.parse(data);
                        callbacks.onFetchExecuted(fetchData);
                      }
                      break;
                    case "hit":
                      if (callbacks.onHit) {
                        const hit = JSON.parse(data);
                        callbacks.onHit(hit);
                      }
                      break;
                    case "answer":
                      if (callbacks.onAnswer) {
                        // Answer is JSON-encoded to preserve newlines in SSE format
                        callbacks.onAnswer(JSON.parse(data));
                      }
                      break;
                    case "done":
                      if (callbacks.onDone) {
                        const doneData = JSON.parse(data);
                        callbacks.onDone(doneData);
                      }
                      return;
                    case "error":
                      if (callbacks.onError) {
                        const error = JSON.parse(data);
                        callbacks.onError(error);
                      }
                      throw new Error(data);
                  }
                } catch (e) {
                  console.warn("Failed to parse SSE data:", currentEvent, data, e);
                }
              }
            }
          }
        } catch (error) {
          if ((error as Error).name !== "AbortError") {
            console.error("Chat agent streaming error:", error);
          }
        }
      })();
    }

    return abortController;
  }

  /**
   * Chat Agent - Conversational RAG with multi-turn history and tool calling
   * Supports filter refinement, clarification requests, and streaming responses
   * @param request - Chat agent request with conversation history and generator config
   * @param callbacks - Optional callbacks for SSE events (classification, clarification_required, filter_applied, hit, answer, done, error)
   * @returns Promise with ChatAgentResult (JSON) or AbortController (when streaming)
   */
  async chatAgent(
    request: ChatAgentRequest,
    callbacks?: ChatAgentStreamCallbacks
  ): Promise<ChatAgentResult | AbortController> {
    return this.performChatAgent("/agents/chat", request, callbacks);
  }

  /**
   * Table operations
   */
  tables = {
    /**
     * List all tables
     */
    list: async (params?: { prefix?: string; pattern?: string }) => {
      const { data, error } = await this.client.GET("/tables", {
        params: params ? { query: params } : undefined,
      });
      if (error) throw new Error(`Failed to list tables: ${error.error}`);
      return data;
    },

    /**
     * Get table details and status
     */
    get: async (tableName: string) => {
      const { data, error } = await this.client.GET("/tables/{tableName}", {
        params: { path: { tableName } },
      });
      if (error) throw new Error(`Failed to get table: ${error.error}`);
      return data;
    },

    /**
     * Create a new table
     */
    create: async (tableName: string, config: CreateTableRequest = {}) => {
      const { data, error } = await this.client.POST("/tables/{tableName}", {
        params: { path: { tableName } },
        body: config,
      });
      if (error) throw new Error(`Failed to create table: ${error.error}`);
      return data;
    },

    /**
     * Drop a table
     */
    drop: async (tableName: string) => {
      const { error } = await this.client.DELETE("/tables/{tableName}", {
        params: { path: { tableName } },
      });
      if (error) throw new Error(`Failed to drop table: ${error.error}`);
      return true;
    },

    /**
     * Update schema for a table
     */
    updateSchema: async (tableName: string, config: TableSchema) => {
      const { data, error } = await this.client.PUT("/tables/{tableName}/schema", {
        params: { path: { tableName } },
        body: config,
      });
      if (error) throw new Error(`Failed to update table schema: ${error.error}`);
      return data;
    },

    /**
     * Query a specific table
     */
    query: async (tableName: string, request: QueryRequest) => {
      return this.performQuery("/tables/{tableName}/query", request, tableName);
    },

    /**
     * Execute multiple queries on a specific table
     */
    multiquery: async (tableName: string, requests: QueryRequest[]) => {
      return this.performMultiquery("/tables/{tableName}/query", requests, tableName);
    },

    /**
     * Perform batch operations on a table
     */
    batch: async (tableName: string, request: BatchRequest) => {
      const { data, error } = await this.client.POST("/tables/{tableName}/batch", {
        params: { path: { tableName } },
        // @ts-expect-error Our BatchRequest type allows any object shape for inserts
        body: request,
      });
      if (error) throw new Error(`Batch operation failed: ${error.error}`);
      return data;
    },

    /**
     * Backup a table
     */
    backup: async (tableName: string, request: BackupRequest) => {
      const { data, error } = await this.client.POST("/tables/{tableName}/backup", {
        params: { path: { tableName } },
        body: request,
      });
      if (error) throw new Error(`Backup failed: ${error.error}`);
      return data;
    },

    /**
     * Restore a table from backup
     */
    restore: async (tableName: string, request: RestoreRequest) => {
      const { data, error } = await this.client.POST("/tables/{tableName}/restore", {
        params: { path: { tableName } },
        body: request,
      });
      if (error) throw new Error(`Restore failed: ${error.error}`);
      return data;
    },

    /**
     * Lookup a specific key in a table
     * @param tableName - Name of the table
     * @param key - Key of the record to lookup
     * @param options - Optional parameters
     * @param options.fields - Comma-separated list of fields to include (e.g., "title,author,metadata.tags")
     */
    lookup: async (tableName: string, key: string, options?: { fields?: string }) => {
      const { data, error } = await this.client.GET("/tables/{tableName}/lookup/{key}", {
        params: {
          path: { tableName, key },
          query: options?.fields ? { fields: options.fields } : undefined,
        },
      });
      if (error) throw new Error(`Key lookup failed: ${error.error}`);
      return data;
    },

    /**
     * Scan keys in a table within a key range
     * Returns documents as an async iterable, streaming results as NDJSON.
     * @param tableName - Name of the table
     * @param request - Scan request with optional key range, field projection, and filtering
     * @returns AsyncGenerator yielding documents with their keys
     */
    scan: (
      tableName: string,
      request?: ScanKeysRequest
    ): AsyncGenerator<{ _key: string; [key: string]: unknown }> => {
      const config = this.config;

      async function* scanGenerator(): AsyncGenerator<{ _key: string; [key: string]: unknown }> {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        };

        // Add auth header if configured
        if (config.auth) {
          const auth = btoa(`${config.auth.username}:${config.auth.password}`);
          headers["Authorization"] = `Basic ${auth}`;
        }

        // Merge with any additional headers
        Object.assign(headers, config.headers);

        const response = await fetch(`${config.baseUrl}/tables/${tableName}/lookup`, {
          method: "POST",
          headers,
          body: JSON.stringify(request || {}),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Scan failed: ${response.status} ${errorText}`);
        }

        if (!response.body) {
          throw new Error("Response body is null");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim()) {
              yield JSON.parse(line);
            }
          }
        }

        // Handle any remaining content in buffer
        if (buffer.trim()) {
          yield JSON.parse(buffer);
        }
      }

      return scanGenerator();
    },

    /**
     * Scan keys in a table and collect all results into an array
     * Convenience method that consumes the scan AsyncGenerator
     * @param tableName - Name of the table
     * @param request - Scan request with optional key range, field projection, and filtering
     * @returns Promise with array of all matching documents
     */
    scanAll: async (
      tableName: string,
      request?: ScanKeysRequest
    ): Promise<Array<{ _key: string; [key: string]: unknown }>> => {
      const results: Array<{ _key: string; [key: string]: unknown }> = [];
      for await (const doc of this.tables.scan(tableName, request)) {
        results.push(doc);
      }
      return results;
    },

    /**
     * RAG (Retrieval-Augmented Generation) query on a specific table with streaming or citations
     * @param tableName - Name of the table to query
     * @param request - RAG request with query and summarizer config (set with_streaming: true to enable streaming)
     * @param callbacks - Optional callbacks for structured SSE events (hit, summary, citation, done, error)
     * @returns Promise with RAG result (JSON) or AbortController (when streaming)
     */
    rag: async (
      tableName: string,
      request: RAGRequest,
      callbacks?: RAGStreamCallbacks
    ): Promise<RAGResult | AbortController> => {
      return this.performRag(`/tables/${tableName}/rag`, request, callbacks);
    },
  };

  /**
   * Index operations
   */
  indexes = {
    /**
     * List all indexes for a table
     */
    list: async (tableName: string) => {
      const { data, error } = await this.client.GET("/tables/{tableName}/indexes", {
        params: { path: { tableName } },
      });
      if (error) throw new Error(`Failed to list indexes: ${error.error}`);
      return data;
    },

    /**
     * Get index details
     */
    get: async (tableName: string, indexName: string) => {
      const { data, error } = await this.client.GET("/tables/{tableName}/indexes/{indexName}", {
        params: { path: { tableName, indexName } },
      });
      if (error) throw new Error(`Failed to get index: ${error.error}`);
      return data;
    },

    /**
     * Create a new index
     */
    create: async (tableName: string, config: IndexConfig) => {
      const { error } = await this.client.POST("/tables/{tableName}/indexes/{indexName}", {
        params: { path: { tableName, indexName: config.name } },
        body: config,
      });
      if (error) throw new Error(`Failed to create index: ${error.error}`);
      return true;
    },

    /**
     * Drop an index
     */
    drop: async (tableName: string, indexName: string) => {
      const { error } = await this.client.DELETE("/tables/{tableName}/indexes/{indexName}", {
        params: { path: { tableName, indexName } },
      });
      if (error) throw new Error(`Failed to drop index: ${error.error}`);
      return true;
    },
  };

  /**
   * User management operations
   */
  users = {
    /**
     * Get current authenticated user
     */
    getCurrentUser: async () => {
      const { data, error } = await this.client.GET("/users/me");
      if (error) throw new Error(`Failed to get current user: ${error.error}`);
      return data;
    },

    /**
     * List all users
     */
    list: async () => {
      const { data, error } = await this.client.GET("/users");
      if (error) throw new Error(`Failed to list users: ${error.error}`);
      return data;
    },

    /**
     * Get user details
     */
    get: async (userName: string) => {
      const { data, error } = await this.client.GET("/users/{userName}", {
        params: { path: { userName } },
      });
      if (error) throw new Error(`Failed to get user: ${error.error}`);
      return data;
    },

    /**
     * Create a new user
     */
    create: async (userName: string, request: CreateUserRequest) => {
      const { data, error } = await this.client.POST("/users/{userName}", {
        params: { path: { userName } },
        body: request,
      });
      if (error) throw new Error(`Failed to create user: ${error.error}`);
      return data;
    },

    /**
     * Delete a user
     */
    delete: async (userName: string) => {
      const { error } = await this.client.DELETE("/users/{userName}", {
        params: { path: { userName } },
      });
      if (error) throw new Error(`Failed to delete user: ${error.error}`);
      return true;
    },

    /**
     * Update user password
     */
    updatePassword: async (userName: string, newPassword: string) => {
      const { data, error } = await this.client.PUT("/users/{userName}/password", {
        params: { path: { userName } },
        body: { new_password: newPassword },
      });
      if (error) throw new Error(`Failed to update password: ${error.error}`);
      return data;
    },

    /**
     * Get user permissions
     */
    getPermissions: async (userName: string) => {
      const { data, error } = await this.client.GET("/users/{userName}/permissions", {
        params: { path: { userName } },
      });
      if (error) throw new Error(`Failed to get permissions: ${error.error}`);
      return data;
    },

    /**
     * Add permission to user
     */
    addPermission: async (userName: string, permission: Permission) => {
      const { data, error } = await this.client.POST("/users/{userName}/permissions", {
        params: { path: { userName } },
        body: permission,
      });
      if (error) throw new Error(`Failed to add permission: ${error.error}`);
      return data;
    },

    /**
     * Remove permission from user
     */
    removePermission: async (userName: string, resource: string, resourceType: ResourceType) => {
      const { error } = await this.client.DELETE("/users/{userName}/permissions", {
        params: {
          path: { userName },
          query: { resource, resourceType },
        },
      });
      if (error) throw new Error(`Failed to remove permission: ${error.error}`);
      return true;
    },
  };

  /**
   * Standalone evaluation for testing evaluators without running a query.
   * Evaluates a generated output against ground truth using LLM-as-judge metrics.
   * @param request - Eval request with evaluators, judge config, query, output, and ground truth
   * @returns Evaluation result with scores for each evaluator
   */
  async evaluate(
    request: import("./types.js").EvalRequest
  ): Promise<import("./types.js").EvalResult> {
    const { data, error } = await this.client.POST("/eval", {
      body: request,
    });
    if (error) throw new Error(`Evaluation failed: ${error.error}`);
    return data;
  }

  /**
   * Get the underlying OpenAPI client for advanced use cases
   */
  getRawClient() {
    return this.client;
  }
}
