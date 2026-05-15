"use client";

import * as React from "react";
import {
  Plus,
  FileText,
  Trash2,
  RotateCcw,
  HardDrive,
  Loader2,
  Upload,
  ChevronDown,
  Cloud,
  Plug,
  Inbox,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import * as Popover from "@radix-ui/react-popover";
import { useWorkshop } from "@/lib/store";
import {
  listDocuments,
  listTrash,
  createDocument,
  moveToTrash,
  restoreFromTrash,
  purgeFromTrash,
} from "@/lib/docs/store";
import type { ButeaDocument, TrashedDocument } from "@/lib/docs/types";
import { TRASH_TTL_DAYS } from "@/lib/docs/types";
import { ObsidianPanel } from "@/components/obsidian/ObsidianPanel";
import { importFile, ACCEPT_ATTR } from "@/lib/docs/import";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Tab = "local" | "external" | "trash";
type ExternalSource = "obsidian" | "notion" | "drive";

const EXTERNAL_SOURCES: {
  id: ExternalSource;
  label: string;
  ready: boolean;
  blurb: string;
}[] = [
  {
    id: "obsidian",
    label: "Obsidian",
    ready: true,
    blurb: "通过 Local REST API 插件读写本地 Vault",
  },
  {
    id: "notion",
    label: "Notion",
    ready: false,
    blurb: "OAuth + Notion API（v0.5 接入）",
  },
  {
    id: "drive",
    label: "Google Drive",
    ready: false,
    blurb: "Drive API 拉取 Docs/Markdown（v0.5 接入）",
  },
];

export function LibraryPanel() {
  const [tab, setTab] = React.useState<Tab>("local");
  const [externalSource, setExternalSource] = React.useState<ExternalSource>(
    "obsidian"
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-app-border">
        <div className="text-sm font-medium">文档库</div>
        <div className="text-[11px] text-app-fg-muted mt-0.5">
          所有本地文档 · 外部笔记源 · 回收站
        </div>
      </div>
      <div className="flex border-b border-app-border bg-app-surface text-xs">
        <TabBtn active={tab === "local"} onClick={() => setTab("local")}>
          <HardDrive size={12} /> 本地
        </TabBtn>
        <ExternalTab
          active={tab === "external"}
          source={externalSource}
          onClickTab={() => setTab("external")}
          onPickSource={(s) => {
            setExternalSource(s);
            setTab("external");
          }}
        />
        <TabBtn active={tab === "trash"} onClick={() => setTab("trash")}>
          <Trash2 size={12} /> 回收站
        </TabBtn>
      </div>
      <div className="flex-1 overflow-auto">
        {tab === "local" && <LocalView />}
        {tab === "external" && <ExternalView source={externalSource} />}
        {tab === "trash" && <TrashView />}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1 px-2 py-2 transition-colors",
        active
          ? "text-app-fg border-b-2 border-app-fg -mb-px"
          : "text-app-fg-muted hover:text-app-fg"
      )}
    >
      {children}
    </button>
  );
}

