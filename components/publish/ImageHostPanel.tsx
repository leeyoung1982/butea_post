"use client";

import * as React from "react";
import { Upload, Loader2, Check, AlertCircle, Settings } from "lucide-react";
import {
  loadHostConfig,
  saveHostConfig,
  clearHostConfig,
  uploadAllInMarkdown,
  type HostConfig,
  type HostId,
} from "@/lib/media/hosts";
import { useWorkshop } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Image host setup + bulk upload. Lives inside the Publish sidebar pane.
 *
 *   - Pick host (Imgur / GitHub)
 *   - Enter credentials (kept in localStorage, never leaves the browser
 *     except to the host itself)
 *   - Click "上传全部图片" — uploads every butea-media:// reference,
 *     rewrites markdown with public URLs
 */
export function ImageHostPanel() {
  const markdown = useWorkshop((s) => s.markdown);
  const setMarkdown = useWorkshop((s) => s.setMarkdown);
  const [config, setConfig] = React.useState<HostConfig | null>(null);
  const [editing, setEditing] = React.useState(false);

  React.useEffect(() => {
    const c = loadHostConfig();
    setConfig(c);
    if (!c) setEditing(true);
  }, []);

  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number; name?: string } | null>(null);
  const [result, setResult] = React.useState<{ uploaded: number; failed: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const mediaCount = (markdown.match(/butea-media:\/\/[\w-]+/g) ?? []).length;

  const onUpload = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: mediaCount });
    try {
      const r = await uploadAllInMarkdown(markdown, (done, total, name) =>
        setProgress({ done, total, name })
      );
      if (r.uploaded > 0) setMarkdown(r.markdown);
      setResult({ uploaded: r.uploaded, failed: r.failed.length });
      if (r.failed.length === 0 && r.uploaded > 0) {
        toast.success(`上传完成`, `${r.uploaded} 张图片已替换为公网 URL`);
      } else if (r.failed.length > 0) {
        setError(
          `部分失败：${r.failed.slice(0, 2).map((f) => f.error).join("; ")}`
        );
        toast.error(
          `部分上传失败`,
          `成功 ${r.uploaded} · 失败 ${r.failed.length}`
        );
      }
    } catch (e) {
      setError((e as Error).message);
      toast.error("上传失败", (e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-app-fg-subtle">
          图床（媒体上传）
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
          ✓ 当前图床：<span className="text-app-fg font-medium">
            {config.hostId === "imgur"
              ? "Imgur"
              : config.hostId === "r2"
              ? `R2 · ${config.bucketName}`
              : `GitHub · ${config.owner}/${config.repo}`}
          </span>
        </div>
      )}

      {editing && (
        <HostConfigForm
          initial={config}
          onSave={(c) => {
            saveHostConfig(c);
            setConfig(c);
            setEditing(false);
            toast.success(
              "图床已保存",
              c.hostId === "imgur"
                ? "Imgur · 匿名上传就绪"
                : c.hostId === "r2"
                ? `R2 · ${c.bucketName}`
                : `GitHub · ${c.owner}/${c.repo}`
            );
          }}
          onClear={() => {
            clearHostConfig();
            setConfig(null);
            toast.info("图床配置已清除");
          }}
        />
      )}

      <div className="border-t border-app-border pt-3 space-y-2">
        <div className="text-[11px] text-app-fg-muted">
          当前文档有 <span className="text-app-fg font-mono">{mediaCount}</span> 张本地图片（butea-media://）
        </div>
        <Button
          className="w-full"
          size="sm"
          onClick={onUpload}
          disabled={busy || mediaCount === 0 || !config}
        >
          {busy ? (
            <>
              <Loader2 size={12} className="animate-spin" /> 上传中…
            </>
          ) : (
            <>
              <Upload size={12} /> 上传全部图片并替换链接
            </>
          )}
        </Button>
        {progress && (
          <div className="text-[11px] text-app-fg-muted">
            进度 {progress.done} / {progress.total} {progress.name ? `· ${progress.name}` : ""}
          </div>
        )}
        {result && !error && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
            <Check size={11} /> 成功 {result.uploaded} 张{result.failed ? ` · 失败 ${result.failed} 张` : ""}
          </div>
        )}
        {error && (
          <div className="flex items-start gap-1.5 text-[11px] text-red-700 dark:text-red-400">
            <AlertCircle size={11} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function HostConfigForm({
  initial,
  onSave,
  onClear,
}: {
  initial: HostConfig | null;
  onSave: (c: HostConfig) => void;
  onClear: () => void;
}) {
  const [hostId, setHostId] = React.useState<HostId>(initial?.hostId ?? "imgur");
  const [imgurId, setImgurId] = React.useState(
    initial?.hostId === "imgur" ? initial.clientId : ""
  );
  const [ghToken, setGhToken] = React.useState(
    initial?.hostId === "github" ? initial.token : ""
  );
  const [ghOwner, setGhOwner] = React.useState(
    initial?.hostId === "github" ? initial.owner : ""
  );
  const [ghRepo, setGhRepo] = React.useState(
    initial?.hostId === "github" ? initial.repo : ""
  );
  const [ghBranch, setGhBranch] = React.useState(
    initial?.hostId === "github" ? initial.branch : "main"
  );
  const [ghPath, setGhPath] = React.useState(
    initial?.hostId === "github" ? initial.pathPrefix : "butea-uploads"
  );
  const [r2AccountId, setR2AccountId] = React.useState(
    initial?.hostId === "r2" ? initial.accountId : ""
  );
  const [r2Bucket, setR2Bucket] = React.useState(
    initial?.hostId === "r2" ? initial.bucketName : ""
  );
  const [r2AccessKey, setR2AccessKey] = React.useState(
    initial?.hostId === "r2" ? initial.accessKeyId : ""
  );
  const [r2SecretKey, setR2SecretKey] = React.useState(
    initial?.hostId === "r2" ? initial.secretAccessKey : ""
  );
  const [r2PublicUrl, setR2PublicUrl] = React.useState(
    initial?.hostId === "r2" ? initial.publicUrl : ""
  );
  const [r2Path, setR2Path] = React.useState(
    initial?.hostId === "r2" ? initial.pathPrefix : "butea/"
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hostId === "imgur") {
      onSave({ hostId: "imgur", clientId: imgurId.trim() });
    } else if (hostId === "r2") {
      onSave({
        hostId: "r2",
        accountId: r2AccountId.trim(),
        bucketName: r2Bucket.trim(),
        accessKeyId: r2AccessKey.trim(),
        secretAccessKey: r2SecretKey.trim(),
        publicUrl: r2PublicUrl.trim(),
        pathPrefix: r2Path.trim() || "butea/",
      });
    } else {
      onSave({
        hostId: "github",
        token: ghToken.trim(),
        owner: ghOwner.trim(),
        repo: ghRepo.trim(),
        branch: ghBranch.trim() || "main",
        pathPrefix: ghPath.trim() || "butea-uploads",
      });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2.5 text-xs">
      <div className="flex gap-1">
        <HostTab
          active={hostId === "r2"}
          onClick={() => setHostId("r2")}
          label="R2"
        />
        <HostTab
          active={hostId === "imgur"}
          onClick={() => setHostId("imgur")}
          label="Imgur"
        />
        <HostTab
          active={hostId === "github"}
          onClick={() => setHostId("github")}
          label="GitHub"
        />
      </div>

      {hostId === "r2" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Account ID">
              <input
                value={r2AccountId}
                onChange={(e) => setR2AccountId(e.target.value)}
                placeholder="cf-account-id"
                className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
              />
            </Field>
            <Field label="Bucket Name">
              <input
                value={r2Bucket}
                onChange={(e) => setR2Bucket(e.target.value)}
                placeholder="my-images"
                className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
              />
            </Field>
          </div>
          <Field label="Access Key ID">
            <input
              value={r2AccessKey}
              onChange={(e) => setR2AccessKey(e.target.value)}
              placeholder="R2 API Token Access Key ID"
              className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
            />
          </Field>
          <Field label="Secret Access Key">
            <input
              type="password"
              value={r2SecretKey}
              onChange={(e) => setR2SecretKey(e.target.value)}
              placeholder="R2 API Token Secret"
              className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
            />
          </Field>
          <Field label="Public URL (自定义域名)">
            <input
              value={r2PublicUrl}
              onChange={(e) => setR2PublicUrl(e.target.value)}
              placeholder="https://img.example.com"
              className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
            />
          </Field>
          <Field label="Path prefix">
            <input
              value={r2Path}
              onChange={(e) => setR2Path(e.target.value)}
              placeholder="butea/"
              className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
            />
          </Field>
          <p className="text-[10px] text-app-fg-muted leading-relaxed">
            在 Cloudflare Dashboard → R2 → Manage R2 API Tokens 创建 Token，
            需要 Object Read &amp; Write 权限。Public URL 是你给 Bucket 绑定的
            自定义域名（R2 → Settings → Custom Domains）。
          </p>
        </>
      ) : hostId === "imgur" ? (
        <>
          <Field label="Imgur Client ID">
            <input
              value={imgurId}
              onChange={(e) => setImgurId(e.target.value)}
              placeholder="例如 abc123def456"
              className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
            />
          </Field>
          <p className="text-[10px] text-app-fg-muted leading-relaxed">
            在{" "}
            <a
              href="https://api.imgur.com/oauth2/addclient"
              target="_blank"
              rel="noreferrer"
              className="text-app-fg underline"
            >
              api.imgur.com/oauth2/addclient
            </a>{" "}
            注册一个 anonymous app，复制 Client ID。免费，每天可上传约 1250 张图。
          </p>
        </>
      ) : (
        <>
          <Field label="Personal Access Token">
            <input
              type="password"
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
              placeholder="ghp_..."
              className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Owner">
              <input
                value={ghOwner}
                onChange={(e) => setGhOwner(e.target.value)}
                placeholder="username"
                className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
              />
            </Field>
            <Field label="Repo (public)">
              <input
                value={ghRepo}
                onChange={(e) => setGhRepo(e.target.value)}
                placeholder="image-cdn"
                className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
              />
            </Field>
            <Field label="Branch">
              <input
                value={ghBranch}
                onChange={(e) => setGhBranch(e.target.value)}
                placeholder="main"
                className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
              />
            </Field>
            <Field label="Path prefix">
              <input
                value={ghPath}
                onChange={(e) => setGhPath(e.target.value)}
                placeholder="butea-uploads"
                className="w-full h-7 px-2 rounded border border-app-border bg-app-bg text-xs font-mono focus:outline-none focus:border-app-fg-muted"
              />
            </Field>
          </div>
          <p className="text-[10px] text-app-fg-muted leading-relaxed">
            Token 需 <code className="bg-app-surface-hover px-1 rounded">repo</code> 权限。
            仓库必须是 public，否则 raw URL 无法访问。
            图片提交后，URL 形如 <code className="bg-app-surface-hover px-1 rounded">raw.githubusercontent.com/.../path</code>，公众号粘贴时会自动转存为永久素材。
          </p>
        </>
      )}

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

function HostTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 px-2 py-1 rounded text-xs transition-colors",
        active
          ? "bg-app-fg text-app-bg"
          : "bg-app-bg border border-app-border text-app-fg-muted hover:text-app-fg"
      )}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-app-fg-subtle">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
