"use client";

// File System Access API type augmentation (not yet in all TS lib targets)
declare global {
  interface Window {
    showDirectoryPicker(options?: {
      mode?: "read" | "readwrite";
    }): Promise<FileSystemDirectoryHandle>;
  }
  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
  }
}

import * as React from "react";
import {
  FolderOpen,
  FileText,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  BookOpen,
} from "lucide-react";
import { useWorkshop } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type VaultFile = {
  name: string;
  path: string;
  handle: FileSystemFileHandle;
};

type VaultFolder = {
  name: string;
  path: string;
  handle: FileSystemDirectoryHandle;
  children: (VaultFolder | VaultFile)[];
  expanded: boolean;
};

function isFolder(item: VaultFolder | VaultFile): item is VaultFolder {
  return "children" in item;
}

// =====================================================================
// Module-level cache — survives component unmount/remount
// =====================================================================
let _cachedHandle: FileSystemDirectoryHandle | null = null;
let _cachedTree: (VaultFolder | VaultFile)[] = [];

/**
 * Obsidian Vault browser — reads a local folder using the File System Access
 * API and displays markdown files in a tree view. Click to import into editor.
 */
export function ObsidianPanel() {
  const setMarkdown = useWorkshop((s) => s.setMarkdown);
  const setObsidianVaultConnected = useWorkshop((s) => s.setObsidianVaultConnected);
  const [rootHandle, setRootHandle] =
    React.useState<FileSystemDirectoryHandle | null>(_cachedHandle);
  const [tree, setTree] = React.useState<(VaultFolder | VaultFile)[]>(_cachedTree);
  const [loading, setLoading] = React.useState(false);

  const openVault = async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: "read" });
      setRootHandle(handle);
      _cachedHandle = handle;
      setObsidianVaultConnected(true);
      await loadTree(handle);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error("无法打开文件夹", (e as Error).message);
      }
    }
  };

  const loadTree = async (handle: FileSystemDirectoryHandle) => {
    setLoading(true);
    try {
      const items = await scanDirectory(handle, "");
      setTree(items);
      _cachedTree = items;
    } catch (e) {
      toast.error("读取失败", (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    if (rootHandle) loadTree(rootHandle);
  };

  const importFile = async (fileHandle: FileSystemFileHandle) => {
    try {
      const file = await fileHandle.getFile();
      const text = await file.text();
      setMarkdown(text);
      toast.success(`已导入「${file.name}」`);
    } catch (e) {
      toast.error("导入失败", (e as Error).message);
    }
  };

  const toggleFolder = (path: string) => {
    setTree((prev) => {
      const next = toggleExpanded(prev, path);
      _cachedTree = next;
      return next;
    });
  };

  if (!rootHandle) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-app-border">
          <div className="text-[13px] font-semibold">Obsidian Vault</div>
          <div className="text-[11px] text-app-fg-muted mt-0.5">
            选择 Vault 文件夹，浏览笔记并导入到编辑器
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <EmptyState
            icon={<BookOpen size={24} />}
            title="连接 Obsidian Vault"
            description="选择你的 Obsidian Vault 文件夹，即可浏览和导入笔记。仅读取 .md 文件，不会修改你的原始笔记。"
            density="comfortable"
            action={
              <Button onClick={openVault} size="sm" className="mt-3">
                <FolderOpen size={13} />
                选择文件夹
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-app-border flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold flex items-center gap-1.5">
            <BookOpen size={13} />
            {rootHandle.name}
          </div>
          <div className="text-[11px] text-app-fg-muted mt-0.5">
            点击 .md 文件导入到编辑器
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={refresh}
            className="p-1.5 rounded text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover transition-colors"
            title="刷新"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={openVault}
            className="p-1.5 rounded text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover transition-colors"
            title="切换 Vault"
          >
            <FolderOpen size={13} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto py-1">
        {tree.length === 0 && !loading && (
          <div className="px-4 py-6 text-center text-xs text-app-fg-muted">
            没有找到 .md 文件
          </div>
        )}
        <TreeView
          items={tree}
          onImport={importFile}
          onToggle={toggleFolder}
          depth={0}
        />
      </div>
    </div>
  );
}

function TreeView({
  items,
  onImport,
  onToggle,
  depth,
}: {
  items: (VaultFolder | VaultFile)[];
  onImport: (handle: FileSystemFileHandle) => void;
  onToggle: (path: string) => void;
  depth: number;
}) {
  return (
    <ul>
      {items.map((item) =>
        isFolder(item) ? (
          <li key={item.path}>
            <button
              onClick={() => onToggle(item.path)}
              className="w-full text-left flex items-center gap-1 px-2 py-1.5 text-xs text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover transition-colors"
              style={{ paddingLeft: 8 + depth * 16 }}
            >
              {item.expanded ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
              <FolderOpen size={12} className="text-app-fg-subtle" />
              <span className="truncate">{item.name}</span>
            </button>
            {item.expanded && (
              <TreeView
                items={item.children}
                onImport={onImport}
                onToggle={onToggle}
                depth={depth + 1}
              />
            )}
          </li>
        ) : (
          <li key={item.path}>
            <button
              onClick={() => onImport(item.handle)}
              className="w-full text-left flex items-center gap-1 px-2 py-1.5 text-xs text-app-fg hover:bg-app-surface-hover transition-colors"
              style={{ paddingLeft: 8 + depth * 16 + 16 }}
              title={`导入 ${item.name}`}
            >
              <FileText size={12} className="text-app-fg-subtle shrink-0" />
              <span className="truncate">{item.name}</span>
            </button>
          </li>
        )
      )}
    </ul>
  );
}

// =====================================================================
// Helpers
// =====================================================================

async function scanDirectory(
  handle: FileSystemDirectoryHandle,
  parentPath: string
): Promise<(VaultFolder | VaultFile)[]> {
  const items: (VaultFolder | VaultFile)[] = [];

  for await (const entry of handle.values()) {
    // Skip hidden files/folders (like .obsidian, .git)
    if (entry.name.startsWith(".")) continue;

    const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;

    if (entry.kind === "directory") {
      const children = await scanDirectory(
        entry as FileSystemDirectoryHandle,
        path
      );
      // Only include folders that contain .md files (directly or nested)
      if (children.length > 0) {
        items.push({
          name: entry.name,
          path,
          handle: entry as FileSystemDirectoryHandle,
          children,
          expanded: false,
        });
      }
    } else if (entry.name.endsWith(".md")) {
      items.push({
        name: entry.name,
        path,
        handle: entry as FileSystemFileHandle,
      });
    }
  }

  // Sort: folders first, then files, both alphabetical
  items.sort((a, b) => {
    const aIsFolder = isFolder(a);
    const bIsFolder = isFolder(b);
    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return items;
}

function toggleExpanded(
  items: (VaultFolder | VaultFile)[],
  targetPath: string
): (VaultFolder | VaultFile)[] {
  return items.map((item) => {
    if (!isFolder(item)) return item;
    if (item.path === targetPath) {
      return { ...item, expanded: !item.expanded };
    }
    return { ...item, children: toggleExpanded(item.children, targetPath) };
  });
}
