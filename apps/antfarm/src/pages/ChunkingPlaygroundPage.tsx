import { ReloadIcon } from "@radix-ui/react-icons";
import { Clock, Database, Hash, RotateCcw, Scissors, Zap } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
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

// Chunk response types matching Termite API
interface ChunkItem {
  id: number;
  text: string;
  start_char: number;
  end_char: number;
}

interface ChunkResponse {
  chunks: ChunkItem[];
  model: string;
  cache_hit: boolean;
}

// Configuration state
interface ChunkConfig {
  model: string;
  target_tokens: number;
  overlap_tokens: number;
  separator: string;
  max_chunks: number;
  threshold: number;
}

const DEFAULT_CONFIG: ChunkConfig = {
  model: "fixed",
  target_tokens: 500,
  overlap_tokens: 50,
  separator: "\\n\\n",
  max_chunks: 50,
  threshold: 0.5,
};

// Color palette for chunk visualization
const CHUNK_COLORS = [
  "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
  "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
  "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700",
  "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700",
  "bg-pink-100 dark:bg-pink-900/30 border-pink-300 dark:border-pink-700",
  "bg-cyan-100 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700",
  "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700",
  "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700",
];

const CHUNK_TEXT_COLORS = [
  "text-blue-700 dark:text-blue-300",
  "text-green-700 dark:text-green-300",
  "text-purple-700 dark:text-purple-300",
  "text-orange-700 dark:text-orange-300",
  "text-pink-700 dark:text-pink-300",
  "text-cyan-700 dark:text-cyan-300",
  "text-yellow-700 dark:text-yellow-300",
  "text-indigo-700 dark:text-indigo-300",
];

const TERMITE_API_URL = "http://localhost:11433";

