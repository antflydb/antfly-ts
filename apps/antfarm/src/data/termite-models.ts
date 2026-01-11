// Termite Model Type Definitions
// Types and helper functions for working with Termite registry models

export type ModelType =
  | "embedder"
  | "reranker"
  | "chunker"
  | "recognizer"
  | "rewriter"
  | "generator";

export type RecognizerCapability = "labels" | "zeroshot" | "relations" | "answers";

export type QuantizationType = "f32" | "f16" | "i8" | "i8-st" | "i4" | "i4-cuda";

export type Backend = "onnx" | "xla" | "go";

// Hardware capabilities that models can run on
export type HardwareCapability = "nvidia-gpu" | "apple-silicon" | "google-tpu" | "cpu";

export interface HardwareInfo {
  type: HardwareCapability;
  label: string;
  shortLabel: string;
  description: string;
}

// Hardware capability metadata
export const HARDWARE_INFO: Record<HardwareCapability, HardwareInfo> = {
  "nvidia-gpu": {
    type: "nvidia-gpu",
    label: "NVIDIA GPU",
    shortLabel: "GPU",
    description: "NVIDIA CUDA-enabled GPUs for accelerated inference",
  },
  "apple-silicon": {
    type: "apple-silicon",
    label: "Apple Silicon",
    shortLabel: "Apple",
    description: "Apple M-series chips with Metal/CoreML acceleration",
  },
  "google-tpu": {
    type: "google-tpu",
    label: "Google TPU",
    shortLabel: "TPU",
    description: "Google Cloud TPU for high-throughput inference",
  },
  cpu: {
    type: "cpu",
    label: "CPU",
    shortLabel: "CPU",
    description: "Standard CPU inference (always available)",
  },
};

// Map backends to supported hardware capabilities
export const BACKEND_TO_HARDWARE: Record<Backend, HardwareCapability[]> = {
  onnx: ["nvidia-gpu", "apple-silicon", "cpu"],
  xla: ["google-tpu", "nvidia-gpu", "cpu"],
  go: ["cpu"],
};

// Get unique hardware capabilities from a list of backends
export function getHardwareCapabilities(backends?: Backend[]): HardwareCapability[] {
  if (!backends || backends.length === 0) {
    return ["cpu"]; // Default to CPU-only if no backends specified
  }

  const capabilities = new Set<HardwareCapability>();
  for (const backend of backends) {
    const hardware = BACKEND_TO_HARDWARE[backend];
    if (hardware) {
      for (const cap of hardware) {
        capabilities.add(cap);
      }
    }
  }

  // Return in a logical order: GPU first, then Apple, then TPU, then CPU
  const order: HardwareCapability[] = ["nvidia-gpu", "apple-silicon", "google-tpu", "cpu"];
  return order.filter((cap) => capabilities.has(cap));
}

// Variant presets for quick selection
export type VariantPreset = "recommended" | "smallest" | "highest-quality";

export interface VariantPresetInfo {
  type: VariantPreset;
  label: string;
  description: string;
  // Function to find the best matching variant from available options
  selectVariant: (available: QuantizationType[]) => QuantizationType | undefined;
}

export const VARIANT_PRESETS: VariantPresetInfo[] = [
  {
    type: "recommended",
    label: "Recommended",
    description: "Best balance of speed and accuracy (FP16)",
    selectVariant: (available) => {
      // Prefer f16, then f32, then i8
      if (available.includes("f16")) return "f16";
      if (available.includes("f32")) return "f32";
      if (available.includes("i8")) return "i8";
      return available[0];
    },
  },
  {
    type: "smallest",
    label: "Smallest",
    description: "Fastest inference, smallest download (INT8)",
    selectVariant: (available) => {
      // Prefer i8, then i4, then f16
      if (available.includes("i8")) return "i8";
      if (available.includes("i4")) return "i4";
      if (available.includes("f16")) return "f16";
      return available[0];
    },
  },
  {
    type: "highest-quality",
    label: "Best Quality",
    description: "Maximum accuracy, larger download (FP32)",
    selectVariant: (available) => {
      // Prefer f32, then f16
      if (available.includes("f32")) return "f32";
      if (available.includes("f16")) return "f16";
      return available[0];
    },
  },
];

export interface QuantizationOption {
  type: QuantizationType;
  name: string;
  description: string;
  recommended?: boolean;
  generatorOnly?: boolean;
}

export interface TermiteModel {
  id: string;
  name: string;
  source: string;
  sourceUrl: string;
  type: ModelType;
  description: string;
  capabilities?: RecognizerCapability[];
  variants: QuantizationType[];
  backends?: Backend[];
  architecture?: string;
  size?: string;
  inRegistry: boolean;
}

export interface ModelTypeInfo {
  type: ModelType;
  name: string;
  description: string;
  icon: string;
}

// Map quantization types to CLI variant names
const VARIANT_CLI_NAMES: Record<QuantizationType, string> = {
  f32: "fp32",
  f16: "fp16",
  i8: "int8",
  "i8-st": "int8-static",
  i4: "int4",
  "i4-cuda": "int4-cuda",
};

// Helper functions that work with model data

export function getModelsByType(models: TermiteModel[], type: ModelType): TermiteModel[] {
  return models.filter((model) => model.type === type);
}

export function getModelById(models: TermiteModel[], id: string): TermiteModel | undefined {
  return models.find((model) => model.id === id);
}

export function getRegistryModels(models: TermiteModel[]): TermiteModel[] {
  return models.filter((model) => model.inRegistry);
}

export function getExportableModels(models: TermiteModel[]): TermiteModel[] {
  return models.filter((model) => !model.inRegistry);
}

export function getModelsWithCapability(
  models: TermiteModel[],
  capability: RecognizerCapability
): TermiteModel[] {
  return models.filter(
    (model) => model.capabilities && model.capabilities.includes(capability)
  );
}

export function getQuantizationInfo(
  options: QuantizationOption[],
  type: QuantizationType
): QuantizationOption | undefined {
  return options.find((opt) => opt.type === type);
}

// Generate download command for a model
export function getDownloadCommand(
  model: TermiteModel,
  quantization?: QuantizationType
): string {
  // Base command: termite pull hf:SOURCE --type TYPE
  let cmd = `termite pull hf:${model.source} --type ${model.type}`;

  // Add variant flag if specified
  if (quantization) {
    const variantName = VARIANT_CLI_NAMES[quantization];
    if (!variantName) {
      console.error(`Unknown quantization type: ${quantization}`);
      return cmd;
    }
    cmd += ` --variant ${variantName}`;
  }

  return cmd;
}

// Get the model card URL
export function getModelCardUrl(model: TermiteModel): string {
  return model.sourceUrl;
}
