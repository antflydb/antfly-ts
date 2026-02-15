import type {
  Citation,
  ClassificationTransformationResult,
  QueryHit,
} from "@antfly/sdk";
import type { TableStatus } from "@antfly/sdk";
import { ReloadIcon } from "@radix-ui/react-icons";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  HelpCircle,
  MessageSquare,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api-config";

// Generator providers
const GENERATOR_PROVIDERS = ["openai", "anthropic", "gemini", "ollama"] as const;
type GeneratorProvider = (typeof GENERATOR_PROVIDERS)[number];

interface GeneratorConfig {
  provider: GeneratorProvider;
  model: string;
  temperature?: number;
}

interface StepsConfig {
  classification: {
    enabled: boolean;
    with_reasoning: boolean;
  };
  generation: {
    enabled: boolean;
    system_prompt: string;
    generation_context: string;
  };
  followup: {
    enabled: boolean;
    count: number;
  };
  confidence: {
    enabled: boolean;
  };
}

const DEFAULT_GENERATOR: GeneratorConfig = {
  provider: "openai",
  model: "gpt-5-mini",
  temperature: 0.7,
};

const DEFAULT_STEPS: StepsConfig = {
  classification: { enabled: false, with_reasoning: false },
  generation: { enabled: true, system_prompt: "", generation_context: "" },
  followup: { enabled: false, count: 3 },
  confidence: { enabled: false },
};


// Simple markdown-ish formatter for RAG answers
function formatAnswer(text: string): React.ReactNode {
  if (!text) return null;

  // Split into lines and process
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    // Format citations: [resource_id ...] -> italicized
    const formattedLine = line.split(/(\[resource_id [^\]]+\])/).map((part, i) => {
      if (part.match(/^\[resource_id [^\]]+\]$/)) {
        return (
          <span key={i} className="text-muted-foreground italic text-xs">
            {part}
          </span>
        );
      }
      return part;
    });

    // Check if it's a bullet point
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (bulletMatch) {
      const [, indent] = bulletMatch;
      const indentLevel = Math.floor((indent?.length || 0) / 2);
      elements.push(
        <div
          key={lineIndex}
          className="flex gap-2"
          style={{ marginLeft: `${indentLevel * 1}rem` }}
        >
          <span className="text-muted-foreground">•</span>
          <span>{formattedLine}</span>
        </div>
      );
    } else if (line.trim() === "") {
      // Empty line = paragraph break
      elements.push(<div key={lineIndex} className="h-3" />);
    } else {
      // Regular paragraph
      elements.push(
        <p key={lineIndex} className="leading-relaxed">
          {formattedLine}
        </p>
      );
    }
  });

  return <div className="space-y-1">{elements}</div>;
}

