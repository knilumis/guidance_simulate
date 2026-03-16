(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});
  const EPSILON = 1e-9;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function safeDivide(numerator, denominator, fallback = 0) {
    return Math.abs(denominator) < EPSILON ? fallback : numerator / denominator;
  }

  function degToRad(value) {
    return value * Math.PI / 180;
  }

  function radToDeg(value) {
    return value * 180 / Math.PI;
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

  function formatNumber(value, fractionDigits = 2, fallback = "-") {
    return Number.isFinite(value) ? value.toFixed(fractionDigits) : fallback;
  }

  function niceStep(rawStep) {
    const magnitude = 10 ** Math.floor(Math.log10(Math.max(rawStep, 1)));
    const normalized = rawStep / magnitude;

    if (normalized < 1.5) {
      return 1 * magnitude;
    }
    if (normalized < 3) {
      return 2 * magnitude;
    }
    if (normalized < 7) {
      return 5 * magnitude;
    }
    return 10 * magnitude;
  }

  GuidanceSim.utils = GuidanceSim.utils || {};
  GuidanceSim.utils.math = {
    EPSILON,
    clamp,
    safeDivide,
    degToRad,
    radToDeg,
    normalizeAngle,
    formatNumber,
    niceStep,
  };
})();
