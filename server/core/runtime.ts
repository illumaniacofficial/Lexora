import type { DirectorId } from "./directors";
import type { RuntimeMode } from "../config/env";

export type ExecutionLocation = "local" | "cloud";

export type RuntimeCapability =
  | "text-generation"
  | "long-context"
  | "structured-output"
  | "image-generation"
  | "speech-generation"
  | "web-research"
  | "translation"
  | "embeddings";

export interface ModelRuntimeDescriptor {
  id: string;
  location: ExecutionLocation;
  provider: string;
  model: string;
  available: boolean;
  capabilities: RuntimeCapability[];
  maxContextTokens?: number;
  estimatedCostClass?: "free" | "low" | "standard" | "premium";
}

export interface AgentTaskRequest<TPayload = unknown> {
  id: string;
  director: DirectorId;
  kind: string;
  payload: TPayload;
  runtimeMode: RuntimeMode;
  requiredCapabilities: RuntimeCapability[];
  allowCloud: boolean;
  allowQueueWhenOffline: boolean;
  projectId?: number;
  propertyId?: string;
  artifactParentId?: string;
}

export interface AgentTaskResult<TValue = unknown> {
  taskId: string;
  value: TValue;
  runtime: ModelRuntimeDescriptor;
  queued: boolean;
  staleExternalData?: boolean;
  warnings?: string[];
}

export interface RuntimeAvailability {
  mode: RuntimeMode;
  local: ModelRuntimeDescriptor[];
  cloud: ModelRuntimeDescriptor[];
  online: boolean;
}

export function canRunInLocation(
  request: AgentTaskRequest,
  runtime: ModelRuntimeDescriptor,
): boolean {
  if (!runtime.available) return false;
  if (runtime.location === "cloud" && (!request.allowCloud || request.runtimeMode === "off-grid")) {
    return false;
  }
  return request.requiredCapabilities.every((capability) =>
    runtime.capabilities.includes(capability),
  );
}