function ExternalTab({
  active,
  source,
  onClickTab,
  onPickSource,
}: {
  active: boolean;
  source: ExternalSource;
  onClickTab: () => void;
  onPickSource: (s: ExternalSource) => void;
}) {
  const current = EXTERNAL_SOURCES.find((s) => s.id === source)!;
  return (
    <Popover.Root>
      <div
        className={cn(
          "flex-1 flex items-center justify-center transition-colors",
          active
            ? "text-app-fg border-b-2 border-app-fg -mb-px"
            : "text-app-fg-muted hover:text-app-fg"
        )}
      >
        <button
          onClick={onClickTab}
          className="flex items-center gap-1 px-1.5 py-2"
        >
          <Cloud size={12} />
          <span>{current.label}</span>
        </button>
        <Popover.Trigger asChild>
          <button
            className="px-1 py-2 hover:bg-app-surface-hover rounded"
            title="切换外部源"
          >
            <ChevronDown size={11} />
          </button>
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Content
          align="center"
          sideOffset={4}
          className="z-50 w-[260px] bg-app-surface border border-app-border rounded-lg shadow-xl py-1 animate-fade-in"
        >
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-app-fg-subtle">
            外部笔记源
          </div>
          {EXTERNAL_SOURCES.map((s) => (
            <Popover.Close key={s.id} asChild>
              <button
                onClick={() => onPickSource(s.id)}
                disabled={!s.ready}
                className={cn(
                  "w-full text-left px-3 py-2 hover:bg-app-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                  source === s.id && "bg-app-surface-hover"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-app-fg">
                    {s.label}
                  </span>
                  {!s.ready && (
                    <span className="text-[9px] uppercase tracking-wider text-app-fg-subtle">
                      即将
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-app-fg-muted mt-0.5">
                  {s.blurb}
                </div>
              </button>
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---------- External view ----------

function ExternalView({ source }: { source: ExternalSource }) {
  if (source === "obsidian") return <ObsidianPanel />;
  if (source === "notion") return <ComingSoon name="Notion" blurb="OAuth + Notion API 双向（pages / databases / blocks）。" />;
  return <ComingSoon name="Google Drive" blurb="Google Drive API 拉取 Docs 与本地 markdown 文件。" />;
}

function ComingSoon({ name, blurb }: { name: string; blurb: string }) {
  return (
    <div className="p-5 text-center space-y-2">
      <Plug size={20} className="mx-auto text-app-fg-subtle" />
      <div className="text-sm font-medium text-app-fg-muted">{name} 即将支持</div>
      <p className="text-[11px] text-app-fg-muted leading-relaxed">{blurb}</p>
      <div className="pt-2 text-[10px] text-app-fg-subtle">
        v0.5 路线 · 已规划
      </div>
    </div>
  );
}

// ---------- Local docs ----------

function LocalView() {
  const activeDocId = useWorkshop((s) => s.activeDocId);
  const setActiveDocId = useWorkshop((s) => s.setActiveDocId);
  const docListNonce = useWorkshop((s) => s.docListNonce);
  const bumpDocList = useWorkshop((s) => s.bumpDocList);

  const [docs, setDocs] = React.useState<ButeaDocument[] | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    listDocuments().then(setDocs);
  }, [docListNonce]);

  const onNew = async () => {
    const doc = await createDocument({
      title: "未命名文档",
      markdown: "",
      source: { kind: "local" },
    });
    setActiveDocId(doc.id);
    bumpDocList();
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      const result = await importFile(file);
      const doc = await createDocument({
        title: result.title,
        markdown: result.markdown,
        source: { kind: "local" },
      });
      setActiveDocId(doc.id);
      bumpDocList();
      if (result.warnings?.length) {
        // Show first warning inline; full list could be a future toast queue
        setImportError("⚠ 导入有提示：" + result.warnings[0]);
      }
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const onDelete = async (id: string, title: string) => {
    if (!confirm(`将「${title}」移到回收站？30 天内可恢复。`)) return;
    await moveToTrash(id);
    if (id === activeDocId) {
      const remaining = (await listDocuments())[0];
      setActiveDocId(remaining?.id ?? null);
    }
    bumpDocList();
  };

  if (docs === null) return <SkeletonList count={5} />;

  return (
    <div>
      <div className="px-3 py-2 border-b border-app-border space-y-1.5">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs bg-app-fg text-app-bg hover:opacity-90 transition-opacity"
        >
          <Plus size={12} />
          新建文档
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs bg-app-bg border border-app-border text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover transition-colors disabled:opacity-50"
        >
          {importing ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Upload size={11} />
          )}
          {importing ? "导入中…" : "从本地文件导入"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={onPickFile}
          className="hidden"
        />
        <div className="text-[10px] text-app-fg-subtle text-center pt-0.5">
          支持 .md / .txt / .html / .docx（Word）
        </div>
        {importError && (
          <div className="text-[11px] text-amber-700 dark:text-amber-400 break-words">
            {importError}
          </div>
        )}
      </div>
      {docs.length === 0 ? (
        <EmptyState
          icon={<Inbox size={18} />}
          title="还没有本地文档"
          description="点上方按钮新建空白文档，或从 .md / .docx / .html 文件导入。"
          tip="想看完整功能演示？打开「本篇」面板右上角「示例」可载入欢迎稿。"
          density="compact"
        />
      ) : (
        <ul className="py-1">
          {sortDocsActiveFirst(docs, activeDocId).map((d) => (
            <DocRow
              key={d.id}
              doc={d}
              active={d.id === activeDocId}
              onOpen={() => {
                if (d.id === activeDocId) return;
                setActiveDocId(d.id);
                toast.info(`已切换到《${d.title || "未命名文档"}》`);
              }}
              onDelete={() => onDelete(d.id, d.title)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function DocRow({
  doc,
  active,
  onOpen,
  onDelete,
}: {
  doc: ButeaDocument;
  active: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={cn(
        "group flex items-start gap-2 px-3 py-2 border-l-2 hover:bg-app-surface-hover transition-colors cursor-pointer",
        active ? "border-app-fg bg-app-surface-hover" : "border-transparent"
      )}
      onClick={onOpen}
    >
      <FileText size={13} className="text-app-fg-muted shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="text-xs font-medium text-app-fg truncate">
            {doc.title || "未命名文档"}
          </div>
          {active && (
            <span
              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-[1px] rounded-full text-[9px] uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
              title="此文档正在编辑器中打开"
            >
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              编辑中
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-app-fg-subtle mt-0.5">
          <span>{relativeTime(doc.updatedAt)}</span>
          {doc.tags.length > 0 && (
            <span className="truncate">
              {doc.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}
            </span>
          )}
          {doc.snapshots.length > 0 && (
            <span title={`${doc.snapshots.length} 个手动快照`}>
              📷{doc.snapshots.length}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 text-app-fg-subtle hover:text-red-600 p-0.5 transition-all shrink-0"
        title="移到回收站"
      >
        <Trash2 size={11} />
      </button>
    </li>
  );
}

// ---------- Trash ----------

function TrashView() {
  const docListNonce = useWorkshop((s) => s.docListNonce);
  const bumpDocList = useWorkshop((s) => s.bumpDocList);
  const setActiveDocId = useWorkshop((s) => s.setActiveDocId);
  const [items, setItems] = React.useState<TrashedDocument[] | null>(null);

  React.useEffect(() => {
    listTrash().then(setItems);
  }, [docListNonce]);

  const onRestore = async (id: string) => {
    await restoreFromTrash(id);
    setActiveDocId(id);
    bumpDocList();
  };
  const onPurge = async (id: string, title: string) => {
    if (!confirm(`「${title}」将被永久删除，无法恢复。继续？`)) return;
    await purgeFromTrash(id);
    bumpDocList();
  };

  if (items === null) return <SkeletonList count={3} />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Trash2 size={18} />}
        title="回收站是空的"
        description={`删除的文档会在这里保留 ${TRASH_TTL_DAYS} 天，之后自动清空。`}
        tip="好嘞，看来你没误删什么。"
        density="compact"
      />
    );
  }

  return (
    <ul className="py-1">
      {items.map((d) => {
        const daysLeft = Math.max(
          0,
          Math.floor(
            (d.deletedAt + TRASH_TTL_DAYS * 86400000 - Date.now()) / 86400000
          )
        );
        return (
          <li
            key={d.id}
            className="group flex items-start gap-2 px-3 py-2 border-l-2 border-transparent hover:bg-app-surface-hover"
          >
            <FileText size={13} className="text-app-fg-subtle shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-app-fg-muted truncate">
                {d.title || "未命名文档"}
              </div>
              <div className="text-[10px] text-app-fg-subtle mt-0.5">
                删除于 {relativeTime(d.deletedAt)} · 剩 {daysLeft} 天
              </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
              <button
                onClick={() => onRestore(d.id)}
                className="text-app-fg-muted hover:text-app-fg p-0.5"
                title="恢复"
              >
                <RotateCcw size={11} />
              </button>
              <button
                onClick={() => onPurge(d.id, d.title)}
                className="text-app-fg-subtle hover:text-red-600 p-0.5"
                title="永久删除"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Sort docs by updatedAt desc, then pin the active doc to the top so it
 *  doesn't visually "jump" as autosave fires while the user types. */
function sortDocsActiveFirst(
  docs: ButeaDocument[],
  activeId: string | null
): ButeaDocument[] {
  const rest = docs
    .filter((d) => d.id !== activeId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const active = docs.find((d) => d.id === activeId);
  return active ? [active, ...rest] : rest;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return new Date(ts).toLocaleDateString();
}
