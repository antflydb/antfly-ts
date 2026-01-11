import { useState, useEffect, useCallback, useRef } from "react";
import type {
  TermiteModel,
  ModelType,
  ModelTypeInfo,
  QuantizationOption,
  QuantizationType,
  RecognizerCapability,
  Backend,
} from "@/data/termite-models";

const TERMITE_API_URL = "http://localhost:11433";
const FETCH_TIMEOUT = 10000; // 10 seconds

// API response types (snake_case from server)
interface RegistryModelResponse {
  id: string;
  name: string;
  source: string;
  source_url: string;
  type: ModelType;
  description: string;
  capabilities?: RecognizerCapability[];
  variants: QuantizationType[];
  backends?: Backend[];
  architecture?: string;
  size?: string;
  in_registry: boolean;
}

interface RegistryTypeResponse {
  type: ModelType;
  name: string;
  description: string;
  icon: string;
}

interface RegistryQuantizationResponse {
  type: QuantizationType;
  name: string;
  description: string;
  recommended?: boolean;
  generator_only?: boolean;
}

interface RegistryResponse {
  models: RegistryModelResponse[];
  types: RegistryTypeResponse[];
  quantization_options: RegistryQuantizationResponse[];
}

export interface TermiteRegistryState {
  models: TermiteModel[];
  types: ModelTypeInfo[];
  quantizationOptions: QuantizationOption[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

// Transform API response to camelCase types
function transformModel(apiModel: RegistryModelResponse): TermiteModel {
  return {
    id: apiModel.id,
    name: apiModel.name,
    source: apiModel.source,
    sourceUrl: apiModel.source_url,
    type: apiModel.type,
    description: apiModel.description,
    capabilities: apiModel.capabilities,
    variants: apiModel.variants,
    backends: apiModel.backends,
    architecture: apiModel.architecture,
    size: apiModel.size,
    inRegistry: apiModel.in_registry,
  };
}

function transformQuantizationOption(
  apiOption: RegistryQuantizationResponse
): QuantizationOption {
  return {
    type: apiOption.type,
    name: apiOption.name,
    description: apiOption.description,
    recommended: apiOption.recommended,
    generatorOnly: apiOption.generator_only,
  };
}

// Cache for registry data to avoid refetching
let registryCache: {
  models: TermiteModel[];
  types: ModelTypeInfo[];
  quantizationOptions: QuantizationOption[];
} | null = null;

export function useTermiteRegistry(): TermiteRegistryState {
  const [models, setModels] = useState<TermiteModel[]>(
    registryCache?.models ?? []
  );
  const [types, setTypes] = useState<ModelTypeInfo[]>(
    registryCache?.types ?? []
  );
  const [quantizationOptions, setQuantizationOptions] = useState<
    QuantizationOption[]
  >(registryCache?.quantizationOptions ?? []);
  const [loading, setLoading] = useState(!registryCache);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchRegistry = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${TERMITE_API_URL}/api/registry`, {
        method: "GET",
        signal: signal ?? AbortSignal.timeout(FETCH_TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch registry: ${response.status}`);
      }

      const data: RegistryResponse = await response.json();

      if (!isMountedRef.current) return;

      const transformedModels = data.models.map(transformModel);
      const transformedTypes = data.types as ModelTypeInfo[];
      const transformedQuantization = data.quantization_options.map(
        transformQuantizationOption
      );

      // Update cache
      registryCache = {
        models: transformedModels,
        types: transformedTypes,
        quantizationOptions: transformedQuantization,
      };

      setModels(transformedModels);
      setTypes(transformedTypes);
      setQuantizationOptions(transformedQuantization);
      setLoading(false);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (!isMountedRef.current) return;

      const message =
        err instanceof Error ? err.message : "Failed to connect to Termite";
      setError(message);
      setLoading(false);
    }
  }, []);

  const retry = useCallback(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  // Initial fetch on mount
  useEffect(() => {
    isMountedRef.current = true;

    // Skip fetch if we have cached data
    if (registryCache) {
      return;
    }

    const controller = new AbortController();
    fetchRegistry(controller.signal);

    return () => {
      isMountedRef.current = false;
      controller.abort();
    };
  }, [fetchRegistry]);

  return {
    models,
    types,
    quantizationOptions,
    loading,
    error,
    retry,
  };
}
