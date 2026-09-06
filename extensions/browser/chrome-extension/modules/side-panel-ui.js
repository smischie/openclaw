const INITIAL_MESSAGES = [
  {
    role: "assistant",
    text: "**Welcome to OpenClaw.** This is a local Side Panel preview. It is ready to receive a message, but it does not connect to a Gateway or read tab data.",
  },
  {
    role: "assistant",
    text: "Try a short note or `code sample` to preview the conversation layout.",
  },
];

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** A deliberately small, safe display formatter for the static preview. */
export function renderSafeMarkdown(value) {
  const escaped = escapeHtml(value);
  return escaped
    .split(/\n{2,}/u)
    .map((paragraph) => {
      const inline = paragraph
        .replace(/`([^`]+)`/gu, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>")
        .replace(/\n/gu, "<br />");
      return `<p>${inline}</p>`;
    })
    .join("");
}

export function createLocalPreviewReply(message) {
  const subject = message.trim().slice(0, 96);
  return subject
    ? `Local preview received: **${subject}**\n\nGateway chat is intentionally not connected in this phase.`
    : "Gateway chat is intentionally not connected in this phase.";
}

export function createSidePanelUi(documentRef = document) {
  const timeline = documentRef.getElementById("timeline");
  const form = documentRef.getElementById("composerForm");
  const composer = documentRef.getElementById("composer");
  const send = documentRef.getElementById("send");
  if (!timeline || !form || !composer || !send) {
    throw new Error("OpenClaw Side Panel UI is missing required elements.");
  }

  let messages = [...INITIAL_MESSAGES];
  let state = "ready";

  function scrollToLatest() {
    timeline.scrollTop = timeline.scrollHeight;
  }

  function render() {
    timeline.replaceChildren();
    if (state === "loading") {
      timeline.innerHTML =
        '<div class="state"><strong>Starting preview…</strong><span>Preparing local conversation state.</span></div>';
      return;
    }
    if (state === "error") {
      timeline.innerHTML =
        '<div class="state error"><strong>Preview unavailable</strong><span>No message was sent. Try again when the local preview is ready.</span></div>';
      return;
    }
    if (messages.length === 0) {
      timeline.innerHTML =
        '<div class="empty"><strong>Start a conversation</strong><span>Your message stays in this local preview.</span></div>';
      return;
    }
    for (const message of messages) {
      const messageElement = documentRef.createElement("article");
      messageElement.className = `message ${message.role}`;
      messageElement.innerHTML = `<span class="sender">${message.role === "user" ? "You" : "OpenClaw"}</span><div class="bubble">${renderSafeMarkdown(message.text)}</div>`;
      timeline.append(messageElement);
    }
    scrollToLatest();
  }

  function setState(nextState) {
    state = nextState;
    composer.disabled = state !== "ready";
    send.disabled = state !== "ready";
    render();
  }

  function resizeComposer() {
    composer.style.height = "auto";
    composer.style.height = `${Math.min(composer.scrollHeight, 110)}px`;
  }

  composer.addEventListener("input", resizeComposer);
  composer.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = composer.value.trim();
    if (!text || state !== "ready") {
      return;
    }
    messages.push({ role: "user", text });
    composer.value = "";
    resizeComposer();
    setState("loading");
    window.setTimeout(() => {
      messages.push({ role: "assistant", text: createLocalPreviewReply(text) });
      setState("ready");
    }, 260);
  });

  render();
  return { getState: () => state, render, setState };
}

if (typeof document !== "undefined") {
  createSidePanelUi();
}
