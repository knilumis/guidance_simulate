(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});
  const { GUIDANCE_EXAMPLES, DEFAULT_SCENARIO, HELP_FORMULAS, cloneScenario } = GuidanceSim.examples || {};
  const {
    AnalysisPanel,
    ControlPanel,
    EditorPanel,
    GuidePanel,
    LayoutManager,
    PlotManager,
    PLOT_SPECS,
    ReportGenerator,
    Scene2D,
    SettingsPanel,
    SWEEP_METRICS,
  } = GuidanceSim.ui || {};
  const { createExpressionEvaluator, SUPPORTED_FUNCTIONS, SUPPORTED_VARIABLES } = GuidanceSim.guidanceEngine || {};
  const { buildSimulationParams, continueSimulationFromSample, runSimulation } = GuidanceSim.simulationCore || {};

  function clampSweepSteps(value) {
    return Math.max(2, Math.min(61, Math.round(value || 2)));
  }

  function sampleRange(start, end, steps) {
    const safeSteps = clampSweepSteps(steps);
    if (safeSteps <= 1 || Math.abs(end - start) < 1e-9) {
      return [start];
    }

    const delta = (end - start) / (safeSteps - 1);
    return Array.from({ length: safeSteps }, (_, index) => start + delta * index);
  }

  function getSweepMetric(result, metricId) {
    switch (metricId) {
      case "minMissDistance":
        return result.stats.minMissDistance;
      case "interceptTime":
        return result.outcome.code === "hit" ? result.stats.interceptTime : NaN;
      case "terminalSpeed":
        return result.stats.terminalSpeed;
      case "peakAz":
        return result.stats.peakAz;
      case "peakLambdaDot":
        return result.stats.peakLambdaDotDeg;
      case "finalTime":
        return result.stats.finalTime;
      default:
        return NaN;
    }
  }

  function selectBestSweepRun(runs, metricId) {
    const metricInfo = SWEEP_METRICS?.find((item) => item.id === metricId);
    const validRuns = runs.filter((run) => Number.isFinite(run.metricValue));

    if (!validRuns.length) {
      return null;
    }

    return validRuns.reduce((best, current) => {
      if (!best) {
        return current;
      }

      const currentValue = metricInfo?.direction === "min_abs" ? Math.abs(current.metricValue) : current.metricValue;
      const bestValue = metricInfo?.direction === "min_abs" ? Math.abs(best.metricValue) : best.metricValue;

      if (metricInfo?.direction === "max") {
        return currentValue > bestValue ? current : best;
      }

      return currentValue < bestValue ? current : best;
    }, null);
  }

  const LIVE_UPDATE_PARAMS = new Set([
    "outputMode",
    "dt",
    "tMax",
    "interceptRadius",
    "maxAccel",
    "speedModel",
    "N",
    "k1",
    "k2",
    "gammaTau",
    "gammaCmdLimitDeg",
    "gammaCmdRateLimitDeg",
    "targetMotionModel",
    "targetSinAmplitude",
    "targetSinFrequency",
    "targetTurnRateDeg",
    "targetEvasionRange",
    "targetWaypointX",
    "targetWaypointZ",
    "targetCommandExpression",
    "thrust",
    "missileMass",
    "referenceArea",
    "dragCoeff",
  ]);

  function bootstrap() {
    if (
      !GUIDANCE_EXAMPLES
      || !AnalysisPanel
      || !ControlPanel
      || !EditorPanel
      || !GuidePanel
      || !LayoutManager
      || !PlotManager
      || !Array.isArray(PLOT_SPECS)
      || !ReportGenerator
      || !Scene2D
      || !SettingsPanel
      || !Array.isArray(SWEEP_METRICS)
      || !buildSimulationParams
      || !continueSimulationFromSample
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

    const analysisPanel = new AnalysisPanel({
      sweepButton: document.getElementById("sweepBtn"),
      compareButton: document.getElementById("compareBtn"),
    });

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
      isTargetCommandValid: true,
      viewSettings: {
        showLos: initialSettings.showLos,
        traceEnabled: initialSettings.traceEnabled,
      },
      themeId: initialSettings.theme,
    };
    let liveParamUpdateTimer = null;

    function getRawValues() {
      return {
        ...controlPanel.getValues(),
        ...appState.viewSettings,
        themeId: appState.themeId,
      };
    }

    const reportGenerator = new ReportGenerator({
      button: document.getElementById("reportBtn"),
      plotManager,
      getSimulationResult: () => appState.simulationResult,
      getRawValues: () => ({
        ...(appState.lastSimulationRawValues ?? getRawValues()),
        ...appState.viewSettings,
        themeId: appState.themeId,
      }),
      getExpression: () => appState.lastSimulationExpression || editorPanel.getExpression(),
      getActiveExample: () => GUIDANCE_EXAMPLES[appState.lastSimulationExampleId] ?? null,
    });

    function updateRunState() {
      const isEnabled = appState.isExpressionValid && appState.isTargetCommandValid;
      controlPanel.setRunEnabled(isEnabled);
      scene.setRunEnabled(isEnabled);
    }

    function validateTargetCommand(rawValues, options = {}) {
      const { silent = false } = options;
      const usesCommandedTarget = rawValues.targetMotionModel === "commanded";
      const expression = String(rawValues.targetCommandExpression ?? "").trim() || "gamma_t";

      try {
        if (usesCommandedTarget) {
          createExpressionEvaluator(expression);
        }
        appState.isTargetCommandValid = true;
      } catch (error) {
        appState.isTargetCommandValid = false;
        if (!silent) {
          controlPanel.setStatus("error", "Hedef komutu hatası", `Hedef komut ifadesi geçersiz: ${error.message}`);
        }
      }

      return appState.isTargetCommandValid;
    }

    function setDirty(message) {
      appState.dirty = true;

      if (!appState.isExpressionValid) {
        controlPanel.setStatus("error", "Formül hatası", message ?? "Formül geçersiz; simülasyon başlatılamaz.");
        return;
      }

      if (!appState.isTargetCommandValid) {
        controlPanel.setStatus("error", "Hedef komutu hatası", message ?? "Hedef komut ifadesi geçersiz; simülasyon başlatılamaz.");
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

    function ensureSimulationInputs(options = {}) {
      const { silent = false } = options;
      const rawValues = getRawValues();
      const isExpressionValid = validateExpression({ silent });
      const isTargetCommandValid = validateTargetCommand(rawValues, { silent });

      updateRunState();
      return {
        ok: isExpressionValid && isTargetCommandValid,
        rawValues,
      };
    }

    function compileSimulation(rawValues, expression) {
      const evaluator = createExpressionEvaluator(expression);
      const params = buildSimulationParams(rawValues);
      return { evaluator, params };
    }

    function runSimulationWithEvaluator(rawValues, evaluator) {
      const params = buildSimulationParams(rawValues);
      return {
        params,
        result: runSimulation(params, evaluator),
      };
    }

    function runSimulationWithInputs(rawValues, expression) {
      const { evaluator, params } = compileSimulation(rawValues, expression);
      return {
        evaluator,
        params,
        result: runSimulation(params, evaluator),
      };
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
      ensureSimulationInputs({ silent: true });
      scene.setViewOptions(appState.viewSettings);
      setDirty(`${example.title} örneği yüklendi. Formülü düzenleyip yeni simülasyon çalıştırabilirsiniz.`);
    }

    function syncEditorMode() {
      editorPanel.setMode(controlPanel.getValues().outputMode);
    }

    function refreshSceneAndPlotsLayout() {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          layoutManager.ensureBounds();
          scene.scheduleResize?.();
          plotManager.resizeAll();
        });
      });
    }

    function scheduleLiveParameterUpdate(changedKey) {
      if (!LIVE_UPDATE_PARAMS.has(changedKey) || !appState.simulationResult) {
        return;
      }

      window.clearTimeout(liveParamUpdateTimer);
      liveParamUpdateTimer = window.setTimeout(() => {
        continueSimulationFromCurrentState({ keepPlaying: scene.isPlaying() });
      }, 140);
    }

    function executeSimulation(options = {}) {
      const { autoplay = true, resetOnly = false } = options;
      const validation = ensureSimulationInputs();

      if (!validation.ok) {
        return false;
      }

      let params;
      try {
        params = buildSimulationParams(validation.rawValues);
      } catch (error) {
        controlPanel.setStatus("error", "Parametre hatası", error.message);
        return false;
      }

      controlPanel.setStatus("running", "Hesaplanıyor", "State, geometry, guidance ve dynamics zinciri işleniyor.");

      const result = runSimulation(params, appState.compiledExpression);
      appState.simulationResult = result;
      appState.lastSimulationRawValues = { ...validation.rawValues };
      appState.lastSimulationExpression = editorPanel.getExpression();
      appState.lastSimulationExampleId = appState.activeExampleId;
      appState.dirty = false;

      scene.loadSimulation(result, validation.rawValues);
      plotManager.update(result, validation.rawValues);
      refreshSceneAndPlotsLayout();

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

    function continueSimulationFromCurrentState(options = {}) {
      const { keepPlaying = false } = options;
      const validation = ensureSimulationInputs();

      if (!appState.simulationResult || !validation.ok) {
        return false;
      }

      const playbackState = scene.getPlaybackState();
      let params;
      try {
        params = buildSimulationParams(validation.rawValues);
      } catch (error) {
        controlPanel.setStatus("error", "Parametre hatası", error.message);
        return false;
      }

      const result = continueSimulationFromSample(
        params,
        appState.compiledExpression,
        appState.simulationResult,
        playbackState.playhead,
      );

      appState.simulationResult = result;
      appState.lastSimulationRawValues = { ...validation.rawValues };
      appState.lastSimulationExpression = editorPanel.getExpression();
      appState.lastSimulationExampleId = appState.activeExampleId;
      appState.dirty = false;

      scene.replaceSimulation(result, validation.rawValues, {
        ...playbackState,
        playing: keepPlaying,
      });
      plotManager.update(result, validation.rawValues);
      refreshSceneAndPlotsLayout();

      controlPanel.setStatus(
        result.outcome.kind,
        result.outcome.label,
        `Formül güncellendi. ${result.outcome.message} Simülasyon ${result.stats.sampleCount} örnek ile tamamlandı.`,
      );

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

      if (appState.dirty) {
        continueSimulationFromCurrentState({ keepPlaying: true });
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
        if (appState.simulationResult && appState.dirty) {
          const continued = continueSimulationFromCurrentState({ keepPlaying: false });
          if (!continued) {
            return;
          }
        } else {
          const started = executeSimulation({ autoplay: false, resetOnly: true });
          if (!started) {
            return;
          }
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

      validateTargetCommand({ ...values, ...appState.viewSettings, themeId: appState.themeId }, { silent: true });
      updateRunState();
      setDirty();
      scheduleLiveParameterUpdate(changedKey);

      if (analysisPanel.isOpen?.()) {
        analysisPanel.scheduleLiveRun("sweep");
        analysisPanel.scheduleLiveRun("compare");
      }
    });

    settingsPanel.bind({
      onThemeChange: (themeId) => {
        appState.themeId = themeId;
        plotManager.applyTheme();
        scene.applyTheme();
        analysisPanel.applyTheme?.();
        refreshSceneAndPlotsLayout();
      },
      onViewChange: (viewSettings) => {
        appState.viewSettings = { ...appState.viewSettings, ...viewSettings };
        scene.setViewOptions(appState.viewSettings);
        refreshSceneAndPlotsLayout();
      },
    });

    editorPanel.bind({
      onExampleSelected: (exampleId) => {
        applyExample(exampleId, { includeScenario: true });
      },
      onExpressionEdited: () => {
        ensureSimulationInputs({ silent: true });
        if (
          appState.isExpressionValid
          && appState.isTargetCommandValid
          && appState.simulationResult
          && scene.isPlaying()
        ) {
          const continued = continueSimulationFromCurrentState({ keepPlaying: true });
          if (continued) {
            if (analysisPanel.isOpen?.()) {
              analysisPanel.scheduleLiveRun("compare");
              analysisPanel.scheduleLiveRun("sweep");
            }
            return;
          }
        }

        if (analysisPanel.isOpen?.()) {
          analysisPanel.scheduleLiveRun("compare");
          analysisPanel.scheduleLiveRun("sweep");
        }
        setDirty();
      },
    });

    guidePanel.bind({
      onPrepareTutorial: () => {
        scene.pause();
        const tutorialScenario = cloneScenario(DEFAULT_SCENARIO);
        tutorialScenario.missileSpeed = 250;
        tutorialScenario.targetMotionModel = "linear";
        tutorialScenario.targetTurnRateDeg = 12;
        tutorialScenario.N = 3;
        tutorialScenario.outputMode = "az_demand";
        controlPanel.setValues(tutorialScenario);
        applyExample("PNG", { includeScenario: false });
        syncEditorMode();
        ensureSimulationInputs({ silent: true });
        setDirty("Öğren modu için başlangıç senaryosu yüklendi.");
        refreshSceneAndPlotsLayout();
      },
    });

    analysisPanel.bind({
      onRunSweep: (config) => {
        const validation = ensureSimulationInputs({ silent: true });
        if (!validation.ok) {
          throw new Error("Mevcut formül veya hedef komutu geçerli değil.");
        }

        const evaluator = createExpressionEvaluator(editorPanel.getExpression());
        const metricInfo = SWEEP_METRICS.find((item) => item.id === config.metricId) ?? SWEEP_METRICS[0];
        const parameterLabel = controlPanel.root
          ?.querySelector(`[data-param='${config.parameterId}']`)
          ?.closest("[data-field]")
          ?.querySelector("span")
          ?.textContent
          ?? config.parameterId;

        const runs = sampleRange(config.start, config.end, config.steps).map((value) => {
          const rawValues = { ...validation.rawValues, [config.parameterId]: value };
          const { result } = runSimulationWithEvaluator(rawValues, evaluator);
          return {
            parameterValue: value,
            metricValue: getSweepMetric(result, config.metricId),
            outcomeCode: result.outcome.code,
            outcomeLabel: result.outcome.label,
            minMissDistance: result.stats.minMissDistance,
            interceptTime: result.stats.interceptTime,
            result,
          };
        });

        return {
          parameterId: config.parameterId,
          parameterLabel,
          metricId: config.metricId,
          metricLabel: metricInfo.label,
          metricUnit: metricInfo.unit,
          runs,
          best: selectBestSweepRun(runs, config.metricId),
        };
      },
      onRunComparison: (config) => {
        const validation = ensureSimulationInputs({ silent: true });
        if (!validation.ok) {
          throw new Error("Mevcut formül veya hedef komutu geçerli değil.");
        }

        if (!config.algorithmIds.length) {
          throw new Error("En az bir algoritma seçin.");
        }

        const selectedMetric = PLOT_SPECS.find((item) => item.id === config.metricId) ?? PLOT_SPECS[0];
        const baseRawValues = validation.rawValues;

        const comparisonEntries = config.algorithmIds.map((algorithmId) => {
          if (algorithmId === "USER") {
            return {
              id: "USER",
              label: "Kullanıcı",
              expression: editorPanel.getExpression(),
              outputMode: baseRawValues.outputMode,
              rawValues: { ...baseRawValues },
            };
          }

          const example = GUIDANCE_EXAMPLES[algorithmId];
          if (!example) {
            return null;
          }

          return {
            id: algorithmId,
            label: example.title,
            expression: example.expression,
            outputMode: example.outputMode,
            rawValues: {
              ...baseRawValues,
              outputMode: example.outputMode,
            },
          };
        }).filter(Boolean);

        return {
          metricId: config.metricId,
          metricAccessor: selectedMetric.accessor,
          runs: comparisonEntries.map((entry) => {
            const evaluator = createExpressionEvaluator(entry.expression);
            const { result } = runSimulationWithEvaluator(entry.rawValues, evaluator);
            return {
              ...entry,
              result,
              outcomeLabel: result.outcome.label,
            };
          }),
        };
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
    analysisPanel.applyTheme?.();
    refreshSceneAndPlotsLayout();
    controlPanel.setValues(cloneScenario(DEFAULT_SCENARIO));
    applyExample("PNG", { includeScenario: true });
    ensureSimulationInputs({ silent: true });
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
