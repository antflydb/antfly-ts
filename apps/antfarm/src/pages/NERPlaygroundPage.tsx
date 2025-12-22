import { ReloadIcon } from "@radix-ui/react-icons";
import {
  Clock,
  FileText,
  Hash,
  Percent,
  Plus,
  RotateCcw,
  Tag,
  X,
  Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";

// NER response types matching Termite API
interface NEREntity {
  text: string;
  label: string;
  start: number;
  end: number;
  score: number;
}

interface NERResponse {
  model: string;
  entities: NEREntity[][];
}

interface ModelsResponse {
  chunkers: string[];
  rerankers: string[];
  ner: string[];
  embedders: string[];
  generators: string[];
}

// Default entity labels for GLiNER
const DEFAULT_LABELS = ["person", "organization", "location"];

// Standard entity type colors (for common NER labels)
const STANDARD_LABEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  per: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-700",
  },
  person: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-700",
  },
  org: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-300 dark:border-green-700",
  },
  organization: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-300 dark:border-green-700",
  },
  loc: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-300 dark:border-purple-700",
  },
  location: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-300 dark:border-purple-700",
  },
  misc: {
    bg: "bg-gray-100 dark:bg-gray-800/30",
    text: "text-gray-700 dark:text-gray-300",
    border: "border-gray-300 dark:border-gray-600",
  },
};

// Dynamic colors for custom labels (when not in standard set)
const DYNAMIC_COLORS = [
  {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-300 dark:border-orange-700",
  },
  {
    bg: "bg-pink-100 dark:bg-pink-900/30",
    text: "text-pink-700 dark:text-pink-300",
    border: "border-pink-300 dark:border-pink-700",
  },
  {
    bg: "bg-cyan-100 dark:bg-cyan-900/30",
    text: "text-cyan-700 dark:text-cyan-300",
    border: "border-cyan-300 dark:border-cyan-700",
  },
  {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-300",
    border: "border-yellow-300 dark:border-yellow-700",
  },
  {
    bg: "bg-indigo-100 dark:bg-indigo-900/30",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-300 dark:border-indigo-700",
  },
  {
    bg: "bg-rose-100 dark:bg-rose-900/30",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-300 dark:border-rose-700",
  },
  {
    bg: "bg-teal-100 dark:bg-teal-900/30",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-300 dark:border-teal-700",
  },
  {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-700",
  },
];

const SAMPLE_TEXT = `Apple Inc. announced that Tim Cook will be visiting the new headquarters in Cupertino, California next Monday. The company plans to unveil several new products, including the iPhone 16 and MacBook Pro. Meanwhile, Google's CEO Sundar Pichai confirmed that the search giant is expanding its AI research team in London. Microsoft and Amazon are also investing heavily in artificial intelligence, with Jeff Bezos recently stating that AWS will double its machine learning capabilities by 2025.`;

const TERMITE_API_URL = "http://localhost:11433";

