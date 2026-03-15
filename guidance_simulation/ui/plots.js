(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});

  const PLOT_SPECS = [
    { id: "az_cmd", title: "az_cmd(t)", subtitle: "Normal ivme komutu", unit: "m/s²", color: "#5cc8ff", accessor: (sample) => sample.az_cmd, checked: true },
    { id: "gamma_m", title: "gamma_m(t)", subtitle: "Fuze ucus yolu acisi", unit: "deg", color: "#ffb347", accessor: (sample) => sample.gamma_m_deg, checked: true },
    { id: "R", title: "R(t)", subtitle: "Menzil", unit: "m", color: "#8ddc97", accessor: (sample) => sample.R, checked: true },
    { id: "lambda", title: "lambda(t)", subtitle: "LOS acisi", unit: "deg", color: "#d7a6ff", accessor: (sample) => sample.lambda_deg, checked: true },
    { id: "lambda_dot", title: "lambda_dot(t)", subtitle: "LOS donus hizi", unit: "deg/s", color: "#ff7a7a", accessor: (sample) => sample.lambda_dot_deg, checked: true },
    { id: "xz_error", title: "xz_error(t)", subtitle: "Yanal hata metrigi", unit: "m", color: "#6ce6c7", accessor: (sample) => sample.xz_error, checked: true },
    { id: "energy", title: "energy(t)", subtitle: "Ozgul enerji", unit: "J/kg", color: "#91b9ff", accessor: (sample) => sample.energy, checked: false },
  ];

  function createCanvasCard(spec) {
    const card = document.createElement("article");
    card.className = "plot-card";
    card.dataset.plot = spec.id;

    const title = document.createElement("h3");
    title.textContent = spec.title;
    card.append(title);

    const subtitle = document.createElement("p");
    subtitle.textContent = `${spec.subtitle} [${spec.unit}]`;
    card.append(subtitle);

    const canvas = document.createElement("canvas");
    card.append(canvas);

    return { card, canvas };
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

  class PlotManager {
    constructor(togglesRoot, gridRoot) {
      this.togglesRoot = togglesRoot;
      this.gridRoot = gridRoot;
      this.chartLibrary = window.Chart;
      this.charts = new Map();
      this.cards = new Map();
      this.toggles = new Map();
      this.maxPlotPoints = 800;
      this.init();
    }

    init() {
      if (!this.chartLibrary) {
        const warning = document.createElement("p");
        warning.textContent = "Chart.js yuklenemedi; zaman grafikleri olusturulamadi.";
        this.gridRoot.append(warning);
        return;
      }

      PLOT_SPECS.forEach((spec) => {
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
          data: {
            labels: [],
            datasets: [{ label: `${spec.title} [${spec.unit}]`, data: [], borderColor: spec.color, borderWidth: 2, pointRadius: 0, tension: 0.16 }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: {
                labels: {
                  color: "#c7d7f1",
                  boxWidth: 12,
                },
              },
            },
            scales: {
              x: {
                title: { display: true, text: "t [s]", color: "#c7d7f1" },
                ticks: { color: "#92a6c5", maxTicksLimit: 6 },
                grid: { color: "rgba(146, 166, 197, 0.08)" },
              },
              y: {
                ticks: { color: "#92a6c5", maxTicksLimit: 6 },
                grid: { color: "rgba(146, 166, 197, 0.08)" },
              },
            },
          },
        });

        this.charts.set(spec.id, chart);
      });
    }

    update(result, params) {
      if (!this.chartLibrary) {
        return;
      }

      const plotSamples = downsampleSamples(result.samples, this.maxPlotPoints);
      const times = plotSamples.map((sample) => sample.t.toFixed(2));

      PLOT_SPECS.forEach((spec) => {
        const chart = this.charts.get(spec.id);
        if (!chart) {
          return;
        }

        chart.data.labels = times;
        chart.data.datasets[0].data = plotSamples.map(spec.accessor);
        chart.data.datasets[0].label = `${spec.title} [${spec.unit}]`;
        chart.update();

        if (spec.id === "energy") {
          this.applyCardVisibility(spec.id, this.toggles.get(spec.id)?.checked ?? false, params.speedModel === "energy");
        }
      });
    }

    applyCardVisibility(plotId, isChecked, extraCondition = true) {
      this.cards.get(plotId)?.classList.toggle("hidden", !(isChecked && extraCondition));
    }
  }

  GuidanceSim.ui = GuidanceSim.ui || {};
  GuidanceSim.ui.PlotManager = PlotManager;
})();
