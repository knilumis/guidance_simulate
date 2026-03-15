(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});
  const { clamp } = GuidanceSim.utils.math;

  class LayoutManager {
    constructor(options) {
      this.dashboard = options.dashboard;
      this.leftZone = options.leftZone;
      this.controlPanel = options.controlPanel;
      this.editorPanel = options.editorPanel;
      this.rightZone = options.rightZone;
      this.plotsPanel = options.plotsPanel;
      this.controlSplitter = options.controlSplitter;
      this.workspaceSplitter = options.workspaceSplitter;
      this.plotsSplitter = options.plotsSplitter;
      this.onLayoutChange = options.onLayoutChange;
      this.storageKeys = {
        leftWidth: "guidanceSim.leftWidth",
        controlWidth: "guidanceSim.controlWidth",
        plotsHeight: "guidanceSim.plotsHeight",
      };
      this.dragState = null;
      this.refreshFrame = null;
      this.boundPointerMove = (event) => this.handlePointerMove(event);
      this.boundPointerUp = () => this.handlePointerUp();
    }

    readStorage(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    }

    writeStorage(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        // Sessizce devam et; layout persistence kritik degil.
      }
    }

    init() {
      this.restoreLayout();
      this.bind();
      this.scheduleLayoutRefresh();
    }

    bind() {
      this.controlSplitter?.addEventListener("pointerdown", (event) => {
        if (window.innerWidth <= 1280) {
          return;
        }

        this.dragState = {
          type: "control",
          startPosition: event.clientX,
          startSize: this.controlPanel.getBoundingClientRect().width,
        };
        this.controlSplitter.setPointerCapture(event.pointerId);
        document.addEventListener("pointermove", this.boundPointerMove);
        document.addEventListener("pointerup", this.boundPointerUp);
      });

      this.workspaceSplitter?.addEventListener("pointerdown", (event) => {
        if (window.innerWidth <= 1280) {
          return;
        }

        this.dragState = {
          type: "workspace",
          startPosition: event.clientX,
          startSize: this.leftZone.getBoundingClientRect().width,
        };
        this.workspaceSplitter.setPointerCapture(event.pointerId);
        document.addEventListener("pointermove", this.boundPointerMove);
        document.addEventListener("pointerup", this.boundPointerUp);
      });

      this.plotsSplitter?.addEventListener("pointerdown", (event) => {
        if (window.innerWidth <= 1280) {
          return;
        }

        this.dragState = {
          type: "plots",
          startPosition: event.clientY,
          startSize: this.plotsPanel.getBoundingClientRect().height,
        };
        this.plotsSplitter.setPointerCapture(event.pointerId);
        document.addEventListener("pointermove", this.boundPointerMove);
        document.addEventListener("pointerup", this.boundPointerUp);
      });

      window.addEventListener("resize", () => this.ensureBounds());
    }

    restoreLayout() {
      const savedLeftWidth = Number(this.readStorage(this.storageKeys.leftWidth));
      const savedControlWidth = Number(this.readStorage(this.storageKeys.controlWidth));
      const savedPlotsHeight = Number(this.readStorage(this.storageKeys.plotsHeight));

      if (Number.isFinite(savedLeftWidth)) {
        this.dashboard.style.setProperty("--left-zone-width", `${savedLeftWidth}px`);
      }

      if (Number.isFinite(savedControlWidth)) {
        this.leftZone.style.setProperty("--control-panel-width", `${savedControlWidth}px`);
      }

      if (Number.isFinite(savedPlotsHeight)) {
        this.rightZone.style.setProperty("--plots-height", `${savedPlotsHeight}px`);
      }
    }

    ensureBounds() {
      if (window.innerWidth <= 1280) {
        return;
      }

      const dashboardWidth = this.dashboard.getBoundingClientRect().width;
      const minLeftWidth = 720;
      const maxLeftWidth = Math.max(minLeftWidth, dashboardWidth - 480);
      const currentLeftWidth = this.leftZone.getBoundingClientRect().width;
      const boundedLeftWidth = clamp(currentLeftWidth, minLeftWidth, maxLeftWidth);
      this.dashboard.style.setProperty("--left-zone-width", `${boundedLeftWidth}px`);

      const leftZoneWidth = this.leftZone.getBoundingClientRect().width;
      const minControlWidth = 280;
      const maxControlWidth = Math.max(minControlWidth, leftZoneWidth - 420);
      const currentControlWidth = this.controlPanel.getBoundingClientRect().width;
      const boundedControlWidth = clamp(currentControlWidth, minControlWidth, maxControlWidth);
      this.leftZone.style.setProperty("--control-panel-width", `${boundedControlWidth}px`);

      const rightZoneHeight = this.rightZone.getBoundingClientRect().height;
      const minPlotsHeight = 220;
      const maxPlotsHeight = Math.max(minPlotsHeight, rightZoneHeight - 260);
      const currentPlotsHeight = this.plotsPanel.getBoundingClientRect().height;
      const boundedPlotsHeight = clamp(currentPlotsHeight, minPlotsHeight, maxPlotsHeight);
      this.rightZone.style.setProperty("--plots-height", `${boundedPlotsHeight}px`);

      this.scheduleLayoutRefresh();
    }

    handlePointerMove(event) {
      if (!this.dragState) {
        return;
      }

      if (this.dragState.type === "workspace") {
        const dashboardWidth = this.dashboard.getBoundingClientRect().width;
        const minLeftWidth = 720;
        const maxLeftWidth = Math.max(minLeftWidth, dashboardWidth - 480);
        const nextWidth = clamp(
          this.dragState.startSize + (event.clientX - this.dragState.startPosition),
          minLeftWidth,
          maxLeftWidth,
        );

        this.dashboard.style.setProperty("--left-zone-width", `${nextWidth}px`);
        this.writeStorage(this.storageKeys.leftWidth, String(Math.round(nextWidth)));
      }

      if (this.dragState.type === "control") {
        const leftZoneWidth = this.leftZone.getBoundingClientRect().width;
        const minControlWidth = 280;
        const maxControlWidth = Math.max(minControlWidth, leftZoneWidth - 420);
        const nextWidth = clamp(
          this.dragState.startSize + (event.clientX - this.dragState.startPosition),
          minControlWidth,
          maxControlWidth,
        );

        this.leftZone.style.setProperty("--control-panel-width", `${nextWidth}px`);
        this.writeStorage(this.storageKeys.controlWidth, String(Math.round(nextWidth)));
      }

      if (this.dragState.type === "plots") {
        const rightZoneHeight = this.rightZone.getBoundingClientRect().height;
        const minPlotsHeight = 220;
        const maxPlotsHeight = Math.max(minPlotsHeight, rightZoneHeight - 260);
        const nextHeight = clamp(
          this.dragState.startSize - (event.clientY - this.dragState.startPosition),
          minPlotsHeight,
          maxPlotsHeight,
        );

        this.rightZone.style.setProperty("--plots-height", `${nextHeight}px`);
        this.writeStorage(this.storageKeys.plotsHeight, String(Math.round(nextHeight)));
      }

      this.scheduleLayoutRefresh();
    }

    handlePointerUp() {
      this.dragState = null;
      document.removeEventListener("pointermove", this.boundPointerMove);
      document.removeEventListener("pointerup", this.boundPointerUp);
      this.scheduleLayoutRefresh();
    }

    scheduleLayoutRefresh() {
      if (this.refreshFrame != null) {
        window.cancelAnimationFrame(this.refreshFrame);
      }

      this.refreshFrame = window.requestAnimationFrame(() => {
        this.refreshFrame = null;
        this.onLayoutChange?.();
      });
    }
  }

  GuidanceSim.ui = GuidanceSim.ui || {};
  GuidanceSim.ui.LayoutManager = LayoutManager;
})();
