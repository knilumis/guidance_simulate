(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});
  const { clamp, normalizeAngle } = GuidanceSim.utils.math;

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
      turnRate: target.turnRate,
      evasionRange: target.evasionRange,
      waypointX: target.waypointX,
      waypointZ: target.waypointZ,
      commandEvaluator: target.commandEvaluator,
      commandTau: target.commandTau,
      forwardDirection: fixedVx >= 0 ? 1 : -1,
    };
  }

  function getTargetVelocity(state) {
    return {
      vx: state.V * Math.cos(state.gamma),
      vz: state.V * Math.sin(state.gamma),
    };
  }

  function computeSinusoidalKinematics(time, config) {
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

  function computeHeadingController(currentGamma, desiredGamma, turnRate, tau = 0.65) {
    const error = normalizeAngle(desiredGamma - currentGamma);
    return clamp(error / Math.max(tau, 0.1), -Math.abs(turnRate), Math.abs(turnRate));
  }

  function computeTargetDerivatives(state, context, config) {
    if (config.motionModel === "sinusoidal") {
      const kinematics = computeSinusoidalKinematics(context.time, config);
      return {
        x: kinematics.vx,
        z: kinematics.vz,
        V: 0,
        gamma: 0,
      };
    }

    if (config.motionModel === "linear") {
      return {
        x: config.fixedVx,
        z: config.fixedVz,
        V: 0,
        gamma: 0,
      };
    }

    if (config.motionModel === "constant_gamma") {
      return {
        x: config.initialSpeed * Math.cos(config.initialGamma),
        z: config.initialSpeed * Math.sin(config.initialGamma),
        V: 0,
        gamma: 0,
      };
    }

    let desiredGamma = state.gamma;
    if (config.motionModel === "constant_turn") {
      return {
        x: state.V * Math.cos(state.gamma),
        z: state.V * Math.sin(state.gamma),
        V: 0,
        gamma: config.turnRate,
      };
    }

    if (config.motionModel === "evasive") {
      desiredGamma = (context.derived?.R ?? Number.POSITIVE_INFINITY) <= config.evasionRange
        ? (context.derived?.lambda ?? state.gamma)
        : config.initialGamma;
    }

    if (config.motionModel === "waypoint") {
      desiredGamma = Math.atan2(config.waypointZ - state.z, config.waypointX - state.x);
    }

    if (config.motionModel === "commanded") {
      desiredGamma = config.commandEvaluator
        ? config.commandEvaluator.evaluate(context.commandScope ?? {})
        : state.gamma;
    }

    const gammaDot = computeHeadingController(state.gamma, desiredGamma, config.turnRate, config.commandTau);
    return {
      x: state.V * Math.cos(state.gamma),
      z: state.V * Math.sin(state.gamma),
      V: 0,
      gamma: gammaDot,
    };
  }

  function normalizeTargetState(state, context, config) {
    if (config.motionModel === "sinusoidal") {
      const kinematics = computeSinusoidalKinematics(context.time, config);
      return {
        ...state,
        V: kinematics.speed,
        gamma: kinematics.gamma,
      };
    }

    if (config.motionModel === "linear") {
      return {
        ...state,
        V: Math.hypot(config.fixedVx, config.fixedVz),
        gamma: Math.atan2(config.fixedVz, config.fixedVx || 1e-6),
      };
    }

    if (config.motionModel === "constant_gamma") {
      return {
        ...state,
        V: config.initialSpeed,
        gamma: config.initialGamma,
      };
    }

    return {
      ...state,
      V: config.initialSpeed,
      gamma: normalizeAngle(state.gamma),
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
