/* eslint-disable react-refresh/only-export-components */

import type { GeneratorConfig, QueryHit, RAGRequest, RAGResult } from "@antfly/sdk";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Streamdown } from "streamdown";
import { replaceCitations, renderAsMarkdownLinks } from "./citations";
import { preprocessStreamingText } from "./markdown";
import { useSharedContext } from "./SharedContext";
import { resolveTable, streamRAG } from "./utils";

// Context for sharing RAG data with child components (e.g., AnswerFeedback)
export interface RAGResultsContextValue {
  query: string;
  result: RAGResult | null;
  isStreaming: boolean;
}

export const RAGResultsContext = createContext<RAGResultsContextValue | null>(null);

export function useRAGResultsContext() {
  const context = useContext(RAGResultsContext);
  if (!context) {
    throw new Error("useRAGResultsContext must be used within a RAGResults component");
  }
  return context;
}

export interface RAGResultsProps {
  id: string;
  searchBoxId: string; // Links to the QueryBox that provides the search value
  summarizer: GeneratorConfig;
  systemPrompt?: string;
  table?: string; // Optional table override - auto-inherits from QueryBox if not specified
  filterQuery?: Record<string, unknown>; // Filter query to constrain RAG retrieval
  exclusionQuery?: Record<string, unknown>; // Exclusion query to exclude matches
  /**
   * Custom render function for the summary text. Allows developers to bring their own
   * markdown renderer (e.g., streamdown.ai, react-markdown, marked) and citation interaction.
   *
   * @param summary - The RAG summary text (may contain inline citations like [doc_id doc1])
   * @param isStreaming - Whether the summary is currently streaming
   * @param hits - Optional search result hits if showHits is enabled
   * @returns Rendered summary component
   *
   * @example With streamdown.ai
   * ```tsx
   * <RAGResults
   *   renderSummary={(summary) => <StreamdownMarkdown>{summary}</StreamdownMarkdown>}
   * />
   * ```
   *
   * @example With custom parser
   * ```tsx
   * <RAGResults
   *   renderSummary={(summary, streaming) => (
   *     <CustomMarkdown text={summary} streaming={streaming} />
   *   )}
   * />
   * ```
   */
  renderSummary?: (summary: string, isStreaming: boolean, hits?: QueryHit[]) => ReactNode;
  /**
   * @deprecated Citations are now inline in the summary text using [doc_id ...] format.
   * Use renderSummary prop to customize how inline citations are displayed.
   */
  showCitations?: boolean;
  /**
   * @deprecated with_citations is no longer supported by the backend.
   * Citations are always included inline in the markdown summary.
   */
  withCitations?: boolean;
  showHits?: boolean;
  fields?: string[];
  semanticIndexes?: string[];
  children?: ReactNode;
}

