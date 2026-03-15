(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});
  const { clamp, formatNumber, niceStep } = GuidanceSim.utils.math;

  function getCssVar(name, fallback) {
    const value = window.getComputedStyle(document.body || document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  class Scene2D {
    constructor(root) {
      this.root = root;
      this.canvas = document.getElementById("sceneCanvas");
      this.ctx = this.canvas.getContext("2d");
      this.summaryEl = document.getElementById("sceneSummary");
      this.telemetry = {
        time: document.getElementById("telemetryTime"),
        range: document.getElementById("telemetryRange"),
        lambda: document.getElementById("telemetryLambda"),
        speed: document.getElementById("telemetrySpeed"),
        gamma: document.getElementById("telemetryGamma"),
        az: document.getElementById("telemetryAz"),
      };
      this.resultStats = {
        minMiss: document.getElementById("resultMinMiss"),
        interceptTime: document.getElementById("resultInterceptTime"),
        terminalSpeed: document.getElementById("resultTerminalSpeed"),
        terminalGamma: document.getElementById("resultTerminalGamma"),
        peakAz: document.getElementById("resultPeakAz"),
        peakLambdaDot: document.getElementById("resultPeakLambdaDot"),
      };
      this.playButtons = {
        start: document.getElementById("sceneStartBtn"),
        pause: document.getElementById("scenePauseBtn"),
        resume: document.getElementById("sceneResumeBtn"),
        restart: document.getElementById("sceneRestartBtn"),
      };

      this.frames = [];
      this.result = null;
      this.options = { showLos: true, traceEnabled: true };
      this.playhead = 0;
      this.playing = false;
      this.playbackClock = 0;
      this.playbackRate = 6;
      this.lastAnimationTime = null;
      this.lastTelemetryTime = 0;
      this.dragging = false;
      this.lastPointer = { x: 0, y: 0 };
      this.view = {
        centerX: 0,
        centerZ: 0,
        scale: 0.08,
        autoFit: true,
      };
      this.renderBudget = {
        maxTrailPoints: 1400,
        telemetryIntervalMs: 80,
      };
      this.pendingResizeFrame = null;

      if (window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(this.canvas);
        if (this.canvas.parentElement) {
          this.resizeObserver.observe(this.canvas.parentElement);
        }
        if (this.root) {
          this.resizeObserver.observe(this.root);
        }
      } else {
        window.addEventListener("resize", () => this.handleResize());
      }

      this.bindCanvasInteraction();
      this.handleResize();
    }

    bindControls(handlers) {
      this.playButtons.start.addEventListener("click", handlers.onStart);
      this.playButtons.pause.addEventListener("click", handlers.onPause);
      this.playButtons.resume.addEventListener("click", handlers.onResume);
      this.playButtons.restart.addEventListener("click", handlers.onRestart);
    }

    setRunEnabled(isEnabled) {
      this.playButtons.start.disabled = !isEnabled;
    }

    isPlaying() {
      return this.playing;
    }

    getPlaybackState() {
      return {
        playhead: this.playhead,
        playbackClock: this.playbackClock,
        playing: this.playing,
      };
    }

    getPalette() {
      return {
        background: getCssVar("--canvas-bg", "#031008"),
        empty: getCssVar("--scene-empty", "rgba(220, 255, 230, 0.75)"),
        grid: getCssVar("--scene-grid", "rgba(98, 255, 144, 0.1)"),
        gridText: getCssVar("--scene-grid-text", "rgba(188, 255, 208, 0.8)"),
        axis: getCssVar("--scene-axis", "rgba(99, 255, 141, 0.45)"),
        axisText: getCssVar("--scene-axis-text", "rgba(220, 255, 230, 0.92)"),
        scaleBg: getCssVar("--scene-scale-bg", "rgba(4, 11, 20, 0.78)"),
        scaleBorder: getCssVar("--scene-scale-border", "rgba(99, 255, 141, 0.28)"),
        scaleText: getCssVar("--scene-scale-text", "rgba(220, 255, 230, 0.92)"),
        scaleLine: getCssVar("--scene-scale-line", "rgba(46, 255, 103, 0.95)"),
        missileTrace: getCssVar("--scene-trace-missile", "rgba(99, 255, 141, 0.95)"),
        targetTrace: getCssVar("--scene-trace-target", "rgba(180, 255, 91, 0.95)"),
        los: getCssVar("--scene-los", "rgba(124, 255, 164, 0.72)"),
        missile: getCssVar("--scene-missile", "#63ff8d"),
        target: getCssVar("--scene-target", "#b4ff5b"),
        vehicleStroke: getCssVar("--scene-vehicle-stroke", "rgba(255, 255, 255, 0.24)"),
      };
    }

    applyTheme() {
      this.render();
    }

    scheduleResize() {
      if (this.pendingResizeFrame != null) {
        window.cancelAnimationFrame(this.pendingResizeFrame);
      }

      this.pendingResizeFrame = window.requestAnimationFrame(() => {
        this.pendingResizeFrame = window.requestAnimationFrame(() => {
          this.pendingResizeFrame = null;
          this.handleResize();
        });
      });
    }

    bindCanvasInteraction() {
      this.canvas.addEventListener("pointerdown", (event) => {
        this.dragging = true;
        this.lastPointer = { x: event.clientX, y: event.clientY };
        this.view.autoFit = false;
        this.canvas.setPointerCapture(event.pointerId);
      });

      this.canvas.addEventListener("pointermove", (event) => {
        if (!this.dragging) {
          return;
        }

        const deltaX = event.clientX - this.lastPointer.x;
        const deltaY = event.clientY - this.lastPointer.y;
        this.lastPointer = { x: event.clientX, y: event.clientY };

        this.view.centerX -= deltaX / this.view.scale;
        this.view.centerZ += deltaY / this.view.scale;
        this.render();
      });

      this.canvas.addEventListener("pointerup", () => {
        this.dragging = false;
      });

      this.canvas.addEventListener("wheel", (event) => {
        event.preventDefault();
        if (!this.frames.length) {
          return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const worldBefore = this.screenToWorld(mouseX, mouseY);
        const factor = event.deltaY < 0 ? 1.12 : 0.9;
        this.view.scale = clamp(this.view.scale * factor, 0.01, 30);
        const worldAfter = this.screenToWorld(mouseX, mouseY);
        this.view.centerX += worldBefore.x - worldAfter.x;
        this.view.centerZ += worldBefore.z - worldAfter.z;
        this.view.autoFit = false;
        this.render();
      }, { passive: false });

      this.canvas.addEventListener("dblclick", () => {
        this.fitView();
        this.render();
      });
    }

    handleResize() {
      const dpr = window.devicePixelRatio || 1;
      const canvasRect = this.canvas.getBoundingClientRect();
      const fallbackRect = this.canvas.parentElement?.getBoundingClientRect?.() ?? canvasRect;
      const width = Math.max(canvasRect.width || fallbackRect.width, 320);
      const height = Math.max(canvasRect.height || fallbackRect.height, 240);
      this.canvas.width = Math.floor(width * dpr);
      this.canvas.height = Math.floor(height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (this.frames.length && this.view.autoFit) {
        this.fitView();
      }
      this.render();
    }

    loadSimulation(result, options) {
      this.result = result;
      this.frames = result.samples;
      this.options = { ...this.options, ...options };
      this.playhead = 0;
      this.playbackClock = this.frames[0]?.t ?? 0;
      this.playing = false;
      this.lastAnimationTime = null;
      this.lastTelemetryTime = 0;
      this.fitView();
      this.updateResultStats(result);
      if (this.summaryEl) {
        this.summaryEl.textContent = `${result.outcome.message} Toplam ${result.samples.length} örnek, bitiş zamanı ${formatNumber(result.stats.finalTime, 2)} s.`;
      }
      this.scheduleResize();
      this.render();
    }

    replaceSimulation(result, options = {}, playbackState = {}) {
      const nextFrames = result?.samples ?? [];
      const requestedPlayhead = playbackState.playhead ?? this.playhead;
      const nextPlayhead = nextFrames.length
        ? Math.max(0, Math.min(requestedPlayhead, nextFrames.length - 1))
        : 0;

      this.result = result;
      this.frames = nextFrames;
      this.options = { ...this.options, ...options };
      this.playhead = nextPlayhead;
      this.playbackClock = playbackState.playbackClock ?? (nextFrames[nextPlayhead]?.t ?? 0);
      this.lastAnimationTime = null;
      this.lastTelemetryTime = 0;
      this.playing = false;
      this.updateResultStats(result);

      this.scheduleResize();
      this.render();

      if (playbackState.playing && nextFrames.length > 0) {
        this.play();
      }
    }

    setViewOptions(options) {
      this.options = { ...this.options, ...options };
      this.render();
    }

    updateResultStats(result) {
      this.resultStats.minMiss.textContent = `${formatNumber(result.stats.minMissDistance, 2)} m`;
      this.resultStats.interceptTime.textContent = result.stats.interceptTime == null
        ? "-"
        : `${formatNumber(result.stats.interceptTime, 2)} s`;
      this.resultStats.terminalSpeed.textContent = `${formatNumber(result.stats.terminalSpeed, 2)} m/s`;
      this.resultStats.terminalGamma.textContent = `${formatNumber(result.stats.terminalGammaDeg, 2)}°`;
      this.resultStats.peakAz.textContent = `${formatNumber(result.stats.peakAz, 2)} m/s^2`;
      this.resultStats.peakLambdaDot.textContent = `${formatNumber(result.stats.peakLambdaDotDeg, 2)}°/s`;
    }

    fitView() {
      if (!this.frames.length) {
        return;
      }

      const xs = this.frames.flatMap((sample) => [sample.x_m, sample.x_t]);
      const zs = this.frames.flatMap((sample) => [sample.z_m, sample.z_t]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minZ = Math.min(0, ...zs);
      const maxZ = Math.max(...zs);
      const padding = 76;
      const width = this.canvas.clientWidth || 960;
      const height = this.canvas.clientHeight || 560;
      const worldWidth = Math.max(maxX - minX, 200);
      const worldHeight = Math.max(maxZ - minZ, 200);

      this.view.scale = Math.min((width - padding * 2) / worldWidth, (height - padding * 2) / worldHeight);
      this.view.centerX = (minX + maxX) / 2;
      this.view.centerZ = (minZ + maxZ) / 2;
      this.view.autoFit = true;
    }

    playFromStart() {
      if (!this.frames.length) {
        return;
      }

      this.playhead = 0;
      this.playbackClock = this.frames[0].t;
      this.play();
    }

    play() {
      if (!this.frames.length || this.playing) {
        return;
      }

      this.playing = true;
      this.lastAnimationTime = null;
      this.lastTelemetryTime = 0;
      window.requestAnimationFrame((timestamp) => this.animate(timestamp));
    }

    pause() {
      this.playing = false;
      this.lastAnimationTime = null;
    }

    reset() {
      this.pause();
      this.playhead = 0;
      this.playbackClock = this.frames[0]?.t ?? 0;
      this.lastTelemetryTime = 0;
      this.render();
    }

    rewindAndPlay() {
      this.playhead = 0;
      this.playbackClock = this.frames[0]?.t ?? 0;
      this.play();
    }

    step() {
      if (!this.frames.length) {
        return;
      }

      this.pause();
      this.playhead = Math.min(this.playhead + 1, this.frames.length - 1);
      this.playbackClock = this.frames[this.playhead].t;
      this.render();
    }

    animate(timestamp) {
      if (!this.playing) {
        return;
      }

      if (this.lastAnimationTime == null) {
        this.lastAnimationTime = timestamp;
      }

      const deltaSeconds = (timestamp - this.lastAnimationTime) / 1000;
      this.lastAnimationTime = timestamp;
      this.playbackClock += deltaSeconds * this.playbackRate;

      while (this.playhead < this.frames.length - 1 && this.frames[this.playhead + 1].t <= this.playbackClock) {
        this.playhead += 1;
      }

      if (this.playhead >= this.frames.length - 1) {
        this.playing = false;
      }

      this.render();

      if (this.playing) {
        window.requestAnimationFrame((nextTimestamp) => this.animate(nextTimestamp));
      }
    }

    screenToWorld(screenX, screenY) {
      const width = this.canvas.clientWidth || 1;
      const height = this.canvas.clientHeight || 1;
      return {
        x: this.view.centerX + (screenX - width / 2) / this.view.scale,
        z: this.view.centerZ - (screenY - height / 2) / this.view.scale,
      };
    }

    worldToScreen(worldX, worldZ) {
      const width = this.canvas.clientWidth || 1;
      const height = this.canvas.clientHeight || 1;
      return {
        x: (worldX - this.view.centerX) * this.view.scale + width / 2,
        y: height / 2 - (worldZ - this.view.centerZ) * this.view.scale,
      };
    }

    drawGrid(width, height, palette) {
      const ctx = this.ctx;
      const worldStep = niceStep(120 / this.view.scale);
      const leftWorld = this.view.centerX - width / (2 * this.view.scale);
      const rightWorld = this.view.centerX + width / (2 * this.view.scale);
      const bottomWorld = this.view.centerZ - height / (2 * this.view.scale);
      const topWorld = this.view.centerZ + height / (2 * this.view.scale);

      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = palette.grid;
      ctx.fillStyle = palette.gridText;
      ctx.font = "10px Consolas";

      for (let x = Math.floor(leftWorld / worldStep) * worldStep; x <= rightWorld; x += worldStep) {
        const screen = this.worldToScreen(x, 0);
        ctx.beginPath();
        ctx.moveTo(screen.x, 0);
        ctx.lineTo(screen.x, height);
        ctx.stroke();
        ctx.fillText(`${Math.round(x)} m`, screen.x + 4, 16);
      }

      for (let z = Math.floor(bottomWorld / worldStep) * worldStep; z <= topWorld; z += worldStep) {
        const screen = this.worldToScreen(0, z);
        ctx.beginPath();
        ctx.moveTo(0, screen.y);
        ctx.lineTo(width, screen.y);
        ctx.stroke();
        ctx.fillText(`${Math.round(z)} m`, 8, screen.y - 4);
      }

      ctx.restore();
    }

    drawAxes(width, height, palette) {
      const ctx = this.ctx;
      const origin = this.worldToScreen(0, 0);
      ctx.save();
      ctx.strokeStyle = palette.axis;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, origin.y);
      ctx.lineTo(width, origin.y);
      ctx.moveTo(origin.x, 0);
      ctx.lineTo(origin.x, height);
      ctx.stroke();
      ctx.fillStyle = palette.axisText;
      ctx.font = "11px Consolas";
      ctx.fillText("x [m]", width - 42, origin.y - 8);
      ctx.fillText("z [m]", origin.x + 8, 18);
      ctx.restore();
    }

    drawScaleInfo(width, height, palette) {
      const ctx = this.ctx;
      const metersPerPixel = 1 / this.view.scale;
      const barMeters = niceStep(metersPerPixel * 120);
      const barPixels = barMeters * this.view.scale;
      const x = width - Math.max(200, barPixels + 48);
      const y = height - 54;

      ctx.save();
      ctx.fillStyle = palette.scaleBg;
      ctx.strokeStyle = palette.scaleBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x - 12, y - 28, Math.max(180, barPixels + 32), 40, 12);
      } else {
        ctx.rect(x - 12, y - 28, Math.max(180, barPixels + 32), 40);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = palette.scaleText;
      ctx.font = "10px Consolas";
      ctx.fillText(`Ölçek: 1 px = ${formatNumber(metersPerPixel, 2)} m`, x, y - 10);

      ctx.strokeStyle = palette.scaleLine;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x, y + 6);
      ctx.lineTo(x + barPixels, y + 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + 1);
      ctx.lineTo(x, y + 11);
      ctx.moveTo(x + barPixels, y + 1);
      ctx.lineTo(x + barPixels, y + 11);
      ctx.stroke();
      ctx.fillText(`${Math.round(barMeters)} m`, x, y + 24);
      ctx.restore();
    }

    drawTrajectoryFromFrames(xKey, zKey, maxIndex, color) {
      if (maxIndex < 0 || !this.frames.length) {
        return;
      }

      const ctx = this.ctx;
      const width = this.canvas.clientWidth || 960;
      const maxRenderablePoints = Math.max(240, Math.min(this.renderBudget.maxTrailPoints, Math.floor(width * 1.6)));
      const step = Math.max(1, Math.ceil((maxIndex + 1) / maxRenderablePoints));

      ctx.save();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = color;
      ctx.beginPath();

      let started = false;
      for (let index = 0; index <= maxIndex; index += step) {
        const frame = this.frames[index];
        const point = this.worldToScreen(frame[xKey], frame[zKey]);
        if (!started) {
          ctx.moveTo(point.x, point.y);
          started = true;
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }

      if (maxIndex % step !== 0) {
        const lastFrame = this.frames[maxIndex];
        const lastPoint = this.worldToScreen(lastFrame[xKey], lastFrame[zKey]);
        if (!started) {
          ctx.moveTo(lastPoint.x, lastPoint.y);
        } else {
          ctx.lineTo(lastPoint.x, lastPoint.y);
        }
      }

      ctx.stroke();
      ctx.restore();
    }

    drawVehicle(x, z, gamma, color, size, type, palette) {
      const ctx = this.ctx;
      const point = this.worldToScreen(x, z);

      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(-gamma);
      ctx.fillStyle = color;
      ctx.strokeStyle = palette.vehicleStroke;
      ctx.lineWidth = 1.1;

      ctx.beginPath();
      if (type === "missile") {
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.8, size * 0.42);
        ctx.lineTo(-size * 0.45, 0);
        ctx.lineTo(-size * 0.8, -size * 0.42);
      } else {
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.78, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.78, 0);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    render() {
      const ctx = this.ctx;
      const width = this.canvas.clientWidth || 1;
      const height = this.canvas.clientHeight || 1;
      const palette = this.getPalette();

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = palette.background;
      ctx.fillRect(0, 0, width, height);

      if (!this.frames.length) {
        ctx.fillStyle = palette.empty;
        ctx.font = "16px Consolas";
        ctx.fillText("Simülasyon verisi bekleniyor.", 20, 30);
        return;
      }

      this.drawGrid(width, height, palette);
      this.drawAxes(width, height, palette);

      const current = this.frames[this.playhead];
      if (this.options.traceEnabled) {
        this.drawTrajectoryFromFrames("x_m", "z_m", this.playhead, palette.missileTrace);
        this.drawTrajectoryFromFrames("x_t", "z_t", this.playhead, palette.targetTrace);
      }

      if (this.options.showLos) {
        const missilePoint = this.worldToScreen(current.x_m, current.z_m);
        const targetPoint = this.worldToScreen(current.x_t, current.z_t);
        ctx.save();
        ctx.strokeStyle = palette.los;
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(missilePoint.x, missilePoint.y);
        ctx.lineTo(targetPoint.x, targetPoint.y);
        ctx.stroke();
        ctx.restore();
      }

      this.drawVehicle(current.x_m, current.z_m, current.gamma_m, palette.missile, 12, "missile", palette);
      this.drawVehicle(current.x_t, current.z_t, current.gamma_t, palette.target, 10, "target", palette);
      this.drawScaleInfo(width, height, palette);

      const now = window.performance?.now?.() ?? Date.now();
      if (
        !this.playing
        || now - this.lastTelemetryTime >= this.renderBudget.telemetryIntervalMs
        || this.playhead >= this.frames.length - 1
      ) {
        this.lastTelemetryTime = now;
        this.updateTelemetry(current);
      }
    }

    updateTelemetry(sample) {
      this.telemetry.time.textContent = `${formatNumber(sample.t, 2)} s`;
      this.telemetry.range.textContent = `${formatNumber(sample.R, 1)} m`;
      this.telemetry.lambda.textContent = `${formatNumber(sample.lambda_deg, 2)}°`;
      this.telemetry.speed.textContent = `${formatNumber(sample.V_m, 1)} m/s`;
      this.telemetry.gamma.textContent = `${formatNumber(sample.gamma_m_deg, 2)}°`;
      this.telemetry.az.textContent = `${formatNumber(sample.az_actual, 2)} m/s^2`;
    }
  }

  GuidanceSim.ui = GuidanceSim.ui || {};
  GuidanceSim.ui.Scene2D = Scene2D;
})();
