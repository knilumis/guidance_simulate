(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});
  const { eulerStep } = GuidanceSim.integrator || {};
  const {
    buildMissileConfig,
    createMissileState,
    resolveMissileControl,
    computeMissileDerivatives,
    normalizeMissileState,
    GRAVITY,
  } = GuidanceSim.missileModel || {};
  const {
    buildTargetConfig,
    createTargetState,
    computeTargetDerivatives,
    normalizeTargetState,
  } = GuidanceSim.targetModel || {};
  const { createExpressionEvaluator, buildGuidanceContext } = GuidanceSim.guidanceEngine || {};
  const { computeRelativeGeometry } = GuidanceSim.geometry || {};
  const { degToRad, radToDeg } = GuidanceSim.utils.math;

  const STATUS_TEXT = {
    hit: { kind: "success", label: "Önleme başarılı" },
    miss: { kind: "warning", label: "Kaçırdı" },
    ground: { kind: "error", label: "Yere çarptı" },
    timeout: { kind: "warning", label: "Süre doldu" },
    numerical_error: { kind: "error", label: "Sayısal hata" },
  };

  function stateIsFinite(state) {
    return Object.values(state).every((value) => Number.isFinite(value));
  }

  function buildSimulationParams(rawValues) {
    const thrust = rawValues.thrust ?? 1700;
    const missileMass = rawValues.missileMass ?? 85;
    const referenceArea = rawValues.referenceArea ?? 0.018;
    const dragCoeff = rawValues.dragCoeff ?? 0.34;
    const targetCommandExpression = String(rawValues.targetCommandExpression ?? "").trim();

    return {
      sim: {
        dt: rawValues.dt,
        tMax: rawValues.tMax,
        interceptRadius: rawValues.interceptRadius,
        outputMode: rawValues.outputMode,
        g: GRAVITY,
      },
      guidance: {
        N: rawValues.N,
        k1: rawValues.k1,
        k2: rawValues.k2,
      },
      missile: {
        initialX: rawValues.missileX,
        initialZ: rawValues.missileZ,
        initialSpeed: rawValues.missileSpeed,
        initialGamma: degToRad(rawValues.missileGammaDeg),
        speedModel: rawValues.speedModel,
        maxAccel: rawValues.maxAccel,
        gammaTau: rawValues.gammaTau,
        gammaCmdLimit: degToRad(rawValues.gammaCmdLimitDeg),
        gammaCmdRateLimit: degToRad(rawValues.gammaCmdRateLimitDeg),
        thrust,
        mass: missileMass,
        referenceArea,
        dragCoeff,
        rho: 1.225,
      },
      target: {
        initialX: rawValues.targetX,
        initialZ: rawValues.targetZ,
        initialSpeed: rawValues.targetSpeed,
        initialGamma: degToRad(rawValues.targetGammaDeg),
        motionModel: rawValues.targetMotionModel,
        sinAmplitude: rawValues.targetSinAmplitude,
        sinFrequency: rawValues.targetSinFrequency,
        turnRate: degToRad(rawValues.targetTurnRateDeg ?? 0),
        evasionRange: rawValues.targetEvasionRange ?? 1200,
        waypointX: rawValues.targetWaypointX ?? rawValues.targetX,
        waypointZ: rawValues.targetWaypointZ ?? rawValues.targetZ,
        commandExpression: targetCommandExpression,
        commandEvaluator: rawValues.targetMotionModel === "commanded"
          ? createExpressionEvaluator(targetCommandExpression || "gamma_t")
          : null,
        commandTau: 0.55,
      },
      view: {
        showLos: rawValues.showLos ?? true,
        traceEnabled: rawValues.traceEnabled ?? true,
      },
    };
  }

  function createSimulationState(params) {
    const missile = createMissileState(params);
    const target = createTargetState(params);

    return {
      time: 0,
      stepIndex: 0,
      missile,
      target,
    };
  }

  function createInitialControl(state) {
    return {
      formula_output: 0,
      gamma_cmd_raw: state.missile.gamma,
      gamma_cmd: state.missile.gamma,
      gamma_error: 0,
      gamma_dot: 0,
      az_cmd: 0,
      az_actual: 0,
    };
  }

  function createHistory(params, initialState, overrides = {}) {
    const referenceEnergy = overrides.referenceEnergy
      ?? (0.5 * params.missile.initialSpeed * params.missile.initialSpeed + params.sim.g * params.missile.initialZ);

    return {
      samples: [...(overrides.samples ?? [])],
      referenceEnergy,
      minMissDistance: overrides.minMissDistance ?? Number.POSITIVE_INFINITY,
      interceptTime: overrides.interceptTime ?? null,
      peakAz: overrides.peakAz ?? 0,
      peakLambdaDot: overrides.peakLambdaDot ?? 0,
    };
  }

  function createControlFromSample(sample, fallbackGamma = 0) {
    return {
      formula_output: sample?.formula_output ?? 0,
      gamma_cmd_raw: sample?.gamma_cmd ?? fallbackGamma,
      gamma_cmd: sample?.gamma_cmd ?? fallbackGamma,
      gamma_error: sample?.gamma_error ?? 0,
      gamma_dot: sample?.gamma_dot ?? 0,
      az_cmd: sample?.az_cmd ?? 0,
      az_actual: sample?.az_actual ?? 0,
    };
  }

  function createDerivedFromSample(sample) {
    if (!sample) {
      return null;
    }

    return {
      sigma: sample.sigma,
    };
  }

  function buildHistoryFromSamples(params, samples = []) {
    const minMissDistance = samples.reduce(
      (currentMin, sample) => Math.min(currentMin, sample.R),
      Number.POSITIVE_INFINITY,
    );
    const peakAz = samples.reduce(
      (currentPeak, sample) => Math.max(currentPeak, Math.abs(sample.az_actual)),
      0,
    );
    const peakLambdaDot = samples.reduce(
      (currentPeak, sample) => Math.max(currentPeak, Math.abs(sample.lambda_dot)),
      0,
    );
    const interceptSample = samples.find((sample, index) => (
      index > 0 && sample.R <= params.sim.interceptRadius
    ));

    return createHistory(params, null, {
      samples,
      minMissDistance,
      interceptTime: interceptSample?.t ?? null,
      peakAz,
      peakLambdaDot,
    });
  }

  function createResumeStateFromSample(sample, stepIndex) {
    return {
      time: sample.t,
      stepIndex,
      missile: {
        x: sample.x_m,
        z: sample.z_m,
        V: sample.V_m,
        gamma: sample.gamma_m,
      },
      target: {
        x: sample.x_t,
        z: sample.z_t,
        V: sample.V_t,
        gamma: sample.gamma_t,
      },
    };
  }

  function buildContinuationOptions(params, result, sampleIndex) {
    const lastIndex = Math.max(0, result.samples.length - 1);
    const safeIndex = Math.max(0, Math.min(sampleIndex, lastIndex));
    const currentSample = result.samples[safeIndex];
    const prefixSamples = result.samples.slice(0, safeIndex);
    const previousSample = prefixSamples.at(-1);
    const resumeState = createResumeStateFromSample(currentSample, safeIndex);

    return {
      state: resumeState,
      history: buildHistoryFromSamples(params, prefixSamples),
      previousControl: previousSample
        ? createControlFromSample(previousSample, currentSample.gamma_m)
        : createInitialControl(resumeState),
      previousDerived: createDerivedFromSample(previousSample),
    };
  }

  function buildSample(state, derived, control, missileDerivatives, outcome) {
    return {
      t: state.time,
      x_m: state.missile.x,
      z_m: state.missile.z,
      x_t: state.target.x,
      z_t: state.target.z,
      V_m: state.missile.V,
      V_t: state.target.V,
      Vdot: missileDerivatives.V,
      gamma_m: state.missile.gamma,
      gamma_t: state.target.gamma,
      gamma_m_deg: radToDeg(state.missile.gamma),
      gamma_t_deg: radToDeg(state.target.gamma),
      gamma_cmd: control.gamma_cmd,
      gamma_cmd_deg: radToDeg(control.gamma_cmd),
      gamma_error: control.gamma_error,
      gamma_error_deg: radToDeg(control.gamma_error),
      gamma_dot: control.gamma_dot,
      gamma_dot_deg: radToDeg(control.gamma_dot),
      az_cmd: control.az_cmd,
      az_actual: control.az_actual,
      formula_output: control.formula_output,
      dx: derived.dx,
      dz: derived.dz,
      R: derived.R,
      Rdot: derived.Rdot,
      lambda: derived.lambda,
      lambda_deg: radToDeg(derived.lambda),
      lambda_dot: derived.lambda_dot,
      lambda_dot_deg: radToDeg(derived.lambda_dot),
      sigma: derived.sigma,
      sigma_deg: radToDeg(derived.sigma),
      sigma_dot: derived.sigma_dot,
      closing_velocity: derived.closing_velocity,
      xz_error: derived.xz_error,
      energy: derived.energy,
      energy_error: derived.energy_error,
      status_code: outcome.code,
    };
  }

  function updateHistory(history, derived, control, sample) {
    history.samples.push(sample);
    history.minMissDistance = Math.min(history.minMissDistance, derived.R);
    history.peakAz = Math.max(history.peakAz, Math.abs(control.az_actual));
    history.peakLambdaDot = Math.max(history.peakLambdaDot, Math.abs(sample.lambda_dot));
  }

  function evaluateOutcome(state, derived, params, history) {
    if (state.stepIndex > 0 && derived.R <= params.sim.interceptRadius) {
      return {
        code: "hit",
        ...STATUS_TEXT.hit,
        message: `Füze ${params.sim.interceptRadius} m önleme yarıçapına girdi.`,
      };
    }

    if (state.stepIndex > 0 && state.missile.z < 0) {
      return {
        code: "ground",
        ...STATUS_TEXT.ground,
        message: "Füze z < 0 koşuluyla yere çarptı.",
      };
    }

    if (
      state.stepIndex > Math.max(40, Math.ceil(1 / params.sim.dt))
      && derived.closing_velocity < -1
      && derived.R > history.minMissDistance + Math.max(30, params.sim.interceptRadius * 5)
    ) {
      return {
        code: "miss",
        ...STATUS_TEXT.miss,
        message: "Füze hedefi geçti ve menzil tekrar artmaya başladı.",
      };
    }

    if (state.time >= params.sim.tMax) {
      return {
        code: "timeout",
        ...STATUS_TEXT.timeout,
        message: "Maksimum simülasyon süresi doldu.",
      };
    }

    return null;
  }

  function buildResult(params, history, outcome) {
    const terminal = history.samples.at(-1);
    const minMissDistance = Number.isFinite(history.minMissDistance) ? history.minMissDistance : NaN;

    return {
      samples: history.samples,
      params,
      outcome,
      stats: {
        finalTime: terminal?.t ?? 0,
        sampleCount: history.samples.length,
        minMissDistance,
        interceptTime: history.interceptTime,
        terminalSpeed: terminal?.V_m ?? 0,
        terminalGamma: terminal?.gamma_m ?? 0,
        terminalGammaDeg: terminal?.gamma_m_deg ?? 0,
        peakAz: history.peakAz,
        peakLambdaDot: history.peakLambdaDot,
        peakLambdaDotDeg: radToDeg(history.peakLambdaDot),
      },
    };
  }

  function buildStepContext(state, params, history, previousDerived, previousControl) {
    const derived = computeRelativeGeometry(state.missile, state.target, {
      dt: params.sim.dt,
      previousDerived,
      referenceEnergy: history.referenceEnergy,
    });

    const guidanceScope = buildGuidanceContext({
      time: state.time,
      dt: params.sim.dt,
      state,
      derived,
      previousControl,
      params,
    });

    return {
      derived,
      guidanceScope,
    };
  }

  function runSimulation(params, evaluator, options = {}) {
    const missileConfig = buildMissileConfig(params);
    const targetConfig = buildTargetConfig(params);
    const state = options.state
      ? {
        time: options.state.time,
        stepIndex: options.state.stepIndex,
        missile: { ...options.state.missile },
        target: { ...options.state.target },
      }
      : createSimulationState(params);
    state.missile = normalizeMissileState(state.missile, missileConfig);
    state.target = normalizeTargetState(state.target, { time: state.time }, targetConfig);
    const history = options.history
      ? createHistory(params, state, options.history)
      : createHistory(params, state);
    let previousDerived = options.previousDerived ?? null;
    let previousControl = options.previousControl
      ? { ...options.previousControl }
      : createInitialControl(state);
    let outcome = {
      code: "timeout",
      ...STATUS_TEXT.timeout,
      message: "Maksimum simülasyon süresi doldu.",
    };

    while (state.time <= params.sim.tMax + 1e-9) {
      const { derived, guidanceScope } = buildStepContext(
        state,
        params,
        history,
        previousDerived,
        previousControl,
      );

      let guidanceOutput = 0;
      try {
        guidanceOutput = evaluator.evaluate(guidanceScope);
      } catch (error) {
        outcome = {
          code: "numerical_error",
          ...STATUS_TEXT.numerical_error,
          message: `Formül değerlendirilemedi: ${error.message}`,
        };
        break;
      }

      const control = resolveMissileControl({
        state: state.missile,
        guidanceOutput,
        previousControl,
        params,
        dt: params.sim.dt,
      });

      const missileDerivatives = computeMissileDerivatives(state.missile, control, missileConfig);
      const sample = buildSample(state, derived, control, missileDerivatives, outcome);
      updateHistory(history, derived, control, sample);

      if (!stateIsFinite(state.missile) || !stateIsFinite(state.target) || !Number.isFinite(guidanceOutput)) {
        outcome = {
          code: "numerical_error",
          ...STATUS_TEXT.numerical_error,
          message: "Sayısal taşma veya geçersiz durum tespit edildi.",
        };
        break;
      }

      const terminalOutcome = evaluateOutcome(state, derived, params, history);
      if (terminalOutcome) {
        outcome = terminalOutcome;
        if (terminalOutcome.code === "hit" && history.interceptTime == null) {
          history.interceptTime = state.time;
        }
        break;
      }

      const nextMissileState = eulerStep(state.missile, params.sim.dt, (currentMissileState) => (
        computeMissileDerivatives(currentMissileState, control, missileConfig)
      ));

      const nextTargetState = eulerStep(state.target, params.sim.dt, (currentTargetState) => (
        computeTargetDerivatives(currentTargetState, {
          time: state.time,
          dt: params.sim.dt,
          derived,
          state,
          params,
          commandScope: guidanceScope,
        }, targetConfig)
      ));

      state.missile = normalizeMissileState(nextMissileState, missileConfig);
      state.target = normalizeTargetState(nextTargetState, {
        time: state.time + params.sim.dt,
        dt: params.sim.dt,
        derived,
        state,
        params,
        commandScope: guidanceScope,
      }, targetConfig);
      state.time += params.sim.dt;
      state.stepIndex += 1;
      previousDerived = derived;
      previousControl = control;
    }

    return buildResult(params, history, outcome);
  }

  function continueSimulationFromSample(params, evaluator, result, sampleIndex) {
    if (!result?.samples?.length) {
      return runSimulation(params, evaluator);
    }

    return runSimulation(params, evaluator, buildContinuationOptions(params, result, sampleIndex));
  }

  GuidanceSim.simulationCore = {
    STATUS_TEXT,
    buildSimulationParams,
    runSimulation,
    continueSimulationFromSample,
  };
})();
