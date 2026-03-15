(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});
  const { GUIDANCE_EXAMPLES, DEFAULT_SCENARIO, HELP_FORMULAS, cloneScenario } = GuidanceSim.examples || {};
  const {
    ControlPanel,
    EditorPanel,
    GuidePanel,
    PlotManager,
    ReportGenerator,
    Scene2D,
    LayoutManager,
    SettingsPanel,
  } = GuidanceSim.ui || {};
  const { createExpressionEvaluator, SUPPORTED_FUNCTIONS, SUPPORTED_VARIABLES } = GuidanceSim.guidanceEngine || {};
  const { buildSimulationParams, runSimulation } = GuidanceSim.simulationCore || {};

  function bootstrap() {
    if (
      !GUIDANCE_EXAMPLES
      || !ControlPanel
      || !EditorPanel
      || !GuidePanel
      || !PlotManager
      || !ReportGenerator
      || !Scene2D
      || !LayoutManager
      || !SettingsPanel
      || !buildSimulationParams
      || !runSimulation
    ) {
      throw new Error("Gerekli script dosyalarından biri yüklenemedi.");
    }

    const settingsPanel = new SettingsPanel(document.getElementById("settingsMenu"));
    const initialSettings = settingsPanel.init({
      theme: "radar",
      showLos: true,
      traceEnabled: true,
    });

    const editorPanel = new EditorPanel(
      document.getElementById("editorPanel"),
      GUIDANCE_EXAMPLES,
      HELP_FORMULAS,
      SUPPORTED_VARIABLES,
      SUPPORTED_FUNCTIONS,
    );

    const controlPanel = new ControlPanel(document.getElementById("controlPanel"), {
      badge: document.getElementById("statusBadge"),
      message: document.getElementById("statusMessage"),
    }, [document.getElementById("editorOutputMode")]);

    const plotManager = new PlotManager(
      document.getElementById("plotToggles"),
      document.getElementById("plotsGrid"),
    );

    const guidePanel = new GuidePanel({
      openButton: document.getElementById("guideBtn"),
    });

    const scene = new Scene2D(document.getElementById("scenePanel"));
    const layoutManager = new LayoutManager({
      dashboard: document.getElementById("dashboard"),
      leftZone: document.getElementById("leftZone"),
      controlPanel: document.getElementById("controlPanel"),
      editorPanel: document.querySelector(".editor-shell"),
      rightZone: document.getElementById("rightZone"),
      plotsPanel: document.getElementById("plotsPanel"),
      controlSplitter: document.getElementById("controlSplitter"),
      workspaceSplitter: document.getElementById("workspaceSplitter"),
      plotsSplitter: document.getElementById("plotsSplitter"),
      onLayoutChange: () => {
        scene.handleResize();
        plotManager.resizeAll();
      },
    });

    const appState = {
      activeExampleId: "PNG",
      compiledExpression: null,
      simulationResult: null,
      lastSimulationRawValues: null,
      lastSimulationExpression: "",
      lastSimulationExampleId: "PNG",
      dirty: true,
      isExpressionValid: false,
      viewSettings: {
        showLos: initialSettings.showLos,
        traceEnabled: initialSettings.traceEnabled,
      },
      themeId: initialSettings.theme,
    };

    const reportGenerator = new ReportGenerator({
      button: document.getElementById("reportBtn"),
      plotManager,
      getSimulationResult: () => appState.simulationResult,
      getRawValues: () => ({
        ...(appState.lastSimulationRawValues ?? controlPanel.getValues()),
        ...appState.viewSettings,
        themeId: appState.themeId,
      }),
      getExpression: () => appState.lastSimulationExpression || editorPanel.getExpression(),
      getActiveExample: () => GUIDANCE_EXAMPLES[appState.lastSimulationExampleId] ?? null,
    });

    function updateRunState() {
      controlPanel.setRunEnabled(appState.isExpressionValid);
      scene.setRunEnabled(appState.isExpressionValid);
    }

    function setDirty(message) {
      appState.dirty = true;

      if (!appState.isExpressionValid) {
        controlPanel.setStatus("error", "Formül hatası", message ?? "Formül geçersiz; simülasyon başlatılamaz.");
        return;
      }

      controlPanel.setStatus(
        "ready",
        "Hazır",
        message ?? "Parametre veya formül değişti; yeni simülasyon için Başlat kullanın.",
      );
    }

    function validateExpression(options = {}) {
      const { silent = false } = options;

      try {
        appState.compiledExpression = createExpressionEvaluator(editorPanel.getExpression());
        appState.isExpressionValid = true;
        editorPanel.setFormulaStatus("", { isSuccess: true });
      } catch (error) {
        appState.compiledExpression = null;
        appState.isExpressionValid = false;
        editorPanel.setFormulaStatus(`Formül hatası: ${error.message}`, { isError: true });
        if (!silent) {
          controlPanel.setStatus("error", "Formül hatası", "Formülde hata var; simülasyon başlatılamaz.");
        }
      }

      updateRunState();
      return appState.isExpressionValid;
    }

    function applyExample(exampleId, options = {}) {
      const { includeScenario = true } = options;
      const example = GUIDANCE_EXAMPLES[exampleId];
      if (!example) {
        return;
      }

      appState.activeExampleId = exampleId;
      editorPanel.loadExample(example);

      if (includeScenario) {
        const scenario = cloneScenario(example.scenario);
        scenario.N = example.defaults.N;
        scenario.k1 = example.defaults.k1;
        scenario.k2 = example.defaults.k2;
        controlPanel.setValues(scenario);
      } else {
        controlPanel.refreshDynamicVisibility(controlPanel.getValues());
      }

      editorPanel.setMode(controlPanel.getValues().outputMode);
      validateExpression({ silent: true });
      scene.setViewOptions(appState.viewSettings);
      setDirty(`${example.title} örneği yüklendi. Formülü düzenleyip yeni simülasyon çalıştırabilirsiniz.`);
    }

    function syncEditorMode() {
      editorPanel.setMode(controlPanel.getValues().outputMode);
    }

    function executeSimulation(options = {}) {
      const { autoplay = true, resetOnly = false } = options;

      if (!validateExpression()) {
        return false;
      }

      const rawValues = {
        ...controlPanel.getValues(),
        ...appState.viewSettings,
        themeId: appState.themeId,
      };
      const params = buildSimulationParams(rawValues);
      controlPanel.setStatus("running", "Hesaplanıyor", "State, geometry, guidance ve dynamics zinciri işleniyor.");

      const result = runSimulation(params, appState.compiledExpression);
      appState.simulationResult = result;
      appState.lastSimulationRawValues = { ...rawValues };
      appState.lastSimulationExpression = editorPanel.getExpression();
      appState.lastSimulationExampleId = appState.activeExampleId;
      appState.dirty = false;

      scene.loadSimulation(result, rawValues);
      plotManager.update(result, rawValues);

      controlPanel.setStatus(
        result.outcome.kind,
        result.outcome.label,
        `${result.outcome.message} Simülasyon ${result.stats.sampleCount} örnek ile tamamlandı.`,
      );

      if (resetOnly) {
        scene.reset();
      } else if (autoplay) {
        scene.playFromStart();
      }

      return true;
    }

    function handleStart() {
      executeSimulation({ autoplay: true });
    }

    function handlePause() {
      scene.pause();
    }

    function handleResume() {
      if (!appState.simulationResult) {
        executeSimulation({ autoplay: true });
        return;
      }
      scene.play();
    }

    function handleReset() {
      if (!appState.simulationResult || appState.dirty) {
        executeSimulation({ autoplay: false, resetOnly: true });
        return;
      }
      scene.reset();
    }

    function handleStep() {
      if (!appState.simulationResult || appState.dirty) {
        const started = executeSimulation({ autoplay: false, resetOnly: true });
        if (!started) {
          return;
        }
      }
      scene.step();
    }

    function handleLoadDemo() {
      applyExample(appState.activeExampleId, { includeScenario: true });
      executeSimulation({ autoplay: true });
    }

    controlPanel.bindActions({
      onStart: handleStart,
      onStop: handlePause,
      onReset: handleReset,
      onStep: handleStep,
      onLoadDemo: handleLoadDemo,
    });

    controlPanel.bindInput((values, changedKey) => {
      if (changedKey === "outputMode") {
        syncEditorMode();
      }

      setDirty();
    });

    settingsPanel.bind({
      onThemeChange: (themeId) => {
        appState.themeId = themeId;
        plotManager.applyTheme();
        scene.applyTheme();
      },
      onViewChange: (viewSettings) => {
        appState.viewSettings = { ...appState.viewSettings, ...viewSettings };
        scene.setViewOptions(appState.viewSettings);
      },
    });

    editorPanel.bind({
      onExampleSelected: (exampleId) => {
        applyExample(exampleId, { includeScenario: true });
      },
      onExpressionEdited: () => {
        validateExpression({ silent: true });
        setDirty();
      },
    });

    scene.bindControls({
      onStart: handleStart,
      onPause: handlePause,
      onResume: handleResume,
      onRestart: () => {
        if (!appState.simulationResult || appState.dirty) {
          executeSimulation({ autoplay: true });
          return;
        }
        scene.rewindAndPlay();
      },
    });

    document.getElementById("resetPlotZoomBtn").addEventListener("click", () => {
      plotManager.resetZoomAll();
    });

    layoutManager.init();
    guidePanel.render();
    scene.setViewOptions(appState.viewSettings);
    plotManager.applyTheme();
    scene.applyTheme();
    controlPanel.setValues(cloneScenario(DEFAULT_SCENARIO));
    applyExample("PNG", { includeScenario: true });
    executeSimulation({ autoplay: true });
  }

  function handleBootstrapError(error) {
    const badge = document.getElementById("statusBadge");
    const message = document.getElementById("statusMessage");
    if (badge && message) {
      badge.textContent = "Hata";
      badge.className = "status-pill status-error";
      message.textContent = `Uygulama başlatılamadı: ${error.message}`;
    }
    console.error(error);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      try {
        bootstrap();
      } catch (error) {
        handleBootstrapError(error);
      }
    });
  } else {
    try {
      bootstrap();
    } catch (error) {
      handleBootstrapError(error);
    }
  }
})();
