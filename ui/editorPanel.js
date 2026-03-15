(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});
  const { tokenize } = GuidanceSim.guidanceEngine || {};

  const UNIT_BY_SYMBOL = {
    t: "[s]",
    dt: "[s]",
    x_m: "[m]",
    z_m: "[m]",
    x_t: "[m]",
    z_t: "[m]",
    vx_m: "[m/s]",
    vz_m: "[m/s]",
    vx_t: "[m/s]",
    vz_t: "[m/s]",
    V_m: "[m/s]",
    V_t: "[m/s]",
    gamma_m: "[rad]",
    gamma_t: "[rad]",
    dx: "[m]",
    dz: "[m]",
    vrel_x: "[m/s]",
    vrel_z: "[m/s]",
    R: "[m]",
    Rdot: "[m/s]",
    lambda: "[rad]",
    lambda_dot: "[rad/s]",
    sigma: "[rad]",
    sigma_dot: "[rad/s]",
    closing_velocity: "[m/s]",
    xz_error: "[m]",
    yanal_hata: "[m]",
    energy: "[J/kg]",
    energy_error: "[J/kg]",
    az_prev: "[m/s^2]",
    az_cmd_prev: "[m/s^2]",
    az_actual_prev: "[m/s^2]",
    gamma_cmd_prev: "[rad]",
    gamma_error_prev: "[rad]",
    g: "[m/s^2]",
    intercept_radius: "[m]",
    gamma_tau: "[s]",
    a_max: "[m/s^2]",
  };

  function createTextElement(tagName, className, textContent) {
    const node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    node.textContent = textContent;
    return node;
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function buildSymbolMap(supportedVariables, supportedFunctions) {
    const map = new Map();

    supportedVariables.forEach((item) => {
      item.name.split(/\s*,\s*|\s*\/\s*/).map((part) => part.trim()).filter(Boolean).forEach((name) => {
        map.set(name, {
          type: "variable",
          name,
          description: item.description,
          unit: UNIT_BY_SYMBOL[name] ?? "",
          insertText: name,
        });
      });
    });

    supportedFunctions.forEach((name) => {
      map.set(name, {
        type: "function",
        name,
        description: "İzinli matematik fonksiyonu",
        unit: "Fonksiyon",
        insertText: `${name}()`,
      });
    });

    return map;
  }

  function inferWarnings(expression, mode, symbolNames) {
    const warnings = [];
    const trimmed = expression.trim();
    const identifiers = symbolNames.filter(Boolean);
    const hasAny = (...names) => names.some((name) => identifiers.includes(name));

    if (mode === "az_demand") {
      if (["lambda", "sigma", "gamma_m", "gamma_t"].includes(trimmed)) {
        warnings.push("Çıktı modu az_demand iken doğrudan açı döndürüyorsunuz. Çıktının yanal ivme [m/s²] olması beklenir.");
      } else if (
        hasAny("lambda", "sigma", "gamma_m", "gamma_t")
        && !hasAny("V_m", "closing_velocity", "a_max", "az_prev", "az_cmd_prev", "az_actual_prev")
      ) {
        warnings.push("Formülde açı terimleri var. az_demand modunda birimlerin ivme ölçeğine dönüştüğünü kontrol edin.");
      }
    }

    if (mode === "gamma_demand") {
      if (hasAny("az_prev", "az_cmd_prev", "az_actual_prev") && !hasAny("gamma_m", "gamma_cmd_prev", "lambda", "sigma")) {
        warnings.push("gamma_demand modunda çıktı açı [rad] olmalıdır. İvme terimi kullanıyorsanız dönüştürme gerekip gerekmediğini kontrol edin.");
      } else if (hasAny("V_m", "lambda_dot") && !hasAny("gamma_m", "lambda", "sigma")) {
        warnings.push("V_m * lambda_dot benzeri terimler ivme ölçeğinde olabilir. gamma_demand modunda çıktının açı komutu olması beklenir.");
      }
    }

    return warnings;
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
      this.highlightEl = document.getElementById("guidanceHighlight");
      this.tooltipEl = document.getElementById("editorTooltip");
      this.autocompleteEl = document.getElementById("editorAutocomplete");
      this.unitWarningsEl = document.getElementById("editorUnitWarnings");
      this.statusEl = document.getElementById("formulaStatus");
      this.variableLegend = document.getElementById("variableLegend");
      this.functionLegend = document.getElementById("functionLegend");
      this.formulaExamples = document.getElementById("formulaExamples");
      this.activeExampleId = null;
      this.inputTimer = null;
      this.symbolMap = buildSymbolMap(supportedVariables, supportedFunctions);
      this.completions = Array.from(this.symbolMap.values()).sort((left, right) => left.name.localeCompare(right.name, "tr"));
      this.autocompleteState = {
        items: [],
        activeIndex: 0,
        prefixStart: 0,
        prefixText: "",
      };

      this.buildInfoPopover();
      this.renderExamples();
      this.renderLegend();
      this.renderFormulaExamples();
      this.renderHighlight();
      this.refreshContextualHelp();
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

        head.append(titleGroup, infoButton);

        card.append(head, createTextElement("code", "", example.expression));
        card.addEventListener("click", () => this.handlers?.onExampleSelected?.(example.id));
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
        card.append(line, createTextElement("span", "", item.note));
        card.addEventListener("click", () => {
          this.expressionField.value = item.expression;
          this.renderHighlight();
          this.refreshContextualHelp();
          this.handlers?.onExpressionEdited?.(this.getExpression());
        });
        this.formulaExamples.append(card);
      });
    }

    bind(handlers) {
      this.handlers = handlers;

      this.expressionField.addEventListener("input", () => {
        this.renderHighlight();
        this.refreshContextualHelp();
        this.updateAutocomplete();

        window.clearTimeout(this.inputTimer);
        this.inputTimer = window.setTimeout(() => {
          this.handlers?.onExpressionEdited?.(this.getExpression());
        }, 100);
      });

      this.expressionField.addEventListener("scroll", () => this.syncScroll());
      this.expressionField.addEventListener("click", () => {
        this.refreshContextualHelp();
        this.updateAutocomplete();
      });
      this.expressionField.addEventListener("keyup", () => {
        this.refreshContextualHelp();
        this.updateAutocomplete();
      });
      this.expressionField.addEventListener("keydown", (event) => this.handleEditorKeyDown(event));
      this.expressionField.addEventListener("blur", () => {
        window.setTimeout(() => this.hideAutocomplete(), 120);
      });
      this.expressionField.addEventListener("focus", () => {
        this.refreshContextualHelp();
        this.updateAutocomplete();
      });
    }

    handleEditorKeyDown(event) {
      if (this.autocompleteState.items.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          this.autocompleteState.activeIndex = (this.autocompleteState.activeIndex + 1) % this.autocompleteState.items.length;
          this.renderAutocomplete();
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          this.autocompleteState.activeIndex = (this.autocompleteState.activeIndex - 1 + this.autocompleteState.items.length) % this.autocompleteState.items.length;
          this.renderAutocomplete();
          return;
        }

        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          this.acceptAutocomplete(this.autocompleteState.items[this.autocompleteState.activeIndex]);
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          this.hideAutocomplete();
          return;
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key === " ") {
        event.preventDefault();
        this.updateAutocomplete({ force: true });
      }
    }

    loadExample(example) {
      this.activeExampleId = example.id;
      this.expressionField.value = example.expression;
      this.setMode(example.outputMode);
      this.renderHighlight();
      this.refreshContextualHelp();

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
      this.refreshContextualHelp();
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

    renderHighlight() {
      if (!this.highlightEl || !this.expressionField) {
        return;
      }

      const expression = this.expressionField.value;
      if (!expression) {
        this.highlightEl.innerHTML = "<span class=\"editor-token-placeholder\">Formül buraya yazılır</span>";
        return;
      }

      if (typeof tokenize !== "function") {
        this.highlightEl.textContent = expression;
        return;
      }

      try {
        const tokens = tokenize(expression);
        let cursor = 0;
        let html = "";

        tokens.forEach((token) => {
          if (cursor < token.start) {
            html += escapeHtml(expression.slice(cursor, token.start));
          }

          let className = "editor-token-operator";
          if (token.type === "number") {
            className = "editor-token-number";
          } else if (token.type === "identifier") {
            className = this.symbolMap.has(token.value)
              ? (this.symbolMap.get(token.value).type === "function" ? "editor-token-function" : "editor-token-variable")
              : "editor-token-unknown";
          } else if (token.type === "(" || token.type === ")" || token.type === ",") {
            className = "editor-token-paren";
          }

          html += `<span class="${className}">${escapeHtml(expression.slice(token.start, token.end))}</span>`;
          cursor = token.end;
        });

        if (cursor < expression.length) {
          html += escapeHtml(expression.slice(cursor));
        }

        this.highlightEl.innerHTML = html;
      } catch (error) {
        this.highlightEl.textContent = expression;
      }
    }

    syncScroll() {
      if (!this.highlightEl) {
        return;
      }
      this.highlightEl.scrollTop = this.expressionField.scrollTop;
      this.highlightEl.scrollLeft = this.expressionField.scrollLeft;
    }

    getActiveSymbol() {
      if (typeof tokenize !== "function") {
        return null;
      }

      const expression = this.getExpression();
      const caret = this.expressionField.selectionStart ?? expression.length;
      try {
        const tokens = tokenize(expression);
        const token = tokens.find((item) => item.type === "identifier" && item.start <= caret && item.end >= caret);
        if (!token) {
          return null;
        }
        return this.symbolMap.get(token.value) ?? {
          type: "unknown",
          name: token.value,
          description: "Bu sembol izinli listede görünmüyor.",
          unit: "",
        };
      } catch (error) {
        return null;
      }
    }

    refreshContextualHelp() {
      const activeSymbol = this.getActiveSymbol();
      if (activeSymbol && this.tooltipEl) {
        this.tooltipEl.innerHTML = `
          <strong>${escapeHtml(activeSymbol.name)}</strong>
          <span>${escapeHtml(activeSymbol.description)}</span>
          <small>${escapeHtml(activeSymbol.unit || "Birim bilgisi yok")}</small>
        `;
        this.tooltipEl.classList.remove("is-hidden");
      } else {
        this.tooltipEl?.classList.add("is-hidden");
      }

      this.updateUnitWarnings();
    }

    updateUnitWarnings() {
      if (!this.unitWarningsEl || typeof tokenize !== "function") {
        return;
      }

      const expression = this.getExpression();
      try {
        const tokens = tokenize(expression);
        const names = tokens.filter((token) => token.type === "identifier").map((token) => token.value);
        const warnings = inferWarnings(expression, this.modeSelect?.value ?? "az_demand", names);

        if (!warnings.length) {
          this.unitWarningsEl.classList.add("is-hidden");
          this.unitWarningsEl.replaceChildren();
          return;
        }

        this.unitWarningsEl.replaceChildren(...warnings.map((warning) => createTextElement("p", "", warning)));
        this.unitWarningsEl.classList.remove("is-hidden");
      } catch (error) {
        this.unitWarningsEl.classList.add("is-hidden");
      }
    }

    updateAutocomplete(options = {}) {
      const { force = false } = options;
      const value = this.getExpression();
      const caret = this.expressionField.selectionStart ?? value.length;
      const prefixMatch = value.slice(0, caret).match(/([A-Za-z_][A-Za-z0-9_]*)$/);
      const prefixText = prefixMatch?.[1] ?? "";

      if (!force && prefixText.length < 1) {
        this.hideAutocomplete();
        return;
      }

      const items = this.completions
        .filter((item) => !prefixText || item.name.toLowerCase().startsWith(prefixText.toLowerCase()))
        .slice(0, 8);

      if (!items.length) {
        this.hideAutocomplete();
        return;
      }

      this.autocompleteState.items = items;
      this.autocompleteState.activeIndex = Math.min(this.autocompleteState.activeIndex, items.length - 1);
      this.autocompleteState.prefixStart = prefixMatch ? caret - prefixText.length : caret;
      this.autocompleteState.prefixText = prefixText;
      this.renderAutocomplete();
    }

    renderAutocomplete() {
      if (!this.autocompleteEl) {
        return;
      }

      this.autocompleteEl.replaceChildren();
      let activeButton = null;
      this.autocompleteState.items.forEach((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "editor-autocomplete-item";
        button.classList.toggle("active", index === this.autocompleteState.activeIndex);
        button.innerHTML = `
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.description)}</span>
        `;
        button.addEventListener("mousedown", (event) => {
          event.preventDefault();
          this.acceptAutocomplete(item);
        });
        this.autocompleteEl.append(button);
        if (index === this.autocompleteState.activeIndex) {
          activeButton = button;
        }
      });

      this.autocompleteEl.classList.remove("is-hidden");
      activeButton?.scrollIntoView({ block: "nearest" });
    }

    hideAutocomplete() {
      this.autocompleteState.items = [];
      this.autocompleteState.activeIndex = 0;
      this.autocompleteEl?.classList.add("is-hidden");
      this.autocompleteEl?.replaceChildren();
    }

    acceptAutocomplete(item) {
      if (!item) {
        return;
      }

      const value = this.getExpression();
      const prefixStart = this.autocompleteState.prefixStart;
      const caret = this.expressionField.selectionStart ?? value.length;
      const insertion = item.insertText;
      const nextValue = `${value.slice(0, prefixStart)}${insertion}${value.slice(caret)}`;
      this.expressionField.value = nextValue;

      const caretOffset = item.type === "function" ? insertion.length - 1 : insertion.length;
      const nextCaret = prefixStart + caretOffset;
      this.expressionField.setSelectionRange(nextCaret, nextCaret);
      this.hideAutocomplete();
      this.renderHighlight();
      this.refreshContextualHelp();
      this.handlers?.onExpressionEdited?.(this.getExpression());
      this.expressionField.focus();
    }
  }

  GuidanceSim.ui = GuidanceSim.ui || {};
  GuidanceSim.ui.EditorPanel = EditorPanel;
})();
