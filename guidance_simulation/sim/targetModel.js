(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});

  function createTargetState(params) {
    return {
      x: params.targetX,
      z: params.targetZ,
      V: params.targetSpeed,
      gamma: params.targetGamma,
    };
  }

  function getTargetVelocity(state) {
    return {
      vx: state.V * Math.cos(state.gamma),
      vz: state.V * Math.sin(state.gamma),
    };
  }

  function computeTargetDerivatives(state) {
    return {
      x: state.V * Math.cos(state.gamma),
      z: state.V * Math.sin(state.gamma),
      V: 0,
      gamma: 0,
    };
  }

  GuidanceSim.targetModel = {
    createTargetState,
    getTargetVelocity,
    computeTargetDerivatives,
  };
})();