const RagPlaygroundPage: React.FC = () => {
  const apiClient = useApi();

  // Config state
  const [query, setQuery] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [embeddingIndexes, setEmbeddingIndexes] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState("");
  const [generator, setGenerator] = useState<GeneratorConfig>(DEFAULT_GENERATOR);
  const [limit, setLimit] = useState(10);
  const [steps, setSteps] = useState<StepsConfig>(DEFAULT_STEPS);
  const [settingsOpen, setSettingsOpen] = useState(true);

  // Streaming result state
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const [classification, setClassification] =
    useState<ClassificationTransformationResult | null>(null);
  const [hits, setHits] = useState<QueryHit[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [followupQuestions, setFollowupQuestions] = useState<string[]>([]);
  const [confidenceScores, setConfidenceScores] = useState<{
    generation: number;
    context: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);

  // Collapsible state for results
  const [contextOpen, setContextOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  // Fetch tables on mount
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await api.tables.list();
        setTables(response as TableStatus[]);
        if (response.length > 0 && !selectedTable) {
          setSelectedTable(response[0].name);
        }
      } catch (e) {
        console.error("Failed to fetch tables:", e);
      }
    };
    fetchTables();
  }, [selectedTable]);

  // Fetch embedding indexes when table changes
  useEffect(() => {
    const fetchIndexes = async () => {
      if (!selectedTable) {
        setEmbeddingIndexes([]);
        setSelectedIndex("");
        return;
      }
      try {
        const response = await apiClient.indexes.list(selectedTable);
        const embeddingIdxs = (response || [])
          .filter(
            (idx: { config?: { type?: string } }) =>
              idx.config?.type?.includes("aknn") ||
              idx.config?.type?.includes("embedding")
          )
          .map((idx: { config?: { name?: string } }) => idx.config?.name || "")
          .filter(Boolean);
        setEmbeddingIndexes(embeddingIdxs);
        if (embeddingIdxs.length > 0) {
          setSelectedIndex(embeddingIdxs[0]);
        } else {
          setSelectedIndex("");
        }
      } catch (e) {
        console.error("Failed to fetch indexes:", e);
        setEmbeddingIndexes([]);
        setSelectedIndex("");
      }
    };
    fetchIndexes();
  }, [selectedTable, apiClient]);

  const handleReset = () => {
    setQuery("");
    setStreamingAnswer("");
    setClassification(null);
    setHits([]);
    setCitations([]);
    setFollowupQuestions([]);
    setConfidenceScores(null);
    setError(null);
    setProcessingTime(null);
    setSteps(DEFAULT_STEPS);
    setGenerator(DEFAULT_GENERATOR);
    setLimit(10);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const runQuery = useCallback(async () => {
    if (!query.trim()) {
      setError("Please enter a query");
      return;
    }
    if (!selectedTable) {
      setError("Please select a table");
      return;
    }
    if (!selectedIndex) {
      setError("No embedding index available for this table");
      return;
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset state
    setStreamingAnswer("");
    setClassification(null);
    setHits([]);
    setCitations([]);
    setFollowupQuestions([]);
    setConfidenceScores(null);
    setIsLoading(true);
    setError(null);
    setProcessingTime(null);
    startTimeRef.current = performance.now();

    try {
      const controller = await apiClient.retrievalAgent(
        {
          query,
          queries: [
            {
              table: selectedTable,
              semantic_search: query,
              indexes: [selectedIndex],
              limit,
            },
          ],
          stream: true,
          generator: {
            provider: generator.provider,
            model: generator.model,
            temperature: generator.temperature,
          },
          steps: {
            classification: steps.classification.enabled
              ? {
                  enabled: true,
                  with_reasoning: steps.classification.with_reasoning,
                }
              : undefined,
            generation: {
              enabled: true,
              system_prompt: steps.generation.system_prompt || undefined,
              generation_context: steps.generation.generation_context || undefined,
            },
            followup: steps.followup.enabled
              ? {
                  enabled: true,
                  count: steps.followup.count,
                }
              : undefined,
            confidence: steps.confidence.enabled ? { enabled: true } : undefined,
          },
        },
        {
          onClassification: (c) => setClassification(c),
          onHit: (hit) => setHits((prev) => [...prev, hit]),
          onAnswer: (chunk) => setStreamingAnswer((prev) => prev + chunk),
          onCitation: (c) => setCitations((prev) => [...prev, c]),
          onFollowUpQuestion: (q) => setFollowupQuestions((prev) => [...prev, q]),
          onConfidence: (c) =>
            setConfidenceScores({
              generation: c.generation_confidence,
              context: c.context_relevance,
            }),
          onError: (e) => {
            setError(e);
            setIsLoading(false);
          },
          onDone: () => {
            setIsLoading(false);
            setProcessingTime(performance.now() - startTimeRef.current);
          },
        }
      );

      abortControllerRef.current = controller as AbortController;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to run query");
      setIsLoading(false);
    }
  }, [query, selectedTable, selectedIndex, limit, generator, steps, apiClient]);

  const canRun = query.trim() && selectedTable && selectedIndex && !isLoading;

  return (
    <div className="h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">RAG Playground</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Query your documents with AI-powered retrieval and generation
          </p>
        </div>
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Query & Settings */}
        <div className="space-y-4">
          {/* Query Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Query</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Enter your question..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-h-[100px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canRun) {
                    runQuery();
                  }
                }}
              />
              <div className="flex items-center justify-end">
                <Button onClick={runQuery} disabled={!canRun}>
                  {isLoading ? (
                    <>
                      <ReloadIcon className="h-4 w-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run Query
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Settings Card */}
          <Card>
            <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
              <CardHeader className="pb-3">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </CardTitle>
                    {settingsOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {/* Table & Index */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Table</Label>
                      <Select value={selectedTable} onValueChange={setSelectedTable}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select table..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tables.map((table) => (
                            <SelectItem key={table.name} value={table.name}>
                              {table.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Index</Label>
                      <Select
                        value={selectedIndex}
                        onValueChange={setSelectedIndex}
                        disabled={embeddingIndexes.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              embeddingIndexes.length === 0
                                ? "No embedding index"
                                : "Select index..."
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {embeddingIndexes.map((idx) => (
                            <SelectItem key={idx} value={idx}>
                              {idx}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  {/* Generator Config */}
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">Generator</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Provider</Label>
                        <Select
                          value={generator.provider}
                          onValueChange={(v) =>
                            setGenerator((g) => ({ ...g, provider: v as GeneratorProvider }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GENERATOR_PROVIDERS.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Model</Label>
                        <Input
                          value={generator.model}
                          onChange={(e) =>
                            setGenerator((g) => ({ ...g, model: e.target.value }))
                          }
                          placeholder="gpt-5-mini"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Temperature</Label>
                        <Input
                          type="number"
                          value={generator.temperature ?? 0.7}
                          onChange={(e) =>
                            setGenerator((g) => ({
                              ...g,
                              temperature: parseFloat(e.target.value) || 0.7,
                            }))
                          }
                          min={0}
                          max={2}
                          step={0.1}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Query Options */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Result Limit</Label>
                    <Input
                      type="number"
                      value={limit}
                      onChange={(e) => setLimit(parseInt(e.target.value) || 10)}
                      min={1}
                      max={50}
                      className="w-24"
                    />
                  </div>

                  <Separator />

                  {/* Pipeline Steps */}
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">Pipeline Steps</Label>

                    {/* Classification */}
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Classification</p>
                          <p className="text-xs text-muted-foreground">
                            Analyze query strategy
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {steps.classification.enabled && (
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Reasoning</Label>
                            <Switch
                              checked={steps.classification.with_reasoning}
                              onCheckedChange={(v) =>
                                setSteps((s) => ({
                                  ...s,
                                  classification: { ...s.classification, with_reasoning: v },
                                }))
                              }
                            />
                          </div>
                        )}
                        <Switch
                          checked={steps.classification.enabled}
                          onCheckedChange={(v) =>
                            setSteps((s) => ({
                              ...s,
                              classification: { ...s.classification, enabled: v },
                            }))
                          }
                        />
                      </div>
                    </div>

                    {/* Follow-up */}
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Follow-up Questions</p>
                          <p className="text-xs text-muted-foreground">
                            Generate related questions
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {steps.followup.enabled && (
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Count</Label>
                            <Input
                              type="number"
                              value={steps.followup.count}
                              onChange={(e) =>
                                setSteps((s) => ({
                                  ...s,
                                  followup: {
                                    ...s.followup,
                                    count: parseInt(e.target.value) || 3,
                                  },
                                }))
                              }
                              className="w-14 h-7 text-xs"
                              min={1}
                              max={10}
                            />
                          </div>
                        )}
                        <Switch
                          checked={steps.followup.enabled}
                          onCheckedChange={(v) =>
                            setSteps((s) => ({
                              ...s,
                              followup: { ...s.followup, enabled: v },
                            }))
                          }
                        />
                      </div>
                    </div>

                    {/* Confidence */}
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Confidence Scores</p>
                          <p className="text-xs text-muted-foreground">
                            Rate answer confidence
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={steps.confidence.enabled}
                        onCheckedChange={(v) =>
                          setSteps((s) => ({
                            ...s,
                            confidence: { enabled: v },
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* System Prompt */}
                  <div className="space-y-2">
                    <Label>System Prompt (optional)</Label>
                    <Textarea
                      placeholder="Custom instructions for the generator..."
                      value={steps.generation.system_prompt}
                      onChange={(e) =>
                        setSteps((s) => ({
                          ...s,
                          generation: { ...s.generation, system_prompt: e.target.value },
                        }))
                      }
                      className="min-h-[80px] resize-none text-sm"
                    />
                  </div>

                  {/* Generation Context */}
                  <div className="space-y-2">
                    <Label>Generation Context (optional)</Label>
                    <Textarea
                      placeholder="Guidance for tone, detail level, style... e.g. 'Be concise and technical. Include code examples.'"
                      value={steps.generation.generation_context}
                      onChange={(e) =>
                        setSteps((s) => ({
                          ...s,
                          generation: { ...s.generation, generation_context: e.target.value },
                        }))
                      }
                      className="min-h-[60px] resize-none text-sm"
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>

        {/* Right Column - Results */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Results</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            {!streamingAnswer && !isLoading && !error ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Run a query to see results</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Stats Bar */}
                {(isLoading || streamingAnswer) && (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1.5">
                      <Zap className="h-3 w-3" />
                      {generator.provider}/{generator.model}
                    </Badge>
                    {hits.length > 0 && (
                      <Badge variant="outline" className="gap-1.5">
                        <BookOpen className="h-3 w-3" />
                        {hits.length} docs
                      </Badge>
                    )}
                    {processingTime && (
                      <Badge variant="outline" className="gap-1.5">
                        <Clock className="h-3 w-3" />
                        {(processingTime / 1000).toFixed(1)}s
                      </Badge>
                    )}
                    {confidenceScores && (
                      <>
                        <Badge
                          variant="outline"
                          className={`gap-1.5 ${
                            confidenceScores.generation > 0.7
                              ? "text-green-600"
                              : confidenceScores.generation > 0.4
                                ? "text-yellow-600"
                                : "text-red-600"
                          }`}
                        >
                          <Target className="h-3 w-3" />
                          {(confidenceScores.generation * 100).toFixed(0)}% confidence
                        </Badge>
                      </>
                    )}
                  </div>
                )}

                {/* Classification Result */}
                {classification && (
                  <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Sparkles className="h-4 w-4" />
                      Classification
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Strategy:</span>{" "}
                        <span className="font-medium">{classification.strategy}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Mode:</span>{" "}
                        <span className="font-medium">{classification.semantic_mode}</span>
                      </div>
                    </div>
                    {classification.semantic_query && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Semantic Query:</span>{" "}
                        <span className="italic">{classification.semantic_query}</span>
                      </div>
                    )}
                    {classification.reasoning && (
                      <div className="text-xs text-muted-foreground mt-2 p-2 bg-background rounded">
                        {classification.reasoning}
                      </div>
                    )}
                  </div>
                )}

                {/* Streaming Answer */}
                {(streamingAnswer || isLoading) && (
                  <div className="text-sm">
                    {streamingAnswer ? (
                      formatAnswer(streamingAnswer)
                    ) : (
                      <span className="text-muted-foreground italic">Generating...</span>
                    )}
                    {isLoading && (
                      <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5" />
                    )}
                  </div>
                )}

                {/* Citations */}
                {citations.length > 0 && (
                  <div className="space-y-2">
                    <Separator />
                    <div className="text-sm font-medium">Citations</div>
                    <div className="space-y-2">
                      {citations.map((citation, i) => (
                        <div
                          key={i}
                          className="p-2 rounded border text-xs bg-muted/30"
                        >
                          <div className="font-medium text-muted-foreground">
                            [{i + 1}] {citation.document_id}
                          </div>
                          {citation.text && (
                            <div className="mt-1 text-foreground line-clamp-2">
                              {citation.text}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up Questions */}
                {followupQuestions.length > 0 && (
                  <div className="space-y-2">
                    <Separator />
                    <div className="text-sm font-medium flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      Follow-up Questions
                    </div>
                    <div className="space-y-1">
                      {followupQuestions.map((q, i) => (
                        <Button
                          key={i}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-left h-auto py-2 text-sm"
                          onClick={() => setQuery(q)}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Retrieved Context */}
                {hits.length > 0 && (
                  <Collapsible open={contextOpen} onOpenChange={setContextOpen}>
                    <Separator />
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between mt-2"
                      >
                        <span className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Retrieved Context ({hits.length} documents)
                        </span>
                        {contextOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {hits.map((hit, i) => (
                        <div
                          key={hit._id || i}
                          className="p-3 rounded-lg border text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{hit._id}</span>
                            <Badge variant="secondary" className="text-xs">
                              {hit._score?.toFixed(3)}
                            </Badge>
                          </div>
                          {hit._source && (
                            <pre className="text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(hit._source, null, 2).slice(0, 500)}
                              {JSON.stringify(hit._source).length > 500 && "..."}
                            </pre>
                          )}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Help text */}
      <div className="mt-6 text-xs text-muted-foreground">
        <p>
          <strong>RAG Playground:</strong> Enter a natural language question to search
          your documents and generate an AI-powered answer with citations. Configure
          classification, follow-up questions, and confidence scoring in Settings.
        </p>
      </div>
    </div>
  );
};

export default RagPlaygroundPage;
