(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});
  const { formatNumber } = GuidanceSim.utils.math;
  const { PLOT_SPECS = [] } = GuidanceSim.ui || {};

  const SWEEP_PARAMETERS = [
    { id: "N", label: "N", min: 1, max: 6, steps: 11 },
    { id: "k1", label: "k1", min: 0.2, max: 4, steps: 11 },
    { id: "k2", label: "k2", min: 0, max: 3, steps: 11 },
    { id: "gammaTau", label: "gamma_tau [s]", min: 0.15, max: 1.4, steps: 11 },
    { id: "targetTurnRateDeg", label: "Hedef donus orani [deg/s]", min: -18, max: 18, steps: 13 },
    { id: "targetEvasionRange", label: "Kacinma menzili [m]", min: 400, max: 2000, steps: 9 },
  ];

  const SWEEP_METRICS = [
    { id: "minMissDistance", label: "En kucuk sapma", unit: "m", direction: "min" },
    { id: "interceptTime", label: "Onleme zamani", unit: "s", direction: "min" },
    { id: "terminalSpeed", label: "Terminal hiz", unit: "m/s", direction: "max" },
    { id: "peakAz", label: "Tepe az", unit: "m/s^2", direction: "min_abs" },
    { id: "peakLambdaDot", label: "Tepe lambda_dot", unit: "rad/s", direction: "min_abs" },
    { id: "finalTime", label: "Bitis zamani", unit: "s", direction: "min" },
  ];

  const COMPARISON_ALGORITHMS = [
    { id: "PNG", label: "PNG" },
    { id: "BPG", label: "BPG" },
    { id: "USER", label: "Kullanici" },
  ];

  function getCssVar(name, fallback) {
    const value = window.getComputedStyle(document.body || document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function makeOptionList(items) {
    return items.map((item) => `<option value="${item.id}">${item.label}</option>`).join("");
  }

  function makeCheckboxList(items, name) {
    return items.map((item) => `
      <label class="analysis-check">
        <input type="checkbox" name="${name}" value="${item.id}" checked>
        <span>${item.label}</span>
      </label>
    `).join("");
  }

  function buildChartOptions(extra = {}) {
    const legend = getCssVar("--plot-legend", "#f2fff6");
    const tick = getCssVar("--plot-tick", "#b3d7bf");
    const grid = getCssVar("--plot-grid", "rgba(98, 255, 144, 0.08)");
    const title = getCssVar("--plot-title", "#f2fff6");
    const dragBorder = getCssVar("--plot-drag-border", "rgba(99, 255, 141, 0.72)");
    const dragFill = getCssVar("--plot-drag-fill", "rgba(99, 255, 141, 0.14)");

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          labels: {
            color: legend,
            font: { family: "Consolas", size: 10 },
          },
        },
        zoom: {
          pan: {
            enabled: true,
            mode: "xy",
            modifierKey: "shift",
          },
          zoom: {
            wheel: {
              enabled: extra.wheelEnabled ?? false,
              modifierKey: "ctrl",
            },
            pinch: { enabled: false },
            drag: {
              enabled: true,
              modifierKey: "ctrl",
              borderColor: dragBorder,
              backgroundColor: dragFill,
            },
            mode: "xy",
          },
          limits: {
            x: { min: "original", max: "original" },
            y: { min: "original", max: "original" },
          },
        },
      },
      scales: {
        x: {
          type: extra.xAxisType ?? "linear",
          title: {
            display: true,
            text: extra.xTitle ?? "x",
            color: title,
            font: { family: "Consolas", size: 10 },
          },
          ticks: {
            color: tick,
            font: { family: "Consolas", size: 10 },
          },
          grid: { color: grid },
        },
        y: {
          title: {
            display: true,
            text: extra.yTitle ?? "y",
            color: title,
            font: { family: "Consolas", size: 10 },
          },
          ticks: {
            color: tick,
            font: { family: "Consolas", size: 10 },
          },
          grid: { color: grid },
        },
      },
    };
  }

  function buildSummaryCard(label, value) {
    return `
      <article class="analysis-summary-card">
        <span>${label}</span>
        <strong>${value}</strong>
      </article>
    `;
  }

  class AnalysisPanel {
    constructor(options = {}) {
      this.chartLibrary = window.Chart;
      this.sweepButton = options.sweepButton ?? document.getElementById("sweepBtn");
      this.compareButton = options.compareButton ?? document.getElementById("compareBtn");
      this.handlers = {};
      this.chartRefs = {
        sweep: null,
        comparisonMetric: null,
        comparisonTrajectory: null,
      };
      this.lastSweepResult = null;
      this.lastComparisonResult = null;
      this.pendingTimers = new Map();
      this.resizeFrame = null;

      this.build();
      this.bindBaseEvents();
    }

    build() {
      const overlay = document.createElement("div");
      overlay.className = "analysis-overlay is-hidden";
      overlay.innerHTML = `
        <div class="analysis-card" role="dialog" aria-modal="true" aria-label="Analiz paneli">
          <div class="analysis-head">
            <div class="analysis-head-copy">
              <p class="section-kicker">Analiz</p>
              <h2 id="analysisTitle">Parametre Supurme</h2>
            </div>
            <button type="button" class="analysis-close" aria-label="Analiz panelini kapat">X</button>
          </div>
          <div class="analysis-tabs">
            <button type="button" class="analysis-tab active" data-tab="sweep">Supurme</button>
            <button type="button" class="analysis-tab" data-tab="compare">Karsilastirma</button>
          </div>
          <div class="analysis-body">
            <section class="analysis-tab-panel active" data-panel="sweep">
              <div class="analysis-layout">
                <div class="analysis-config">
                  <div class="analysis-field-grid">
                    <label class="analysis-field">
                      <span>Parametre</span>
                      <select data-role="sweep-parameter">${makeOptionList(SWEEP_PARAMETERS)}</select>
                    </label>
                    <label class="analysis-field">
                      <span>Metrik</span>
                      <select data-role="sweep-metric">${makeOptionList(SWEEP_METRICS)}</select>
                    </label>
                    <label class="analysis-field">
                      <span>Baslangic</span>
                      <input data-role="sweep-min" type="number" step="0.1">
                    </label>
                    <label class="analysis-field">
                      <span>Bitis</span>
                      <input data-role="sweep-max" type="number" step="0.1">
                    </label>
                    <label class="analysis-field">
                      <span>Adim sayisi</span>
                      <input data-role="sweep-steps" type="number" min="2" max="61" step="1">
                    </label>
                    <label class="analysis-check analysis-check-wide">
                      <input data-role="sweep-live" type="checkbox" checked>
                      <span>Canli guncelle</span>
                    </label>
                  </div>
                  <div class="analysis-actions">
                    <button type="button" class="primary" data-action="run-sweep">Supurmeyi Calistir</button>
                  </div>
                  <p class="panel-note" data-role="sweep-status">Mevcut kullanici formulu secili parametre araliginda taranir.</p>
                </div>
                <div class="analysis-results">
                  <div class="analysis-summary-grid" data-role="sweep-summary"></div>
                  <div class="analysis-chart-card">
                    <div class="analysis-chart-frame">
                      <canvas data-role="sweep-chart"></canvas>
                    </div>
                  </div>
                  <div class="analysis-table-wrap">
                    <table class="analysis-table">
                      <thead>
                        <tr>
                          <th>Parametre</th>
                          <th>Durum</th>
                          <th>Metrik</th>
                          <th>En kucuk sapma</th>
                          <th>Onleme zamani</th>
                        </tr>
                      </thead>
                      <tbody data-role="sweep-table"></tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
            <section class="analysis-tab-panel" data-panel="compare">
              <div class="analysis-layout">
                <div class="analysis-config">
                  <div class="analysis-field-grid">
                    <label class="analysis-field">
                      <span>Zaman serisi</span>
                      <select data-role="compare-metric">${makeOptionList(PLOT_SPECS.map((spec) => ({ id: spec.id, label: spec.title })))}</select>
                    </label>
                    <div class="analysis-field analysis-field-span">
                      <span>Algoritmalar</span>
                      <div class="analysis-check-grid">
                        ${makeCheckboxList(COMPARISON_ALGORITHMS, "compare-algorithm")}
                      </div>
                    </div>
                    <label class="analysis-check analysis-check-wide">
                      <input data-role="compare-live" type="checkbox" checked>
                      <span>Canli guncelle</span>
                    </label>
                  </div>
                  <div class="analysis-actions">
                    <button type="button" class="primary" data-action="run-compare">Karsilastirmayi Calistir</button>
                  </div>
                  <p class="panel-note" data-role="compare-status">PNG, BPG ve kullanici formulu ayni senaryoda ust uste cizilir.</p>
                </div>
                <div class="analysis-results">
                  <div class="analysis-summary-grid" data-role="compare-summary"></div>
                  <div class="analysis-chart-grid">
                    <div class="analysis-chart-card analysis-chart-card-large">
                      <h3>2D Yorunge Karsilastirmasi</h3>
                      <div class="analysis-chart-frame">
                        <canvas data-role="compare-trajectory-chart"></canvas>
                      </div>
                    </div>
                    <div class="analysis-chart-card">
                      <h3>Zaman Serisi Karsilastirmasi</h3>
                      <div class="analysis-chart-frame">
                        <canvas data-role="compare-metric-chart"></canvas>
                      </div>
                    </div>
                  </div>
                  <div class="analysis-table-wrap">
                    <table class="analysis-table">
                      <thead>
                        <tr>
                          <th>Algoritma</th>
                          <th>Cikti modu</th>
                          <th>Durum</th>
                          <th>En kucuk sapma</th>
                          <th>Onleme zamani</th>
                          <th>Tepe az</th>
                        </tr>
                      </thead>
                      <tbody data-role="compare-table"></tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      `;

      document.body.append(overlay);
      this.overlay = overlay;
      this.card = overlay.querySelector(".analysis-card");
      this.titleEl = overlay.querySelector("#analysisTitle");
      this.closeButton = overlay.querySelector(".analysis-close");
      this.tabButtons = Array.from(overlay.querySelectorAll(".analysis-tab"));
      this.tabPanels = Array.from(overlay.querySelectorAll(".analysis-tab-panel"));

      this.refs = {
        sweep: {
          parameter: overlay.querySelector("[data-role='sweep-parameter']"),
          metric: overlay.querySelector("[data-role='sweep-metric']"),
          min: overlay.querySelector("[data-role='sweep-min']"),
          max: overlay.querySelector("[data-role='sweep-max']"),
          steps: overlay.querySelector("[data-role='sweep-steps']"),
          live: overlay.querySelector("[data-role='sweep-live']"),
          status: overlay.querySelector("[data-role='sweep-status']"),
          summary: overlay.querySelector("[data-role='sweep-summary']"),
          table: overlay.querySelector("[data-role='sweep-table']"),
          chartCanvas: overlay.querySelector("[data-role='sweep-chart']"),
          run: overlay.querySelector("[data-action='run-sweep']"),
        },
        compare: {
          metric: overlay.querySelector("[data-role='compare-metric']"),
          live: overlay.querySelector("[data-role='compare-live']"),
          checks: Array.from(overlay.querySelectorAll("input[name='compare-algorithm']")),
          status: overlay.querySelector("[data-role='compare-status']"),
          summary: overlay.querySelector("[data-role='compare-summary']"),
          table: overlay.querySelector("[data-role='compare-table']"),
          trajectoryCanvas: overlay.querySelector("[data-role='compare-trajectory-chart']"),
          metricCanvas: overlay.querySelector("[data-role='compare-metric-chart']"),
          run: overlay.querySelector("[data-action='run-compare']"),
        },
      };

      this.applySweepParameterDefaults(this.refs.sweep.parameter.value);
      if (PLOT_SPECS.some((spec) => spec.id === "R")) {
        this.refs.compare.metric.value = "R";
      }
    }

    bindBaseEvents() {
      this.sweepButton?.addEventListener("click", () => this.open("sweep"));
      this.compareButton?.addEventListener("click", () => this.open("compare"));
      this.closeButton?.addEventListener("click", () => this.close());

      this.overlay.addEventListener("pointerdown", (event) => {
        if (event.target === this.overlay) {
          this.close();
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !this.overlay.classList.contains("is-hidden")) {
          this.close();
        }
      });

      this.tabButtons.forEach((button) => {
        button.addEventListener("click", () => this.activateTab(button.dataset.tab));
      });

      this.refs.sweep.parameter.addEventListener("change", () => {
        this.applySweepParameterDefaults(this.refs.sweep.parameter.value);
        this.scheduleLiveRun("sweep");
      });

      [this.refs.sweep.metric, this.refs.sweep.min, this.refs.sweep.max, this.refs.sweep.steps, this.refs.sweep.live]
        .forEach((element) => {
          element.addEventListener("input", () => this.scheduleLiveRun("sweep"));
          element.addEventListener("change", () => this.scheduleLiveRun("sweep"));
        });

      [this.refs.compare.metric, this.refs.compare.live, ...this.refs.compare.checks].forEach((element) => {
        element.addEventListener("input", () => this.scheduleLiveRun("compare"));
        element.addEventListener("change", () => this.scheduleLiveRun("compare"));
      });

      this.refs.sweep.run.addEventListener("click", () => this.runSweep());
      this.refs.compare.run.addEventListener("click", () => this.runComparison());
    }

    bind(handlers = {}) {
      this.handlers = {
        ...this.handlers,
        ...handlers,
      };
    }

    open(tabId = "sweep") {
      this.overlay.classList.remove("is-hidden");
      this.activateTab(tabId);
      this.queueChartResize();
      if (tabId === "sweep") {
        this.scheduleLiveRun("sweep", 30);
      } else {
        this.scheduleLiveRun("compare", 30);
      }
    }

    close() {
      this.overlay.classList.add("is-hidden");
    }

    isOpen() {
      return !this.overlay.classList.contains("is-hidden");
    }

    activateTab(tabId) {
      this.tabButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.tab === tabId);
      });
      this.tabPanels.forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.panel === tabId);
      });
      this.titleEl.textContent = tabId === "sweep" ? "Parametre Supurme" : "Coklu Algoritma Karsilastirmasi";
      this.queueChartResize();
    }

    applySweepParameterDefaults(parameterId) {
      const config = SWEEP_PARAMETERS.find((item) => item.id === parameterId) ?? SWEEP_PARAMETERS[0];
      this.refs.sweep.min.value = config.min;
      this.refs.sweep.max.value = config.max;
      this.refs.sweep.steps.value = config.steps;
    }

    scheduleLiveRun(tabId, delay = 220) {
      if (tabId === "sweep" && !this.refs.sweep.live.checked) {
        return;
      }
      if (tabId === "compare" && !this.refs.compare.live.checked) {
        return;
      }

      window.clearTimeout(this.pendingTimers.get(tabId));
      const timer = window.setTimeout(() => {
        if (tabId === "sweep") {
          this.runSweep();
        } else {
          this.runComparison();
        }
      }, delay);
      this.pendingTimers.set(tabId, timer);
    }

    getSweepConfig() {
      return {
        parameterId: this.refs.sweep.parameter.value,
        metricId: this.refs.sweep.metric.value,
        start: Number(this.refs.sweep.min.value),
        end: Number(this.refs.sweep.max.value),
        steps: Number(this.refs.sweep.steps.value),
      };
    }

    getComparisonConfig() {
      return {
        metricId: this.refs.compare.metric.value,
        algorithmIds: this.refs.compare.checks
          .filter((input) => input.checked)
          .map((input) => input.value),
      };
    }

    setBusy(section, message) {
      if (section === "sweep") {
        this.refs.sweep.status.textContent = message;
      } else {
        this.refs.compare.status.textContent = message;
      }
    }

    runSweep() {
      if (!this.handlers.onRunSweep) {
        return;
      }

      this.setBusy("sweep", "Supurme calisiyor...");
      try {
        const result = this.handlers.onRunSweep(this.getSweepConfig());
        if (result) {
          this.renderSweepResult(result);
        }
      } catch (error) {
        this.refs.sweep.status.textContent = `Supurme calistirilamadi: ${error.message}`;
      }
    }

    runComparison() {
      if (!this.handlers.onRunComparison) {
        return;
      }

      this.setBusy("compare", "Karsilastirma calisiyor...");
      try {
        const result = this.handlers.onRunComparison(this.getComparisonConfig());
        if (result) {
          this.renderComparisonResult(result);
        }
      } catch (error) {
        this.refs.compare.status.textContent = `Karsilastirma calistirilamadi: ${error.message}`;
      }
    }

    destroyChart(key) {
      this.chartRefs[key]?.destroy?.();
      this.chartRefs[key] = null;
    }

    queueChartResize() {
      window.cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = window.requestAnimationFrame(() => {
        this.resizeFrame = window.requestAnimationFrame(() => {
          this.chartRefs.sweep?.resize?.();
          this.chartRefs.comparisonMetric?.resize?.();
          this.chartRefs.comparisonTrajectory?.resize?.();
        });
      });
    }

    renderSweepResult(result) {
      this.lastSweepResult = result;
      const metricInfo = SWEEP_METRICS.find((item) => item.id === result.metricId) ?? SWEEP_METRICS[0];
      const hits = result.runs.filter((item) => item.outcomeCode === "hit").length;

      this.refs.sweep.status.textContent = `${result.parameterLabel} parametresi icin ${result.runs.length} kosu tamamlandi.`;
      this.refs.sweep.summary.innerHTML = [
        buildSummaryCard("Kosu sayisi", String(result.runs.length)),
        buildSummaryCard("Basarili onleme", `${hits}`),
        buildSummaryCard("En iyi parametre", formatNumber(result.best?.parameterValue, 3)),
        buildSummaryCard(`En iyi ${metricInfo.label}`, `${formatNumber(result.best?.metricValue, 3)} ${metricInfo.unit}`),
      ].join("");

      this.refs.sweep.table.innerHTML = result.runs.map((run) => `
        <tr>
          <td>${formatNumber(run.parameterValue, 3)}</td>
          <td>${run.outcomeLabel}</td>
          <td>${formatNumber(run.metricValue, 3)}</td>
          <td>${formatNumber(run.minMissDistance, 2)} m</td>
          <td>${run.interceptTime == null ? "-" : `${formatNumber(run.interceptTime, 2)} s`}</td>
        </tr>
      `).join("");

      if (this.chartLibrary) {
        this.destroyChart("sweep");
        this.chartRefs.sweep = new this.chartLibrary(this.refs.sweep.chartCanvas.getContext("2d"), {
          type: "line",
          data: {
            datasets: [{
              label: `${result.parameterLabel} -> ${metricInfo.label}`,
              data: result.runs.map((run) => ({ x: run.parameterValue, y: run.metricValue })),
              borderColor: getCssVar("--plot-series-2", "#39ff72"),
              backgroundColor: getCssVar("--plot-series-2", "#39ff72"),
              borderWidth: 2,
              pointRadius: 2.5,
              tension: 0.16,
            }],
          },
          options: buildChartOptions({
            xAxisType: "linear",
            xTitle: result.parameterLabel,
            yTitle: `${metricInfo.label} [${metricInfo.unit}]`,
          }),
        });
        this.queueChartResize();
      }
    }

    renderComparisonResult(result) {
      this.lastComparisonResult = result;
      const metricSpec = PLOT_SPECS.find((item) => item.id === result.metricId) ?? PLOT_SPECS[0];
      this.refs.compare.status.textContent = `${result.runs.length} algoritma ayni senaryoda karsilastirildi.`;
      this.refs.compare.summary.innerHTML = result.runs.map((run) => (
        buildSummaryCard(run.label, `${run.outcomeLabel} / ${formatNumber(run.result.stats.minMissDistance, 2)} m`)
      )).join("");

      this.refs.compare.table.innerHTML = result.runs.map((run) => `
        <tr>
          <td>${run.label}</td>
          <td>${run.outputMode}</td>
          <td>${run.outcomeLabel}</td>
          <td>${formatNumber(run.result.stats.minMissDistance, 2)} m</td>
          <td>${run.result.stats.interceptTime == null ? "-" : `${formatNumber(run.result.stats.interceptTime, 2)} s`}</td>
          <td>${formatNumber(run.result.stats.peakAz, 2)} m/s^2</td>
        </tr>
      `).join("");

      if (!this.chartLibrary) {
        return;
      }

      this.destroyChart("comparisonTrajectory");
      this.destroyChart("comparisonMetric");

      this.chartRefs.comparisonTrajectory = new this.chartLibrary(this.refs.compare.trajectoryCanvas.getContext("2d"), {
        type: "line",
        data: {
          datasets: result.runs.map((run, index) => ({
            label: run.label,
            data: run.result.samples.map((sample) => ({ x: sample.x_m, y: sample.z_m })),
            borderColor: getCssVar(`--plot-series-${(index % 6) + 1}`, "#7eff9d"),
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.08,
          })),
        },
        options: buildChartOptions({
          xAxisType: "linear",
          xTitle: "x [m]",
          yTitle: "z [m]",
        }),
      });

      this.chartRefs.comparisonMetric = new this.chartLibrary(this.refs.compare.metricCanvas.getContext("2d"), {
        type: "line",
        data: {
          datasets: result.runs.map((run, index) => ({
            label: run.label,
            data: run.result.samples.map((sample) => ({ x: sample.t, y: result.metricAccessor(sample) })),
            borderColor: getCssVar(`--plot-series-${(index % 6) + 1}`, "#7eff9d"),
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.14,
          })),
        },
        options: buildChartOptions({
          xAxisType: "linear",
          xTitle: "t [s]",
          yTitle: `${metricSpec.title} [${metricSpec.unit}]`,
        }),
      });
      this.queueChartResize();
    }

    applyTheme() {
      if (this.lastSweepResult) {
        this.renderSweepResult(this.lastSweepResult);
      }

      if (this.lastComparisonResult) {
        this.renderComparisonResult(this.lastComparisonResult);
      }
    }
  }

  GuidanceSim.ui = GuidanceSim.ui || {};
  GuidanceSim.ui.SWEEP_PARAMETERS = SWEEP_PARAMETERS;
  GuidanceSim.ui.SWEEP_METRICS = SWEEP_METRICS;
  GuidanceSim.ui.AnalysisPanel = AnalysisPanel;
})();
