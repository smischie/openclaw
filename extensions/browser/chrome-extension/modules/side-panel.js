export const SIDE_PANEL_ENABLED_KEY = "sidePanelEnabled";

/** Keep optional Side Panel state separate from relay, pairing, and tab access. */
export function createSidePanelController({ chromeApi = chrome, storage = chrome.storage.local }) {
  let initialized = false;
  let initializing = null;
  let enabled = false;

  async function apply(nextEnabled) {
    await chromeApi.sidePanel.setOptions({ enabled: nextEnabled });
  }

  return {
    async initialize() {
      if (initialized) {
        return enabled;
      }
      if (!initializing) {
        initializing = (async () => {
          const stored = await storage.get(SIDE_PANEL_ENABLED_KEY);
          enabled = stored[SIDE_PANEL_ENABLED_KEY] === true;
          await apply(enabled);
          initialized = true;
          return enabled;
        })().finally(() => {
          initializing = null;
        });
      }
      return await initializing;
    },
    async isEnabled() {
      await this.initialize();
      return enabled;
    },
    async setEnabled(nextEnabled) {
      if (typeof nextEnabled !== "boolean") {
        throw new Error("Invalid Side Panel setting.");
      }
      await apply(nextEnabled);
      await storage.set({ [SIDE_PANEL_ENABLED_KEY]: nextEnabled });
      enabled = nextEnabled;
      initialized = true;
      return enabled;
    },
  };
}
