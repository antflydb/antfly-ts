import type {
  AnswerAgentRequest,
  AnswerAgentResult,
  AnswerConfidence,
  ClassificationTransformationResult,
  GeneratorConfig,
  QueryHit,
} from "@antfly/sdk";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnswerResultsContext, type AnswerResultsContextValue } from "./AnswerResultsContext";
import { useSharedContext } from "./SharedContext";
import { resolveTable, streamAnswer } from "./utils";

export interface AnswerResultsProps {
  id: string;
  searchBoxId: string; // Links to the QueryBox that provides the search value
  generator: GeneratorConfig;
  agentKnowledge?: string; // Additional context for the answer agent
  table?: string; // Optional table override - auto-inherits from QueryBox if not specified
  filterQuery?: Record<string, unknown>; // Filter query to constrain search results
  exclusionQuery?: Record<string, unknown>; // Exclusion query to exclude matches
  fields?: string[];
  semanticIndexes?: string[];

  // Visibility controls
  showClassification?: boolean;
  showReasoning?: boolean;
  showFollowUpQuestions?: boolean;
  showConfidence?: boolean;
  showHits?: boolean;

  // Custom renderers
  renderLoading?: () => ReactNode;
  renderEmpty?: () => ReactNode;
  renderClassification?: (data: ClassificationTransformationResult) => ReactNode;
  renderReasoning?: (reasoning: string, isStreaming: boolean) => ReactNode;
  renderAnswer?: (answer: string, isStreaming: boolean, hits?: QueryHit[]) => ReactNode;
  renderConfidence?: (confidence: AnswerConfidence) => ReactNode;
  renderFollowUpQuestions?: (questions: string[]) => ReactNode;
  renderHits?: (hits: QueryHit[]) => ReactNode;

  // Callbacks
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onError?: (error: string) => void;

  children?: ReactNode;
}