const NERPlaygroundPage: React.FC = () => {
  const [inputText, setInputText] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [labels, setLabels] = useState<string[]>(DEFAULT_LABELS);
  const [newLabel, setNewLabel] = useState("");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
  const [result, setResult] = useState<NERResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const labelColorMapRef = useRef<Map<string, number>>(new Map());

  // Fetch available models on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(`${TERMITE_API_URL}/api/models`);
        if (response.ok) {
          const data: ModelsResponse = await response.json();
          setAvailableModels(data.ner || []);
          if (data.ner && data.ner.length > 0) {
            setSelectedModel(data.ner[0]);
          }
        }
      } catch {
        console.error("Failed to fetch models");
      } finally {
        setModelsLoaded(true);
      }
    };
    fetchModels();
  }, []);

  const getColorForLabel = (label: string) => {
    const normalizedLabel = label.toLowerCase();

    // Check standard colors first
    if (STANDARD_LABEL_COLORS[normalizedLabel]) {
      return STANDARD_LABEL_COLORS[normalizedLabel];
    }

    // Use dynamic color assignment for custom labels
    if (!labelColorMapRef.current.has(normalizedLabel)) {
      const nextIndex = labelColorMapRef.current.size % DYNAMIC_COLORS.length;
      labelColorMapRef.current.set(normalizedLabel, nextIndex);
    }

    return DYNAMIC_COLORS[labelColorMapRef.current.get(normalizedLabel)!];
  };

  const handleRecognize = async () => {
    if (!inputText.trim()) {
      setError("Please enter some text to analyze");
      return;
    }

    if (!selectedModel) {
      setError("Please select a model");
      return;
    }

    if (labels.length === 0) {
      setError("Please add at least one entity label");
      return;
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);
    setResult(null);
    labelColorMapRef.current.clear();

    const startTime = performance.now();

    try {
      const response = await fetch(`${TERMITE_API_URL}/api/recognize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          texts: [inputText],
          labels: labels,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const data: NERResponse = await response.json();
      setResult(data);
      setProcessingTime(performance.now() - startTime);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Failed to connect to Termite. Make sure Termite is running on localhost:11433"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setInputText("");
    setLabels(DEFAULT_LABELS);
    setNewLabel("");
    setConfidenceThreshold(0.5);
    setResult(null);
    setError(null);
    setProcessingTime(null);
    labelColorMapRef.current.clear();
  };

  const handleAddLabel = () => {
    const trimmedLabel = newLabel.trim().toLowerCase();
    if (trimmedLabel && !labels.includes(trimmedLabel)) {
      setLabels([...labels, trimmedLabel]);
      setNewLabel("");
    }
  };

  const handleRemoveLabel = (labelToRemove: string) => {
    setLabels(labels.filter((l) => l !== labelToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddLabel();
    }
  };

  const loadSampleText = () => {
    setInputText(SAMPLE_TEXT);
    setLabels(["person", "organization", "location", "product", "date"]);
  };

  // Get filtered entities based on confidence threshold
  const getFilteredEntities = (): NEREntity[] => {
    if (!result || !result.entities || result.entities.length === 0) {
      return [];
    }
    return result.entities[0].filter((entity) => entity.score >= confidenceThreshold);
  };

  // Render text with entity highlighting
  const renderHighlightedText = () => {
    const entities = getFilteredEntities();

    if (entities.length === 0) {
      if (result) {
        return (
          <div className="text-sm text-muted-foreground">
            No entities found{" "}
            {confidenceThreshold > 0
              ? `above ${(confidenceThreshold * 100).toFixed(0)}% confidence`
              : ""}
          </div>
        );
      }
      return (
        <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-mono">
          {inputText || 'Enter text and click "Extract Entities" to see results'}
        </pre>
      );
    }

    // Sort entities by start position
    const sortedEntities = [...entities].sort((a, b) => a.start - b.start);

    const elements: React.ReactNode[] = [];
    let lastEnd = 0;

    sortedEntities.forEach((entity, index) => {
      // Add text before this entity
      if (entity.start > lastEnd) {
        elements.push(<span key={`text-${index}`}>{inputText.slice(lastEnd, entity.start)}</span>);
      }

      // Add the entity with highlighting
      const colors = getColorForLabel(entity.label);
      elements.push(
        <span
          key={`entity-${index}`}
          className={`${colors.bg} ${colors.border} rounded px-1 py-0.5 border cursor-help`}
          title={`${entity.label}: ${(entity.score * 100).toFixed(1)}% confidence`}
        >
          {entity.text}
        </span>
      );

      lastEnd = entity.end;
    });

    // Add remaining text
    if (lastEnd < inputText.length) {
      elements.push(<span key="end">{inputText.slice(lastEnd)}</span>);
    }

    return (
      <div className="whitespace-pre-wrap text-sm font-mono leading-relaxed">{elements}</div>
    );
  };

  // Get unique labels from results for legend
  const getUniqueLabels = (): string[] => {
    const entities = getFilteredEntities();
    return [...new Set(entities.map((e) => e.label))];
  };

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">NER Playground</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Extract named entities from text using GLiNER models
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadSampleText}>
            <FileText className="h-4 w-4 mr-2" />
            Load Sample
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Configuration Panel */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={!modelsLoaded || availableModels.length === 0}
              >
                <SelectTrigger id="model">
                  <SelectValue
                    placeholder={
                      !modelsLoaded
                        ? "Loading models..."
                        : availableModels.length === 0
                          ? "No models available"
                          : "Select a model"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Confidence Threshold */}
            <div className="space-y-2">
              <Label htmlFor="threshold">Confidence Threshold</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="threshold"
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={(confidenceThreshold * 100).toFixed(0)}
                  onChange={(e) => {
                    const val = Number.parseInt(e.target.value);
                    if (!Number.isNaN(val) && val >= 0 && val <= 100) {
                      setConfidenceThreshold(val / 100);
                    }
                  }}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>

            {/* Extract Button */}
            <div className="space-y-2 flex items-end">
              <Button
                onClick={handleRecognize}
                disabled={isLoading || !inputText.trim() || !selectedModel}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <ReloadIcon className="h-4 w-4 mr-2 animate-spin" />
                    Processing
                  </>
                ) : (
                  <>
                    <Tag className="h-4 w-4 mr-2" />
                    Extract Entities
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Entity Labels */}
          <div className="space-y-2">
            <Label>Entity Labels (GLiNER)</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {labels.map((label) => {
                const colors = getColorForLabel(label);
                return (
                  <Badge
                    key={label}
                    variant="secondary"
                    className={`${colors.bg} ${colors.text} ${colors.border} border gap-1`}
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => handleRemoveLabel(label)}
                      className="ml-1 hover:opacity-70"
                      aria-label={`Remove ${label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add custom label..."
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                className="max-w-xs"
              />
              <Button variant="outline" size="sm" onClick={handleAddLabel} disabled={!newLabel.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              GLiNER models extract entities matching these labels. Press Enter or click + to add.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Results Stats Bar */}
      {result && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="gap-1.5">
            <Hash className="h-3 w-3" />
            {getFilteredEntities().length} entities
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            <Zap className="h-3 w-3" />
            {result.model}
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            <Percent className="h-3 w-3" />
            {(confidenceThreshold * 100).toFixed(0)}% threshold
          </Badge>
          {processingTime && (
            <Badge variant="outline" className="gap-1.5">
              <Clock className="h-3 w-3" />
              {processingTime.toFixed(0)}ms
            </Badge>
          )}
        </div>
      )}

      {/* Main Content - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Input Text</CardTitle>
              {inputText && (
                <span className="text-xs text-muted-foreground">{inputText.length} characters</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <Textarea
              placeholder="Paste or type your text here to extract named entities..."
              className="h-100 resize-y font-mono text-sm"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Output Panel */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{result ? "Extracted Entities" : "Preview"}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            {result ? (
              <div className="h-100 overflow-y-auto space-y-4">
                {/* Legend */}
                {getUniqueLabels().length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-2">
                    {getUniqueLabels().map((label) => {
                      const colors = getColorForLabel(label);
                      return (
                        <Badge
                          key={label}
                          variant="outline"
                          className={`${colors.bg} ${colors.text} ${colors.border} text-xs`}
                        >
                          {label}
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* Highlighted text view */}
                <div className="p-3 bg-muted/50 rounded-lg border max-h-37.5 overflow-y-auto">
                  {renderHighlightedText()}
                </div>

                <Separator />

                {/* Entity list */}
                <div className="space-y-2">
                  {getFilteredEntities().length > 0 ? (
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Entity</th>
                            <th className="text-left px-3 py-2 font-medium">Label</th>
                            <th className="text-right px-3 py-2 font-medium">Confidence</th>
                            <th className="text-right px-3 py-2 font-medium">Position</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getFilteredEntities().map((entity, index) => {
                            const colors = getColorForLabel(entity.label);
                            return (
                              <tr key={index} className="border-t hover:bg-muted/30">
                                <td className="px-3 py-2 font-mono">{entity.text}</td>
                                <td className="px-3 py-2">
                                  <Badge
                                    variant="secondary"
                                    className={`${colors.bg} ${colors.text} ${colors.border} border text-xs`}
                                  >
                                    {entity.label}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {(entity.score * 100).toFixed(1)}%
                                </td>
                                <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                                  {entity.start}-{entity.end}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No entities found above the confidence threshold
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-100 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Tag className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Enter text and click "Extract Entities" to see results</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Help text */}
      <div className="mt-6 text-xs text-muted-foreground space-y-1">
        <p>
          <strong>GLiNER Models:</strong> Zero-shot named entity recognition. Add custom labels to
          extract any entity types you need - no retraining required.
        </p>
        <p>
          <strong>Confidence Threshold:</strong> Adjust the slider to filter out low-confidence
          predictions. Higher thresholds show fewer but more reliable entities.
        </p>
      </div>
    </div>
  );
};

export default NERPlaygroundPage;
