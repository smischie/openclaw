import type { CDPSession, Page } from "playwright-core";
import {
  appendCdpPath,
  fetchJson,
  normalizeCdpHttpBaseForJsonEndpoints,
  withCdpSocket,
} from "./cdp.helpers.js";
import { getChromeWebSocketUrl } from "./chrome.js";

const OPENCLAW_EXTENSION_RELAY_BROWSER = "OpenClaw/extension-relay";

type PageCdpSend = (method: string, params?: Record<string, unknown>) => Promise<unknown>;
type MarkBackendDomRef = { ref: string; backendDOMNodeId: number };

export const BROWSER_REF_MARKER_ATTRIBUTE = "data-openclaw-browser-ref";

const extensionRelayByCdpUrl = new Map<string, boolean>();

function normalizeCdpUrl(raw: string) {
  return raw.replace(/\/$/, "");
}

export async function isExtensionRelayCdpEndpoint(cdpUrl: string): Promise<boolean> {
  const normalized = normalizeCdpUrl(cdpUrl);
  const cached = extensionRelayByCdpUrl.get(normalized);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const cdpHttpBase = normalizeCdpHttpBaseForJsonEndpoints(normalized);
    const version = await fetchJson<{ Browser?: string }>(
      appendCdpPath(cdpHttpBase, "/json/version"),
      2000,
    );
    const isRelay = String(version?.Browser ?? "").trim() === OPENCLAW_EXTENSION_RELAY_BROWSER;
    extensionRelayByCdpUrl.set(normalized, isRelay);
    return isRelay;
  } catch {
    extensionRelayByCdpUrl.set(normalized, false);
    return false;
  }
}

async function withPlaywrightPageCdpSession<T>(
  page: Page,
  fn: (session: CDPSession) => Promise<T>,
): Promise<T> {
  const session = await page.context().newCDPSession(page);
  try {
    return await fn(session);
  } finally {
    await session.detach().catch(() => {});
  }
}

export async function withPageScopedCdpClient<T>(opts: {
  cdpUrl: string;
  page: Page;
  targetId?: string;
  fn: (send: PageCdpSend) => Promise<T>;
}): Promise<T> {
  const targetId = opts.targetId?.trim();
  if (targetId && (await isExtensionRelayCdpEndpoint(opts.cdpUrl))) {
    const wsUrl = await getChromeWebSocketUrl(opts.cdpUrl, 2000);
    if (!wsUrl) {
      throw new Error("CDP websocket unavailable");
    }
    return await withCdpSocket(wsUrl, async (send) => {
      return await opts.fn((method, params) => send(method, { ...params, targetId }));
    });
  }

  return await withPlaywrightPageCdpSession(opts.page, async (session) => {
    return await opts.fn((method, params) =>
      (
        session.send as unknown as (
          method: string,
          params?: Record<string, unknown>,
        ) => Promise<unknown>
      )(method, params),
    );
  });
}

export async function markBackendDomRefsOnPage(opts: {
  page: Page;
  refs: MarkBackendDomRef[];
}): Promise<Set<string>> {
  await opts.page
    .locator(`[${BROWSER_REF_MARKER_ATTRIBUTE}]`)
    .evaluateAll((elements, attr) => {
      for (const element of elements) {
        if (element instanceof Element) {
          element.removeAttribute(attr);
        }
      }
    }, BROWSER_REF_MARKER_ATTRIBUTE)
    .catch(() => {});

  const refs = opts.refs.filter(
    (entry) =>
      /^ax\d+$/.test(entry.ref) &&
      Number.isFinite(entry.backendDOMNodeId) &&
      Math.floor(entry.backendDOMNodeId) > 0,
  );
  const marked = new Set<string>();
  if (!refs.length) {
    return marked;
  }

  return await withPlaywrightPageCdpSession(opts.page, async (session) => {
    const send = async (method: string, params?: Record<string, unknown>) =>
      await (
        session.send as unknown as (
          method: string,
          params?: Record<string, unknown>,
        ) => Promise<unknown>
      )(method, params);

    await send("DOM.enable").catch(() => {});

    const backendNodeIds = [...new Set(refs.map((entry) => Math.floor(entry.backendDOMNodeId)))];
    const pushed = (await send("DOM.pushNodesByBackendIdsToFrontend", {
      backendNodeIds,
    }).catch(() => ({}))) as { nodeIds?: number[] };
    const nodeIds = Array.isArray(pushed.nodeIds) ? pushed.nodeIds : [];
    const nodeIdByBackendId = new Map<number, number>();
    for (let index = 0; index < backendNodeIds.length; index += 1) {
      const backendNodeId = backendNodeIds[index];
      const nodeId = nodeIds[index];
      if (backendNodeId && typeof nodeId === "number" && nodeId > 0) {
        nodeIdByBackendId.set(backendNodeId, nodeId);
      }
    }

    for (const entry of refs) {
      const nodeId = nodeIdByBackendId.get(Math.floor(entry.backendDOMNodeId));
      if (!nodeId) {
        continue;
      }
      try {
        await send("DOM.setAttributeValue", {
          nodeId,
          name: BROWSER_REF_MARKER_ATTRIBUTE,
          value: entry.ref,
        });
        marked.add(entry.ref);
      } catch {
        // Best-effort marker write. Unmarked refs fall back to role metadata.
      }
    }

    return marked;
  });
}
