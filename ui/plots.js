(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});

  const PLOT_SPECS = [
    { id: "az_cmd", title: "az_cmd(t)", subtitle: "Komutlanan yanal ivme", unit: "m/s^2", color: "#7eff9d", accessor: (sample) => sample.az_cmd, checked: true },
    { id: "az_actual", title: "az_actual(t)", subtitle: "Uygulanan yanal ivme", unit: "m/s^2", color: "#39ff72", accessor: (sample) => sample.az_actual, checked: true },
    { id: "gamma_cmd", title: "gamma_cmd(t)", subtitle: "Komutlanan uçuş yolu açısı", unit: "°", color: "#baff5b", accessor: (sample) => sample.gamma_cmd_deg, checked: true },
    { id: "gamma_error", title: "gamma_error(t)", subtitle: "Gamma izleme hatası", unit: "°", color: "#9cf3b0", accessor: (sample) => sample.gamma_error_deg, checked: false },
    { id: "gamma_m", title: "gamma_m(t)", subtitle: "Füze uçuş yolu açısı", unit: "°", color: "#62ffcf", accessor: (sample) => sample.gamma_m_deg, checked: true },
    { id: "V_m", title: "V_m(t)", subtitle: "Füze hız büyüklüğü", unit: "m/s", color: "#9effc6", accessor: (sample) => sample.V_m, checked: true },
    { id: "Vdot", title: "Vdot(t)", subtitle: "Hız türevi", unit: "m/s^2", color: "#d7ff77", accessor: (sample) => sample.Vdot, checked: false },
    { id: "R", title: "R(t)", subtitle: "Menzil", unit: "m", color: "#5fff78", accessor: (sample) => sample.R, checked: true },
    { id: "lambda", title: "lambda(t)", subtitle: "LOS açısı", unit: "°", color: "#abff8c", accessor: (sample) => sample.lambda_deg, checked: false },
    { id: "lambda_dot", title: "lambda_dot(t)", subtitle: "LOS dönüş hızı", unit: "°/s", color: "#2cffb7", accessor: (sample) => sample.lambda_dot_deg, checked: true },
    { id: "closing_velocity", title: "closing_velocity(t)", subtitle: "Kapanma hızı", unit: "m/s", color: "#78ffd6", accessor: (sample) => sample.closing_velocity, checked: false },
    { id: "sigma", title: "sigma(t)", subtitle: "LOS - gamma farkı", unit: "°", color: "#d3ff99", accessor: (sample) => sample.sigma_deg, checked: false },
    { id: "xz_error", title: "xz_error(t)", subtitle: "Yanal hata", unit: "m", color: "#5cff9a", accessor: (sample) => sample.xz_error, checked: false },
    { id: "energy", title: "energy(t)", subtitle: "Özgül enerji", unit: "J/kg", color: "#8fffe9", accessor: (sample) => sample.energy, checked: false },
  ];

  function getCssVar(name, fallback) {
    const value = window.getComputedStyle(document.body || document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function createCanvasCard(spec) {
    const card = document.createElement("article");
    card.className = "plot-card";
    card.dataset.plot = spec.id;
    card.append(
      Object.assign(document.createElement("h3"), { textContent: spec.title }),
      Object.assign(document.createElement("p"), { textContent: `${spec.subtitle} [${spec.unit}]` }),
      document.createElement("canvas"),
    );

    return {
      card,
      canvas: card.querySelector("canvas"),
    };
  }

  function downsampleSamples(samples, maxPoints) {
    if (samples.length <= maxPoints) {
      return samples;
    }

    const reduced = [];
    const lastIndex = samples.length - 1;

    for (let pointIndex = 0; pointIndex < maxPoints; pointIndex += 1) {
      const sampleIndex = Math.round((pointIndex / (maxPoints - 1)) * lastIndex);
      reduced.push(samples[sampleIndex]);
    }

    return reduced;
  }

  function buildDataset(spec, data = [], specIndex = 0) {
    return {
      label: `${spec.title} [${spec.unit}]`,
      data,
      borderColor: getCssVar(`--plot-series-${specIndex + 1}`, spec.color),
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.16,
    };
  }

  function buildChartData(spec, samples, specIndex = 0) {
    return {
      labels: samples.map((sample) => sample.t.toFixed(2)),
      datasets: [buildDataset(spec, samples.map(spec.accessor), specIndex)],
    };
  }

  function getThemePalette(theme = "app") {
    if (theme === "report") {
      return {
        legend: "#22322b",
        tick: "#5c6b65",
        grid: "rgba(22, 32, 27, 0.12)",
        title: "#22322b",
        dragBorder: "rgba(12, 106, 76, 0.72)",
        dragFill: "rgba(12, 106, 76, 0.12)",
      };
    }

    return {
      legend: getCssVar("--plot-legend", "#dcffe6"),
      tick: getCssVar("--plot-tick", "#7daf8c"),
      grid: getCssVar("--plot-grid", "rgba(98, 255, 144, 0.08)"),
      title: getCssVar("--plot-title", "#dcffe6"),
      dragBorder: getCssVar("--plot-drag-border", "rgba(99, 255, 141, 0.72)"),
      dragFill: getCssVar("--plot-drag-fill", "rgba(99, 255, 141, 0.14)"),
    };
  }

  function buildChartOptions(options = {}) {
    const { interactive = true, theme = "app" } = options;
    const palette = getThemePalette(theme);

    return {
      responsive: interactive,
      maintainAspectRatio: false,
      animation: false,
      interaction: interactive ? { mode: "index", intersect: false } : undefined,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: palette.legend,
            boxWidth: 10,
            font: { family: "Consolas", size: interactive ? 10 : 11 },
          },
        },
        ...(interactive
          ? {
            zoom: {
              pan: {
                enabled: true,
                mode: "xy",
                modifierKey: "shift",
              },
              zoom: {
                wheel: { enabled: true },
                drag: {
                  enabled: true,
                  modifierKey: "ctrl",
                  borderColor: palette.dragBorder,
                  backgroundColor: palette.dragFill,
                },
                pinch: { enabled: true },
                mode: "xy",
              },
              limits: {
                x: { min: "original", max: "original" },
                y: { min: "original", max: "original" },
              },
            },
          }
          : {}),
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "t [s]",
            color: palette.title,
            font: { family: "Consolas", size: interactive ? 10 : 11 },
          },
          ticks: {
            color: palette.tick,
            maxTicksLimit: interactive ? 6 : 8,
            font: { family: "Consolas", size: interactive ? 10 : 11 },
          },
          grid: { color: palette.grid },
        },
        y: {
          ticks: {
            color: palette.tick,
            maxTicksLimit: interactive ? 6 : 8,
            font: { family: "Consolas", size: interactive ? 10 : 11 },
          },
          grid: { color: palette.grid },
        },
      },
    };
  }

  function getReportSpecs(rawValues = {}) {
    return PLOT_SPECS.filter((spec) => spec.id !== "energy" || rawValues.speedModel === "energy");
  }

  class PlotManager {
    constructor(togglesRoot, gridRoot) {
      this.togglesRoot = togglesRoot;
      this.gridRoot = gridRoot;
      this.chartLibrary = window.Chart;
      this.charts = new Map();
      this.cards = new Map();
      this.toggles = new Map();
      this.maxPlotPoints = 800;
      this.maxReportPoints = 1000;
      this.lastResult = null;
      this.lastRawValues = null;
      this.init();
    }

    init() {
      if (!this.chartLibrary) {
        const warning = document.createElement("p");
        warning.textContent = "Chart.js yüklenemedi; zaman grafikleri oluşturulamadı.";
        this.gridRoot.append(warning);
        return;
      }

      this.chartLibrary.defaults.font.family = "Consolas, Lucida Console, monospace";
      this.chartLibrary.defaults.font.size = 10;
      this.chartLibrary.defaults.color = getThemePalette().legend;

      PLOT_SPECS.forEach((spec, specIndex) => {
        const toggle = document.createElement("label");
        toggle.className = "plot-toggle";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = spec.checked;
        checkbox.addEventListener("change", () => {
          this.applyCardVisibility(spec.id, checkbox.checked);
        });

        const label = document.createElement("span");
        label.textContent = spec.title;
        toggle.append(checkbox, label);
        this.togglesRoot.append(toggle);

        const { card, canvas } = createCanvasCard(spec);
        if (!spec.checked) {
          card.classList.add("hidden");
        }

        this.gridRoot.append(card);
        this.cards.set(spec.id, card);
        this.toggles.set(spec.id, checkbox);

        const chart = new this.chartLibrary(canvas.getContext("2d"), {
          type: "line",
          data: buildChartData(spec, [], specIndex),
          options: buildChartOptions({ interactive: true }),
        });

        this.charts.set(spec.id, chart);
      });
    }

    update(result, rawValues) {
      if (!this.chartLibrary) {
        return;
      }

      this.lastResult = result;
      this.lastRawValues = rawValues;
      const plotSamples = downsampleSamples(result.samples, this.maxPlotPoints);

      PLOT_SPECS.forEach((spec, specIndex) => {
        const chart = this.charts.get(spec.id);
        if (!chart) {
          return;
        }

        chart.resetZoom?.();
        chart.options = buildChartOptions({ interactive: true });
        chart.data = buildChartData(spec, plotSamples, specIndex);
        chart.update();

        if (spec.id === "energy") {
          this.applyCardVisibility(spec.id, this.toggles.get(spec.id)?.checked ?? false, rawValues.speedModel === "energy");
        }
      });
    }

    createReportFigures(result, rawValues = {}) {
      if (!this.chartLibrary) {
        return [];
      }

      const reportSamples = downsampleSamples(result.samples, this.maxReportPoints);

      return getReportSpecs(rawValues).map((spec) => ({
        id: spec.id,
        title: spec.title,
        subtitle: spec.subtitle,
        unit: spec.unit,
        filename: `chart-${spec.id.replaceAll("_", "-")}.png`,
        dataUrl: this.renderReportChart(spec, reportSamples),
      }));
    }

    renderReportChart(spec, samples) {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 420;
      const reportBackgroundPlugin = {
        id: "report-background",
        beforeDraw(chart) {
          const { ctx, width, height } = chart;
          ctx.save();
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        },
      };

      const chart = new this.chartLibrary(canvas.getContext("2d"), {
        type: "line",
        data: buildChartData(spec, samples, PLOT_SPECS.findIndex((item) => item.id === spec.id)),
        options: buildChartOptions({ interactive: false, theme: "report" }),
        plugins: [reportBackgroundPlugin],
      });

      chart.update("none");
      const dataUrl = canvas.toDataURL("image/png");
      chart.destroy();
      return dataUrl;
    }

    applyCardVisibility(plotId, isChecked, extraCondition = true) {
      this.cards.get(plotId)?.classList.toggle("hidden", !(isChecked && extraCondition));
    }

    resetZoomAll() {
      this.charts.forEach((chart) => chart.resetZoom?.());
    }

    resizeAll() {
      this.charts.forEach((chart) => chart.resize());
    }

    applyTheme() {
      if (!this.chartLibrary) {
        return;
      }

      this.chartLibrary.defaults.color = getThemePalette().legend;

      if (this.lastResult) {
        this.update(this.lastResult, this.lastRawValues ?? {});
        return;
      }

      PLOT_SPECS.forEach((spec, specIndex) => {
        const chart = this.charts.get(spec.id);
        if (!chart) {
          return;
        }

        chart.options = buildChartOptions({ interactive: true });
        if (chart.data?.datasets?.[0]) {
          chart.data.datasets[0].borderColor = getCssVar(`--plot-series-${specIndex + 1}`, spec.color);
        }
        chart.update();
      });
    }
  }

  GuidanceSim.ui = GuidanceSim.ui || {};
  GuidanceSim.ui.PLOT_SPECS = PLOT_SPECS;
  GuidanceSim.ui.PlotManager = PlotManager;
})();
