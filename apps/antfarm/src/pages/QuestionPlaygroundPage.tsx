import { ReloadIcon } from "@radix-ui/react-icons";
import { Clock, FileText, HelpCircle, MessageCircle, RotateCcw, Zap } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Generate response types matching Termite API
interface GenerateResponse {
  model: string;
  texts: string[][];
}

interface ModelsResponse {
  chunkers: string[];
  rerankers: string[];
  ner: string[];
  embedders: string[];
  generators: string[];
}

const SAMPLE_CONTEXT = `The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It is named after the engineer Gustave Eiffel, whose company designed and built the tower from 1887 to 1889 as the entrance arch for the 1889 World's Fair. The tower is 330 metres tall and was the tallest man-made structure in the world until the Chrysler Building in New York City was built in 1930.`;

const SAMPLE_ANSWER = "Gustave Eiffel";

const TERMITE_API_URL = "http://localhost:11433";

const QuestionPlaygroundPage: React.FC = () => {
  const [context, setContext] = useState("");
  const [answer, setAnswer] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch available models on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(`${TERMITE_API_URL}/api/models`);
        if (response.ok) {
          const data: ModelsResponse = await response.json();
          setAvailableModels(data.generators || []);
          if (data.generators && data.generators.length > 0) {
            setSelectedModel(data.generators[0]);
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

  // Format input for LMQG question generation models
  const formatInput = (ctx: string, ans: string): string => {
    // Highlight the answer in the context
    const highlightedContext = ctx.replace(
      new RegExp(`(${ans.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"),
      "<hl> $1 <hl>"
    );
    return `generate question: ${highlightedContext}`;
  };

  const handleGenerate = async () => {
    if (!context.trim()) {
      setError("Please enter a context passage");
      return;
    }

    if (!answer.trim()) {
      setError("Please enter an answer to generate a question for");
      return;
    }

    if (!selectedModel) {
      setError("Please select a model");
      return;
    }

    // Check if answer appears in context
    if (!context.toLowerCase().includes(answer.toLowerCase())) {
      setError("The answer should appear in the context passage");
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
      const formattedInput = formatInput(context, answer);

      const response = await fetch(`${TERMITE_API_URL}/api/question`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          inputs: [formattedInput],
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const data: GenerateResponse = await response.json();
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
    setContext("");
    setAnswer("");
    setResult(null);
    setError(null);
    setProcessingTime(null);
  };

  const loadSampleText = () => {
    setContext(SAMPLE_CONTEXT);
    setAnswer(SAMPLE_ANSWER);
  };

  // Highlight the answer in the context for display
  const renderHighlightedContext = () => {
    if (!answer.trim()) {
      return <span>{context}</span>;
    }

    const regex = new RegExp(`(${answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = context.split(regex);

    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === answer.toLowerCase() ? (
            <span
              key={index}
              className="bg-yellow-200 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-100 px-1 rounded"
            >
              {part}
            </span>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </>
    );
  };

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Question Generation Playground</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate questions from context and answer pairs using Seq2Seq models
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
        <CardContent>
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

            {/* Generate Button */}
            <div className="space-y-2 flex items-end lg:col-start-3">
              <Button
                onClick={handleGenerate}
                disabled={isLoading || !context.trim() || !answer.trim() || !selectedModel}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <ReloadIcon className="h-4 w-4 mr-2 animate-spin" />
                    Generating
                  </>
                ) : (
                  <>
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Generate Question
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
            <Zap className="h-3 w-3" />
            {result.model}
          </Badge>
          {processingTime && (
            <Badge variant="outline" className="gap-1.5">
              <Clock className="h-3 w-3" />
              {processingTime.toFixed(0)}ms
            </Badge>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Input</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            {/* Context */}
            <div className="space-y-2">
              <Label htmlFor="context">Context Passage</Label>
              <Textarea
                id="context"
                placeholder="Enter a passage of text containing the answer..."
                className="h-48 resize-y font-mono text-sm"
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
            </div>

            {/* Answer */}
            <div className="space-y-2">
              <Label htmlFor="answer">Answer</Label>
              <Textarea
                id="answer"
                placeholder="Enter the answer that the question should target..."
                className="h-20 resize-y font-mono text-sm"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The answer should appear in the context passage above.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Output Panel */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{result ? "Generated Question" : "Preview"}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            {result ? (
              <div className="space-y-6">
                {/* Generated Question(s) */}
                <div className="space-y-3">
                  {result.texts.map((textArray, inputIndex) =>
                    textArray.map((question, beamIndex) => (
                      <div
                        key={`${inputIndex}-${beamIndex}`}
                        className="p-4 bg-primary/5 border border-primary/20 rounded-lg"
                      >
                        <div className="flex items-start gap-3">
                          <MessageCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                          <p className="text-lg font-medium">{question}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Context with highlighted answer */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Context (answer highlighted)
                  </Label>
                  <div className="p-3 bg-muted/50 rounded-lg border text-sm leading-relaxed">
                    {renderHighlightedContext()}
                  </div>
                </div>

                {/* Answer */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Target Answer</Label>
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border border-yellow-300 dark:border-yellow-700 text-sm font-medium">
                    {answer}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Enter context and answer, then click "Generate Question"</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Help text */}
      <div className="mt-6 text-xs text-muted-foreground space-y-1">
        <p>
          <strong>Question Generation:</strong> Uses Seq2Seq models (T5, FLAN-T5) trained for
          question generation. The model generates a question that would be answered by the
          specified answer within the given context.
        </p>
        <p>
          <strong>LMQG Models:</strong> Compatible with LMQG (Language Model for Question
          Generation) models. The input is automatically formatted with answer highlighting.
        </p>
      </div>
    </div>
  );
};

export default QuestionPlaygroundPage;
