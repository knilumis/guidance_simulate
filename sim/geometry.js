(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});
  const { GRAVITY, getMissileVelocity } = GuidanceSim.missileModel;
  const { getTargetVelocity } = GuidanceSim.targetModel;
  const {
    EPSILON,
    clamp,
    degToRad,
    radToDeg,
    normalizeAngle,
    safeDivide,
  } = GuidanceSim.utils.math;

  function computeRelativeGeometry(missileState, targetState, options = {}) {
    const missileVelocity = getMissileVelocity(missileState);
    const targetVelocity = getTargetVelocity(targetState);
    const dx = targetState.x - missileState.x;
    const dz = targetState.z - missileState.z;
    const vrelX = targetVelocity.vx - missileVelocity.vx;
    const vrelZ = targetVelocity.vz - missileVelocity.vz;
    const R = Math.hypot(dx, dz);
    const lambda = Math.atan2(dz, dx);
    const Rdot = safeDivide(dx * vrelX + dz * vrelZ, R);
    const lambdaDot = safeDivide(dx * vrelZ - dz * vrelX, R * R);
    const sigma = normalizeAngle(lambda - missileState.gamma);
    const previousSigma = options.previousDerived?.sigma ?? sigma;
    const sigmaDot = normalizeAngle(sigma - previousSigma) / Math.max(options.dt ?? 1, EPSILON);
    const xzError = R * Math.sin(sigma);
    const energy = 0.5 * missileState.V * missileState.V + GRAVITY * missileState.z;
    const referenceEnergy = options.referenceEnergy ?? energy;

    return {
      dx,
      dz,
      R,
      lambda,
      vrel_x: vrelX,
      vrel_z: vrelZ,
      Rdot,
      lambda_dot: lambdaDot,
      closing_velocity: -Rdot,
      sigma,
      sigma_dot: sigmaDot,
      vx_m: missileVelocity.vx,
      vz_m: missileVelocity.vz,
      vx_t: targetVelocity.vx,
      vz_t: targetVelocity.vz,
      xz_error: xzError,
      yanal_hata: xzError,
      energy,
      energy_error: referenceEnergy - energy,
    };
  }

  GuidanceSim.geometry = {
    degToRad,
    radToDeg,
    clamp,
    normalizeAngle,
    computeRelativeGeometry,
  };
})();
