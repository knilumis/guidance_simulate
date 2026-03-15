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
    constructor(root, statusElements, extraInputs = []) {
      this.root = root;
      this.inputs = [...Array.from(root.querySelectorAll("[data-param]")), ...extraInputs.filter(Boolean)];
      this.statusBadge = statusElements.badge;
      this.statusMessage = statusElements.message;
      this.buttons = {
        start: document.getElementById("startBtn"),
        step: document.getElementById("stepBtn"),
      };
      this.fieldWrappers = new Map(
        Array.from(root.querySelectorAll("[data-field]")).map((node) => [node.dataset.field, node]),
      );
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

      this.refreshDynamicVisibility(this.getValues());
    }

    setFieldVisibility(fieldName, isVisible) {
      const node = this.fieldWrappers.get(fieldName);
      if (!node) {
        return;
      }

      node.classList.toggle("is-hidden", !isVisible);
    }

    refreshDynamicVisibility(values) {
      const gammaDemand = values.outputMode === "gamma_demand";
      const energyModel = values.speedModel === "energy";
      const sinusoidalTarget = values.targetMotionModel === "sinusoidal";

      this.setFieldVisibility("gammaTau", gammaDemand);
      this.setFieldVisibility("gammaCmdLimitDeg", gammaDemand);
      this.setFieldVisibility("gammaCmdRateLimitDeg", gammaDemand);
      this.setFieldVisibility("missileMass", energyModel);
      this.setFieldVisibility("thrust", energyModel);
      this.setFieldVisibility("referenceArea", energyModel);
      this.setFieldVisibility("dragCoeff", energyModel);
      this.setFieldVisibility("targetSinAmplitude", sinusoidalTarget);
      this.setFieldVisibility("targetSinFrequency", sinusoidalTarget);
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
        const button = this.root.ownerDocument.getElementById(id);
        if (button && handler) {
          button.addEventListener("click", handler);
        }
      });
    }

    bindInput(onChange) {
      this.inputs.forEach((input) => {
        const eventName = input.tagName === "SELECT" || input.type === "checkbox" ? "change" : "input";
        input.addEventListener(eventName, () => {
          const values = this.getValues();
          this.refreshDynamicVisibility(values);
          onChange(values, input.dataset.param);
        });
      });
    }

    setStatus(kind, label, message) {
      if (this.statusBadge) {
        this.statusBadge.textContent = label;
        this.statusBadge.className = `status-pill ${STATUS_CLASS_MAP[kind] ?? STATUS_CLASS_MAP.ready}`;
      }

      if (this.statusMessage) {
        this.statusMessage.textContent = message;
      }
    }

    setRunEnabled(isEnabled) {
      if (this.buttons.start) {
        this.buttons.start.disabled = !isEnabled;
      }
      if (this.buttons.step) {
        this.buttons.step.disabled = !isEnabled;
      }
    }
  }

  GuidanceSim.ui = GuidanceSim.ui || {};
  GuidanceSim.ui.ControlPanel = ControlPanel;
})();
