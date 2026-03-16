(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});

  const COMMON_MISSILE_PARAMS = {
    maxAccel: 95,
    gammaTau: 0.55,
    gammaCmdLimitDeg: 70,
    gammaCmdRateLimitDeg: 120,
    missileMass: 85,
    thrust: 1700,
    referenceArea: 0.018,
    dragCoeff: 0.34,
  };

  const COMMON_TARGET_PARAMS = {
    targetMotionModel: "linear",
    targetSinAmplitude: 120,
    targetSinFrequency: 0.12,
    targetTurnRateDeg: 12,
    targetEvasionRange: 1200,
    targetWaypointX: 4200,
    targetWaypointZ: 900,
    targetCommandExpression: "gamma_t + 0.25 * sin(0.35 * t)",
  };

  const HELP_FORMULAS = [
    {
      title: "PNG klasik",
      expression: "N * V_m * lambda_dot",
      note: "Normal ivme komutu üreten en temel oransal seyrüsefer örneği.",
    },
    {
      title: "BPG benzeri gamma komutu",
      expression: "gamma_m + k1 * sigma + k2 * lambda_dot",
      note: "LOS hizalama hatası ile LOS dönüş hızını birlikte kullanır.",
    },
    {
      title: "Saf takip",
      expression: "lambda",
      note: "gamma_demand modunda doğrudan LOS açısına dönmeyi dener.",
    },
    {
      title: "Sönümlü takip",
      expression: "gamma_m + 1.2 * sigma + 0.6 * lambda_dot",
      note: "Küçük LOS-rate katkısı ile daha yumuşak yönelim verir.",
    },
    {
      title: "Menzile duyarlı az komutu",
      expression: "N * closing_velocity * lambda_dot / max(R, intercept_radius)",
      note: "Menzil azaldıkça komutu ölçeklemeye çalışan deneysel örnek.",
    },
    {
      title: "Kosullu if mantigi",
      expression: "if(R > 1200, N * V_m * lambda_dot, 0.7 * N * V_m * lambda_dot)",
      note: "Kosul dogruysa ilk, yanlissa ikinci dali calistiran guvenli if() ornegi.",
    },
  ];

  const GUIDANCE_EXAMPLES = {
    PNG: {
      id: "PNG",
      title: "PNG",
      outputMode: "az_demand",
      expression: "N * V_m * lambda_dot",
      description:
        "Klasik oransal seyrüsefer. LOS dönüş hızını füze hızı ve navigasyon sabiti ile çarpar, çıkış olarak yanal ivme komutu üretir.",
      defaults: {
        N: 3,
        k1: 1.4,
        k2: 0.5,
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
        speedModel: "constant",
        outputMode: "az_demand",
        N: 3,
        k1: 1.4,
        k2: 0.5,
        showLos: true,
        traceEnabled: true,
        ...COMMON_MISSILE_PARAMS,
        ...COMMON_TARGET_PARAMS,
      },
    },
    BPG: {
      id: "BPG",
      title: "BPG",
      outputMode: "gamma_demand",
      expression: "gamma_m + k1 * sigma + k2 * lambda_dot",
      description:
        "Body / boresight pursuit esinli sade gamma komutu. LOS yönelim hatası ile LOS dönüş hızını birleştirerek uçuş yolu açısını şekillendirir.",
      defaults: {
        N: 3,
        k1: 2,
        k2: 1.4,
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
        speedModel: "energy",
        outputMode: "gamma_demand",
        N: 3,
        k1: 2,
        k2: 1.4,
        showLos: true,
        traceEnabled: true,
        ...COMMON_MISSILE_PARAMS,
        gammaTau: 0.45,
        targetMotionModel: "sinusoidal",
        targetSinAmplitude: 60,
        targetSinFrequency: 0.16,
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
    HELP_FORMULAS,
    cloneScenario,
  };
})();
