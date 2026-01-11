import { ReloadIcon } from "@radix-ui/react-icons";
import {
  Bot,
  Copy,
  MessageSquare,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  User,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TERMITE_API_URL = "http://localhost:11433";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  isStreaming?: boolean;
}

interface ModelsResponse {
  generators: string[];
}

interface GenerateChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string | null;
    };
    finish_reason?: string;
  }[];
}

const ChatsPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generation parameters
  const [showSettings, setShowSettings] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(512);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful assistant."
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch available generator models on mount
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
        setError(
          "Failed to connect to Termite. Make sure Termite is running on localhost:11433"
        );
      } finally {
        setModelsLoaded(true);
      }
    };
    fetchModels();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const handleSend = async () => {
    if (!inputValue.trim() || isGenerating || !selectedModel) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setError(null);
    setIsGenerating(true);

    // Build the messages array for the API
    const apiMessages: { role: string; content: string }[] = [];

    // Add system prompt if set
    if (systemPrompt.trim()) {
      apiMessages.push({ role: "system", content: systemPrompt.trim() });
    }

    // Add conversation history
    for (const msg of messages) {
      apiMessages.push({ role: msg.role, content: msg.content });
    }

    // Add the new user message
    apiMessages.push({ role: "user", content: userMessage.content });

    // Create placeholder for assistant response
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${TERMITE_API_URL}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: apiMessages,
          max_tokens: maxTokens,
          temperature: temperature,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed: GenerateChunk = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                accumulatedContent += content;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMessage = updated[updated.length - 1];
                  if (lastMessage && lastMessage.role === "assistant") {
                    lastMessage.content = accumulatedContent;
                  }
                  return updated;
                });
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }
      }

      // Mark streaming as complete
      setMessages((prev) => {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];
        if (lastMessage && lastMessage.role === "assistant") {
          lastMessage.isStreaming = false;
        }
        return updated;
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setMessages((prev) => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          if (lastMessage && lastMessage.role === "assistant") {
            lastMessage.isStreaming = false;
            if (!lastMessage.content) {
              lastMessage.content = "[Generation stopped]";
            }
          }
          return updated;
        });
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate response. Make sure Termite is running."
      );

      // Remove the empty assistant message on error
      setMessages((prev) => {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];
        if (
          lastMessage &&
          lastMessage.role === "assistant" &&
          !lastMessage.content
        ) {
          updated.pop();
        }
        return updated;
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const regenerateLastResponse = async () => {
    if (messages.length < 2) return;

    // Find the last user message
    const lastUserMessageIndex = messages
      .map((m, i) => ({ ...m, index: i }))
      .filter((m) => m.role === "user")
      .pop()?.index;

    if (lastUserMessageIndex === undefined) return;

    // Remove messages after the last user message
    const trimmedMessages = messages.slice(0, lastUserMessageIndex + 1);
    setMessages(trimmedMessages);

    // Get the last user message content
    const lastUserMessage = trimmedMessages[lastUserMessageIndex];

    // Trigger a new generation
    setInputValue(lastUserMessage.content);
    // Remove the last user message since handleSend will add it again
    setMessages(trimmedMessages.slice(0, -1));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
            <MessageSquare className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Chat</h1>
            <p className="text-muted-foreground text-sm">
              Chat with local LLM models via Termite
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Model Selector */}
          <Select
            value={selectedModel}
            onValueChange={setSelectedModel}
            disabled={!modelsLoaded || availableModels.length === 0}
          >
            <SelectTrigger className="w-[260px]">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-muted-foreground" />
                <SelectValue
                  placeholder={
                    !modelsLoaded
                      ? "Loading models..."
                      : availableModels.length === 0
                        ? "No generators available"
                        : "Select a model"
                  }
                />
              </div>
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Settings Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showSettings ? "secondary" : "outline"}
                  size="icon"
                  onClick={() => setShowSettings(!showSettings)}
                >
                  <Settings2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Generation settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Clear Chat */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleClearChat}
                  disabled={messages.length === 0}
                >
                  <Trash2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear chat</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Settings Panel */}
      <Collapsible open={showSettings} onOpenChange={setShowSettings}>
        <CollapsibleContent>
          <Card className="mb-4 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Temperature */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Temperature</Label>
                  <Badge variant="secondary">{temperature.toFixed(2)}</Badge>
                </div>
                <Slider
                  value={[temperature]}
                  onValueChange={([v]) => setTemperature(v)}
                  min={0}
                  max={2}
                  step={0.05}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Higher values make output more random
                </p>
              </div>

              {/* Max Tokens */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Max Tokens</Label>
                  <Badge variant="secondary">{maxTokens}</Badge>
                </div>
                <Slider
                  value={[maxTokens]}
                  onValueChange={([v]) => setMaxTokens(v)}
                  min={64}
                  max={2048}
                  step={64}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum tokens to generate
                </p>
              </div>

              {/* System Prompt */}
              <div className="space-y-2">
                <Label>System Prompt</Label>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="You are a helpful assistant..."
                  className="h-20 resize-none text-sm"
                />
              </div>
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Chat Messages */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Bot className="size-8 opacity-50" />
              </div>
              <p className="text-lg font-medium mb-1">Start a conversation</p>
              <p className="text-sm text-center max-w-md">
                Send a message to start chatting with{" "}
                {selectedModel || "the model"}
              </p>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role !== "user" && (
                    <div className="flex-shrink-0 size-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="size-4 text-primary" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "group relative max-w-[75%] rounded-2xl px-4 py-3",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content || (
                        <span className="inline-flex items-center gap-1">
                          <span className="size-1.5 bg-current rounded-full animate-bounce" />
                          <span
                            className="size-1.5 bg-current rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          />
                          <span
                            className="size-1.5 bg-current rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          />
                        </span>
                      )}
                    </div>

                    {/* Message actions */}
                    {message.role === "assistant" &&
                      !message.isStreaming &&
                      message.content && (
                        <div className="absolute -bottom-8 left-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  onClick={() => copyToClipboard(message.content)}
                                >
                                  <Copy className="size-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {index === messages.length - 1 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    onClick={regenerateLastResponse}
                                    disabled={isGenerating}
                                  >
                                    <RotateCcw className="size-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Regenerate</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      )}
                  </div>

                  {message.role === "user" && (
                    <div className="flex-shrink-0 size-8 rounded-full bg-secondary flex items-center justify-center">
                      <User className="size-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  !selectedModel
                    ? "Select a model to start chatting..."
                    : "Type a message... (Enter to send, Shift+Enter for new line)"
                }
                disabled={!selectedModel || isGenerating}
                className="min-h-[44px] max-h-[200px] pr-12 resize-none"
                rows={1}
              />
              <div className="absolute right-2 bottom-2">
                {isGenerating ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={handleStop}
                  >
                    <Square className="size-4 fill-current" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={handleSend}
                    disabled={!inputValue.trim() || !selectedModel}
                  >
                    <Send className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              {isGenerating && (
                <div className="flex items-center gap-1.5">
                  <ReloadIcon className="size-3 animate-spin" />
                  <span>Generating...</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span>Temp: {temperature}</span>
              <span>Max: {maxTokens}</span>
              {messages.length > 0 && (
                <span>{messages.length} messages</span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ChatsPage;
