(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});

  class EditorPanel {
    constructor(root, examples, supportedVariables, supportedFunctions) {
      this.root = root;
      this.examples = examples;
      this.supportedVariables = supportedVariables;
      this.supportedFunctions = supportedFunctions;
      this.algorithmButtons = document.getElementById("algorithmButtons");
      this.expressionField = document.getElementById("guidanceExpression");
      this.titleEl = document.getElementById("exampleTitle");
      this.descriptionEl = document.getElementById("exampleDescription");
      this.modeChip = document.getElementById("activeModeChip");
      this.statusEl = document.getElementById("formulaStatus");
      this.variableLegend = document.getElementById("variableLegend");
      this.functionLegend = document.getElementById("functionLegend");
      this.activeExampleId = null;
      this.inputTimer = null;

      this.renderExamples();
      this.renderLegend();
    }

    renderExamples() {
      this.algorithmButtons.replaceChildren();

      Object.values(this.examples).forEach((example) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = example.title;
        button.dataset.example = example.id;
        button.addEventListener("click", () => {
          this.handlers?.onExampleSelected?.(example.id);
        });
        this.algorithmButtons.append(button);
      });
    }

    renderLegend() {
      this.variableLegend.replaceChildren();
      this.functionLegend.replaceChildren();

      this.supportedVariables.forEach((item) => {
        const card = document.createElement("div");
        card.className = "legend-item";

        const key = document.createElement("strong");
        key.textContent = item.name;
        card.append(key);

        const description = document.createElement("span");
        description.textContent = item.description;
        card.append(description);

        this.variableLegend.append(card);
      });

      this.supportedFunctions.forEach((name) => {
        const tag = document.createElement("span");
        tag.textContent = name;
        this.functionLegend.append(tag);
      });
    }

    bind(handlers) {
      this.handlers = handlers;

      this.expressionField.addEventListener("input", () => {
        window.clearTimeout(this.inputTimer);
        this.inputTimer = window.setTimeout(() => {
          this.handlers?.onExpressionEdited?.(this.getExpression());
        }, 150);
      });
    }

    loadExample(example) {
      this.activeExampleId = example.id;
      this.titleEl.textContent = example.title;
      this.descriptionEl.textContent = example.description;
      this.expressionField.value = example.expression;
      this.setMode(example.outputMode);

      Array.from(this.algorithmButtons.children).forEach((button) => {
        button.classList.toggle("active", button.dataset.example === example.id);
      });
    }

    getExpression() {
      return this.expressionField.value;
    }

    setMode(mode) {
      this.modeChip.textContent = `Cikti modu: ${mode}`;
    }

    setFormulaStatus(message, options = {}) {
      this.statusEl.textContent = message;
      this.statusEl.className = "formula-status";
      if (options.isError) {
        this.statusEl.classList.add("status-error");
      } else if (options.isSuccess) {
        this.statusEl.classList.add("status-ok");
      }
    }
  }

  GuidanceSim.ui = GuidanceSim.ui || {};
  GuidanceSim.ui.EditorPanel = EditorPanel;
})();
