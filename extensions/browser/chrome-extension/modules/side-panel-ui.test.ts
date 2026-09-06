import { describe, expect, it } from "vitest";
import { createLocalPreviewReply, escapeHtml, renderSafeMarkdown } from "./side-panel-ui.js";

describe("Side Panel static preview", () => {
  it("escapes message HTML before applying the minimal display formatting", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    expect(renderSafeMarkdown("**Safe** `text` <script>alert(1)</script>")).toBe(
      "<p><strong>Safe</strong> <code>text</code> &lt;script&gt;alert(1)&lt;/script&gt;</p>",
    );
  });

  it("keeps preview replies local and identifies the static scope", () => {
    expect(createLocalPreviewReply("Check the **draft**")).toContain(
      "Gateway chat is intentionally not connected in this phase.",
    );
    expect(createLocalPreviewReply("Check the **draft**")).toContain("Local preview received");
  });

  it("bounds echoed preview text", () => {
    const reply = createLocalPreviewReply("a".repeat(120));
    expect(reply).toContain("a".repeat(96));
    expect(reply).not.toContain("a".repeat(97));
  });
});