export default function AnswerResults({
  id,
  searchBoxId,
  generator,
  agentKnowledge,
  table,
  filterQuery,
  exclusionQuery,
  fields,
  semanticIndexes,
  showClassification = false,
  showReasoning = false,
  showFollowUpQuestions = true,
  showConfidence = false,
  showHits = false,
  renderLoading,
  renderEmpty,
  renderClassification,
  renderReasoning,
  renderAnswer,
  renderConfidence,
  renderFollowUpQuestions,
  renderHits,
  onStreamStart,
  onStreamEnd,
  onError: onErrorCallback,
  children,
}: AnswerResultsProps) {
  const [{ widgets, url, table: defaultTable, headers }, dispatch] = useSharedContext();

  // Answer agent state
  const [classification, setClassification] = useState<ClassificationTransformationResult | null>(
    null
  );
  const [hits, setHits] = useState<QueryHit[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [answer, setAnswer] = useState("");
  const [confidence, setConfidence] = useState<AnswerConfidence | null>(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const previousSubmissionRef = useRef<number | undefined>(undefined);

  // Watch for changes in the QueryBox widget
  const searchBoxWidget = widgets.get(searchBoxId);
  const currentQuery = searchBoxWidget?.value as string | undefined;
  const submittedAt = searchBoxWidget?.submittedAt;

  // Trigger Answer Agent request when QueryBox is submitted (based on timestamp, not just query value)
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
      console.error("AnswerResults: Missing API URL in context");
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

    // Build the Answer Agent request with queries array (similar to RAG format)
    // QueryBox only provides the text value, AnswerResults owns the query configuration
    const answerRequest: AnswerAgentRequest = {
      query: currentQuery,
      queries: [
        {
          table: resolvedTable,
          // Use the query value directly as semantic search
          semantic_search: currentQuery,
          fields: fields || [],
          indexes: semanticIndexes || [],
          filter_query: filterQuery,
          exclusion_query: exclusionQuery,
        },
      ],
      generator: generator,
      agent_knowledge: agentKnowledge,
      with_streaming: true,
      steps: {
        classification: {
          with_reasoning: showReasoning,
        },
        followup: {
          enabled: showFollowUpQuestions,
        },
        confidence: {
          enabled: showConfidence,
        },
      },
    };

    // Start streaming
    const startStream = async () => {
      // Reset state at the start of the async operation
      setClassification(null);
      setHits([]);
      setReasoning("");
      setAnswer("");
      setConfidence(null);
      setFollowUpQuestions([]);
      setError(null);
      setIsStreaming(true);

      if (onStreamStart) {
        onStreamStart();
      }

      try {
        const controller = await streamAnswer(url, answerRequest, headers || {}, {
          onClassification: (data) => {
            setClassification(data);
          },
          onReasoning: (chunk) => {
            setReasoning((prev) => prev + chunk);
          },
          onHit: (hit) => {
            setHits((prev) => [...prev, hit]);
          },
          onAnswer: (chunk) => {
            setAnswer((prev) => prev + chunk);
          },
          onConfidence: (data) => {
            setConfidence(data);
          },
          onFollowUpQuestion: (question) => {
            setFollowUpQuestions((prev) => [...prev, question]);
          },
          onComplete: () => {
            setIsStreaming(false);
            if (onStreamEnd) {
              onStreamEnd();
            }
          },
          onError: (err) => {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            setIsStreaming(false);
            if (onErrorCallback) {
              onErrorCallback(message);
            }
          },
          onAnswerAgentResult: (result) => {
            // Non-streaming response
            setClassification(result.classification_transformation || null);
            setAnswer(result.answer || "");
            setFollowUpQuestions(result.followup_questions || []);
            setHits(result.query_results?.[0]?.hits?.hits || []);
            if (result.answer_confidence !== undefined && result.context_relevance !== undefined) {
              setConfidence({
                answer_confidence: result.answer_confidence,
                context_relevance: result.context_relevance,
              });
            }
            setIsStreaming(false);
            if (onStreamEnd) {
              onStreamEnd();
            }
          },
        });

        abortControllerRef.current = controller;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setIsStreaming(false);
        if (onErrorCallback) {
          onErrorCallback(message);
        }
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
    generator,
    agentKnowledge,
    fields,
    semanticIndexes,
    filterQuery,
    exclusionQuery,
    showReasoning,
    showFollowUpQuestions,
    showConfidence,
    onStreamStart,
    onStreamEnd,
    onErrorCallback,
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
      value: answer,
    });
  }, [dispatch, id, table, answer]);

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

  // Default renderers
  const defaultRenderClassification = useCallback(
    (data: ClassificationTransformationResult) => (
      <div className="react-af-answer-classification">
        <strong>Classification:</strong> {data.route_type} (confidence:{" "}
        {(data.confidence * 100).toFixed(1)}%)
        <div>
          <strong>Strategy:</strong> {data.strategy}, <strong>Semantic Mode:</strong>{" "}
          {data.semantic_mode}
        </div>
        <div>
          <strong>Improved Query:</strong> {data.improved_query}
        </div>
        <div>
          <strong>Semantic Query:</strong> {data.semantic_query}
        </div>
        {data.reasoning && (
          <div>
            <strong>Reasoning:</strong> {data.reasoning}
          </div>
        )}
      </div>
    ),
    []
  );

  const defaultRenderReasoning = useCallback(
    (reasoningText: string, streaming: boolean) => (
      <div className="react-af-answer-reasoning">
        <strong>Reasoning:</strong>
        <p>
          {reasoningText}
          {streaming && <span className="react-af-answer-streaming"> ...</span>}
        </p>
      </div>
    ),
    []
  );

  const defaultRenderAnswer = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (answerText: string, streaming: boolean, _hits?: QueryHit[]) => (
      <div className="react-af-answer-text">
        {answerText}
        {streaming && <span className="react-af-answer-streaming"> ...</span>}
      </div>
    ),
    []
  );

  const defaultRenderConfidence = useCallback(
    (confidenceData: AnswerConfidence) => (
      <div className="react-af-answer-confidence">
        <strong>Confidence Assessment:</strong>
        <div>
          <strong>Answer Confidence:</strong> {(confidenceData.answer_confidence * 100).toFixed(1)}%
        </div>
        <div>
          <strong>Context Relevance:</strong> {(confidenceData.context_relevance * 100).toFixed(1)}%
        </div>
      </div>
    ),
    []
  );

  const defaultRenderFollowUpQuestions = useCallback(
    (questions: string[]) => (
      <div className="react-af-answer-follow-up">
        <strong>Follow-up Questions:</strong>
        <ul>
          {questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </div>
    ),
    []
  );

  const defaultRenderHits = useCallback(
    (hitList: QueryHit[]) => (
      <details className="react-af-answer-hits">
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
    ),
    []
  );

  // Build context value for child components (e.g., AnswerFeedback)
  const contextValue = useMemo<AnswerResultsContextValue>(() => {
    const result: AnswerAgentResult | null = answer
      ? ({
          answer,
          reasoning,
          followup_questions: followUpQuestions,
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
        } as unknown as AnswerAgentResult)
      : null;

    return {
      query: currentQuery || "",
      agentKnowledge,
      classification,
      hits,
      reasoning,
      answer,
      followUpQuestions,
      isStreaming,
      result,
      confidence,
    };
  }, [
    currentQuery,
    agentKnowledge,
    classification,
    hits,
    reasoning,
    answer,
    followUpQuestions,
    isStreaming,
    confidence,
  ]);

  return (
    <AnswerResultsContext.Provider value={contextValue}>
      <div className="react-af-answer-results">
        {error && (
          <div className="react-af-answer-error" style={{ color: "red" }}>
            Error: {error}
          </div>
        )}
        {!error &&
          !answer &&
          !reasoning &&
          isStreaming &&
          (renderLoading ? (
            renderLoading()
          ) : (
            <div className="react-af-answer-loading">Loading answer...</div>
          ))}
        {!error &&
          !answer &&
          !isStreaming &&
          (renderEmpty ? (
            renderEmpty()
          ) : (
            <div className="react-af-answer-empty">
              No results yet. Submit a question to get started.
            </div>
          ))}
        {showClassification &&
          classification &&
          (renderClassification
            ? renderClassification(classification)
            : defaultRenderClassification(classification))}
        {showReasoning &&
          reasoning &&
          (renderReasoning
            ? renderReasoning(reasoning, isStreaming)
            : defaultRenderReasoning(reasoning, isStreaming))}
        {answer &&
          (renderAnswer
            ? renderAnswer(answer, isStreaming, hits)
            : defaultRenderAnswer(answer, isStreaming, hits))}
        {showConfidence &&
          confidence &&
          !isStreaming &&
          (renderConfidence ? renderConfidence(confidence) : defaultRenderConfidence(confidence))}
        {showFollowUpQuestions &&
          followUpQuestions.length > 0 &&
          !isStreaming &&
          (renderFollowUpQuestions
            ? renderFollowUpQuestions(followUpQuestions)
            : defaultRenderFollowUpQuestions(followUpQuestions))}
        {showHits && hits.length > 0 && (renderHits ? renderHits(hits) : defaultRenderHits(hits))}
      </div>
      {children}
    </AnswerResultsContext.Provider>
  );
}
