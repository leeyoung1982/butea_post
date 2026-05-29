import type { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * Open Graph / link-preview metadata fetcher. Given a URL, fetch the page
 * server-side and extract title / description / image / site_name. Used by
 * the Link Card dialog.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new Response("missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return new Response("invalid url", { status: 400 });
  }
  if (!/^https?:$/.test(target.protocol)) {
    return new Response("only http(s) urls", { status: 400 });
  }

  try {
    const res = await fetch(target.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Xiangxie/0.3; +https://github.com/leeyoung1982/butea_post)",
        Accept: "text/html,application/xhtml+xml",
      },
      // Hard-limit upstream time so the edge function returns promptly.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return Response.json({ ok: false, error: `${res.status}` }, { status: 200 });
    }
    const html = await res.text();
    const meta = parseMeta(html, target.toString());
    return Response.json({ ok: true, meta }, { status: 200 });
  } catch (e) {
    return Response.json(
      { ok: false, error: (e as Error).message },
      { status: 200 }
    );
  }
}

type Meta = {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url: string;
};

function parseMeta(html: string, url: string): Meta {
  const get = (name: string) => {
    const re = new RegExp(
      `<meta[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`,
      "i"
    );
    return re.exec(html)?.[1];
  };
  const getReverse = (name: string) => {
    const re = new RegExp(
      `<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`,
      "i"
    );
    return re.exec(html)?.[1];
  };
  const pick = (n: string) => get(n) ?? getReverse(n);

  const title =
    pick("og:title") ?? pick("twitter:title") ??
    /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1];
  const description = pick("og:description") ?? pick("twitter:description") ?? pick("description");
  const image = pick("og:image") ?? pick("twitter:image");
  const siteName = pick("og:site_name");

  return {
    title: title?.trim(),
    description: description?.trim(),
    image: image && new URL(image, url).toString(),
    siteName: siteName?.trim() ?? new URL(url).hostname.replace(/^www\./, ""),
    url,
  };
}
