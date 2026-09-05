import { describe, expect, it, vi } from "vitest";
import { createSidePanelController, SIDE_PANEL_ENABLED_KEY } from "./side-panel.js";

describe("Side Panel controller", () => {
  it("defaults to disabled without persisting or collecting tab data", async () => {
    const storage = { get: vi.fn(async () => ({})), set: vi.fn() };
    const setOptions = vi.fn(async () => undefined);
    const controller = createSidePanelController({
      chromeApi: { sidePanel: { setOptions } },
      storage,
    });

    await expect(controller.isEnabled()).resolves.toBe(false);
    expect(storage.get).toHaveBeenCalledWith(SIDE_PANEL_ENABLED_KEY);
    expect(storage.set).not.toHaveBeenCalled();
    expect(setOptions).toHaveBeenCalledWith({ enabled: false });
  });

  it("persists an explicit enable transition after enabling the panel", async () => {
    const storage = { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined) };
    const setOptions = vi.fn(async () => undefined);
    const controller = createSidePanelController({
      chromeApi: { sidePanel: { setOptions } },
      storage,
    });

    await expect(controller.setEnabled(true)).resolves.toBe(true);
    expect(setOptions).toHaveBeenCalledWith({ enabled: true });
    expect(storage.set).toHaveBeenCalledWith({ [SIDE_PANEL_ENABLED_KEY]: true });
  });

  it("coalesces concurrent initialization", async () => {
    const storage = { get: vi.fn(async () => ({})), set: vi.fn() };
    const setOptions = vi.fn(async () => undefined);
    const controller = createSidePanelController({
      chromeApi: { sidePanel: { setOptions } },
      storage,
    });

    await Promise.all([controller.initialize(), controller.isEnabled()]);
    expect(storage.get).toHaveBeenCalledTimes(1);
    expect(setOptions).toHaveBeenCalledTimes(1);
  });

  it("rejects non-boolean setting values", async () => {
    const controller = createSidePanelController({
      chromeApi: { sidePanel: { setOptions: vi.fn() } },
      storage: { get: vi.fn(), set: vi.fn() },
    });

    await expect(controller.setEnabled("true")).rejects.toThrow("Invalid Side Panel setting.");
  });
});
