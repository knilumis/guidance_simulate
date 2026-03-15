(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});
  const GRAVITY = 9.81;
  const MIN_SPEED = 30;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function createMissileState(params) {
    return {
      x: params.missileX,
      z: params.missileZ,
      V: params.missileSpeed,
      gamma: params.missileGamma,
    };
  }

  function buildMissileConfig(params) {
    return {
      speedModel: params.speedModel,
      maxAccel: params.maxAccel,
      gammaTau: params.gammaTau,
      constantSpeed: params.missileSpeed,
      mass: 85,
      thrust: 1700,
      dragCoeff: 0.34,
      referenceArea: 0.018,
      rho0: 1.225,
      scaleHeight: 8500,
    };
  }

  function getMissileVelocity(state) {
    return {
      vx: state.V * Math.cos(state.gamma),
      vz: state.V * Math.sin(state.gamma),
    };
  }

  function computeAirDensity(altitude, config) {
    return config.rho0 * Math.exp(-Math.max(altitude, 0) / config.scaleHeight);
  }

  function computeDragForce(state, config) {
    const rho = computeAirDensity(state.z, config);
    return 0.5 * rho * state.V * state.V * config.dragCoeff * config.referenceArea;
  }

  function computeMissileDerivatives(state, command, config) {
    const safeSpeed = Math.max(state.V, MIN_SPEED);
    const gamma = state.gamma;

    let controlNormalAccel = 0;
    let gammaDot = 0;

    if (command.mode === "gamma_demand") {
      // Gamma komutunda ic otopilot, istenen gamma_dot'u esdeger normal ivmeye cevirir.
      const desiredGammaDot = (command.gammaCmd - state.gamma) / Math.max(config.gammaTau, 0.05);
      const azNeeded = safeSpeed * desiredGammaDot + GRAVITY * Math.cos(gamma);
      controlNormalAccel = clamp(azNeeded, -config.maxAccel, config.maxAccel);
      gammaDot = controlNormalAccel / safeSpeed - (GRAVITY * Math.cos(gamma)) / safeSpeed;
    } else {
      // az_demand modunda kullanici ifadesi dogrudan hiz vektorune dik ivme komutu uretir.
      controlNormalAccel = clamp(command.azCmd, -config.maxAccel, config.maxAccel);
      gammaDot = controlNormalAccel / safeSpeed - (GRAVITY * Math.cos(gamma)) / safeSpeed;
    }

    let Vdot = 0;
    if (config.speedModel === "energy") {
      // Basit enerji modeli: Vdot = T/m - D/m - g * sin(gamma)
      const drag = computeDragForce(state, config);
      Vdot = config.thrust / config.mass - drag / config.mass - GRAVITY * Math.sin(gamma);
    }

    return {
      x: safeSpeed * Math.cos(gamma),
      z: safeSpeed * Math.sin(gamma),
      V: Vdot,
      gamma: gammaDot,
      azEquivalent: controlNormalAccel,
    };
  }

  function normalizeMissileState(state, config) {
    const normalized = { ...state };

    if (config.speedModel === "constant") {
      normalized.V = config.constantSpeed;
    } else {
      normalized.V = Math.max(MIN_SPEED, state.V);
    }

    return normalized;
  }

  GuidanceSim.missileModel = {
    GRAVITY,
    createMissileState,
    buildMissileConfig,
    getMissileVelocity,
    computeMissileDerivatives,
    normalizeMissileState,
  };
})();
