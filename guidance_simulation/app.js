(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});
  const { GUIDANCE_EXAMPLES, DEFAULT_SCENARIO, cloneScenario } = GuidanceSim.examples || {};
  const { ControlPanel, EditorPanel, PlotManager, Scene2D } = GuidanceSim.ui || {};
  const { eulerStep } = GuidanceSim.integrator || {};
  const { buildMissileConfig, createMissileState, computeMissileDerivatives, GRAVITY, normalizeMissileState } = GuidanceSim.missileModel || {};
  const { createTargetState, computeTargetDerivatives } = GuidanceSim.targetModel || {};
  const { buildGuidanceContext, createExpressionEvaluator, SUPPORTED_FUNCTIONS, SUPPORTED_VARIABLES } = GuidanceSim.guidanceEngine || {};
  const { clamp, computeRelativeGeometry, degToRad, radToDeg } = GuidanceSim.geometry || {};

  const STATUS_TEXT = {
    hit: { kind: "success", label: "Onleme basarili" },
    miss: { kind: "warning", label: "Kacirdi" },
    ground: { kind: "error", label: "Yere carpti" },
    timeout: { kind: "warning", label: "Sure doldu" },
    numerical_error: { kind: "error", label: "Sayisal hata" },
  };

  function stateIsFinite(state) {
    return Object.values(state).every((value) => Number.isFinite(value));
  }

  function buildSimulationParams(rawValues) {
    return {
      ...rawValues,
      missileGamma: degToRad(rawValues.missileGammaDeg),
      targetGamma: degToRad(rawValues.targetGammaDeg),
      g: GRAVITY,
    };
  }

  function buildSample({ t, missileState, targetState, geometry, azCmd, gammaCmd, formulaOutput }) {
    return {
      t,
      x_m: missileState.x,
      z_m: missileState.z,
      x_t: targetState.x,
      z_t: targetState.z,
      V_m: missileState.V,
      V_t: targetState.V,
      gamma_m: missileState.gamma,
      gamma_t: targetState.gamma,
      gamma_m_deg: radToDeg(missileState.gamma),
      gamma_t_deg: radToDeg(targetState.gamma),
      az_cmd: azCmd,
      gamma_cmd: gammaCmd,
      formula_output: formulaOutput,
      R: geometry.R,
      Rdot: geometry.Rdot,
      lambda: geometry.lambda,
      lambda_deg: radToDeg(geometry.lambda),
      lambda_dot: geometry.lambda_dot,
      lambda_dot_deg: radToDeg(geometry.lambda_dot),
      sigma: geometry.sigma,
      sigma_deg: radToDeg(geometry.sigma),
      closing_velocity: geometry.closing_velocity,
      xz_error: geometry.xz_error,
      energy: geometry.energy,
      energy_error: geometry.energy_error,
    };
  }

  function runSimulation(params, evaluator) {
    const missileConfig = buildMissileConfig(params);
    let missileState = createMissileState(params);
    let targetState = createTargetState(params);
    let previousGeometry = null;
    let previousCommands = { az_prev: 0, az_cmd_prev: 0, gamma_cmd_prev: missileState.gamma };
    const referenceEnergy = 0.5 * missileState.V * missileState.V + params.g * missileState.z;
    const maxSteps = Math.ceil(params.tMax / params.dt);
    const samples = [];
    let bestRange = Number.POSITIVE_INFINITY;
    let outcome = {
      code: "timeout",
      ...STATUS_TEXT.timeout,
      message: "Maksimum simulasyon suresi doldu.",
    };

    for (let stepIndex = 0; stepIndex <= maxSteps; stepIndex += 1) {
      const t = stepIndex * params.dt;
      const geometry = computeRelativeGeometry(missileState, targetState, {
        dt: params.dt,
        previousGeometry,
        referenceEnergy,
      });

      let formulaOutput = 0;
      try {
        const context = buildGuidanceContext({
          t,
          dt: params.dt,
          missileState,
          targetState,
          geometry,
          previousCommands,
          params,
        });
        formulaOutput = evaluator.evaluate(context);
      } catch (error) {
        outcome = {
          code: "numerical_error",
          ...STATUS_TEXT.numerical_error,
          message: `Formul degerlendirilemedi: ${error.message}`,
        };
        break;
      }

      let gammaCmd = previousCommands.gamma_cmd_prev;
      let azCmd = previousCommands.az_cmd_prev;

      if (params.outputMode === "gamma_demand") {
        gammaCmd = clamp(formulaOutput, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
        const desiredGammaDot = (gammaCmd - missileState.gamma) / Math.max(params.gammaTau, 0.05);
        azCmd = clamp(
          missileState.V * desiredGammaDot + params.g * Math.cos(missileState.gamma),
          -params.maxAccel,
          params.maxAccel,
        );
      } else {
        azCmd = clamp(formulaOutput, -params.maxAccel, params.maxAccel);
      }

      samples.push(buildSample({
        t,
        missileState,
        targetState,
        geometry,
        azCmd,
        gammaCmd,
        formulaOutput,
      }));

      bestRange = Math.min(bestRange, geometry.R);

      if (!stateIsFinite(missileState) || !stateIsFinite(targetState) || !Number.isFinite(formulaOutput)) {
        outcome = {
          code: "numerical_error",
          ...STATUS_TEXT.numerical_error,
          message: "Sayisal tasma veya gecersiz durum tespit edildi.",
        };
        break;
      }

      if (stepIndex > 0 && geometry.R <= params.interceptRadius) {
        outcome = {
          code: "hit",
          ...STATUS_TEXT.hit,
          message: `Fuze ${params.interceptRadius} m onleme yaricapina girdi.`,
        };
        break;
      }

      if (stepIndex > 0 && missileState.z < 0) {
        outcome = {
          code: "ground",
          ...STATUS_TEXT.ground,
          message: "Fuze z < 0 kosuluyla yere carpti.",
        };
        break;
      }

      if (
        stepIndex > Math.max(40, Math.ceil(1 / params.dt))
        && geometry.closing_velocity < -1
        && geometry.R > bestRange + Math.max(30, params.interceptRadius * 5)
      ) {
        outcome = {
          code: "miss",
          ...STATUS_TEXT.miss,
          message: "Fuze hedefi gecti ve menzil tekrar artmaya basladi.",
        };
        break;
      }

      if (stepIndex === maxSteps) {
        break;
      }

      const command = {
        mode: params.outputMode,
        azCmd,
        gammaCmd,
      };

      missileState = normalizeMissileState(
        eulerStep(missileState, params.dt, (state) => computeMissileDerivatives(state, command, missileConfig)),
        missileConfig,
      );
      targetState = eulerStep(targetState, params.dt, computeTargetDerivatives);

      previousGeometry = geometry;
      previousCommands = {
        az_prev: azCmd,
        az_cmd_prev: azCmd,
        gamma_cmd_prev: gammaCmd,
      };
    }

    return {
      samples,
      params,
      outcome,
      stats: {
        finalTime: samples.at(-1)?.t ?? 0,
        sampleCount: samples.length,
      },
    };
  }

  function bootstrap() {
    if (
      !GUIDANCE_EXAMPLES
      || !ControlPanel
      || !EditorPanel
      || !PlotManager
      || !Scene2D
      || !eulerStep
      || !buildMissileConfig
      || !createTargetState
      || !buildGuidanceContext
      || !degToRad
    ) {
      throw new Error("Gerekli script dosyalarindan biri yuklenemedi.");
    }

    const controlPanel = new ControlPanel(document.getElementById("controlPanel"), {
      badge: document.getElementById("statusBadge"),
      message: document.getElementById("statusMessage"),
    });

    const editorPanel = new EditorPanel(
      document.getElementById("editorPanel"),
      GUIDANCE_EXAMPLES,
      SUPPORTED_VARIABLES,
      SUPPORTED_FUNCTIONS,
    );

    const plotManager = new PlotManager(
      document.getElementById("plotToggles"),
      document.getElementById("plotsGrid"),
    );

    const scene = new Scene2D(document.getElementById("scenePanel"));

    const appState = {
      activeExampleId: "PNG",
      compiledExpression: null,
      simulationResult: null,
      dirty: true,
    };

    function setDirty(message = "Parametre veya formul degisti; yeni simulasyon icin Baslat kullanin.") {
      appState.dirty = true;
      controlPanel.setStatus("ready", "Hazir", message);
    }

    function validateExpression() {
      try {
        appState.compiledExpression = createExpressionEvaluator(editorPanel.getExpression());
        editorPanel.setFormulaStatus("Formul basariyla ayristrildi ve guvenli olarak derlendi.", { isSuccess: true });
        return true;
      } catch (error) {
        appState.compiledExpression = null;
        editorPanel.setFormulaStatus(`Formul hatasi: ${error.message}`, { isError: true });
        return false;
      }
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
      }

      editorPanel.setMode(controlPanel.getValues().outputMode);
      validateExpression();
      setDirty(`${example.title} ornegi yuklendi. Dilerseniz formulu duzenleyip yeniden calistirabilirsiniz.`);
      scene.setViewOptions(controlPanel.getValues());
    }

    function syncEditorMode() {
      editorPanel.setMode(controlPanel.getValues().outputMode);
    }

    function executeSimulation(options = {}) {
      const { autoplay = true, resetOnly = false } = options;

      if (!validateExpression()) {
        controlPanel.setStatus("error", "Formul hatasi", "Simulasyon baslatilamadi; formuldeki hatayi duzeltin.");
        return false;
      }

      const rawValues = controlPanel.getValues();
      const params = buildSimulationParams(rawValues);

      controlPanel.setStatus("running", "Hesaplaniyor", "Simulasyon profili olusturuluyor ve animasyon hazirlaniyor.");

      const result = runSimulation(params, appState.compiledExpression);
      appState.simulationResult = result;
      appState.dirty = false;

      scene.loadSimulation(result, rawValues);
      plotManager.update(result, rawValues);

      controlPanel.setStatus(
        result.outcome.kind,
        result.outcome.label,
        `${result.outcome.message} Simulasyon ${result.stats.sampleCount} ornek ile tamamlandi.`,
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

      if (changedKey === "showLos" || changedKey === "traceEnabled") {
        scene.setViewOptions(values);
      }

      setDirty();
    });

    editorPanel.bind({
      onExampleSelected: (exampleId) => {
        applyExample(exampleId, { includeScenario: true });
      },
      onExpressionEdited: () => {
        validateExpression();
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

    controlPanel.setValues(cloneScenario(DEFAULT_SCENARIO));
    applyExample("PNG", { includeScenario: true });
    executeSimulation({ autoplay: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      try {
        bootstrap();
      } catch (error) {
        const badge = document.getElementById("statusBadge");
        const message = document.getElementById("statusMessage");
        if (badge && message) {
          badge.textContent = "Hata";
          badge.className = "status-pill status-error";
          message.textContent = `Uygulama baslatilamadi: ${error.message}`;
        }
        console.error(error);
      }
    });
  } else {
    try {
      bootstrap();
    } catch (error) {
      const badge = document.getElementById("statusBadge");
      const message = document.getElementById("statusMessage");
      if (badge && message) {
        badge.textContent = "Hata";
        badge.className = "status-pill status-error";
        message.textContent = `Uygulama baslatilamadi: ${error.message}`;
      }
      console.error(error);
    }
  }
})();
