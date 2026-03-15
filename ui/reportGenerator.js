(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});
  const { formatNumber } = GuidanceSim.utils.math || {};

  const PAGE_WIDTH = 1240;
  const PAGE_HEIGHT = 1754;
  const PAGE_MARGIN_X = 92;
  const PAGE_MARGIN_Y = 92;
  const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN_X * 2;
  const COLORS = {
    page: "#f6f8fa",
    surface: "#ffffff",
    surfaceAlt: "#eef3f1",
    ink: "#15211b",
    inkSoft: "#43534b",
    inkMuted: "#64736c",
    accent: "#0b7a53",
    accentSoft: "#d8efe6",
    line: "#d6dfda",
    lineStrong: "#9ab3a7",
    success: "#0b7a53",
    warning: "#9d6b00",
    danger: "#b33a3a",
  };

  function sanitizeFilePart(value) {
    return String(value ?? "rapor")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "rapor";
  }

  function formatMetric(value, digits = 2, unit = "", fallback = "-") {
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return `${formatNumber ? formatNumber(value, digits) : value.toFixed(digits)}${unit}`;
  }

  function createPageCanvas() {
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = COLORS.page;
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    ctx.imageSmoothingEnabled = true;
    return { canvas, ctx };
  }

  function drawRect(ctx, x, y, width, height, options = {}) {
    const {
      fill = COLORS.surface,
      stroke = COLORS.line,
      lineWidth = 1,
    } = options;

    ctx.save();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, width, height);
    }
    if (stroke && lineWidth > 0) {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = stroke;
      ctx.strokeRect(x, y, width, height);
    }
    ctx.restore();
  }

  function drawPageChrome(ctx, pageNumber, totalPages) {
    ctx.save();
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, 0, PAGE_WIDTH, 38);

    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(PAGE_MARGIN_X, 58, 170, 6);

    ctx.fillStyle = COLORS.inkMuted;
    ctx.font = "500 20px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`Sayfa ${pageNumber} / ${totalPages}`, PAGE_WIDTH - PAGE_MARGIN_X, 74);

    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAGE_MARGIN_X, PAGE_HEIGHT - 58);
    ctx.lineTo(PAGE_WIDTH - PAGE_MARGIN_X, PAGE_HEIGHT - 58);
    ctx.stroke();

    ctx.fillStyle = COLORS.inkMuted;
    ctx.font = "500 18px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("2B Güdüm ve Angajman Simülasyon Raporu", PAGE_MARGIN_X, PAGE_HEIGHT - 24);
    ctx.restore();
  }

  function wrapLines(ctx, text, maxWidth) {
    const raw = String(text ?? "").split(/\n+/);
    const lines = [];

    raw.forEach((block) => {
      const words = block.split(/\s+/).filter(Boolean);
      if (!words.length) {
        lines.push("");
        return;
      }

      let current = words.shift();
      words.forEach((word) => {
        const candidate = `${current} ${word}`;
        if (ctx.measureText(candidate).width <= maxWidth) {
          current = candidate;
        } else {
          lines.push(current);
          current = word;
        }
      });
      lines.push(current);
    });

    return lines;
  }

  function drawParagraph(ctx, text, x, y, maxWidth, options = {}) {
    const {
      color = COLORS.inkSoft,
      font = "400 24px 'Segoe UI', Arial, sans-serif",
      lineHeight = 36,
    } = options;

    ctx.save();
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const lines = wrapLines(ctx, text, maxWidth);
    lines.forEach((line, index) => {
      ctx.fillText(line, x, y + index * lineHeight);
    });
    ctx.restore();
    return y + lines.length * lineHeight;
  }

  function drawSectionTitle(ctx, kicker, title, x, y, width) {
    ctx.save();
    ctx.fillStyle = COLORS.accent;
    ctx.font = "700 18px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(kicker, x, y);
    ctx.restore();

    const titleY = y + 28;
    drawParagraph(ctx, title, x, titleY, width, {
      color: COLORS.ink,
      font: "700 38px 'Segoe UI', Arial, sans-serif",
      lineHeight: 46,
    });

    ctx.save();
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(x, titleY + 56, 84, 5);
    ctx.restore();
    return titleY + 78;
  }

  function drawKeyValueRows(ctx, entries, x, y, width, options = {}) {
    const {
      columns = 2,
      rowHeight = 66,
      labelColor = COLORS.inkMuted,
      valueColor = COLORS.ink,
      fill = COLORS.surface,
      stroke = COLORS.line,
    } = options;
    const gap = 16;
    const colWidth = (width - gap * (columns - 1)) / columns;

    entries.forEach((entry, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const left = x + column * (colWidth + gap);
      const top = y + row * (rowHeight + gap);

      drawRect(ctx, left, top, colWidth, rowHeight, { fill, stroke });

      ctx.save();
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillStyle = labelColor;
      ctx.font = "600 16px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(entry.label, left + 18, top + 14);
      ctx.fillStyle = valueColor;
      ctx.font = "700 24px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(entry.value, left + 18, top + 34);
      ctx.restore();
    });

    return y + Math.ceil(entries.length / columns) * (rowHeight + gap) - gap;
  }

  function drawMetricCards(ctx, entries, x, y, width) {
    const gap = 16;
    const cardWidth = (width - gap * (entries.length - 1)) / entries.length;

    entries.forEach((entry, index) => {
      const left = x + index * (cardWidth + gap);
      drawRect(ctx, left, y, cardWidth, 128, {
        fill: entry.fill || COLORS.surface,
        stroke: entry.stroke || COLORS.line,
        lineWidth: 1.5,
      });

      ctx.save();
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillStyle = COLORS.inkMuted;
      ctx.font = "600 16px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(entry.label, left + 18, y + 18);
      ctx.fillStyle = entry.valueColor || COLORS.ink;
      ctx.font = "700 34px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(entry.value, left + 18, y + 50);
      if (entry.note) {
        ctx.fillStyle = COLORS.inkSoft;
        ctx.font = "500 15px 'Segoe UI', Arial, sans-serif";
        ctx.fillText(entry.note, left + 18, y + 92);
      }
      ctx.restore();
    });

    return y + 128;
  }

  function drawFormulaBox(ctx, title, expression, x, y, width) {
    const padding = 22;
    ctx.save();
    ctx.font = "600 16px Consolas, 'Lucida Console', monospace";
    const lines = wrapLines(ctx, expression || "-", width - padding * 2);
    ctx.restore();

    const height = 86 + lines.length * 28;
    drawRect(ctx, x, y, width, height, {
      fill: COLORS.surface,
      stroke: COLORS.lineStrong,
      lineWidth: 1.2,
    });

    drawParagraph(ctx, title, x + padding, y + 18, width - padding * 2, {
      color: COLORS.ink,
      font: "700 22px 'Segoe UI', Arial, sans-serif",
      lineHeight: 30,
    });
    drawParagraph(ctx, expression || "-", x + padding, y + 52, width - padding * 2, {
      color: COLORS.ink,
      font: "600 18px Consolas, 'Lucida Console', monospace",
      lineHeight: 28,
    });

    return y + height;
  }

  function drawBulletBox(ctx, title, items, x, y, width) {
    const padding = 22;
    ctx.save();
    ctx.font = "400 21px 'Segoe UI', Arial, sans-serif";
    const bodyHeight = items.reduce((total, item) => {
      const lines = wrapLines(ctx, item, width - padding * 2 - 22);
      return total + lines.length * 30 + 10;
    }, 0);
    ctx.restore();

    const height = Math.max(232, 74 + bodyHeight + 16);
    drawRect(ctx, x, y, width, height, {
      fill: COLORS.surface,
      stroke: COLORS.line,
    });
    drawParagraph(ctx, title, x + padding, y + padding, width - padding * 2, {
      color: COLORS.ink,
      font: "700 24px 'Segoe UI', Arial, sans-serif",
      lineHeight: 30,
    });

    let cursorY = y + 62;
    items.forEach((item) => {
      ctx.save();
      ctx.fillStyle = COLORS.accent;
      ctx.fillRect(x + padding, cursorY + 10, 10, 10);
      ctx.restore();
      cursorY = drawParagraph(ctx, item, x + padding + 22, cursorY, width - padding * 2 - 22, {
        color: COLORS.inkSoft,
        font: "400 21px 'Segoe UI', Arial, sans-serif",
        lineHeight: 30,
      }) + 10;
    });

    return Math.max(cursorY + 12, y + height);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Rapor görseli yüklenemedi."));
      image.src = src;
    });
  }

  function getOutcomeColor(kind) {
    if (kind === "success") {
      return COLORS.success;
    }
    if (kind === "error") {
      return COLORS.danger;
    }
    return COLORS.warning;
  }

  function buildSummaryCards(result) {
    return [
      {
        label: "Simülasyon sonucu",
        value: result?.outcome?.label || "-",
        note: result?.outcome?.message || "-",
        fill: COLORS.surface,
        stroke: getOutcomeColor(result?.outcome?.kind),
        valueColor: getOutcomeColor(result?.outcome?.kind),
      },
      {
        label: "Önleme / minimum sapma",
        value: `${formatMetric(result?.stats?.minMissDistance, 2, " m")}`,
        note: result?.stats?.interceptTime == null
          ? "Önleme zamanı oluşmadı"
          : `Önleme zamanı ${formatMetric(result.stats.interceptTime, 2, " s")}`,
      },
      {
        label: "Terminal durum",
        value: `${formatMetric(result?.stats?.terminalSpeed, 2, " m/s")}`,
        note: `Gamma ${formatMetric(result?.stats?.terminalGammaDeg, 2, "°")}`,
      },
    ];
  }

  function buildExecutiveRows(result, rawValues, expression, activeExample) {
    return [
      { label: "Algoritma", value: activeExample?.title || activeExample?.id || "Kullanıcı tanımlı" },
      { label: "Çıktı modu", value: rawValues.outputMode || "-" },
      { label: "Örnek sayısı", value: String(result?.stats?.sampleCount ?? "-") },
      { label: "Bitiş zamanı", value: formatMetric(result?.stats?.finalTime, 2, " s") },
      { label: "Tepe yanal ivme", value: formatMetric(result?.stats?.peakAz, 2, " m/s²") },
      { label: "Tepe lambda_dot", value: formatMetric(result?.stats?.peakLambdaDotDeg, 2, " °/s") },
      { label: "Rapor zamanı", value: new Date().toLocaleString("tr-TR") },
    ];
  }

  function buildParameterRows(rawValues) {
    return [
      { label: "Füze başlangıç x", value: formatMetric(rawValues.missileX, 2, " m") },
      { label: "Füze başlangıç z", value: formatMetric(rawValues.missileZ, 2, " m") },
      { label: "Füze hız", value: formatMetric(rawValues.missileSpeed, 2, " m/s") },
      { label: "Füze gamma", value: formatMetric(rawValues.missileGammaDeg, 2, " °") },
      { label: "Hedef başlangıç x", value: formatMetric(rawValues.targetX, 2, " m") },
      { label: "Hedef başlangıç z", value: formatMetric(rawValues.targetZ, 2, " m") },
      { label: "Hedef hız", value: formatMetric(rawValues.targetSpeed, 2, " m/s") },
      { label: "Hedef gamma", value: formatMetric(rawValues.targetGammaDeg, 2, " °") },
      { label: "Zaman adımı dt", value: formatMetric(rawValues.dt, 3, " s") },
      { label: "Maksimum süre", value: formatMetric(rawValues.tMax, 2, " s") },
      { label: "Önleme yarıçapı", value: formatMetric(rawValues.interceptRadius, 2, " m") },
      { label: "Azami ivme", value: formatMetric(rawValues.maxAccel, 2, " m/s²") },
      { label: "Hız modeli", value: rawValues.speedModel === "energy" ? "Basit enerji modeli" : "Sabit hız" },
      { label: "Hedef hareket modeli", value: rawValues.targetMotionModel || "-" },
      { label: "Gamma tau", value: formatMetric(rawValues.gammaTau, 2, " s") },
      { label: "Gamma limit", value: formatMetric(rawValues.gammaCmdLimitDeg, 2, " °") },
      { label: "Gamma hız limiti", value: formatMetric(rawValues.gammaCmdRateLimitDeg, 2, " °/s") },
      { label: "Navigasyon sabiti N", value: formatMetric(rawValues.N, 2, "") },
      { label: "k1", value: formatMetric(rawValues.k1, 3, "") },
      { label: "k2", value: formatMetric(rawValues.k2, 3, "") },
      { label: "İtki T", value: formatMetric(rawValues.thrust, 2, " N") },
      { label: "Kütle m", value: formatMetric(rawValues.missileMass, 2, " kg") },
      { label: "Referans alan S", value: formatMetric(rawValues.referenceArea, 4, " m²") },
      { label: "Sürükleme katsayısı Cd", value: formatMetric(rawValues.dragCoeff, 3, "") },
    ];
  }

  function buildMathRows(rawValues) {
    const controlLine = rawValues.outputMode === "gamma_demand"
      ? "gamma_dot = (gamma_cmd - gamma_m) / tau_gamma"
      : "gamma_dot = az_cmd / V_m, az_cmd = saturate(formül, -a_max, +a_max)";

    return [
      "Göreli geometri: dx = x_t - x_m, dz = z_t - z_m, R = sqrt(dx² + dz²), lambda = atan2(dz, dx)",
      "Bağıl hız: v_rel = [vx_t - vx_m, vz_t - vz_m], Rdot = (dx*v_rel_x + dz*v_rel_z) / R",
      "LOS dönüş hızı: lambda_dot = (dx*v_rel_z - dz*v_rel_x) / R², closing_velocity = -Rdot",
      "Açı farkı: sigma = wrapAngle(lambda - gamma_m)",
      `Kontrol çevrimi: ${controlLine}`,
      "Enerji modeli açık ise: Vdot = (T - D) / m - g*sin(gamma_m), D = 0.5*rho*V²*S*Cd",
    ];
  }

  function renderTrajectoryFigure(result) {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 940;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const samples = result.samples || [];
    if (!samples.length) {
      return canvas.toDataURL("image/png");
    }

    const xs = samples.flatMap((sample) => [sample.x_m, sample.x_t]);
    const zs = samples.flatMap((sample) => [sample.z_m, sample.z_t]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(0, ...zs);
    const maxZ = Math.max(...zs);
    const padding = { left: 120, right: 72, top: 74, bottom: 110 };
    const plotWidth = canvas.width - padding.left - padding.right;
    const plotHeight = canvas.height - padding.top - padding.bottom;
    const spanX = Math.max(maxX - minX, 100);
    const spanZ = Math.max(maxZ - minZ, 100);
    const scale = Math.min(plotWidth / spanX, plotHeight / spanZ);
    const offsetX = padding.left + (plotWidth - spanX * scale) / 2;
    const offsetY = padding.top + (plotHeight - spanZ * scale) / 2;

    const worldToScreen = (x, z) => ({
      x: offsetX + (x - minX) * scale,
      y: canvas.height - offsetY - (z - minZ) * scale,
    });

    ctx.strokeStyle = "#d6dfda";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i += 1) {
      const y = padding.top + (plotHeight / 8) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvas.width - padding.right, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 10; i += 1) {
      const x = padding.left + (plotWidth / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, canvas.height - padding.bottom);
      ctx.stroke();
    }

    ctx.strokeStyle = "#202926";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(padding.left, canvas.height - padding.bottom);
    ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, canvas.height - padding.bottom);
    ctx.stroke();

    ctx.fillStyle = COLORS.inkMuted;
    ctx.font = "500 20px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("x [m]", canvas.width - padding.right - 48, canvas.height - padding.bottom + 48);
    ctx.save();
    ctx.translate(44, padding.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("z [m]", 0, 0);
    ctx.restore();

    const drawPath = (color, accessorX, accessorZ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      samples.forEach((sample, index) => {
        const point = worldToScreen(accessorX(sample), accessorZ(sample));
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();
    };

    drawPath("#087f5b", (sample) => sample.x_m, (sample) => sample.z_m);
    drawPath("#d08a00", (sample) => sample.x_t, (sample) => sample.z_t);

    const last = samples.at(-1);
    const missilePoint = worldToScreen(last.x_m, last.z_m);
    const targetPoint = worldToScreen(last.x_t, last.z_t);

    ctx.strokeStyle = "#2d4f8b";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(missilePoint.x, missilePoint.y);
    ctx.lineTo(targetPoint.x, targetPoint.y);
    ctx.stroke();
    ctx.setLineDash([]);

    [
      { point: missilePoint, fill: "#087f5b", label: "Füze" },
      { point: targetPoint, fill: "#d08a00", label: "Hedef" },
    ].forEach(({ point, fill, label }) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.ink;
      ctx.font = "700 20px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(label, point.x + 14, point.y - 16);
    });

    ctx.fillStyle = COLORS.ink;
    ctx.font = "700 30px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("2B angajman ve yörünge görünümü", padding.left, 38);
    ctx.fillStyle = COLORS.inkMuted;
    ctx.font = "500 20px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("Füze izi yeşil, hedef izi altın, son LOS bağlantısı mavi kesik çizgi ile gösterilir.", padding.left, 72);

    return canvas.toDataURL("image/png");
  }

  function drawCoverPage(ctx, data, pageNumber, totalPages) {
    drawPageChrome(ctx, pageNumber, totalPages);
    let cursorY = drawSectionTitle(
      ctx,
      "YÖNETİCİ ÖZETİ",
      "2B güdüm ve angajman simülasyonu sonuç raporu",
      PAGE_MARGIN_X,
      112,
      CONTENT_WIDTH,
    );

    cursorY = drawParagraph(
      ctx,
      "Bu rapor, seçilen güdüm formülünün point-mass füze ve hareketli hedef üzerindeki etkisini; sonuç özeti, matematiksel yapı, yörünge görünümü ve zaman serileri ile birlikte sunar.",
      PAGE_MARGIN_X,
      cursorY + 8,
      CONTENT_WIDTH,
      { font: "400 24px 'Segoe UI', Arial, sans-serif", lineHeight: 36 },
    );

    cursorY = drawMetricCards(ctx, buildSummaryCards(data.result), PAGE_MARGIN_X, cursorY + 32, CONTENT_WIDTH);
    const metaBottom = drawKeyValueRows(ctx, buildExecutiveRows(data.result, data.rawValues, data.expression, data.activeExample), PAGE_MARGIN_X, cursorY + 28, CONTENT_WIDTH, {
      columns: 2,
      rowHeight: 82,
      valueColor: COLORS.ink,
    });
    drawFormulaBox(ctx, "Kullanılan güdüm formülü", data.expression, PAGE_MARGIN_X, metaBottom + 24, CONTENT_WIDTH);
  }

  function drawModelPage(ctx, data, pageNumber, totalPages) {
    drawPageChrome(ctx, pageNumber, totalPages);
    let cursorY = drawSectionTitle(
      ctx,
      "MODEL VE VARSAYIMLAR",
      "Matematiksel çerçeve ve simülasyon girdileri",
      PAGE_MARGIN_X,
      112,
      CONTENT_WIDTH,
    );

    const leftWidth = (CONTENT_WIDTH - 24) * 0.57;
    const rightWidth = CONTENT_WIDTH - leftWidth - 24;
    const leftX = PAGE_MARGIN_X;
    const rightX = leftX + leftWidth + 24;

    const mathBottom = drawBulletBox(ctx, "Matematiksel model", buildMathRows(data.rawValues), leftX, cursorY + 12, leftWidth);
    const infoBottom = drawBulletBox(ctx, "Yorum ve kullanım notları", [
      "Tüm iç hesaplamalar SI birimleriyle ve radyan cinsinden yürütülür; kullanıcı arayüzünde açı girişleri derece olarak alınır.",
      "Güdüm formülü güvenli ifade ayrıştırıcısı ile değerlendirilir ve yalnızca izinli değişkenler ile fonksiyonlar kullanılabilir.",
      "Çıktı modu az_demand ise formül doğrudan yanal ivme komutu üretir; gamma_demand modunda ise komut, birinci dereceden takip dinamiğine gönderilir.",
      "Enerji modeli seçili olduğunda rapordaki V_m ve Vdot eğrileri itki-sürükleme-denge etkisini içerir.",
    ], rightX, cursorY + 12, rightWidth);

    const parameterY = Math.max(mathBottom, infoBottom) + 26;
    drawParagraph(ctx, "Giriş parametreleri", PAGE_MARGIN_X, parameterY, CONTENT_WIDTH, {
      color: COLORS.ink,
      font: "700 28px 'Segoe UI', Arial, sans-serif",
      lineHeight: 34,
    });
    drawKeyValueRows(ctx, buildParameterRows(data.rawValues), PAGE_MARGIN_X, parameterY + 44, CONTENT_WIDTH, {
      columns: 2,
      rowHeight: 70,
      fill: COLORS.surface,
    });
  }

  async function drawTrajectoryPage(ctx, data, pageNumber, totalPages) {
    drawPageChrome(ctx, pageNumber, totalPages);
    drawSectionTitle(
      ctx,
      "GÖRSEL ANALİZ",
      "Nihai 2B yörünge ve kapanış geometrisi",
      PAGE_MARGIN_X,
      112,
      CONTENT_WIDTH,
    );

    const trajectoryImage = await loadImage(data.trajectoryDataUrl);
    drawRect(ctx, PAGE_MARGIN_X, 210, CONTENT_WIDTH, 920, {
      fill: COLORS.surface,
      stroke: COLORS.lineStrong,
      lineWidth: 1.2,
    });
    ctx.drawImage(trajectoryImage, PAGE_MARGIN_X + 22, 232, CONTENT_WIDTH - 44, 876);

    drawRect(ctx, PAGE_MARGIN_X, 1164, CONTENT_WIDTH, 280, {
      fill: COLORS.surface,
      stroke: COLORS.line,
    });
    drawParagraph(ctx, "Yörünge yorumu", PAGE_MARGIN_X + 24, 1188, CONTENT_WIDTH - 48, {
      color: COLORS.ink,
      font: "700 28px 'Segoe UI', Arial, sans-serif",
      lineHeight: 34,
    });
    drawParagraph(
      ctx,
      [
        `Son durum: ${data.result?.outcome?.label || "-"}.`,
        `Minimum sapma ${formatMetric(data.result?.stats?.minMissDistance, 2, " m")} seviyesindedir.`,
        `Terminal hız ${formatMetric(data.result?.stats?.terminalSpeed, 2, " m/s")} ve terminal gamma ${formatMetric(data.result?.stats?.terminalGammaDeg, 2, " °")} olarak hesaplanmıştır.`,
        "Sağdaki zaman grafikleri, bu nihai geometriye götüren komut ve durum evrimini sayfa sayfa gösterir.",
      ].join(" "),
      PAGE_MARGIN_X + 24,
      1230,
      CONTENT_WIDTH - 48,
      { font: "400 23px 'Segoe UI', Arial, sans-serif", lineHeight: 34 },
    );
  }

  async function drawChartPage(ctx, charts, pageNumber, totalPages) {
    drawPageChrome(ctx, pageNumber, totalPages);
    drawSectionTitle(
      ctx,
      "ZAMAN SERİLERİ",
      "Komut, durum ve geometri eğrileri",
      PAGE_MARGIN_X,
      112,
      CONTENT_WIDTH,
    );

    const cardHeight = 600;
    let top = 210;

    for (const chart of charts) {
      drawRect(ctx, PAGE_MARGIN_X, top, CONTENT_WIDTH, cardHeight, {
        fill: COLORS.surface,
        stroke: COLORS.line,
      });

      drawParagraph(ctx, chart.title, PAGE_MARGIN_X + 24, top + 22, CONTENT_WIDTH - 48, {
        color: COLORS.ink,
        font: "700 28px 'Segoe UI', Arial, sans-serif",
        lineHeight: 34,
      });
      drawParagraph(ctx, `${chart.subtitle} [${chart.unit}]`, PAGE_MARGIN_X + 24, top + 62, CONTENT_WIDTH - 48, {
        color: COLORS.inkMuted,
        font: "500 19px 'Segoe UI', Arial, sans-serif",
        lineHeight: 26,
      });

      const image = await loadImage(chart.dataUrl);
      ctx.drawImage(image, PAGE_MARGIN_X + 18, top + 104, CONTENT_WIDTH - 36, 458);
      top += cardHeight + 28;
    }
  }

  async function buildReportPages(data, setStatus) {
    const charts = data.chartFigures || [];
    const totalPages = 3 + Math.ceil(charts.length / 2);
    const pages = [];

    setStatus("Kapak sayfası hazırlanıyor...");
    {
      const { canvas, ctx } = createPageCanvas();
      drawCoverPage(ctx, data, 1, totalPages);
      pages.push(canvas);
    }

    setStatus("Matematiksel model ve parametre sayfası hazırlanıyor...");
    {
      const { canvas, ctx } = createPageCanvas();
      drawModelPage(ctx, data, 2, totalPages);
      pages.push(canvas);
    }

    setStatus("2B yörünge sayfası hazırlanıyor...");
    {
      const { canvas, ctx } = createPageCanvas();
      await drawTrajectoryPage(ctx, data, 3, totalPages);
      pages.push(canvas);
    }

    let pageNumber = 4;
    for (let index = 0; index < charts.length; index += 2) {
      setStatus(`Grafik sayfası hazırlanıyor (${pageNumber}/${totalPages})...`);
      const chunk = charts.slice(index, index + 2);
      const { canvas, ctx } = createPageCanvas();
      await drawChartPage(ctx, chunk, pageNumber, totalPages);
      pages.push(canvas);
      pageNumber += 1;
    }

    return pages;
  }

  class ReportGenerator {
    constructor(options = {}) {
      this.button = options.button;
      this.plotManager = options.plotManager;
      this.getSimulationResult = options.getSimulationResult || (() => null);
      this.getRawValues = options.getRawValues || (() => ({}));
      this.getExpression = options.getExpression || (() => "");
      this.getActiveExample = options.getActiveExample || (() => null);
      this.busy = false;
      this.buildOverlay();
      this.button?.addEventListener("click", () => this.handleGenerate());
    }

    buildOverlay() {
      const overlay = document.createElement("div");
      overlay.className = "report-overlay is-hidden";
      overlay.innerHTML = `
        <div class="report-card">
          <div class="report-head">
            <div class="report-title-wrap">
              <p class="report-badge">PDF RAPOR</p>
              <h2>Rapor Oluşturma</h2>
            </div>
            <button type="button" class="report-close" aria-label="Rapor penceresini kapat">X</button>
          </div>
          <p class="report-status"></p>
          <pre class="report-log is-hidden"></pre>
          <div class="report-actions">
            <span></span>
            <button type="button" class="primary report-close">Kapat</button>
          </div>
        </div>
      `;
      document.body.append(overlay);

      this.overlay = overlay;
      this.statusEl = overlay.querySelector(".report-status");
      this.logEl = overlay.querySelector(".report-log");
      overlay.querySelectorAll(".report-close").forEach((button) => {
        button.addEventListener("click", () => {
          if (!this.busy) {
            this.close();
          }
        });
      });
    }

    open() {
      this.overlay?.classList.remove("is-hidden");
    }

    close() {
      this.overlay?.classList.add("is-hidden");
    }

    setBusy(isBusy) {
      this.busy = isBusy;
      if (this.button) {
        this.button.disabled = isBusy;
      }
      this.overlay?.querySelectorAll(".report-close").forEach((button) => {
        button.disabled = isBusy;
      });
    }

    updateStatus(message, options = {}) {
      if (!this.statusEl) {
        return;
      }
      this.statusEl.textContent = message;
      this.statusEl.classList.toggle("is-error", Boolean(options.isError));
      if (options.log) {
        this.logEl.textContent = options.log;
        this.logEl.classList.remove("is-hidden");
      } else {
        this.logEl.textContent = "";
        this.logEl.classList.add("is-hidden");
      }
    }

    async handleGenerate() {
      const result = this.getSimulationResult();
      if (!result?.samples?.length) {
        this.open();
        this.updateStatus("Rapor için önce geçerli bir simülasyon çalıştırılmalıdır.", { isError: true });
        return;
      }

      const jsPdfApi = window.jspdf?.jsPDF;
      if (!jsPdfApi) {
        this.open();
        this.updateStatus("jsPDF yüklenemediği için rapor üretilemedi.", { isError: true });
        return;
      }

      this.open();
      this.setBusy(true);

      try {
        this.updateStatus("Yörünge ve grafik görselleri hazırlanıyor...");
        const rawValues = this.getRawValues() || {};
        const expression = this.getExpression() || "";
        const activeExample = this.getActiveExample?.() || null;
        const trajectoryDataUrl = renderTrajectoryFigure(result);
        const chartFigures = this.plotManager?.createReportFigures(result, rawValues) || [];

        const pages = await buildReportPages({
          result,
          rawValues,
          expression,
          activeExample,
          trajectoryDataUrl,
          chartFigures,
        }, (message) => this.updateStatus(message));

        this.updateStatus("PDF dosyası derleniyor...");
        const doc = new jsPdfApi({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
          compress: true,
        });

        pages.forEach((pageCanvas, index) => {
          if (index > 0) {
            doc.addPage();
          }
          doc.addImage(pageCanvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
        });

        const fileStem = sanitizeFilePart(activeExample?.title || activeExample?.id || "simulasyon-raporu");
        this.updateStatus("İndirme başlatılıyor...");
        doc.save(`${fileStem}-raporu.pdf`);
        this.updateStatus("Rapor başarıyla oluşturuldu ve indirme başlatıldı.");
      } catch (error) {
        console.error(error);
        this.updateStatus(`Rapor oluşturulamadı: ${error.message}`, {
          isError: true,
          log: error.stack || String(error),
        });
      } finally {
        this.setBusy(false);
      }
    }
  }

  GuidanceSim.ui = GuidanceSim.ui || {};
  GuidanceSim.ui.ReportGenerator = ReportGenerator;
})();
