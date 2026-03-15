(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});

  function mapState(state, mapper) {
    return Object.fromEntries(
      Object.entries(state).map(([key, value]) => [key, mapper(value, key)]),
    );
  }

  function combineState(base, delta, scale) {
    return mapState(base, (value, key) => value + (delta[key] ?? 0) * scale);
  }

  function eulerStep(state, dt, derivativeFn) {
    const derivative = derivativeFn(state);
    return combineState(state, derivative, dt);
  }

  function rk4Step(state, dt, derivativeFn) {
    const k1 = derivativeFn(state);
    const k2 = derivativeFn(combineState(state, k1, dt * 0.5));
    const k3 = derivativeFn(combineState(state, k2, dt * 0.5));
    const k4 = derivativeFn(combineState(state, k3, dt));

    return mapState(state, (value, key) => (
      value
      + (dt / 6) * (
        (k1[key] ?? 0)
        + 2 * (k2[key] ?? 0)
        + 2 * (k3[key] ?? 0)
        + (k4[key] ?? 0)
      )
    ));
  }

  GuidanceSim.integrator = {
    eulerStep,
    rk4Step,
  };
})();
