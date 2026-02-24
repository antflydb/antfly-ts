import { ReloadIcon } from "@radix-ui/react-icons";
import {
  Clock,
  Copy,
  FileText,
  Globe,
  Hash,
  Mic,
  RotateCcw,
  ScanLine,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiConfig } from "@/hooks/use-api-config";
import { fetchWithRetry } from "@/lib/utils";

// --- Local type definitions ---

interface ReadResult {
  text: string;
  fields?: Record<string, string>;
  regions?: TextRegion[];
}

interface TextRegion {
  text: string;
  bbox: number[];
  confidence?: number;
  label?: string;
}

interface ReadResponse {
  model: string;
  results: ReadResult[];
}

interface TranscribeResponse {
  model: string;
  text: string;
  language?: string;
}

interface UploadedImage {
  id: string;
  name: string;
  dataUri: string;
  width: number;
  height: number;
}

interface UploadedAudio {
  name: string;
  base64: string;
  dataUri: string;
  mimeType: string;
  size: number;
}

interface ModelsResponse {
  readers?: Record<string, unknown>;
  transcribers?: Record<string, unknown>;
  [key: string]: unknown;
}

// --- Helpers ---

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function generateSampleInvoiceImage(): Promise<UploadedImage> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 300;
    const ctx = canvas.getContext("2d")!;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 600, 300);

    // Header
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("INVOICE", 40, 50);

    // Invoice details
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#444444";
    ctx.fillText("Invoice #12345", 40, 90);
    ctx.fillText("Date: 2024-01-15", 40, 115);
    ctx.fillText("Bill To: Acme Corp", 40, 140);

    // Line items
    ctx.font = "14px monospace";
    ctx.fillStyle = "#333333";
    ctx.fillText("Item                   Qty    Price", 40, 180);
    ctx.fillText("─────────────────────────────────────", 40, 195);
    ctx.fillText("Widget A                 2   $25.00", 40, 215);
    ctx.fillText("Widget B                 1   $49.00", 40, 235);

    // Total
    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = "#1a1a1a";
    ctx.fillText("Total: $99.00", 40, 275);

    // Border
    ctx.strokeStyle = "#cccccc";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 598, 298);

    const dataUri = canvas.toDataURL("image/png");
    resolve({
      id: crypto.randomUUID(),
      name: "sample-invoice.png",
      dataUri,
      width: 600,
      height: 300,
    });
  });
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

// --- Component ---