const ChunkingPlaygroundPage: React.FC = () => {
  const [inputText, setInputText] = useState("");
  const [config, setConfig] = useState<ChunkConfig>(DEFAULT_CONFIG);
  const [result, setResult] = useState<ChunkResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleChunk = async () => {
    if (!inputText.trim()) {
      setError("Please enter some text to chunk");
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

    const startTime = performance.now();

    try {
      // Convert escaped separator back to actual characters
      const actualSeparator = config.separator.replace(/\\n/g, "\n").replace(/\\t/g, "\t");

      const response = await fetch(`${TERMITE_API_URL}/api/chunk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: inputText,
          config: {
            model: config.model,
            target_tokens: config.target_tokens,
            overlap_tokens: config.overlap_tokens,
            separator: actualSeparator,
            max_chunks: config.max_chunks,
            threshold: config.threshold,
          },
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const data: ChunkResponse = await response.json();
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
    setConfig(DEFAULT_CONFIG);
    setInputText("");
    setResult(null);
    setError(null);
    setProcessingTime(null);
  };

  const estimateTokens = (text: string): number => {
    // Rough approximation: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  };

  // Render text with chunk boundaries highlighted
  const renderHighlightedText = () => {
    if (!result || result.chunks.length === 0) {
      return (
        <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-mono">
          {inputText || "Enter text and click 'Chunk' to see results"}
        </pre>
      );
    }

    const elements: React.ReactNode[] = [];
    let lastEnd = 0;

    result.chunks.forEach((chunk, index) => {
      // Add any text before this chunk (gaps)
      if (chunk.start_char > lastEnd) {
        elements.push(
          <span key={`gap-${chunk.id}`} className="text-muted-foreground/50">
            {inputText.slice(lastEnd, chunk.start_char)}
          </span>
        );
      }

      // Add the chunk with highlighting
      const colorIndex = index % CHUNK_COLORS.length;
      elements.push(
        <span
          key={`chunk-${chunk.id}`}
          className={`${CHUNK_COLORS[colorIndex]} rounded px-0.5 border`}
          title={`Chunk ${chunk.id}`}
        >
          {inputText.slice(chunk.start_char, chunk.end_char)}
        </span>
      );

      lastEnd = chunk.end_char;
    });

    // Add any remaining text after the last chunk
    if (lastEnd < inputText.length) {
      elements.push(
        <span key="end" className="text-muted-foreground/50">
          {inputText.slice(lastEnd)}
        </span>
      );
    }

    return <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">{elements}</pre>;
  };

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Chunking Playground</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Experiment with different chunking models and configurations
          </p>
        </div>
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>

      {/* Configuration Panel */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select
                value={config.model}
                onValueChange={(value) => setConfig({ ...config, model: value })}
              >
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Token Size</SelectItem>
                  <SelectItem value="chonky-mmbert-small-multilingual-1">
                    Chonky (ONNX Semantic)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Basic/Fixed model options */}
            {config.model === "fixed" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="target_tokens">Target Tokens</Label>
                  <Input
                    id="target_tokens"
                    type="number"
                    min={50}
                    max={2000}
                    value={config.target_tokens}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        target_tokens: parseInt(e.target.value, 10) || 500,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="overlap_tokens">Overlap Tokens</Label>
                  <Input
                    id="overlap_tokens"
                    type="number"
                    min={0}
                    max={500}
                    value={config.overlap_tokens}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        overlap_tokens: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="separator">Separator</Label>
                  <Select
                    value={config.separator}
                    onValueChange={(value) => setConfig({ ...config, separator: value })}
                  >
                    <SelectTrigger id="separator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="\\n\\n">Paragraph (\\n\\n)</SelectItem>
                      <SelectItem value="\\n">Line (\\n)</SelectItem>
                      <SelectItem value=". ">Sentence (. )</SelectItem>
                      <SelectItem value=" ">Word ( )</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Semantic (ONNX) model options */}
            {config.model !== "fixed" && (
              <>
                <div className="space-y-2">
                  <Label
                    htmlFor="target_tokens"
                    title="Target tokens per chunk. Small chunks are combined until reaching this size. Set to 0 to disable."
                  >
                    Target Tokens
                  </Label>
                  <Input
                    id="target_tokens"
                    type="number"
                    min={0}
                    max={2000}
                    value={config.target_tokens}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        target_tokens: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="threshold"
                    title="Minimum confidence score (0-1) for separator detection. Higher values = fewer, stronger boundaries."
                  >
                    Threshold
                  </Label>
                  <Input
                    id="threshold"
                    type="text"
                    defaultValue={config.threshold}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!Number.isNaN(val) && val >= 0 && val <= 1) {
                        setConfig({ ...config, threshold: val });
                      } else {
                        e.target.value = String(config.threshold);
                      }
                    }}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="max_chunks">Max Chunks</Label>
              <Input
                id="max_chunks"
                type="number"
                min={1}
                max={200}
                value={config.max_chunks}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    max_chunks: parseInt(e.target.value, 10) || 50,
                  })
                }
              />
            </div>

            <div className="space-y-2 flex items-end">
              <Button
                onClick={handleChunk}
                disabled={isLoading || !inputText.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <ReloadIcon className="h-4 w-4 mr-2 animate-spin" />
                    Processing
                  </>
                ) : (
                  <>
                    <Scissors className="h-4 w-4 mr-2" />
                    Chunk
                  </>
                )}
              </Button>
            </div>
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
            {result.chunks.length} chunks
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            <Zap className="h-3 w-3" />
            {result.model}
          </Badge>
          {result.cache_hit && (
            <Badge variant="secondary" className="gap-1.5">
              <Database className="h-3 w-3" />
              Cache hit
            </Badge>
          )}
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
                <span className="text-xs text-muted-foreground">
                  {inputText.length} chars / ~{estimateTokens(inputText)} tokens
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <Textarea
              placeholder="Paste or type your text here to experiment with chunking..."
              className="h-100 resize-y font-mono text-sm"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Output Panel */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{result ? "Chunked Output" : "Preview"}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            {result ? (
              <div className="h-100 overflow-y-auto space-y-4">
                {/* Highlighted text view */}
                <div className="p-3 bg-muted/50 rounded-lg border max-h-37.5 overflow-y-auto">
                  {renderHighlightedText()}
                </div>

                <Separator />

                {/* Chunk list */}
                <div className="space-y-3">
                  {result.chunks.map((chunk, index) => {
                    const colorIndex = index % CHUNK_COLORS.length;
                    return (
                      <div
                        key={chunk.id}
                        className={`p-3 rounded-lg border ${CHUNK_COLORS[colorIndex]}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`font-semibold text-sm ${CHUNK_TEXT_COLORS[colorIndex]}`}
                          >
                            Chunk {chunk.id}
                          </span>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span>~{estimateTokens(chunk.text)} tokens</span>
                            <span>
                              {chunk.start_char}-{chunk.end_char}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap line-clamp-4 font-mono">
                          {chunk.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-100 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Scissors className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Enter text and click "Chunk" to see results</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Help text */}
      <div className="mt-6 text-xs text-muted-foreground space-y-1">
        <p>
          <strong>Models:</strong> Fixed uses simple token-count splitting with BERT tokenization
          (configure with target tokens, overlap, separator). ONNX models use neural networks for
          intelligent boundary detection (requires models in chunker_models_dir).
        </p>
        {config.model !== "fixed" && (
          <p>
            <strong>Semantic Options:</strong> Target Tokens combines small chunks until reaching
            the target size while preserving strong semantic boundaries (0 = disabled, keeps
            original neural splits).
          </p>
        )}
      </div>
    </div>
  );
};

export default ChunkingPlaygroundPage;
