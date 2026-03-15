(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatNumber(value, fractionDigits = 2) {
    return Number.isFinite(value) ? value.toFixed(fractionDigits) : "-";
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
        lambdaDot: document.getElementById("telemetryLambdaDot"),
        speed: document.getElementById("telemetrySpeed"),
        gamma: document.getElementById("telemetryGamma"),
        az: document.getElementById("telemetryAz"),
        status: document.getElementById("telemetryStatus"),
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

      const observerTarget = this.canvas.parentElement;
      if (window.ResizeObserver && observerTarget) {
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(observerTarget);
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
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const width = Math.max(rect.width, 320);
      const height = Math.max(rect.height, 420);
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
      this.summaryEl.textContent = `${result.outcome.message} Toplam ${result.samples.length} ornek, bitis zamani ${formatNumber(result.stats.finalTime, 2)} s.`;
      this.render();
    }

    setViewOptions(options) {
      this.options = { ...this.options, ...options };
      this.render();
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
      const padding = 70;
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

    drawGrid(width, height) {
      const ctx = this.ctx;
      const worldStep = niceStep(110 / this.view.scale);
      const leftWorld = this.view.centerX - width / (2 * this.view.scale);
      const rightWorld = this.view.centerX + width / (2 * this.view.scale);
      const bottomWorld = this.view.centerZ - height / (2 * this.view.scale);
      const topWorld = this.view.centerZ + height / (2 * this.view.scale);

      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(143, 174, 209, 0.10)";
      ctx.fillStyle = "rgba(152, 171, 199, 0.8)";
      ctx.font = "11px Consolas";

      for (let x = Math.floor(leftWorld / worldStep) * worldStep; x <= rightWorld; x += worldStep) {
        const screen = this.worldToScreen(x, 0);
        ctx.beginPath();
        ctx.moveTo(screen.x, 0);
        ctx.lineTo(screen.x, height);
        ctx.stroke();
        ctx.fillText(`${Math.round(x)} m`, screen.x + 4, 14);
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

    drawAxes(width, height) {
      const ctx = this.ctx;
      const origin = this.worldToScreen(0, 0);
      ctx.save();
      ctx.strokeStyle = "rgba(92, 200, 255, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, origin.y);
      ctx.lineTo(width, origin.y);
      ctx.moveTo(origin.x, 0);
      ctx.lineTo(origin.x, height);
      ctx.stroke();
      ctx.fillStyle = "rgba(235, 243, 255, 0.9)";
      ctx.font = "12px Bahnschrift";
      ctx.fillText("x", width - 18, origin.y - 8);
      ctx.fillText("z", origin.x + 8, 18);
      ctx.restore();
    }

    drawTrajectory(samples, color) {
      if (!samples.length) {
        return;
      }

      const ctx = this.ctx;
      ctx.save();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = color;
      ctx.beginPath();

      samples.forEach((sample, index) => {
        const point = this.worldToScreen(sample.x, sample.z);
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });

      ctx.stroke();
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

    drawVehicle(x, z, gamma, color, size, type) {
      const ctx = this.ctx;
      const point = this.worldToScreen(x, z);

      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(-gamma);
      ctx.fillStyle = color;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      if (type === "missile") {
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.7, size * 0.42);
        ctx.lineTo(-size * 0.42, 0);
        ctx.lineTo(-size * 0.7, -size * 0.42);
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

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#091320";
      ctx.fillRect(0, 0, width, height);

      if (!this.frames.length) {
        ctx.fillStyle = "rgba(235, 243, 255, 0.75)";
        ctx.font = "16px Bahnschrift";
        ctx.fillText("Simulasyon verisi bekleniyor.", 20, 30);
        return;
      }

      this.drawGrid(width, height);
      this.drawAxes(width, height);

      const current = this.frames[this.playhead];
      if (this.options.traceEnabled) {
        this.drawTrajectoryFromFrames("x_m", "z_m", this.playhead, "rgba(92, 200, 255, 0.95)");
        this.drawTrajectoryFromFrames("x_t", "z_t", this.playhead, "rgba(255, 179, 71, 0.95)");
      }

      if (this.options.showLos) {
        const missilePoint = this.worldToScreen(current.x_m, current.z_m);
        const targetPoint = this.worldToScreen(current.x_t, current.z_t);
        ctx.save();
        ctx.strokeStyle = "rgba(141, 220, 151, 0.7)";
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(missilePoint.x, missilePoint.y);
        ctx.lineTo(targetPoint.x, targetPoint.y);
        ctx.stroke();
        ctx.restore();
      }

      this.drawVehicle(current.x_m, current.z_m, current.gamma_m, "#5cc8ff", 12, "missile");
      this.drawVehicle(current.x_t, current.z_t, current.gamma_t, "#ffb347", 10, "target");

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
      const isLastFrame = this.playhead >= this.frames.length - 1;
      const statusText = isLastFrame
        ? this.result?.outcome?.label ?? "Tamamlandi"
        : this.playing
          ? "Animasyon oynatiliyor"
          : "Animasyon duraklatildi";

      this.telemetry.time.textContent = `${formatNumber(sample.t, 2)} s`;
      this.telemetry.range.textContent = `${formatNumber(sample.R, 1)} m`;
      this.telemetry.lambda.textContent = `${formatNumber(sample.lambda_deg, 2)} deg`;
      this.telemetry.lambdaDot.textContent = `${formatNumber(sample.lambda_dot_deg, 2)} deg/s`;
      this.telemetry.speed.textContent = `${formatNumber(sample.V_m, 1)} m/s`;
      this.telemetry.gamma.textContent = `${formatNumber(sample.gamma_m_deg, 2)} deg`;
      this.telemetry.az.textContent = `${formatNumber(sample.az_cmd, 2)} m/s²`;
      this.telemetry.status.textContent = statusText;
    }
  }

  GuidanceSim.ui = GuidanceSim.ui || {};
  GuidanceSim.ui.Scene2D = Scene2D;
})();
