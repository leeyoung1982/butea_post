// LLM provider configurations. BYOK — keys live in the browser's
// localStorage (NOT for production multi-user use).
//
// Text generation and image generation are SEPARATE configs by design:
// most creators want a cheap fast chat model (e.g. DeepSeek) and a
// strong image model (e.g. OpenAI DALL-E 3), and there's no reason to
// force them to come from the same provider.

// ====================================================================
// Text providers (chat / streaming)
// ====================================================================

export type ProviderId = "openai" | "anthropic" | "deepseek" | "custom";

export type ProviderConfig = {
  id: ProviderId;
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
  format: "openai" | "anthropic";
  docsUrl: string;
};

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    label: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    format: "openai",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-6",
    format: "anthropic",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    format: "openai",
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "custom",
    label: "自定义 (OpenAI 兼容)",
    defaultBaseUrl: "",
    defaultModel: "",
    format: "openai",
    docsUrl: "",
  },
];

// ====================================================================
// Image providers (generation)
//
// Most non-OpenAI image APIs that creators reach for offer an
// OpenAI-compatible `/images/generations` endpoint or a thin OpenAI
// gateway. We send the OpenAI request shape and let the user point
// `baseUrl` wherever they need.
// ====================================================================

export type ImageProviderId = "openai" | "fal" | "custom";

/** Wire format of the upstream API. Determines URL shape, auth header,
 *  request body keys, and response parsing in /api/image. */
export type ImageWireFormat = "openai" | "fal";

export type ImageProviderConfig = {
  id: ImageProviderId;
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
  docsUrl: string;
  note: string;
  format: ImageWireFormat;
};

export const IMAGE_PROVIDERS: ImageProviderConfig[] = [
  {
    id: "openai",
    label: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "dall-e-3",
    docsUrl: "https://platform.openai.com/api-keys",
    note: "DALL-E 3 / gpt-image-1。约 $0.04/张。",
    format: "openai",
  },
  {
    id: "fal",
    label: "fal.ai",
    defaultBaseUrl: "https://fal.run",
    defaultModel: "openai/gpt-image-2",
    docsUrl: "https://fal.ai/dashboard/keys",
    note: "代理 GPT Image 2 / Flux / SD 等。Model 写模型路径如 openai/gpt-image-2。",
    format: "fal",
  },
  {
    id: "custom",
    label: "自定义 (OpenAI 兼容)",
    defaultBaseUrl: "",
    defaultModel: "",
    docsUrl: "",
    note:
      "支持任何提供 OpenAI 兼容 /images/generations 的服务（火山方舟、阿里云、自托管网关等）",
    format: "openai",
  },
];

export function resolveImageFormat(s: LLMSettings | null): ImageWireFormat {
  const id = s?.imageProviderId ?? "openai";
  return IMAGE_PROVIDERS.find((p) => p.id === id)?.format ?? "openai";
}

// ====================================================================
// Persisted settings shape
// ====================================================================

export type LLMSettings = {
  // Text
  providerId: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;

  // Image (each can be independent of the text provider)
  imageProviderId?: ImageProviderId;
  imageApiKey?: string;
  imageBaseUrl?: string;
  imageModel?: string;

  /**
   * Free-form writing-style preferences injected into all AI text prompts.
   * Use it to teach the AI your voice, taboos, audience nuances, etc.
   * Empty = no extra constraints.
   */
  writingPreferences?: string;
};

// ====================================================================
// Resolvers
// ====================================================================

/**
 * Resolve which key to use for image generation. We prefer an explicit
 * `imageApiKey`; if absent, fall back to the chat `apiKey` only when the
 * text provider is OpenAI (since the same key works for both endpoints).
 * Returns null if no usable key is available.
 */
export function resolveImageKey(s: LLMSettings | null): string | null {
  if (!s) return null;
  if (s.imageApiKey) return s.imageApiKey;
  if (s.providerId === "openai" && s.apiKey) return s.apiKey;
  return null;
}

export function resolveImageModel(s: LLMSettings | null): string {
  return s?.imageModel || "dall-e-3";
}

export function resolveImageBaseUrl(s: LLMSettings | null): string {
  // Prefer explicit user setting; otherwise pick the provider's default.
  if (s?.imageBaseUrl) return s.imageBaseUrl;
  const cfg = IMAGE_PROVIDERS.find((p) => p.id === s?.imageProviderId);
  if (cfg?.defaultBaseUrl) return cfg.defaultBaseUrl;
  // Last-resort: reuse the text provider's base URL when both are OpenAI.
  if (s?.providerId === "openai" && s.baseUrl) return s.baseUrl;
  return "https://api.openai.com/v1";
}

export function resolveImageProviderId(
  s: LLMSettings | null
): ImageProviderId {
  return s?.imageProviderId ?? "openai";
}

// ====================================================================
// Persistence
// ====================================================================

export const STORAGE_KEY = "claude-wechat-llm:settings";

export function loadSettings(): LLMSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LLMSettings;
  } catch {
    return null;
  }
}

export function saveSettings(s: LLMSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/** Read the user's writing-style preferences (or empty string). Cheap; safe
 *  to call in render. */
export function loadWritingPreferences(): string {
  return loadSettings()?.writingPreferences?.trim() ?? "";
}
