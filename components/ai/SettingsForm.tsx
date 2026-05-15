"use client";

import * as React from "react";
import { MessageSquareText, Image as ImageIcon, PenLine } from "lucide-react";
import {
  PROVIDERS,
  IMAGE_PROVIDERS,
  type LLMSettings,
  type ProviderId,
  type ImageProviderId,
} from "@/lib/llm/providers";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * AI provider settings — text and image are configured independently.
 *
 * Layout: two stacked panels, each self-contained. A creator using DeepSeek
 * for writing and OpenAI for image gen fills both; one using only OpenAI
 * for everything fills the top and ignores the bottom (or sets imageProvider
 * to "OpenAI" which auto-reuses the chat key).
 */
export function SettingsForm({
  initial,
  onSave,
}: {
  initial: LLMSettings | null;
  onSave: (s: LLMSettings) => void;
}) {
  // ----- Text settings state -----
  const [providerId, setProviderId] = React.useState<ProviderId>(
    initial?.providerId ?? "deepseek"
  );
  const textProvider = PROVIDERS.find((p) => p.id === providerId)!;
  const [apiKey, setApiKey] = React.useState(initial?.apiKey ?? "");
  const [baseUrl, setBaseUrl] = React.useState(
    initial?.baseUrl || textProvider.defaultBaseUrl
  );
  const [model, setModel] = React.useState(
    initial?.model || textProvider.defaultModel
  );

  // ----- Image settings state -----
  const [imageProviderId, setImageProviderId] = React.useState<ImageProviderId>(
    initial?.imageProviderId ?? "openai"
  );
  const imageProvider = IMAGE_PROVIDERS.find((p) => p.id === imageProviderId)!;
  const [imageApiKey, setImageApiKey] = React.useState(initial?.imageApiKey ?? "");
  const [imageBaseUrl, setImageBaseUrl] = React.useState(
    initial?.imageBaseUrl || imageProvider.defaultBaseUrl
  );
  const [imageModel, setImageModel] = React.useState(
    initial?.imageModel || imageProvider.defaultModel
  );

  // ----- Writing preferences -----
  const [writingPreferences, setWritingPreferences] = React.useState(
    initial?.writingPreferences ?? ""
  );

  // When the user picks a different text provider, populate the defaults
  // (only if the fields were untouched / still match the previous defaults).
  const prevTextProviderId = React.useRef(providerId);
  React.useEffect(() => {
    if (prevTextProviderId.current === providerId) return;
    const old = PROVIDERS.find((p) => p.id === prevTextProviderId.current);
    if (baseUrl === (old?.defaultBaseUrl ?? "")) setBaseUrl(textProvider.defaultBaseUrl);
    if (model === (old?.defaultModel ?? "")) setModel(textProvider.defaultModel);
    prevTextProviderId.current = providerId;
  }, [providerId, baseUrl, model, textProvider]);

  const prevImageProviderId = React.useRef(imageProviderId);
  React.useEffect(() => {
    if (prevImageProviderId.current === imageProviderId) return;
    const old = IMAGE_PROVIDERS.find((p) => p.id === prevImageProviderId.current);
    if (imageBaseUrl === (old?.defaultBaseUrl ?? "")) {
      setImageBaseUrl(imageProvider.defaultBaseUrl);
    }
    if (imageModel === (old?.defaultModel ?? "")) {
      setImageModel(imageProvider.defaultModel);
    }
    prevImageProviderId.current = imageProviderId;
  }, [imageProviderId, imageBaseUrl, imageModel, imageProvider]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      providerId,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      imageProviderId,
      imageApiKey: imageApiKey.trim() || undefined,
      imageBaseUrl: imageBaseUrl.trim() || undefined,
      imageModel: imageModel.trim() || undefined,
      writingPreferences: writingPreferences.trim() || undefined,
    });
  };

  // Image provider auto-reuses text provider's key when both are OpenAI
  // and no separate image key is set.
  const imageKeyInherited =
    providerId === "openai" &&
    imageProviderId === "openai" &&
    !imageApiKey.trim();

  return (
    <form onSubmit={submit} className="space-y-4 text-sm">
      {/* ====== Text generation ====== */}
      <Section
        icon={<MessageSquareText size={13} />}
        title="文本生成"
        subtitle="对话、改写、扩写、标题、合规预检等"
      >
        <Field label="Provider">
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value as ProviderId)}
            className={selectCls}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="API Key">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className={monoCls}
          />
          {textProvider.docsUrl && (
            <a
              href={textProvider.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-app-fg-muted hover:text-app-fg mt-1 inline-block"
            >
              获取 API Key →
            </a>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Base URL">
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={textProvider.defaultBaseUrl}
              className={monoCls}
            />
          </Field>
          <Field label="Model">
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={textProvider.defaultModel}
              className={monoCls}
            />
          </Field>
        </div>
      </Section>

      {/* ====== Image generation ====== */}
      <Section
        icon={<ImageIcon size={13} />}
        title="图片生成"
        subtitle="文中插图、封面图。可与文本用不同 provider。"
      >
        <Field label="Provider">
          <select
            value={imageProviderId}
            onChange={(e) =>
              setImageProviderId(e.target.value as ImageProviderId)
            }
            className={selectCls}
          >
            {IMAGE_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-app-fg-muted mt-1 leading-relaxed">
            {imageProvider.note}
          </p>
        </Field>
        <Field
          label={
            imageKeyInherited
              ? "API Key（留空将复用上方文本 key）"
              : "API Key"
          }
        >
          <input
            type="password"
            value={imageApiKey}
            onChange={(e) => setImageApiKey(e.target.value)}
            placeholder={
              imageKeyInherited ? "↑ 已复用文本 provider 的 key" : "sk-..."
            }
            className={monoCls}
          />
          {imageProvider.docsUrl && (
            <a
              href={imageProvider.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-app-fg-muted hover:text-app-fg mt-1 inline-block"
            >
              获取 API Key →
            </a>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Base URL">
            <input
              value={imageBaseUrl}
              onChange={(e) => setImageBaseUrl(e.target.value)}
              placeholder={imageProvider.defaultBaseUrl}
              className={monoCls}
            />
          </Field>
          <Field label="Model">
            <input
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value)}
              placeholder={imageProvider.defaultModel || "dall-e-3"}
              className={monoCls}
            />
          </Field>
        </div>
      </Section>

      {/* ====== Writing preferences ====== */}
      <Section
        icon={<PenLine size={13} />}
        title="写作偏好"
        subtitle="自由文本，喂给所有 AI 文本生成 (大纲/扩写/原生化等)，AI 会遵守。"
      >
        <textarea
          value={writingPreferences}
          onChange={(e) => setWritingPreferences(e.target.value)}
          rows={5}
          placeholder={`示例：
• 我写公众号财经赛道，读者是 25-40 岁普通投资者。
• 文风偏冷静理性，少用 emoji、少用感叹号。
• 案例优先用 A 股具体公司而非美股。
• 永远不要用"暴富/翻倍/稳赚"这类承诺词。
• 段落短，常用 60-90 字一段，长短交错。`}
          className="w-full px-2.5 py-2 rounded-md border border-app-border bg-app-surface text-app-fg text-xs leading-relaxed resize-y focus:outline-none focus:border-app-fg-muted"
        />
        <p className="text-[10px] text-app-fg-muted mt-1 leading-relaxed">
          这些规则会注入每个 AI 文本动作的 system prompt。可以放风格/禁忌/读者画像/案例偏好/句长偏好，越具体越有效。
        </p>
      </Section>

      <p className="text-[11px] text-app-fg-muted leading-relaxed border-t border-app-border pt-3">
        Key 保存在你的浏览器 localStorage 中，请求经本应用的{" "}
        <code className="bg-app-surface-hover px-1 rounded">/api/llm</code> 和{" "}
        <code className="bg-app-surface-hover px-1 rounded">/api/image</code>{" "}
        转发，不会落到我们的服务器存储。请勿在共享设备上保存生产密钥。
      </p>

      <div className="flex justify-end">
        <Button type="submit">保存</Button>
      </div>
    </form>
  );
}

// ---------- helpers ----------

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-app-border rounded-lg p-3.5 bg-app-bg space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-app-fg-muted">{icon}</span>
        <span className="text-sm font-semibold text-app-fg">{title}</span>
      </div>
      <p className="text-[11px] text-app-fg-muted leading-relaxed -mt-1">
        {subtitle}
      </p>
      <div className="space-y-2.5 pt-1">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-app-fg-subtle">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputBase =
  "w-full h-7 px-2 rounded-md border border-app-border bg-app-surface text-app-fg focus:outline-none focus:border-app-fg-muted";

const monoCls = cn(inputBase, "font-mono text-xs");
const selectCls = cn(inputBase, "text-xs");
