(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});

  const STATUS_CLASS_MAP = {
    ready: "status-warning",
    running: "status-running",
    success: "status-success",
    warning: "status-warning",
    error: "status-error",
  };

  function normalizeValue(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
    }
    return value;
  }

  class ControlPanel {
    constructor(root, statusElements) {
      this.root = root;
      this.inputs = Array.from(root.querySelectorAll("[data-param]"));
      this.statusBadge = statusElements.badge;
      this.statusMessage = statusElements.message;
    }

    getValues() {
      return Object.fromEntries(
        this.inputs.map((input) => {
          if (input.type === "checkbox") {
            return [input.dataset.param, input.checked];
          }

          if (input.tagName === "SELECT") {
            return [input.dataset.param, input.value];
          }

          return [input.dataset.param, Number(input.value)];
        }),
      );
    }

    setValues(values) {
      this.inputs.forEach((input) => {
        const key = input.dataset.param;
        if (!(key in values)) {
          return;
        }

        const value = values[key];
        if (input.type === "checkbox") {
          input.checked = Boolean(value);
          return;
        }

        input.value = normalizeValue(value);
      });
    }

    bindActions(handlers) {
      const buttonMap = {
        startBtn: handlers.onStart,
        stopBtn: handlers.onStop,
        resetBtn: handlers.onReset,
        stepBtn: handlers.onStep,
        loadDemoBtn: handlers.onLoadDemo,
      };

      Object.entries(buttonMap).forEach(([id, handler]) => {
        this.root.ownerDocument.getElementById(id).addEventListener("click", handler);
      });
    }

    bindInput(onChange) {
      this.inputs.forEach((input) => {
        const eventName = input.tagName === "SELECT" || input.type === "checkbox" ? "change" : "input";
        input.addEventListener(eventName, () => onChange(this.getValues(), input.dataset.param));
      });
    }

    setStatus(kind, label, message) {
      this.statusBadge.textContent = label;
      this.statusBadge.className = `status-pill ${STATUS_CLASS_MAP[kind] ?? STATUS_CLASS_MAP.ready}`;
      this.statusMessage.textContent = message;
    }
  }

  GuidanceSim.ui = GuidanceSim.ui || {};
  GuidanceSim.ui.ControlPanel = ControlPanel;
})();
