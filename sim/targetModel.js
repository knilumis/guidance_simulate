(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});

  function createTargetState(params) {
    const target = params.target;
    return {
      x: target.initialX,
      z: target.initialZ,
      V: target.initialSpeed,
      gamma: target.initialGamma,
    };
  }

  function buildTargetConfig(params) {
    const target = params.target;
    const fixedVx = target.initialSpeed * Math.cos(target.initialGamma);
    const fixedVz = target.initialSpeed * Math.sin(target.initialGamma);

    return {
      motionModel: target.motionModel,
      initialSpeed: target.initialSpeed,
      initialGamma: target.initialGamma,
      fixedVx,
      fixedVz,
      sinAmplitude: target.sinAmplitude,
      sinFrequency: target.sinFrequency,
      forwardDirection: fixedVx >= 0 ? 1 : -1,
    };
  }

  function getTargetVelocity(state) {
    return {
      vx: state.V * Math.cos(state.gamma),
      vz: state.V * Math.sin(state.gamma),
    };
  }

  function computeTargetKinematics(time, state, config) {
    if (config.motionModel === "sinusoidal") {
      const omega = 2 * Math.PI * Math.max(config.sinFrequency, 0);
      const desiredVz = config.sinAmplitude * omega * Math.cos(omega * time);
      const limitedVz = Math.max(-config.initialSpeed * 0.98, Math.min(config.initialSpeed * 0.98, desiredVz));
      const vxMagnitude = Math.sqrt(Math.max(config.initialSpeed * config.initialSpeed - limitedVz * limitedVz, 0));
      const vx = config.forwardDirection * vxMagnitude;
      const gamma = Math.atan2(limitedVz, vx || config.forwardDirection * 1e-6);

      return {
        vx,
        vz: limitedVz,
        gamma,
        speed: Math.hypot(vx, limitedVz),
      };
    }

    if (config.motionModel === "constant_gamma") {
      return {
        vx: config.initialSpeed * Math.cos(config.initialGamma),
        vz: config.initialSpeed * Math.sin(config.initialGamma),
        gamma: config.initialGamma,
        speed: config.initialSpeed,
      };
    }

    return {
      vx: config.fixedVx,
      vz: config.fixedVz,
      gamma: Math.atan2(config.fixedVz, config.fixedVx || 1e-6),
      speed: Math.hypot(config.fixedVx, config.fixedVz),
    };
  }

  function computeTargetDerivatives(state, context, config) {
    const kinematics = computeTargetKinematics(context.time, state, config);

    return {
      x: kinematics.vx,
      z: kinematics.vz,
      V: 0,
      gamma: 0,
    };
  }

  function normalizeTargetState(state, context, config) {
    const kinematics = computeTargetKinematics(context.time, state, config);
    return {
      ...state,
      V: kinematics.speed,
      gamma: kinematics.gamma,
    };
  }

  GuidanceSim.targetModel = {
    createTargetState,
    buildTargetConfig,
    getTargetVelocity,
    computeTargetDerivatives,
    normalizeTargetState,
  };
})();
