import { ReloadIcon } from "@radix-ui/react-icons";
import { Clock, Copy, Globe, Mic, RotateCcw, Trash2, Upload, Zap } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackendInfoBar } from "@/components/playground/BackendInfoBar";
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
import { useApiConfig } from "@/hooks/use-api-config";
import { fetchWithRetry } from "@/lib/utils";

// --- Local type definitions ---

interface TranscribeResponse {
  model: string;
  text: string;
  language?: string;
}

interface UploadedAudio {
  name: string;
  base64: string;
  dataUri: string;
  mimeType: string;
  size: number;
}

interface ModelsResponse {
  transcribers?: Record<string, unknown>;
  [key: string]: unknown;
}

// --- Helpers ---

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

// --- Component ---

const TranscribePlaygroundPage: React.FC = () => {
  const { termiteApiUrl } = useApiConfig();

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [availableTranscribers, setAvailableTranscribers] = useState<string[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Audio state
  const [selectedTranscriberModel, setSelectedTranscriberModel] = useState("");
  const [audioFile, setAudioFile] = useState<UploadedAudio | null>(null);
  const [language, setLanguage] = useState("");
  const [transcribeResult, setTranscribeResult] = useState<TranscribeResponse | null>(null);
  const [isDraggingAudio, setIsDraggingAudio] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Refs
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Fetch available models on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(`${termiteApiUrl}/api/models`);
        if (response.ok) {
          const data: ModelsResponse = await response.json();
          const transcribers = Object.keys(data.transcribers || {});
          setAvailableTranscribers(transcribers);
          if (transcribers.length > 0) setSelectedTranscriberModel(transcribers[0]);
        }
      } catch {
        console.error("Failed to fetch models");
      } finally {
        setModelsLoaded(true);
      }
    };
    fetchModels();
  }, [termiteApiUrl]);

  // --- Audio handling ---

  const processAudioFile = useCallback((file: File) => {
    if (!file.type.startsWith("audio/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUri = e.target?.result as string;
      // Extract base64 part (after the comma)
      const base64 = dataUri.split(",")[1];
      setAudioFile({
        name: file.name,
        base64,
        dataUri,
        mimeType: file.type,
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleAudioDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingAudio(false);
      if (e.dataTransfer.files.length > 0) {
        processAudioFile(e.dataTransfer.files[0]);
      }
    },
    [processAudioFile]
  );

  // --- API call ---

  const handleTranscribe = async () => {
    if (!audioFile) {
      setError("Please upload an audio file");
      return;
    }
    if (!selectedTranscriberModel) {
      setError("Please select a model");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);
    setTranscribeResult(null);

    const startTime = performance.now();

    try {
      const body: Record<string, unknown> = {
        model: selectedTranscriberModel,
        audio: audioFile.base64,
      };
      if (language.trim()) body.language = language.trim();

      const response = await fetchWithRetry(`${termiteApiUrl}/api/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const data: TranscribeResponse = await response.json();
      setTranscribeResult(data);
      setProcessingTime(performance.now() - startTime);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : `Failed to connect to Termite at ${termiteApiUrl}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // --- Actions ---

  const handleReset = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setAudioFile(null);
    setLanguage("");
    setTranscribeResult(null);
    setError(null);
    setProcessingTime(null);
    setIsLoading(false);
    setCopiedId(null);
  };

  const handleCopy = (text: string, id: string) => {
    copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Transcribe Playground</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Convert speech to text using speech recognition models
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      <BackendInfoBar />

      {/* Config */}
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transcriber-model">Model</Label>
                <Select
                  value={selectedTranscriberModel}
                  onValueChange={setSelectedTranscriberModel}
                  disabled={!modelsLoaded || availableTranscribers.length === 0}
                >
                  <SelectTrigger id="transcriber-model">
                    <SelectValue
                      placeholder={
                        !modelsLoaded
                          ? "Loading models..."
                          : availableTranscribers.length === 0
                            ? "No transcriber models"
                            : "Select a model"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTranscribers.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Input
                  id="language"
                  placeholder="Auto-detect (or e.g. en, es, fr)"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                />
              </div>
              <div className="space-y-2 flex items-end">
                <Button
                  onClick={handleTranscribe}
                  disabled={isLoading || !audioFile || !selectedTranscriberModel}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <ReloadIcon className="h-4 w-4 mr-2 animate-spin" />
                      Transcribing...
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 mr-2" />
                      Transcribe
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Stats */}
        {transcribeResult && (
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="gap-1.5">
              <Zap className="h-3 w-3" />
              {transcribeResult.model}
            </Badge>
            {transcribeResult.language && (
              <Badge variant="secondary" className="gap-1.5">
                <Globe className="h-3 w-3" />
                Language: {transcribeResult.language}
              </Badge>
            )}
            {processingTime != null && (
              <Badge variant="outline" className="gap-1.5">
                <Clock className="h-3 w-3" />
                {processingTime.toFixed(0)}ms
              </Badge>
            )}
          </div>
        )}

        {/* Side-by-side panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input: Upload & Player */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Input Audio</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDraggingAudio
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
                onClick={() => audioInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingAudio(true);
                }}
                onDragLeave={() => setIsDraggingAudio(false)}
                onDrop={handleAudioDrop}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") audioInputRef.current?.click();
                }}
                role="button"
                tabIndex={0}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop audio file here or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports WAV, MP3, FLAC, OGG, and more
                </p>
              </div>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) processAudioFile(e.target.files[0]);
                  e.target.value = "";
                }}
              />

              {/* Audio file info & player */}
              {audioFile && (
                <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mic className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium truncate">{audioFile.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({formatFileSize(audioFile.size)})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => setAudioFile(null)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <audio controls src={audioFile.dataUri} className="w-full" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Output */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {transcribeResult ? "Transcription" : "Output"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              {transcribeResult ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-7 gap-1.5 text-xs"
                      onClick={() => handleCopy(transcribeResult.text, "audio-text")}
                    >
                      <Copy className="h-3 w-3" />
                      {copiedId === "audio-text" ? "Copied!" : "Copy"}
                    </Button>
                    <pre className="p-4 pr-20 bg-muted/30 rounded-lg border text-sm font-mono whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                      {transcribeResult.text || "(no text transcribed)"}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Mic className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Upload audio and click "Transcribe" to extract text</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Help text */}
      <div className="mt-6 text-xs text-muted-foreground space-y-1">
        <p>
          Converts speech to text using speech recognition models (e.g., Whisper). Optionally
          specify a language code to improve accuracy.
        </p>
      </div>
    </div>
  );
};

export default TranscribePlaygroundPage;
