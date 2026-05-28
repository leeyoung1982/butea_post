"use client";

import * as React from "react";
import { Rocket, Loader2, Check, AlertCircle, Settings, ExternalLink } from "lucide-react";
import {
  loadAstroConfig,
  saveAstroConfig,
  clearAstroConfig,
  buildAstroPost,
  pushToAstroBlog,
  slugify,
  type AstroBlogConfig,
} from "@/lib/publish/astro";
import { useWorkshop } from "@/lib/store";
import { stripImageAdmonitions } from "@/lib/md/admonitions";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function AstroPushSection() {
  const markdown = useWorkshop((s) => s.markdown);
  const [config, setConfig] = React.useState<AstroBlogConfig | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ url: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Frontmatter fields
  const titleFromDoc = React.useMemo(
    () => (markdown.match(/^#\s+(.+)/m)?.[1] ?? "").replace(/<[^>]+>/g, "").trim(),
    [markdown]
  );
  const [description, setDescription] = React.useState("");

  React.useEffect(() => {
    const c = loadAstroConfig();
    setConfig(c);
    if (!c) setEditing(true);
  }, []);

  const onPush = async () => {
    if (!config) return;
    const title = titleFromDoc;
    if (!title) {
      toast.error("缺少标题", "请在文档开头添加 H1 标题");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // Strip [!image] placeholders before pushing — author-only cues, not
      // publishable content.
      const publishable = stripImageAdmonitions(markdown).stripped;
      const content = buildAstroPost(publishable, {
        title,
        description: description || title,
      });
      const slug = slugify(title);
      const res = await pushToAstroBlog(config, slug, content);
      setResult({ url: res.url });
      toast.success("已推送到 Astro 博客", slug);
    } catch (e) {
      setError((e as Error).message);
      toast.error("推送失败", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-app-fg-subtle">
          Astro 博客推送
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="text-app-fg-subtle hover:text-app-fg text-[11px] flex items-center gap-1"
        >
          <Settings size={11} />
          {editing ? "收起" : config ? "配置" : "未配置"}
        </button>
      </div>

      {config && !editing && (
        <div className="text-[11px] text-app-fg-muted">
          ✓ 推送到{" "}
          <span className="text-app-fg font-medium">
            {config.owner}/{config.repo}
          </span>
          <span className="text-app-fg-subtle"> · {config.branch}</span>
        </div>
      )}

      {editing && (
        <AstroConfigForm
          initial={config}
          onSave={(c) => {
            saveAstroConfig(c);
            setConfig(c);
            setEditing(false);
            toast.success("Astro 配置已保存", `${c.owner}/${c.repo}`);
          }}
          onClear={() => {
            clearAstroConfig();
            setConfig(null);
            toast.info("Astro 配置已清除");
          }}
        />
      )}

      {config && !editing && (
        <div className="space-y-2">
          <div>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-app-fg-subtle">
                Description (SEO)
              </span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={titleFromDoc || "文章描述"}
                className="mt-1 w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs focus:outline-none focus:border-app-fg-muted"
              />
            </label>
          </div>
          <Button
            className="w-full"
            size="sm"
            onClick={onPush}
            disabled={busy || !titleFromDoc}
          >
            {busy ? (
              <>
                <Loader2 size={12} className="animate-spin" /> 推送中...
              </>
            ) : (
              <>
                <Rocket size={12} /> 推送到 Astro 博客
              </>
            )}
          </Button>
          {!titleFromDoc && (
            <div className="text-[11px] text-amber-600">
              文档缺少 H1 标题，无法推送
            </div>
          )}
          {result && (
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              <Check size={11} /> 已推送
              <ExternalLink size={10} />
            </a>
          )}
          {error && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-700 dark:text-red-400">
              <AlertCircle size={11} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AstroConfigForm({
  initial,
  onSave,
  onClear,
}: {
  initial: AstroBlogConfig | null;
  onSave: (c: AstroBlogConfig) => void;
  onClear: () => void;
}) {
  const [token, setToken] = React.useState(initial?.token ?? "");
  const [owner, setOwner] = React.useState(initial?.owner ?? "");
  const [repo, setRepo] = React.useState(initial?.repo ?? "");
  const [branch, setBranch] = React.useState(initial?.branch ?? "main");
  const [contentPath, setContentPath] = React.useState(
    initial?.contentPath ?? "src/content/blog"
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      token: token.trim(),
      owner: owner.trim(),
      repo: repo.trim(),
      branch: branch.trim() || "main",
      contentPath: contentPath.trim() || "src/content/blog",
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2.5 text-xs">
      <Field label="GitHub Personal Access Token">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ghp_..."
          className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Owner">
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="username"
            className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
          />
        </Field>
        <Field label="Repo">
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="my-blog"
            className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
          />
        </Field>
        <Field label="Branch">
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
          />
        </Field>
        <Field label="Content Path">
          <input
            value={contentPath}
            onChange={(e) => setContentPath(e.target.value)}
            placeholder="src/content/blog"
            className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
          />
        </Field>
      </div>
      <p className="text-[10px] text-app-fg-muted leading-relaxed">
        Token 需{" "}
        <code className="bg-app-surface-hover px-1 rounded">repo</code>{" "}
        权限。推送后文件写入{" "}
        <code className="bg-app-surface-hover px-1 rounded">
          {contentPath || "src/content/blog"}/&lt;slug&gt;.md
        </code>
        ，触发 Astro 构建部署。
      </p>
      <div className="flex justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] text-app-fg-subtle hover:text-red-600"
        >
          清除配置
        </button>
        <Button size="sm" type="submit">
          保存
        </Button>
      </div>
    </form>
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
