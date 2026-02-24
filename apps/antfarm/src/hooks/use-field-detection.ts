import type { QueryHit } from "@antfly/sdk";
import { useCallback, useMemo, useState } from "react";
import {
  type DetectedField,
  getDefaultAntflyType,
  inferJSONType,
  RESERVED_FIELD_NAMES,
} from "@/components/schema-builder/schema-utils";
import { useApi } from "@/hooks/use-api-config";

interface UseFieldDetectionResult {
  detect: () => Promise<DetectedField[]>;
  isDetecting: boolean;
  detectionError: string | null;
  detectedFields: DetectedField[];
  sampleCount: number;
}

export function useFieldDetection(tableName?: string): UseFieldDetectionResult {
  const client = useApi();
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [sampleCount, setSampleCount] = useState(0);

  const reservedNames = useMemo(() => new Set(RESERVED_FIELD_NAMES), []);

  const detect = useCallback(async (): Promise<DetectedField[]> => {
    if (!tableName) return [];

    setIsDetecting(true);
    setDetectionError(null);
    setDetectedFields([]);

    try {
      const response = await client.tables.query(tableName, {
        full_text_search: { match_all: {} },
        limit: 50,
      });

      const hits = response?.responses?.[0]?.hits?.hits;
      if (!hits || hits.length === 0) {
        setDetectionError("No documents found in table");
        return [];
      }

      const results = hits as QueryHit[];
      const count = results.length;
      setSampleCount(count);

      const fieldMap = new Map<
        string,
        {
          name: string;
          exampleValue: unknown;
          seenCount: number;
          inferredType: "string" | "number" | "boolean" | "object" | "array";
        }
      >();

      for (const hit of results) {
        const source = hit._source;
        if (!source) continue;

        for (const [key, value] of Object.entries(source)) {
          if (key.startsWith("_") || reservedNames.has(key)) continue;

          const existing = fieldMap.get(key);
          if (existing) {
            existing.seenCount++;
            if (existing.exampleValue === null && value !== null) {
              existing.exampleValue = value;
            }
          } else {
            fieldMap.set(key, {
              name: key,
              exampleValue: value,
              seenCount: 1,
              inferredType: inferJSONType(value),
            });
          }
        }
      }

      const sorted = Array.from(fieldMap.values())
        .sort((a, b) => b.seenCount - a.seenCount)
        .map(
          (f): DetectedField => ({
            name: f.name,
            inferredType: f.inferredType,
            exampleValue: f.exampleValue,
            frequency: f.seenCount / count,
            sampleCount: count,
            suggestedAntflyTypes: getDefaultAntflyType(f.inferredType, f.exampleValue),
          })
        );

      setDetectedFields(sorted);
      return sorted;
    } catch (err) {
      setDetectionError(err instanceof Error ? err.message : "Failed to detect fields");
      return [];
    } finally {
      setIsDetecting(false);
    }
  }, [tableName, client, reservedNames]);

  return { detect, isDetecting, detectionError, detectedFields, sampleCount };
}
