(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});

  const STORAGE_KEY = "guidance-sim-theme";
  const DEFAULT_THEME = "radar";
  const SUPPORTED_THEMES = new Set(["radar", "underwater", "lock", "light"]);

  class SettingsPanel {
    constructor(root) {
      this.root = root;
      this.button = root?.querySelector("[data-role='settings-toggle']") ?? null;
      this.bugButton = root?.querySelector("[data-role='bug-toggle']") ?? null;
      this.panel = root?.querySelector(".settings-menu-panel") ?? null;
      this.bugPanel = root?.querySelector(".bug-menu-panel") ?? null;
      this.themeInputs = Array.from(root?.querySelectorAll("[data-theme-choice]") ?? []);
      this.viewInputs = Array.from(root?.querySelectorAll("[data-view-option]") ?? []);
      this.handlers = {
        onThemeChange: null,
        onViewChange: null,
      };
    }

    init(initialOptions = {}) {
      const initialTheme = this.loadTheme();
      this.applyTheme(initialOptions.theme ?? initialTheme, { notify: false });
      this.setViewOptions({
        showLos: initialOptions.showLos ?? true,
        traceEnabled: initialOptions.traceEnabled ?? true,
      }, { notify: false });
      this.bindEvents();

      return {
        theme: this.getTheme(),
        ...this.getViewOptions(),
      };
    }

    bind(handlers = {}) {
      this.handlers = {
        ...this.handlers,
        ...handlers,
      };
    }

    bindEvents() {
      this.button?.addEventListener("click", (event) => {
        event.stopPropagation();
        this.toggleSettings();
      });

      this.bugButton?.addEventListener("click", (event) => {
        event.stopPropagation();
        this.toggleBug();
      });

      this.themeInputs.forEach((input) => {
        input.addEventListener("change", () => {
          if (input.checked) {
            this.applyTheme(input.value, { notify: true });
          }
        });
      });

      this.viewInputs.forEach((input) => {
        input.addEventListener("change", () => {
          this.handlers.onViewChange?.(this.getViewOptions());
        });
      });

      document.addEventListener("pointerdown", (event) => {
        if (!this.root || this.root.contains(event.target)) {
          return;
        }
        this.close();
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          this.close();
        }
      });
    }

    toggleSettings(force) {
      const shouldOpen = typeof force === "boolean" ? force : this.panel?.classList.contains("is-hidden");
      if (shouldOpen) {
        this.openSettings();
      } else {
        this.closeSettings();
      }
    }

    toggleBug(force) {
      const shouldOpen = typeof force === "boolean" ? force : this.bugPanel?.classList.contains("is-hidden");
      if (shouldOpen) {
        this.openBug();
      } else {
        this.closeBug();
      }
    }

    openSettings() {
      this.closeBug();
      this.panel?.classList.remove("is-hidden");
      this.button?.setAttribute("aria-expanded", "true");
      this.root?.classList.add("is-open");
    }

    closeSettings() {
      this.panel?.classList.add("is-hidden");
      this.button?.setAttribute("aria-expanded", "false");
    }

    openBug() {
      this.closeSettings();
      this.bugPanel?.classList.remove("is-hidden");
      this.bugButton?.setAttribute("aria-expanded", "true");
      this.root?.classList.add("is-open");
    }

    closeBug() {
      this.bugPanel?.classList.add("is-hidden");
      this.bugButton?.setAttribute("aria-expanded", "false");
    }

    close() {
      this.closeSettings();
      this.closeBug();
      this.root?.classList.remove("is-open");
    }

    getTheme() {
      const checked = this.themeInputs.find((input) => input.checked);
      return checked?.value ?? DEFAULT_THEME;
    }

    loadTheme() {
      try {
        const storedValue = window.localStorage?.getItem(STORAGE_KEY);
        return SUPPORTED_THEMES.has(storedValue) ? storedValue : DEFAULT_THEME;
      } catch (error) {
        return DEFAULT_THEME;
      }
    }

    applyTheme(themeId, options = {}) {
      const { notify = true } = options;
      const resolvedTheme = SUPPORTED_THEMES.has(themeId) ? themeId : DEFAULT_THEME;

      this.themeInputs.forEach((input) => {
        input.checked = input.value === resolvedTheme;
      });

      document.body.dataset.theme = resolvedTheme;
      try {
        window.localStorage?.setItem(STORAGE_KEY, resolvedTheme);
      } catch (error) {
        // Yerel depolama kullanılamazsa sessizce varsayılan akışa devam et.
      }

      if (notify) {
        this.handlers.onThemeChange?.(resolvedTheme);
      }
    }

    getViewOptions() {
      return Object.fromEntries(this.viewInputs.map((input) => [input.dataset.viewOption, Boolean(input.checked)]));
    }

    setViewOptions(options = {}, settings = {}) {
      const { notify = true } = settings;
      this.viewInputs.forEach((input) => {
        if (input.dataset.viewOption in options) {
          input.checked = Boolean(options[input.dataset.viewOption]);
        }
      });

      if (notify) {
        this.handlers.onViewChange?.(this.getViewOptions());
      }
    }
  }

  GuidanceSim.ui = GuidanceSim.ui || {};
  GuidanceSim.ui.SettingsPanel = SettingsPanel;
})();
