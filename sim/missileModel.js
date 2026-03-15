(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});
  const GRAVITY = 9.81;
  const MIN_SPEED = 30;
  const { clamp, normalizeAngle } = GuidanceSim.utils.math;

  function createMissileState(params) {
    const missile = params.missile;
    return {
      x: missile.initialX,
      z: missile.initialZ,
      V: missile.initialSpeed,
      gamma: missile.initialGamma,
    };
  }

  function buildMissileConfig(params) {
    const missile = params.missile;
    return {
      speedModel: missile.speedModel,
      maxAccel: missile.maxAccel,
      gammaTau: missile.gammaTau,
      gammaCmdLimit: missile.gammaCmdLimit,
      gammaCmdRateLimit: missile.gammaCmdRateLimit,
      constantSpeed: missile.initialSpeed,
      mass: missile.mass,
      thrust: missile.thrust,
      dragCoeff: missile.dragCoeff,
      referenceArea: missile.referenceArea,
      atmosphere: {
        type: "constant",
        rho: missile.rho,
      },
    };
  }

  function getMissileVelocity(state) {
    return {
      vx: state.V * Math.cos(state.gamma),
      vz: state.V * Math.sin(state.gamma),
    };
  }

  function computeDragForce(state, config) {
    const rho = config.atmosphere.rho;
    return 0.5 * rho * state.V * state.V * config.dragCoeff * config.referenceArea;
  }

  function applyRateLimit(target, previous, maxRate, dt) {
    if (!Number.isFinite(maxRate) || maxRate <= 0) {
      return target;
    }

    const maxDelta = maxRate * dt;
    return clamp(target, previous - maxDelta, previous + maxDelta);
  }

  function resolveMissileControl({ state, guidanceOutput, previousControl, params, dt }) {
    const safeSpeed = Math.max(state.V, MIN_SPEED);
    const missile = params.missile;
    const outputMode = params.sim.outputMode;
    const previousGammaCmd = previousControl.gamma_cmd ?? state.gamma;

    if (outputMode === "gamma_demand") {
      const gammaCmdRaw = Number(guidanceOutput);
      const gammaCmdAngleLimited = clamp(gammaCmdRaw, -missile.gammaCmdLimit, missile.gammaCmdLimit);
      const gammaCmd = applyRateLimit(
        gammaCmdAngleLimited,
        previousGammaCmd,
        missile.gammaCmdRateLimit,
        dt,
      );
      const gammaError = normalizeAngle(gammaCmd - state.gamma);
      const desiredGammaDot = gammaError / Math.max(missile.gammaTau, 0.05);
      const maxGammaDot = missile.maxAccel / safeSpeed;
      const gammaDot = clamp(desiredGammaDot, -maxGammaDot, maxGammaDot);
      const azCmd = safeSpeed * desiredGammaDot;
      const azActual = safeSpeed * gammaDot;

      return {
        mode: outputMode,
        formula_output: guidanceOutput,
        gamma_cmd_raw: gammaCmdRaw,
        gamma_cmd: gammaCmd,
        gamma_error: gammaError,
        gamma_dot: gammaDot,
        az_cmd: azCmd,
        az_actual: azActual,
      };
    }

    const azCmd = Number(guidanceOutput);
    const azActual = clamp(azCmd, -missile.maxAccel, missile.maxAccel);

    return {
      mode: outputMode,
      formula_output: guidanceOutput,
      gamma_cmd_raw: previousGammaCmd,
      gamma_cmd: previousGammaCmd,
      gamma_error: 0,
      gamma_dot: azActual / safeSpeed,
      az_cmd: azCmd,
      az_actual: azActual,
    };
  }

  function computeMissileDerivatives(state, control, config) {
    const safeSpeed = Math.max(state.V, MIN_SPEED);
    const gamma = state.gamma;
    let Vdot = 0;

    if (config.speedModel === "energy") {
      // Basit enerji modeli:
      // Vdot = (T - D) / m - g * sin(gamma)
      const drag = computeDragForce(state, config);
      Vdot = (config.thrust - drag) / Math.max(config.mass, 1e-6) - GRAVITY * Math.sin(gamma);
    }

    return {
      x: safeSpeed * Math.cos(gamma),
      z: safeSpeed * Math.sin(gamma),
      V: Vdot,
      gamma: control.gamma_dot,
    };
  }

  function normalizeMissileState(state, config) {
    const nextState = { ...state };

    if (config.speedModel === "constant") {
      nextState.V = config.constantSpeed;
    } else {
      nextState.V = Math.max(MIN_SPEED, nextState.V);
    }

    nextState.gamma = normalizeAngle(nextState.gamma);
    return nextState;
  }

  GuidanceSim.missileModel = {
    GRAVITY,
    MIN_SPEED,
    createMissileState,
    buildMissileConfig,
    getMissileVelocity,
    resolveMissileControl,
    computeMissileDerivatives,
    normalizeMissileState,
  };
})();
