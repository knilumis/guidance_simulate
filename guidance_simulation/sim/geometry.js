(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});
  const { GRAVITY, getMissileVelocity } = GuidanceSim.missileModel;
  const { getTargetVelocity } = GuidanceSim.targetModel;
  const EPSILON = 1e-9;

  function degToRad(value) {
    return value * Math.PI / 180;
  }

  function radToDeg(value) {
    return value * 180 / Math.PI;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeAngle(angle) {
    let wrapped = angle;

    while (wrapped > Math.PI) {
      wrapped -= 2 * Math.PI;
    }

    while (wrapped < -Math.PI) {
      wrapped += 2 * Math.PI;
    }

    return wrapped;
  }

  function safeDivide(numerator, denominator) {
    return Math.abs(denominator) < EPSILON ? 0 : numerator / denominator;
  }

  function computeRelativeGeometry(missileState, targetState, options = {}) {
    const missileVelocity = getMissileVelocity(missileState);
    const targetVelocity = getTargetVelocity(targetState);

    const relX = targetState.x - missileState.x;
    const relZ = targetState.z - missileState.z;
    const relVx = targetVelocity.vx - missileVelocity.vx;
    const relVz = targetVelocity.vz - missileVelocity.vz;
    const R = Math.hypot(relX, relZ);

    // lambda: gorus hatti (LOS) acisi; x-z duzleminde atan2(z_rel, x_rel) ile tanimlanir.
    const lambda = Math.atan2(relZ, relX);

    // Rdot: menzil degisim hizi; bagil hizin LOS eksenine izdusumu.
    const Rdot = safeDivide(relX * relVx + relZ * relVz, R);

    // lambda_dot: LOS donus hizi; 2D'de bagil konum/hiz capraz carpimi / R^2.
    const lambdaDot = safeDivide(relX * relVz - relZ * relVx, R * R);

    // sigma: fuze hiz vektoru ile LOS arasindaki fark.
    const sigma = normalizeAngle(lambda - missileState.gamma);
    const previousSigma = options.previousGeometry?.sigma ?? sigma;
    const sigmaDot = normalizeAngle(sigma - previousSigma) / Math.max(options.dt ?? 1, EPSILON);
    const xzError = R * Math.sin(sigma);
    const energy = 0.5 * missileState.V * missileState.V + GRAVITY * missileState.z;
    const referenceEnergy = options.referenceEnergy ?? energy;

    return {
      relX,
      relZ,
      relVx,
      relVz,
      vx_m: missileVelocity.vx,
      vz_m: missileVelocity.vz,
      vx_t: targetVelocity.vx,
      vz_t: targetVelocity.vz,
      R,
      Rdot,
      lambda,
      lambda_dot: lambdaDot,
      sigma,
      sigma_dot: sigmaDot,
      closing_velocity: -Rdot,
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
