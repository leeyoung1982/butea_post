// =====================================================================
// Adapter registry.
//
// To add a new platform: write `lib/adapters/<id>.ts`, import it here, and
// append it to ADAPTERS. The UI auto-discovers it via this list.
// =====================================================================

import type { Adapter, PlatformId } from "./types";
import { wechatAdapter } from "./wechat";
import { blogAdapter } from "./blog";
import { xThreadAdapter } from "./x-thread";
import { xLongformAdapter } from "./x-longform";
import { xiaohongshuAdapter } from "./xiaohongshu";
import { weiboAdapter } from "./weibo";
import { momentsAdapter } from "./moments";

export const ADAPTERS: Adapter[] = [
  wechatAdapter,
  blogAdapter,
  xiaohongshuAdapter,
  xThreadAdapter,
  xLongformAdapter,
  weiboAdapter,
  momentsAdapter,
];

export function getAdapter(id: PlatformId): Adapter {
  return ADAPTERS.find((a) => a.id === id) ?? ADAPTERS[0];
}

export * from "./types";