export default function RAGResults({
  id,
  searchBoxId,
  summarizer,
  systemPrompt,
  table,
  filterQuery,
  exclusionQuery,
  renderSummary,
  showHits = false,
  fields,
  semanticIndexes,
  children,
}: RAGResultsProps) {
  const [{ widgets, url, table: defaultTable, headers }, dispatch] = useSharedContext();
  const [summary, setSummary] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<QueryHit[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousSubmissionRef = useRef<number | undefined>(undefined);

  // Watch for changes in the QueryBox widget
  const searchBoxWidget = widgets.get(searchBoxId);
  const currentQuery = searchBoxWidget?.value as string | undefined;
  const submittedAt = searchBoxWidget?.submittedAt;

  // Trigger RAG request when QueryBox is submitted (based on timestamp, not just query value)
  useEffect(() => {
    // Only trigger if we have a query and a submission timestamp
    if (!currentQuery || !submittedAt) {
      return;
    }

    // Check if this is a new submission (different timestamp from previous)
    if (submittedAt === previousSubmissionRef.current) {
      return;
    }

    // Validation check - don't proceed if URL is missing
    if (!url) {
      console.error("RAGResults: Missing API URL in context");
      return;
    }

    // Cancel any previous stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    previousSubmissionRef.current = submittedAt;

    // Resolve table: prop > QueryBox widget > default
    const widgetTable = table || searchBoxWidget?.table;
    const resolvedTable = resolveTable(widgetTable, defaultTable);

    // Build the RAG request (table will be added by streamRAG)
    // QueryBox only provides the text value, RAGResults owns the query configuration
    const ragRequest: RAGRequest = {
      queries: [
        {
          // Use the query value directly as semantic search
          semantic_search: currentQuery,
          fields: fields || [],
          indexes: semanticIndexes || [],
          filter_query: filterQuery,
          exclusion_query: exclusionQuery,
        },
      ],
      generator: summarizer,
      system_prompt: systemPrompt,
      // Note: with_citations is deprecated - citations are now inline in markdown summary
    };

    // Start streaming
    const startStream = async () => {
      // Reset state at the start of the async operation
      setSummary("");
      setError(null);
      setIsStreaming(true);
      setHits([]);

      try {
        const controller = await streamRAG(url, resolvedTable, ragRequest, headers || {}, {
          onHit: (hit) => {
            setHits((prev) => [...prev, hit]);
          },
          onSummary: (chunk) => {
            setSummary((prev) => prev + chunk);
          },
          onComplete: () => {
            setIsStreaming(false);
          },
          onError: (err) => {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            setIsStreaming(false);
          },
          onRAGResult: (result) => {
            // Non-streaming response
            setSummary(result.generate_result?.text || "");
            setHits(result.query_results?.[0]?.hits?.hits || []);
            setIsStreaming(false);
          },
        });

        abortControllerRef.current = controller;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setIsStreaming(false);
      }
    };

    startStream();

    // Cleanup on unmount or when submission changes
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [
    submittedAt,
    currentQuery,
    searchBoxWidget,
    url,
    table,
    defaultTable,
    headers,
    summarizer,
    systemPrompt,
    fields,
    semanticIndexes,
    filterQuery,
    exclusionQuery,
  ]);

  // Register this component as a widget (for consistency with other components)
  useEffect(() => {
    dispatch({
      type: "setWidget",
      key: id,
      needsQuery: false,
      needsConfiguration: false,
      isFacet: false,
      wantResults: false,
      table: table,
      value: summary,
    });
  }, [dispatch, id, table, summary]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      dispatch({ type: "deleteWidget", key: id });
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    },
    [dispatch, id]
  );

  // Default render function - markdown with inline citations
  const defaultRender = useCallback(
    (summaryText: string, streaming: boolean, hitList?: QueryHit[]) => {
      const processedText = preprocessStreamingText(summaryText);
      const textWithLinks = processedText
        ? replaceCitations(processedText, {
            renderCitation: renderAsMarkdownLinks,
          })
        : "";

      return (
        <div className="react-af-rag-results">
          {error && (
            <div className="react-af-rag-error" style={{ color: "red" }}>
              Error: {error}
            </div>
          )}
          {!error && !summaryText && !streaming && (
            <div className="react-af-rag-empty">
              No results yet. Submit a question to get started.
            </div>
          )}
          {summaryText && (
            <div className="react-af-rag-summary">
              <Streamdown isAnimating={streaming}>{textWithLinks}</Streamdown>
            </div>
          )}
          {showHits && hitList && hitList.length > 0 && (
            <details className="react-af-rag-hits">
              <summary>Search Results ({hitList.length})</summary>
              <ul>
                {hitList.map((hit, idx) => (
                  <li key={hit._id || idx}>
                    <strong>Score:</strong> {hit._score.toFixed(3)}
                    <pre>{JSON.stringify(hit._source, null, 2)}</pre>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      );
    },
    [error, showHits]
  );

  // Build context value for child components (e.g., AnswerFeedback)
  const contextValue = useMemo<RAGResultsContextValue>(() => {
    const result: RAGResult | null = summary
      ? ({
          generate_result: { text: summary },
          query_results: [
            {
              hits: {
                hits,
                total: { value: hits.length, relation: "eq" },
              },
              took: 0,
              status: 200,
            },
          ],
        } as unknown as RAGResult)
      : null;

    return {
      query: currentQuery || "",
      result,
      isStreaming,
    };
  }, [currentQuery, summary, hits, isStreaming]);

  return (
    <RAGResultsContext.Provider value={contextValue}>
      {renderSummary
        ? renderSummary(summary, isStreaming, hits)
        : defaultRender(summary, isStreaming, hits)}
      {children}
    </RAGResultsContext.Provider>
  );
}
