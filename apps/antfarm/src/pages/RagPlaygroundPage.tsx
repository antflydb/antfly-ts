import { generatorProviders, type QueryHit } from "@antfly/sdk";
import { ReloadIcon } from "@radix-ui/react-icons";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  HelpCircle,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Target,
} from "lucide-react";
import type React from "react";
import { useCallback, useReducer, useRef, useState } from "react";
import { PipelineTrace } from "@/components/rag/PipelineTrace";
import {
  type ConfidenceStepData,
  type FollowupStepData,
  type GenerationStepData,
  initialPipelineState,
  type PipelineStepId,
  pipelineReducer,
  type SearchStepData,
} from "@/components/rag/pipeline-types";
import { TableIndexSelector } from "@/components/TableIndexSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { useTableIndexSelector } from "@/hooks/use-table-index-selector";

// Generator provider type from SDK
type GeneratorProvider = (typeof generatorProviders)[number];

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
  model: "gpt-4o-mini",
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
        <div key={lineIndex} className="flex gap-2" style={{ marginLeft: `${indentLevel * 1}rem` }}>
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

  // Table & Index selection (shared hook with URL sync)
  const {
    tables,
    selectedTable,
    setSelectedTable,
    embeddingIndexes,
    selectedIndex,
    setSelectedIndex,
  } = useTableIndexSelector({ syncToUrl: true });

  // Config state
  const [query, setQuery] = useState("");
  const [generator, setGenerator] = useState<GeneratorConfig>(DEFAULT_GENERATOR);
  const [limit, setLimit] = useState(10);
  const [steps, setSteps] = useState<StepsConfig>(DEFAULT_STEPS);
  const [settingsOpen, setSettingsOpen] = useState(true);

  // Pipeline state
  const [pipeline, dispatchPipeline] = useReducer(pipelineReducer, initialPipelineState);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  const handleReset = () => {
    setQuery("");
    setError(null);
    setProcessingTime(null);
    setSteps(DEFAULT_STEPS);
    setGenerator(DEFAULT_GENERATOR);
    setLimit(10);
    dispatchPipeline({ type: "RESET" });
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
    setIsLoading(true);
    setError(null);
    setProcessingTime(null);
    startTimeRef.current = performance.now();

    // Determine enabled pipeline steps
    const enabledSteps: PipelineStepId[] = [];
    if (steps.classification.enabled) enabledSteps.push("classification");
    enabledSteps.push("search");
    enabledSteps.push("generation");
    if (steps.confidence.enabled) enabledSteps.push("confidence");
    if (steps.followup.enabled) enabledSteps.push("followup");

    dispatchPipeline({ type: "START", enabledSteps });

    // Track accumulated data for pipeline steps
    let accumulatedAnswer = "";
    const accumulatedHits: QueryHit[] = [];
    const accumulatedFollowups: string[] = [];
    let searchCompleted = false;

    try {
      // Mark search as running immediately
      if (steps.classification.enabled) {
        dispatchPipeline({ type: "STEP_START", stepId: "classification" });
      } else {
        dispatchPipeline({ type: "STEP_START", stepId: "search" });
      }

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
          onClassification: (c) => {
            dispatchPipeline({
              type: "STEP_COMPLETE",
              stepId: "classification",
              data: { classification: c },
            });
            dispatchPipeline({ type: "STEP_START", stepId: "search" });
          },
          onHit: (hit) => {
            accumulatedHits.push(hit);
            dispatchPipeline({
              type: "STEP_UPDATE",
              stepId: "search",
              data: { hits: [...accumulatedHits] } as SearchStepData,
            });
          },
          onAnswer: (chunk) => {
            // First answer chunk: complete search, start generation
            if (!searchCompleted) {
              searchCompleted = true;
              dispatchPipeline({
                type: "STEP_COMPLETE",
                stepId: "search",
                data: { hits: [...accumulatedHits] } as SearchStepData,
              });
              dispatchPipeline({ type: "STEP_START", stepId: "generation" });
            }
            accumulatedAnswer += chunk;
            dispatchPipeline({
              type: "STEP_UPDATE",
              stepId: "generation",
              data: {
                answer: accumulatedAnswer,
                provider: generator.provider,
                model: generator.model,
              } as GenerationStepData,
            });
          },
          onFollowUpQuestion: (q) => {
            accumulatedFollowups.push(q);
            dispatchPipeline({ type: "STEP_START", stepId: "followup" });
            dispatchPipeline({
              type: "STEP_UPDATE",
              stepId: "followup",
              data: { questions: [...accumulatedFollowups] } as FollowupStepData,
            });
          },
          onConfidence: (c) => {
            dispatchPipeline({
              type: "STEP_COMPLETE",
              stepId: "confidence",
              data: {
                generation: c.generation_confidence,
                context: c.context_relevance,
              } as ConfidenceStepData,
            });
          },
          onError: (e) => {
            setError(e);
            setIsLoading(false);
            dispatchPipeline({ type: "ERROR", error: e });
          },
          onDone: () => {
            setIsLoading(false);
            setProcessingTime(performance.now() - startTimeRef.current);
            // Complete any running steps (search may still be running if no answer chunks arrived)
            if (!searchCompleted) {
              searchCompleted = true;
              dispatchPipeline({
                type: "STEP_COMPLETE",
                stepId: "search",
                data: { hits: [...accumulatedHits] } as SearchStepData,
              });
            }
            dispatchPipeline({
              type: "STEP_COMPLETE",
              stepId: "generation",
              data: {
                answer: accumulatedAnswer,
                provider: generator.provider,
                model: generator.model,
              } as GenerationStepData,
            });
            if (accumulatedFollowups.length > 0) {
              dispatchPipeline({
                type: "STEP_COMPLETE",
                stepId: "followup",
                data: { questions: accumulatedFollowups } as FollowupStepData,
              });
            }
            dispatchPipeline({ type: "COMPLETE" });
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
              {/* Table & Index selectors at top of query card */}
              <TableIndexSelector
                tables={tables}
                selectedTable={selectedTable}
                onTableChange={setSelectedTable}
                embeddingIndexes={embeddingIndexes}
                selectedIndex={selectedIndex}
                onIndexChange={setSelectedIndex}
              />

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
                            {generatorProviders.map((p) => (
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
                          onChange={(e) => setGenerator((g) => ({ ...g, model: e.target.value }))}
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
                          <p className="text-xs text-muted-foreground">Analyze query strategy</p>
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
                          <p className="text-xs text-muted-foreground">Rate answer confidence</p>
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

        {/* Right Column - Pipeline Trace */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Results</CardTitle>
              {processingTime && (
                <Badge variant="outline" className="gap-1.5">
                  <Clock className="h-3 w-3" />
                  {(processingTime / 1000).toFixed(1)}s
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            <PipelineTrace
              pipeline={pipeline}
              onFollowupClick={(q) => setQuery(q)}
              formatAnswer={formatAnswer}
            />
          </CardContent>
        </Card>
      </div>

      {/* Help text */}
      <div className="mt-6 text-xs text-muted-foreground">
        <p>
          <strong>RAG Playground:</strong> Enter a natural language question to search your
          documents and generate an AI-powered answer with citations. Configure classification,
          follow-up questions, and confidence scoring in Settings.
        </p>
      </div>
    </div>
  );
};

export default RagPlaygroundPage;
