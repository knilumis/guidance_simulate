(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});

  function createTextElement(tagName, className, textContent) {
    const node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    node.textContent = textContent;
    return node;
  }

  class EditorPanel {
    constructor(root, examples, helpFormulas, supportedVariables, supportedFunctions) {
      this.root = root;
      this.examples = examples;
      this.helpFormulas = helpFormulas;
      this.supportedVariables = supportedVariables;
      this.supportedFunctions = supportedFunctions;
      this.algorithmButtons = document.getElementById("algorithmButtons");
      this.expressionField = document.getElementById("guidanceExpression");
      this.modeSelect = document.getElementById("editorOutputMode");
      this.statusEl = document.getElementById("formulaStatus");
      this.variableLegend = document.getElementById("variableLegend");
      this.functionLegend = document.getElementById("functionLegend");
      this.formulaExamples = document.getElementById("formulaExamples");
      this.activeExampleId = null;
      this.inputTimer = null;
      this.buildInfoPopover();

      this.renderExamples();
      this.renderLegend();
      this.renderFormulaExamples();
    }

    buildInfoPopover() {
      const overlay = document.createElement("div");
      overlay.className = "algorithm-popover is-hidden";

      const card = document.createElement("div");
      card.className = "algorithm-popover-card";

      const head = document.createElement("div");
      head.className = "algorithm-popover-head";

      this.infoTitleEl = createTextElement("h3", "", "");
      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "algorithm-popover-close";
      closeButton.textContent = "X";
      closeButton.addEventListener("click", () => this.closeExampleInfo());

      head.append(this.infoTitleEl, closeButton);

      this.infoBodyEl = createTextElement("p", "algorithm-popover-body", "");
      card.append(head, this.infoBodyEl);
      overlay.append(card);

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          this.closeExampleInfo();
        }
      });

      this.root.append(overlay);
      this.infoOverlay = overlay;
    }

    renderExamples() {
      this.algorithmButtons.replaceChildren();

      Object.values(this.examples).forEach((example) => {
        const card = document.createElement("article");
        card.className = "algorithm-card";
        card.dataset.example = example.id;
        card.tabIndex = 0;

        const head = document.createElement("div");
        head.className = "algorithm-card-head";

        const titleGroup = document.createElement("div");
        titleGroup.className = "algorithm-card-title-group";
        titleGroup.append(
          createTextElement("strong", "algorithm-card-title", example.title),
          createTextElement("span", "algorithm-card-mode", example.outputMode),
        );

        const infoButton = document.createElement("button");
        infoButton.type = "button";
        infoButton.className = "algorithm-info-button";
        infoButton.textContent = "?";
        infoButton.setAttribute("aria-label", `${example.title} açıklamasını göster`);
        infoButton.addEventListener("click", (event) => {
          event.stopPropagation();
          this.openExampleInfo(example);
        });

        head.append(
          titleGroup,
          infoButton,
        );

        card.append(
          head,
          createTextElement("code", "", example.expression),
        );

        card.addEventListener("click", () => {
          this.handlers?.onExampleSelected?.(example.id);
        });
        card.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            this.handlers?.onExampleSelected?.(example.id);
          }
        });

        this.algorithmButtons.append(card);
      });
    }

    renderLegend() {
      this.variableLegend.replaceChildren();
      this.functionLegend.replaceChildren();

      this.supportedVariables.forEach((item) => {
        const card = document.createElement("div");
        card.className = "legend-item";
        card.append(
          createTextElement("strong", "", item.name),
          createTextElement("span", "", item.description),
        );
        this.variableLegend.append(card);
      });

      this.supportedFunctions.forEach((name) => {
        this.functionLegend.append(createTextElement("span", "", name));
      });
    }

    renderFormulaExamples() {
      this.formulaExamples.replaceChildren();

      this.helpFormulas.forEach((item) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "formula-example";
        const line = document.createElement("div");
        line.className = "formula-example-line";
        line.append(
          createTextElement("strong", "", `${item.title}:`),
          createTextElement("code", "", item.expression),
        );
        card.append(
          line,
          createTextElement("span", "", item.note),
        );
        card.addEventListener("click", () => {
          this.expressionField.value = item.expression;
          this.handlers?.onExpressionEdited?.(this.getExpression());
        });
        this.formulaExamples.append(card);
      });
    }

    bind(handlers) {
      this.handlers = handlers;

      this.expressionField.addEventListener("input", () => {
        window.clearTimeout(this.inputTimer);
        this.inputTimer = window.setTimeout(() => {
          this.handlers?.onExpressionEdited?.(this.getExpression());
        }, 100);
      });
    }

    loadExample(example) {
      this.activeExampleId = example.id;
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
      if (this.modeSelect) {
        this.modeSelect.value = mode;
      }
    }

    setFormulaStatus(message, options = {}) {
      if (!this.statusEl) {
        return;
      }

      if (options.isError) {
        this.statusEl.textContent = message;
        this.statusEl.className = "formula-status status-error";
        return;
      }

      this.statusEl.textContent = "";
      this.statusEl.className = "formula-status is-hidden";
    }

    openExampleInfo(example) {
      if (!this.infoOverlay || !this.infoTitleEl || !this.infoBodyEl) {
        return;
      }

      this.infoTitleEl.textContent = example.title;
      this.infoBodyEl.textContent = example.description;
      this.infoOverlay.classList.remove("is-hidden");
    }

    closeExampleInfo() {
      this.infoOverlay?.classList.add("is-hidden");
    }
  }

  GuidanceSim.ui = GuidanceSim.ui || {};
  GuidanceSim.ui.EditorPanel = EditorPanel;
})();