const OCRPlaygroundPage: React.FC = () => {
  const { termiteApiUrl } = useApiConfig();

  // Shared state
  const [activeTab, setActiveTab] = useState<"image" | "audio">("image");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [availableReaders, setAvailableReaders] = useState<string[]>([]);
  const [availableTranscribers, setAvailableTranscribers] = useState<string[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Image OCR state
  const [selectedReaderModel, setSelectedReaderModel] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [maxTokens, setMaxTokens] = useState<string>("");
  const [readResult, setReadResult] = useState<ReadResponse | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [showBboxOverlay, setShowBboxOverlay] = useState(true);
  const [outputTab, setOutputTab] = useState("text");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Audio state
  const [selectedTranscriberModel, setSelectedTranscriberModel] = useState("");
  const [audioFile, setAudioFile] = useState<UploadedAudio | null>(null);
  const [language, setLanguage] = useState("");
  const [transcribeResult, setTranscribeResult] = useState<TranscribeResponse | null>(null);
  const [isDraggingAudio, setIsDraggingAudio] = useState(false);

  // Refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Fetch available models on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(`${termiteApiUrl}/api/models`);
        if (response.ok) {
          const data: ModelsResponse = await response.json();
          const readers = Object.keys(data.readers || {});
          const transcribers = Object.keys(data.transcribers || {});
          setAvailableReaders(readers);
          setAvailableTranscribers(transcribers);
          if (readers.length > 0) setSelectedReaderModel(readers[0]);
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

  // Auto-set prompt based on selected model (only when prompt is empty or a known auto-value)
  useEffect(() => {
    if (!selectedReaderModel) return;
    const autoValues = ["", "<s_cord-v2>", "<OCR>"];
    if (!autoValues.includes(prompt)) return;
    const lower = selectedReaderModel.toLowerCase();
    if (lower.includes("donut")) {
      setPrompt("<s_cord-v2>");
    } else if (lower.includes("florence")) {
      setPrompt("<OCR>");
    } else {
      setPrompt("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReaderModel]);

  // --- Image handling ---

  const processImageFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));
    for (const file of fileArray) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          setImages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              name: file.name,
              dataUri,
              width: img.naturalWidth,
              height: img.naturalHeight,
            },
          ]);
        };
        img.src = dataUri;
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleImageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingImage(false);
      if (e.dataTransfer.files.length > 0) {
        processImageFiles(e.dataTransfer.files);
      }
    },
    [processImageFiles]
  );

  const removeImage = (id: string) => {
    const idx = images.findIndex((img) => img.id === id);
    const filtered = images.filter((img) => img.id !== id);
    setImages(filtered);
    if (selectedImageIndex >= filtered.length) {
      setSelectedImageIndex(Math.max(0, filtered.length - 1));
    } else if (idx < selectedImageIndex) {
      setSelectedImageIndex((prev) => Math.max(0, prev - 1));
    }
  };

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

  // --- API calls ---

  const handleReadImages = async () => {
    if (images.length === 0) {
      setError("Please upload at least one image");
      return;
    }
    if (!selectedReaderModel) {
      setError("Please select a model");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);
    setReadResult(null);

    const startTime = performance.now();

    try {
      const body: Record<string, unknown> = {
        model: selectedReaderModel,
        images: images.map((img) => ({ url: img.dataUri })),
      };
      if (prompt.trim()) body.prompt = prompt.trim();
      if (maxTokens && Number.parseInt(maxTokens) > 0)
        body.max_tokens = Number.parseInt(maxTokens);

      const response = await fetchWithRetry(`${termiteApiUrl}/api/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const data: ReadResponse = await response.json();
      setReadResult(data);
      setProcessingTime(performance.now() - startTime);
      setSelectedImageIndex(0);
      setOutputTab("text");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : `Failed to connect to Termite at ${termiteApiUrl}`
      );
    } finally {
      setIsLoading(false);
    }
  };

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
    setImages([]);
    setPrompt("");
    setMaxTokens("");
    setReadResult(null);
    setAudioFile(null);
    setLanguage("");
    setTranscribeResult(null);
    setError(null);
    setProcessingTime(null);
    setSelectedImageIndex(0);
    setIsLoading(false);
    setCopiedId(null);
  };

  const loadSampleData = async () => {
    if (activeTab === "image") {
      const sample = await generateSampleInvoiceImage();
      setImages([sample]);
      setSelectedImageIndex(0);
      setReadResult(null);
      setError(null);
    } else {
      setError(
        "No sample audio available. Upload a WAV, MP3, or other audio file to test transcription."
      );
    }
  };

  const handleCopy = (text: string, id: string) => {
    copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Current result for selected image
  const currentResult =
    readResult?.results && readResult.results.length > selectedImageIndex
      ? readResult.results[selectedImageIndex]
      : null;

  const hasFields = currentResult?.fields && Object.keys(currentResult.fields).length > 0;
  const hasRegions = currentResult?.regions && currentResult.regions.length > 0;

  // Determine available output tabs and reset to "text" if current tab no longer valid
  const outputTabs = ["text"];
  if (hasFields) outputTabs.push("fields");
  if (hasRegions) outputTabs.push("regions");
  outputTabs.push("json");

  useEffect(() => {
    if (!outputTabs.includes(outputTab)) {
      setOutputTab("text");
    }
  }, [selectedImageIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">OCR Playground</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Extract text from images and transcribe audio using vision and speech models
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadSampleData}>
            <FileText className="h-4 w-4 mr-2" />
            Load Sample
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Mode Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as "image" | "audio");
          setError(null);
        }}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="image" className="gap-2">
            <ScanLine className="h-4 w-4" />
            Image OCR
          </TabsTrigger>
          <TabsTrigger value="audio" className="gap-2">
            <Mic className="h-4 w-4" />
            Audio Transcription
          </TabsTrigger>
        </TabsList>

        {/* Image OCR Tab */}
        <TabsContent value="image" className="mt-6 space-y-6">
          {/* Config */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reader-model">Model</Label>
                  <Select
                    value={selectedReaderModel}
                    onValueChange={setSelectedReaderModel}
                    disabled={!modelsLoaded || availableReaders.length === 0}
                  >
                    <SelectTrigger id="reader-model">
                      <SelectValue
                        placeholder={
                          !modelsLoaded
                            ? "Loading models..."
                            : availableReaders.length === 0
                              ? "No reader models"
                              : "Select a model"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableReaders.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompt">Prompt</Label>
                  <Input
                    id="prompt"
                    placeholder="Optional prompt..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-tokens">Max Tokens</Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    placeholder="Default"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(e.target.value)}
                  />
                </div>
                <div className="space-y-2 flex items-end">
                  <Button
                    onClick={handleReadImages}
                    disabled={isLoading || images.length === 0 || !selectedReaderModel}
                    className="w-full"
                  >
                    {isLoading && activeTab === "image" ? (
                      <>
                        <ReloadIcon className="h-4 w-4 mr-2 animate-spin" />
                        Reading...
                      </>
                    ) : (
                      <>
                        <ScanLine className="h-4 w-4 mr-2" />
                        Read Images
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error */}
          {error && activeTab === "image" && (
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Stats */}
          {readResult && (
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="gap-1.5">
                <Hash className="h-3 w-3" />
                {images.length} image{images.length !== 1 ? "s" : ""}
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <Zap className="h-3 w-3" />
                {readResult.model}
              </Badge>
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
            {/* Input: Upload & Previews */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Input Images</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                {/* Drop zone */}
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDraggingImage
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                  onClick={() => imageInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingImage(true);
                  }}
                  onDragLeave={() => setIsDraggingImage(false)}
                  onDrop={handleImageDrop}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") imageInputRef.current?.click();
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drop images here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports PNG, JPG, WebP, and more
                  </p>
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) processImageFiles(e.target.files);
                    e.target.value = "";
                  }}
                />

                {/* Thumbnails */}
                {images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {images.map((img, idx) => (
                      <div
                        key={img.id}
                        className={`relative group cursor-pointer rounded-md overflow-hidden border-2 transition-all ${
                          selectedImageIndex === idx
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-transparent hover:border-muted-foreground/30"
                        }`}
                        onClick={() => setSelectedImageIndex(idx)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setSelectedImageIndex(idx);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <img
                          src={img.dataUri}
                          alt={img.name}
                          className="w-full h-16 object-cover"
                        />
                        <button
                          type="button"
                          className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(img.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <p className="text-[10px] text-muted-foreground truncate px-1 py-0.5">
                          {img.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected image preview */}
                {images.length > 0 && images[selectedImageIndex] && (
                  <div className="rounded-lg overflow-hidden border bg-muted/20">
                    <img
                      src={images[selectedImageIndex].dataUri}
                      alt={images[selectedImageIndex].name}
                      className="w-full max-h-80 object-contain"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Output */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {readResult ? "Results" : "Output"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                {readResult && currentResult ? (
                  <div className="space-y-4">
                    {/* Image selector if multiple results */}
                    {readResult.results.length > 1 && (
                      <div className="flex gap-1 flex-wrap">
                        {readResult.results.map((_, idx) => (
                          <Button
                            key={idx}
                            variant={selectedImageIndex === idx ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedImageIndex(idx)}
                          >
                            Image {idx + 1}
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* Output tabs */}
                    <Tabs value={outputTab} onValueChange={setOutputTab}>
                      <TabsList>
                        <TabsTrigger value="text">Text</TabsTrigger>
                        {hasFields && <TabsTrigger value="fields">Fields</TabsTrigger>}
                        {hasRegions && <TabsTrigger value="regions">Regions</TabsTrigger>}
                        <TabsTrigger value="json">JSON</TabsTrigger>
                      </TabsList>

                      <TabsContent value="text" className="mt-3">
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 right-2 h-7 gap-1.5 text-xs"
                            onClick={() => handleCopy(currentResult.text, "ocr-text")}
                          >
                            <Copy className="h-3 w-3" />
                            {copiedId === "ocr-text" ? "Copied!" : "Copy"}
                          </Button>
                          <pre className="p-4 pr-20 bg-muted/30 rounded-lg border text-sm font-mono whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                            {currentResult.text || "(no text extracted)"}
                          </pre>
                        </div>
                      </TabsContent>

                      {hasFields && (
                        <TabsContent value="fields" className="mt-3">
                          <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/30">
                                  <th className="text-left p-2 font-medium">Field</th>
                                  <th className="text-left p-2 font-medium">Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(currentResult.fields!).map(([key, value]) => (
                                  <tr key={key} className="border-b last:border-0">
                                    <td className="p-2 font-mono text-xs text-muted-foreground">
                                      {key}
                                    </td>
                                    <td className="p-2 font-mono text-xs">{value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </TabsContent>
                      )}

                      {hasRegions && (
                        <TabsContent value="regions" className="mt-3 space-y-3">
                          {/* Bbox overlay on image */}
                          <div className="flex items-center gap-2 mb-2">
                            <Switch
                              id="bbox-toggle"
                              checked={showBboxOverlay}
                              onCheckedChange={setShowBboxOverlay}
                            />
                            <Label htmlFor="bbox-toggle" className="text-sm">
                              Show bounding boxes
                            </Label>
                          </div>
                          {images[selectedImageIndex] && (
                            <div className="relative rounded-lg overflow-hidden border bg-muted/20 inline-block max-w-full">
                              <img
                                src={images[selectedImageIndex].dataUri}
                                alt="regions overlay"
                                className="block max-w-full max-h-72"
                              />
                              {showBboxOverlay &&
                                currentResult.regions!.map((region, rIdx) => {
                                  const img = images[selectedImageIndex];
                                  if (!region.bbox || region.bbox.length < 4) return null;
                                  const [x, y, w, h] = region.bbox;
                                  const left = (x / img.width) * 100;
                                  const top = (y / img.height) * 100;
                                  const width = (w / img.width) * 100;
                                  const height = (h / img.height) * 100;

                                  const colors = [
                                    "border-red-500",
                                    "border-blue-500",
                                    "border-green-500",
                                    "border-yellow-500",
                                    "border-purple-500",
                                    "border-pink-500",
                                  ];
                                  const color = colors[rIdx % colors.length];

                                  return (
                                    <div
                                      key={rIdx}
                                      className={`absolute border-2 ${color} pointer-events-none`}
                                      style={{
                                        left: `${left}%`,
                                        top: `${top}%`,
                                        width: `${width}%`,
                                        height: `${height}%`,
                                      }}
                                      title={region.text}
                                    />
                                  );
                                })}
                            </div>
                          )}

                          {/* Regions table */}
                          <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/30">
                                  <th className="text-left p-2 font-medium">#</th>
                                  <th className="text-left p-2 font-medium">Text</th>
                                  {currentResult.regions!.some((r) => r.label) && (
                                    <th className="text-left p-2 font-medium">Label</th>
                                  )}
                                  {currentResult.regions!.some(
                                    (r) => r.confidence != null
                                  ) && (
                                    <th className="text-left p-2 font-medium">Confidence</th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {currentResult.regions!.map((region, rIdx) => (
                                  <tr key={rIdx} className="border-b last:border-0">
                                    <td className="p-2 text-muted-foreground">{rIdx + 1}</td>
                                    <td className="p-2 font-mono text-xs">{region.text}</td>
                                    {currentResult.regions!.some((r) => r.label) && (
                                      <td className="p-2 text-xs">{region.label || "-"}</td>
                                    )}
                                    {currentResult.regions!.some(
                                      (r) => r.confidence != null
                                    ) && (
                                      <td className="p-2 font-mono text-xs">
                                        {region.confidence != null
                                          ? `${(region.confidence * 100).toFixed(1)}%`
                                          : "-"}
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </TabsContent>
                      )}

                      <TabsContent value="json" className="mt-3">
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 right-2 h-7 gap-1.5 text-xs"
                            onClick={() =>
                              handleCopy(JSON.stringify(currentResult, null, 2), "ocr-json")
                            }
                          >
                            <Copy className="h-3 w-3" />
                            {copiedId === "ocr-json" ? "Copied!" : "Copy"}
                          </Button>
                          <pre className="p-4 pr-20 bg-muted/30 rounded-lg border text-xs font-mono whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                            {JSON.stringify(currentResult, null, 2)}
                          </pre>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <ScanLine className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>Upload images and click "Read Images" to extract text</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Audio Transcription Tab */}
        <TabsContent value="audio" className="mt-6 space-y-6">
          {/* Config */}
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
                    {isLoading && activeTab === "audio" ? (
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
          {error && activeTab === "audio" && (
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
        </TabsContent>
      </Tabs>

      {/* Help text */}
      <div className="mt-6 text-xs text-muted-foreground space-y-1">
        <p>
          <strong>Image OCR:</strong> Extracts text, structured fields, and text regions from
          images using vision models (e.g., Donut, Florence, TrOCR). Set a prompt to guide
          extraction for specific models.
        </p>
        <p>
          <strong>Audio Transcription:</strong> Converts speech to text using speech recognition
          models (e.g., Whisper). Optionally specify a language code to improve accuracy.
        </p>
      </div>
    </div>
  );
};

export default OCRPlaygroundPage;
