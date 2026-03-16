(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});

  const BOOLEAN_EPSILON = 1e-12;
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
    if: { minArgs: 3, maxArgs: 3, lazy: true },
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
    { name: "dx, dz", description: "Bagil konum: hedef eksi fuze [m]" },
    { name: "vrel_x, vrel_z", description: "Bagil hiz bilesenleri [m/s]" },
    { name: "R, Rdot", description: "Menzil ve menzil turevi" },
    { name: "lambda, lambda_dot", description: "LOS acisi ve donus hizi [rad, rad/s]" },
    { name: "sigma, sigma_dot", description: "LOS ile fuze gamma farki [rad, rad/s]" },
    { name: "closing_velocity", description: "Kapanma hizi [m/s]" },
    { name: "xz_error / yanal_hata", description: "Yanal hata metrigi [m]" },
    { name: "energy, energy_error", description: "Ozgul enerji ve hatasi [J/kg]" },
    { name: "az_prev, az_cmd_prev, az_actual_prev", description: "Bir onceki yanal ivme buyuklukleri [m/s^2]" },
    { name: "gamma_cmd_prev, gamma_error_prev", description: "Bir onceki gamma komutu ve hata [rad]" },
    { name: "N, k1, k2", description: "Algoritma ayar parametreleri" },
    { name: "g, intercept_radius, gamma_tau, a_max", description: "Yardimci sabitler" },
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
      const twoChar = expression.slice(index, index + 2);

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

        tokens.push({ type: "number", value, start: index, end });
        index = end;
        continue;
      }

      if (isIdentifierStart(character)) {
        let end = index + 1;
        while (end < expression.length && isIdentifierPart(expression[end])) {
          end += 1;
        }

        tokens.push({ type: "identifier", value: expression.slice(index, end), start: index, end });
        index = end;
        continue;
      }

      if (["<=", ">=", "==", "!=", "&&", "||"].includes(twoChar)) {
        tokens.push({ type: twoChar, value: twoChar, start: index, end: index + 2 });
        index += 2;
        continue;
      }

      if ("+-*/^(),?:!<>".includes(character)) {
        tokens.push({ type: character, value: character, start: index, end: index + 1 });
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
              args.push(parseConditional());
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
        const expressionNode = parseConditional();
        consume(")", "Parantez kapatilmadi.");
        return expressionNode;
      }

      throw new Error(`Beklenmeyen sembol: "${token.value}"`);
    }

    function parseUnary() {
      const token = currentToken();
      if (token?.type === "+" || token?.type === "-" || token?.type === "!") {
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

    function parseComparison() {
      let node = parseAddSubtract();

      while (["<", "<=", ">", ">="].includes(currentToken()?.type)) {
        const operator = currentToken().type;
        position += 1;
        node = {
          type: "BinaryExpression",
          operator,
          left: node,
          right: parseAddSubtract(),
        };
      }

      return node;
    }

    function parseEquality() {
      let node = parseComparison();

      while (currentToken()?.type === "==" || currentToken()?.type === "!=") {
        const operator = currentToken().type;
        position += 1;
        node = {
          type: "BinaryExpression",
          operator,
          left: node,
          right: parseComparison(),
        };
      }

      return node;
    }

    function parseLogicalAnd() {
      let node = parseEquality();

      while (currentToken()?.type === "&&") {
        const operator = currentToken().type;
        position += 1;
        node = {
          type: "BinaryExpression",
          operator,
          left: node,
          right: parseEquality(),
        };
      }

      return node;
    }

    function parseLogicalOr() {
      let node = parseLogicalAnd();

      while (currentToken()?.type === "||") {
        const operator = currentToken().type;
        position += 1;
        node = {
          type: "BinaryExpression",
          operator,
          left: node,
          right: parseLogicalAnd(),
        };
      }

      return node;
    }

    function parseConditional() {
      const test = parseLogicalOr();

      if (currentToken()?.type === "?") {
        consume("?", "Kosullu ifade icin '?' bekleniyordu.");
        const consequent = parseConditional();
        consume(":", "Kosullu ifade icin ':' bekleniyordu.");
        const alternate = parseConditional();
        return {
          type: "ConditionalExpression",
          test,
          consequent,
          alternate,
        };
      }

      return test;
    }

    const ast = parseConditional();
    if (position < tokens.length) {
      throw new Error(`Beklenmeyen sembol kaldi: "${tokens[position].value}"`);
    }
    return ast;
  }

  function ensureFiniteNumber(value, message) {
    if (!Number.isFinite(value)) {
      throw new Error(message);
    }
    return value;
  }

  function isTruthy(value) {
    return Math.abs(Number(value)) > BOOLEAN_EPSILON;
  }

  function booleanToNumber(value) {
    return value ? 1 : 0;
  }

  function evaluateAst(node, scope) {
    switch (node.type) {
      case "Literal":
        return node.value;
      case "Identifier":
        if (Object.prototype.hasOwnProperty.call(scope, node.name)) {
          return ensureFiniteNumber(scope[node.name], `Degisken sayisal degil: ${node.name}`);
        }
        if (Object.prototype.hasOwnProperty.call(CONSTANTS, node.name)) {
          return CONSTANTS[node.name];
        }
        throw new Error(`Bilinmeyen degisken veya sabit: ${node.name}`);
      case "UnaryExpression": {
        const argument = evaluateAst(node.argument, scope);
        switch (node.operator) {
          case "+":
            return argument;
          case "-":
            return -argument;
          case "!":
            return booleanToNumber(!isTruthy(argument));
          default:
            throw new Error(`Desteklenmeyen unary operator: ${node.operator}`);
        }
      }
      case "BinaryExpression": {
        if (node.operator === "&&") {
          const left = evaluateAst(node.left, scope);
          if (!isTruthy(left)) {
            return 0;
          }
          return booleanToNumber(isTruthy(evaluateAst(node.right, scope)));
        }

        if (node.operator === "||") {
          const left = evaluateAst(node.left, scope);
          if (isTruthy(left)) {
            return 1;
          }
          return booleanToNumber(isTruthy(evaluateAst(node.right, scope)));
        }

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
            return ensureFiniteNumber(left / right, "Sifira bolme veya sayisal tasma olustu.");
          case "^":
            return ensureFiniteNumber(Math.pow(left, right), "Us alma islemi gecersiz sonuc uretti.");
          case "<":
            return booleanToNumber(left < right);
          case "<=":
            return booleanToNumber(left <= right);
          case ">":
            return booleanToNumber(left > right);
          case ">=":
            return booleanToNumber(left >= right);
          case "==":
            return booleanToNumber(left === right);
          case "!=":
            return booleanToNumber(left !== right);
          default:
            throw new Error(`Desteklenmeyen operator: ${node.operator}`);
        }
      }
      case "ConditionalExpression": {
        const test = evaluateAst(node.test, scope);
        return isTruthy(test)
          ? evaluateAst(node.consequent, scope)
          : evaluateAst(node.alternate, scope);
      }
      case "CallExpression": {
        const definition = FUNCTION_DEFINITIONS[node.callee];
        if (!definition) {
          throw new Error(`Izin verilmeyen fonksiyon: ${node.callee}`);
        }

        if (node.arguments.length < definition.minArgs || node.arguments.length > definition.maxArgs) {
          throw new Error(`Fonksiyon arguman sayisi hatali: ${node.callee}`);
        }

        if (definition.lazy && node.callee === "if") {
          const condition = evaluateAst(node.arguments[0], scope);
          const selectedBranch = isTruthy(condition) ? node.arguments[1] : node.arguments[2];
          return ensureFiniteNumber(
            evaluateAst(selectedBranch, scope),
            "if() secilen dalda sonlu bir sayisal deger uretmedi.",
          );
        }

        const args = node.arguments.map((argumentNode) => evaluateAst(argumentNode, scope));
        return ensureFiniteNumber(definition.fn(...args), `Fonksiyon gecersiz sonuc uretti: ${node.callee}`);
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
        return ensureFiniteNumber(value, "Formul sonlu bir sayisal deger uretmedi.");
      },
    };
  }

  function buildGuidanceContext({ time, dt, state, derived, previousControl, params }) {
    return {
      t: time,
      dt,
      x_m: state.missile.x,
      z_m: state.missile.z,
      x_t: state.target.x,
      z_t: state.target.z,
      vx_m: derived.vx_m,
      vz_m: derived.vz_m,
      vx_t: derived.vx_t,
      vz_t: derived.vz_t,
      V_m: state.missile.V,
      V_t: state.target.V,
      gamma_m: state.missile.gamma,
      gamma_t: state.target.gamma,
      dx: derived.dx,
      dz: derived.dz,
      vrel_x: derived.vrel_x,
      vrel_z: derived.vrel_z,
      R: derived.R,
      Rdot: derived.Rdot,
      lambda: derived.lambda,
      lambda_dot: derived.lambda_dot,
      sigma: derived.sigma,
      sigma_dot: derived.sigma_dot,
      closing_velocity: derived.closing_velocity,
      xz_error: derived.xz_error,
      yanal_hata: derived.yanal_hata,
      energy: derived.energy,
      energy_error: derived.energy_error,
      az_prev: previousControl.az_cmd,
      az_cmd_prev: previousControl.az_cmd,
      az_actual_prev: previousControl.az_actual,
      gamma_cmd_prev: previousControl.gamma_cmd,
      gamma_error_prev: previousControl.gamma_error,
      N: params.guidance.N,
      k1: params.guidance.k1,
      k2: params.guidance.k2,
      g: params.sim.g,
      intercept_radius: params.sim.interceptRadius,
      gamma_tau: params.missile.gammaTau,
      a_max: params.missile.maxAccel,
    };
  }

  GuidanceSim.guidanceEngine = {
    SUPPORTED_FUNCTIONS,
    SUPPORTED_VARIABLES,
    tokenize,
    createExpressionEvaluator,
    buildGuidanceContext,
  };
})();
