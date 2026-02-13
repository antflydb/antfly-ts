import type { AntflyType, QueryHit } from "@antfly/sdk";
import { ReloadIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/hooks/use-api-config";
import type { DocumentSchema, JSONSchema, TableSchema } from "../api";

const ANTFLY_TYPES: { value: AntflyType; label: string }[] = [
  { value: "text", label: "Text (full-text search)" },
  { value: "keyword", label: "Keyword (exact match)" },
  { value: "html", label: "HTML (parsed text)" },
  { value: "numeric", label: "Numeric" },
  { value: "datetime", label: "Datetime" },
  { value: "geopoint", label: "Geo Point" },
  { value: "embedding", label: "Embedding (vector)" },
];

interface FieldInfo {
  name: string;
  example: unknown;
  seenCount: number;
  inferredType: "string" | "number" | "boolean" | "object" | "array";
  selectedTypes: AntflyType[];
}

interface FieldExplorerProps {
  tableName: string;
  onSchemaGenerated: (schema: TableSchema) => void;
}

function inferJSONType(value: unknown): "string" | "number" | "boolean" | "object" | "array" {
  if (value === null || value === undefined) return "string";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}

function getDefaultAntflyType(jsonType: string, value: unknown): AntflyType[] {
  if (jsonType === "number") return ["numeric"];
  if (jsonType === "boolean") return [];
  if (jsonType === "array") return ["keyword"];
  if (jsonType === "object") return [];

  // For strings, try to detect datetime
  if (typeof value === "string") {
    // ISO date pattern
    if (/^\d{4}-\d{2}-\d{2}(T|\s)?\d{2}:\d{2}/.test(value)) {
      return ["datetime"];
    }
    // HTML content
    if (/<[a-z][\s\S]*>/i.test(value)) {
      return ["html"];
    }
  }

  return ["text"];
}

function truncateValue(value: unknown, maxLen = 50): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  let str: string;
  if (typeof value === "object") {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }

  if (str.length > maxLen) {
    return str.substring(0, maxLen) + "...";
  }
  return str;
}

export default function FieldExplorer({ tableName, onSchemaGenerated }: FieldExplorerProps) {
  const client = useApi();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [sampleCount, setSampleCount] = useState(0);

  const handleExplore = async () => {
    setIsLoading(true);
    setError(null);
    setFields([]);

    try {
      const response = await client.tables.query(tableName, {
        full_text_search: { match_all: {} },
        limit: 50,
      });

      const hits = response?.responses?.[0]?.hits?.hits;
      if (!hits || hits.length === 0) {
        setError("No documents found in table");
        return;
      }

      const results = hits as QueryHit[];
      setSampleCount(results.length);

      // Collect field info across all documents
      const fieldMap = new Map<string, FieldInfo>();

      for (const hit of results) {
        const source = hit._source;
        if (!source) continue;

        for (const [key, value] of Object.entries(source)) {
          // Skip internal fields
          if (key.startsWith("_")) continue;

          const existing = fieldMap.get(key);
          if (existing) {
            existing.seenCount++;
            // Keep first non-null example
            if (existing.example === null && value !== null) {
              existing.example = value;
            }
          } else {
            const inferredType = inferJSONType(value);
            fieldMap.set(key, {
              name: key,
              example: value,
              seenCount: 1,
              inferredType,
              selectedTypes: getDefaultAntflyType(inferredType, value),
            });
          }
        }
      }

      // Sort by frequency (most common first)
      const sortedFields = Array.from(fieldMap.values()).sort(
        (a, b) => b.seenCount - a.seenCount
      );

      setFields(sortedFields);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to explore table");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeChange = (fieldName: string, newType: AntflyType) => {
    setFields((prev) =>
      prev.map((f) =>
        f.name === fieldName
          ? { ...f, selectedTypes: [newType] }
          : f
      )
    );
  };

  const handleSecondaryTypeToggle = (fieldName: string, type: AntflyType, checked: boolean) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.name !== fieldName) return f;
        const types = new Set(f.selectedTypes);
        if (checked) {
          types.add(type);
        } else {
          types.delete(type);
        }
        return { ...f, selectedTypes: Array.from(types) };
      })
    );
  };

  const handleApplySchema = () => {
    // Build schema from field selections
    const properties: JSONSchema["properties"] = {};

    for (const field of fields) {
      if (field.selectedTypes.length === 0) continue;

      properties[field.name] = {
        type: field.inferredType === "array" ? "array" : field.inferredType,
        "x-antfly-types": field.selectedTypes,
      };

      if (field.inferredType === "array") {
        properties[field.name].items = { type: "string" };
      }
    }

    const documentSchema: DocumentSchema = {
      schema: {
        type: "object",
        properties,
      },
    };

    const tableSchema: TableSchema = {
      document_schemas: {
        default: documentSchema,
      },
      default_type: "default",
    };

    onSchemaGenerated(tableSchema);
  };

  if (fields.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          No schema defined. Explore your data to discover fields and create a schema.
        </p>
        <Button onClick={handleExplore} disabled={isLoading}>
          {isLoading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
          Explore Records
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Found {fields.length} fields in {sampleCount} sampled documents
        </p>
        <Button variant="outline" size="sm" onClick={handleExplore} disabled={isLoading}>
          {isLoading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
          Rescan
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead>Example</TableHead>
              <TableHead>Seen</TableHead>
              <TableHead>Primary Type</TableHead>
              <TableHead>+ Keyword</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field) => (
              <TableRow key={field.name}>
                <TableCell className="font-mono text-sm">{field.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  {truncateValue(field.example)}
                </TableCell>
                <TableCell className="text-sm">
                  {Math.round((field.seenCount / sampleCount) * 100)}%
                </TableCell>
                <TableCell>
                  <Select
                    value={field.selectedTypes[0] || "text"}
                    onValueChange={(v) => handleTypeChange(field.name, v as AntflyType)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_skip">— skip —</SelectItem>
                      {ANTFLY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {field.selectedTypes[0] === "text" && (
                    <Checkbox
                      checked={field.selectedTypes.includes("keyword")}
                      onCheckedChange={(checked) =>
                        handleSecondaryTypeToggle(field.name, "keyword", !!checked)
                      }
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button onClick={handleApplySchema}>Apply to Schema</Button>
    </div>
  );
}
