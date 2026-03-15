(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});

  const GUIDANCE_EXAMPLES = {
    PNG: {
      id: "PNG",
      title: "PNG",
      outputMode: "az_demand",
      expression: "N * V_m * lambda_dot",
      description:
        "Klasik oransal seyrusefer ornegi. LOS donus hizini fuze hizi ve navigasyon sabiti ile carparak normal ivme komutu uretir.",
      defaults: {
        N: 3,
        k1: 1.5,
        k2: 0.8,
      },
      scenario: {
        missileX: 0,
        missileZ: 0,
        missileSpeed: 250,
        missileGammaDeg: 35,
        targetX: 3500,
        targetZ: 1200,
        targetSpeed: 120,
        targetGammaDeg: 0,
        dt: 0.01,
        tMax: 40,
        interceptRadius: 10,
        maxAccel: 90,
        speedModel: "constant",
        outputMode: "az_demand",
        N: 3,
        k1: 1.5,
        k2: 0.8,
        gammaTau: 0.75,
        showLos: true,
        traceEnabled: true,
      },
    },
    BPG: {
      id: "BPG",
      title: "BPG",
      outputMode: "gamma_demand",
      expression: "gamma_m + k1 * sigma + k2 * lambda_dot",
      description:
        "Basitlestirilmis body/boresight pursuit ornegi. Fuze gamma komutunu LOS farki ve LOS donus hizi uzerinden ayarlar.",
      defaults: {
        N: 3,
        k1: 1.9,
        k2: 1.2,
      },
      scenario: {
        missileX: 0,
        missileZ: 0,
        missileSpeed: 240,
        missileGammaDeg: 28,
        targetX: 3200,
        targetZ: 1450,
        targetSpeed: 135,
        targetGammaDeg: -3,
        dt: 0.01,
        tMax: 40,
        interceptRadius: 10,
        maxAccel: 95,
        speedModel: "energy",
        outputMode: "gamma_demand",
        N: 3,
        k1: 1.9,
        k2: 1.2,
        gammaTau: 0.55,
        showLos: true,
        traceEnabled: true,
      },
    },
  };

  const DEFAULT_SCENARIO = { ...GUIDANCE_EXAMPLES.PNG.scenario };

  function cloneScenario(scenario) {
    return JSON.parse(JSON.stringify(scenario));
  }

  GuidanceSim.examples = {
    GUIDANCE_EXAMPLES,
    DEFAULT_SCENARIO,
    cloneScenario,
  };
})();
