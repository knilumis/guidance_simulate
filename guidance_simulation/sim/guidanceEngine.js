(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});

  const CONSTANTS = {
    pi: Math.PI,
  };

  const FUNCTION_DEFINITIONS = {
    sin: { minArgs: 1, maxArgs: 1, fn: Math.sin },
    cos: { minArgs: 1, maxArgs: 1, fn: Math.cos },
    tan: { minArgs: 1, maxArgs: 1, fn: Math.tan },
    atan: { minArgs: 1, maxArgs: 1, fn: Math.atan },
    atan2: { minArgs: 2, maxArgs: 2, fn: Math.atan2 },
    asin: { minArgs: 1, maxArgs: 1, fn: Math.asin },
    acos: { minArgs: 1, maxArgs: 1, fn: Math.acos },
    sqrt: { minArgs: 1, maxArgs: 1, fn: Math.sqrt },
    abs: { minArgs: 1, maxArgs: 1, fn: Math.abs },
    min: { minArgs: 2, maxArgs: Number.POSITIVE_INFINITY, fn: Math.min },
    max: { minArgs: 2, maxArgs: Number.POSITIVE_INFINITY, fn: Math.max },
    pow: { minArgs: 2, maxArgs: 2, fn: Math.pow },
    exp: { minArgs: 1, maxArgs: 1, fn: Math.exp },
    log: { minArgs: 1, maxArgs: 1, fn: Math.log },
  };

  const SUPPORTED_FUNCTIONS = Object.keys(FUNCTION_DEFINITIONS);

  const SUPPORTED_VARIABLES = [
    { name: "t", description: "Simulasyon zamani [s]" },
    { name: "dt", description: "Entegrasyon adimi [s]" },
    { name: "x_m, z_m", description: "Fuze konumu [m]" },
    { name: "x_t, z_t", description: "Hedef konumu [m]" },
    { name: "vx_m, vz_m", description: "Fuze hiz bilesenleri [m/s]" },
    { name: "vx_t, vz_t", description: "Hedef hiz bilesenleri [m/s]" },
    { name: "V_m, V_t", description: "Hiz buyuklukleri [m/s]" },
    { name: "gamma_m, gamma_t", description: "Ucus yolu acilari [rad]" },
    { name: "R, Rdot", description: "Menzil ve menzil turevi" },
    { name: "lambda, lambda_dot", description: "LOS acisi ve donus hizi [rad, rad/s]" },
    { name: "sigma, sigma_dot", description: "LOS-hiz farki ve turevi [rad, rad/s]" },
    { name: "closing_velocity", description: "Kapanma hizi [m/s]" },
    { name: "xz_error / yanal_hata", description: "Yanal hata metrigi [m]" },
    { name: "energy, energy_error", description: "Ozgul enerji ve hatasi [J/kg]" },
    { name: "az_prev, az_cmd_prev", description: "Bir onceki normal ivme komutu [m/s^2]" },
    { name: "gamma_cmd_prev", description: "Bir onceki gamma komutu [rad]" },
    { name: "N, k1, k2", description: "Algoritma ayar parametreleri" },
    { name: "g, intercept_radius, gamma_tau", description: "Yardimci sabitler" },
  ];

  function isDigit(character) {
    return character >= "0" && character <= "9";
  }

  function isIdentifierStart(character) {
    return /[A-Za-z_]/.test(character);
  }

  function isIdentifierPart(character) {
    return /[A-Za-z0-9_]/.test(character);
  }

  function tokenize(expression) {
    const tokens = [];
    let index = 0;

    while (index < expression.length) {
      const character = expression[index];

      if (/\s/.test(character)) {
        index += 1;
        continue;
      }

      if (isDigit(character) || (character === "." && isDigit(expression[index + 1] ?? ""))) {
        let end = index + 1;
        while (end < expression.length && /[0-9.]/.test(expression[end])) {
          end += 1;
        }

        if ((expression[end] === "e" || expression[end] === "E") && /[+\-0-9]/.test(expression[end + 1] ?? "")) {
          end += 1;
          if (expression[end] === "+" || expression[end] === "-") {
            end += 1;
          }
          while (end < expression.length && isDigit(expression[end])) {
            end += 1;
          }
        }

        const value = Number(expression.slice(index, end));
        if (!Number.isFinite(value)) {
          throw new Error("Gecersiz sayi ifadesi bulundu.");
        }

        tokens.push({ type: "number", value });
        index = end;
        continue;
      }

      if (isIdentifierStart(character)) {
        let end = index + 1;
        while (end < expression.length && isIdentifierPart(expression[end])) {
          end += 1;
        }

        tokens.push({ type: "identifier", value: expression.slice(index, end) });
        index = end;
        continue;
      }

      if ("+-*/^(),".includes(character)) {
        tokens.push({ type: character, value: character });
        index += 1;
        continue;
      }

      throw new Error(`Izin verilmeyen karakter bulundu: "${character}"`);
    }

    return tokens;
  }

  function parseExpression(tokens) {
    let position = 0;

    function currentToken() {
      return tokens[position];
    }

    function consume(type, message) {
      const token = currentToken();
      if (!token || token.type !== type) {
        throw new Error(message);
      }
      position += 1;
      return token;
    }

    function parsePrimary() {
      const token = currentToken();

      if (!token) {
        throw new Error("Ifade beklenirken satir sonuna ulasildi.");
      }

      if (token.type === "number") {
        position += 1;
        return { type: "Literal", value: token.value };
      }

      if (token.type === "identifier") {
        position += 1;
        const identifier = token.value;

        if (currentToken()?.type === "(") {
          consume("(", "Fonksiyon cagrisi icin '(' bekleniyordu.");
          const args = [];

          if (currentToken()?.type !== ")") {
            do {
              args.push(parseAddSubtract());
              if (currentToken()?.type !== ",") {
                break;
              }
              consume(",", "Argumanlar arasinda ',' bekleniyordu.");
            } while (true);
          }

          consume(")", "Fonksiyon cagrisi kapatilmadi.");
          return { type: "CallExpression", callee: identifier, arguments: args };
        }

        return { type: "Identifier", name: identifier };
      }

      if (token.type === "(") {
        consume("(", "Acilis parantezi bekleniyordu.");
        const expressionNode = parseAddSubtract();
        consume(")", "Parantez kapatilmadi.");
        return expressionNode;
      }

      throw new Error(`Beklenmeyen sembol: "${token.value}"`);
    }

    function parseUnary() {
      const token = currentToken();
      if (token?.type === "+" || token?.type === "-") {
        position += 1;
        return {
          type: "UnaryExpression",
          operator: token.type,
          argument: parseUnary(),
        };
      }
      return parsePrimary();
    }

    function parsePower() {
      let node = parseUnary();

      if (currentToken()?.type === "^") {
        consume("^", "'^' operatoru bekleniyordu.");
        node = {
          type: "BinaryExpression",
          operator: "^",
          left: node,
          right: parsePower(),
        };
      }

      return node;
    }

    function parseMultiplyDivide() {
      let node = parsePower();

      while (currentToken()?.type === "*" || currentToken()?.type === "/") {
        const operator = currentToken().type;
        position += 1;
        node = {
          type: "BinaryExpression",
          operator,
          left: node,
          right: parsePower(),
        };
      }

      return node;
    }

    function parseAddSubtract() {
      let node = parseMultiplyDivide();

      while (currentToken()?.type === "+" || currentToken()?.type === "-") {
        const operator = currentToken().type;
        position += 1;
        node = {
          type: "BinaryExpression",
          operator,
          left: node,
          right: parseMultiplyDivide(),
        };
      }

      return node;
    }

    const ast = parseAddSubtract();
    if (position < tokens.length) {
      throw new Error(`Beklenmeyen sembol kaldi: "${tokens[position].value}"`);
    }
    return ast;
  }

  function ensureFinite(value, message) {
    if (!Number.isFinite(value)) {
      throw new Error(message);
    }
    return value;
  }

  function evaluateAst(node, scope) {
    switch (node.type) {
      case "Literal":
        return node.value;
      case "Identifier":
        if (Object.prototype.hasOwnProperty.call(scope, node.name)) {
          return ensureFinite(scope[node.name], `Degisken sayisal degil: ${node.name}`);
        }
        if (Object.prototype.hasOwnProperty.call(CONSTANTS, node.name)) {
          return CONSTANTS[node.name];
        }
        throw new Error(`Bilinmeyen degisken veya sabit: ${node.name}`);
      case "UnaryExpression": {
        const argument = evaluateAst(node.argument, scope);
        return node.operator === "-" ? -argument : argument;
      }
      case "BinaryExpression": {
        const left = evaluateAst(node.left, scope);
        const right = evaluateAst(node.right, scope);

        switch (node.operator) {
          case "+":
            return left + right;
          case "-":
            return left - right;
          case "*":
            return left * right;
          case "/":
            return ensureFinite(left / right, "Sifira bolme veya sayisal tasma olustu.");
          case "^":
            return ensureFinite(Math.pow(left, right), "Us alma islemi gecersiz sonuc uretti.");
          default:
            throw new Error(`Desteklenmeyen operator: ${node.operator}`);
        }
      }
      case "CallExpression": {
        const definition = FUNCTION_DEFINITIONS[node.callee];
        if (!definition) {
          throw new Error(`Izin verilmeyen fonksiyon: ${node.callee}`);
        }

        if (node.arguments.length < definition.minArgs || node.arguments.length > definition.maxArgs) {
          throw new Error(`Fonksiyon arguman sayisi hatali: ${node.callee}`);
        }

        const args = node.arguments.map((argumentNode) => evaluateAst(argumentNode, scope));
        return ensureFinite(definition.fn(...args), `Fonksiyon gecersiz sonuc uretti: ${node.callee}`);
      }
      default:
        throw new Error("Ifade agaci cozumlenemedi.");
    }
  }

  function createExpressionEvaluator(expression) {
    const trimmed = expression.trim();
    if (!trimmed) {
      throw new Error("Formul bos birakilamaz.");
    }

    const ast = parseExpression(tokenize(trimmed));

    return {
      expression: trimmed,
      ast,
      evaluate(scope) {
        const value = evaluateAst(ast, scope);
        return ensureFinite(value, "Formul sonlu bir sayisal deger uretmedi.");
      },
    };
  }

  function buildGuidanceContext({ t, dt, missileState, targetState, geometry, previousCommands, params }) {
    return {
      t,
      dt,
      x_m: missileState.x,
      z_m: missileState.z,
      x_t: targetState.x,
      z_t: targetState.z,
      vx_m: geometry.vx_m,
      vz_m: geometry.vz_m,
      vx_t: geometry.vx_t,
      vz_t: geometry.vz_t,
      V_m: missileState.V,
      V_t: targetState.V,
      gamma_m: missileState.gamma,
      gamma_t: targetState.gamma,
      R: geometry.R,
      Rdot: geometry.Rdot,
      lambda: geometry.lambda,
      lambda_dot: geometry.lambda_dot,
      sigma: geometry.sigma,
      sigma_dot: geometry.sigma_dot,
      closing_velocity: geometry.closing_velocity,
      xz_error: geometry.xz_error,
      yanal_hata: geometry.yanal_hata,
      energy: geometry.energy,
      energy_error: geometry.energy_error,
      az_prev: previousCommands.az_prev,
      az_cmd_prev: previousCommands.az_cmd_prev,
      gamma_cmd_prev: previousCommands.gamma_cmd_prev,
      N: params.N,
      k1: params.k1,
      k2: params.k2,
      g: params.g,
      intercept_radius: params.interceptRadius,
      gamma_tau: params.gammaTau,
    };
  }

  GuidanceSim.guidanceEngine = {
    SUPPORTED_FUNCTIONS,
    SUPPORTED_VARIABLES,
    createExpressionEvaluator,
    buildGuidanceContext,
  };
})();
