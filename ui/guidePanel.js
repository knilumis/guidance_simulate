(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});

  const DEFAULT_STEPS = [
    {
      title: "1. Simülasyon Parametreleri",
      body: "Sol taraftaki parametre panelinde füze ve hedef başlangıç koşullarını, zaman adımını, ivme sınırlarını ve hedef hareket modelini ayarlayın. Sayısal değerleri değiştirdikçe yeni senaryoyu hazırlamış olursunuz.",
    },
    {
      title: "2. Algoritma Seçimi",
      body: "Algoritmalar ve Güdüm Formülü bölümünde PNG veya BPG gibi örnek algoritmaları seçin. İsterseniz kartlardaki bilgi düğmesi ile kısa açıklamayı açabilirsiniz.",
    },
    {
      title: "3. Formül Düzenleme",
      body: "Matematiksel ifade alanına kendi güdüm ifadenizi yazın. Çıktı modunu aynı panelin sağ üstünden seçin. Formülde hata varsa uygulama simülasyonu başlatmaz ve hata mesajı gösterir.",
    },
    {
      title: "4. Angajman Sahnesi",
      body: "Sağ üstteki 2D angajman sahnesinde Başlat, Durdur, Devam Et ve Baştan Oynat düğmeleri ile animasyonu kontrol edin. Mouse tekeri ile yakınlaştırabilir, sürükleyerek pan yapabilir, çift tık ile otomatik sığdırma uygulayabilirsiniz.",
    },
    {
      title: "5. Telemetri ve Sonuç",
      body: "Sahnenin yanındaki kartlarda anlık telemetriyi ve simülasyon sonunda oluşan özet değerleri takip edin. En küçük sapma, önleme zamanı ve terminal büyüklükler burada görünür.",
    },
    {
      title: "6. Zaman Grafikleri",
      body: "Alt bölümdeki Zaman Grafikleri alanında serileri inceleyin. Başlığın yanındaki soru işaretine basarak hangi eğrilerin görüneceğini seçebilir, grafik üzerinde zoom ve pan yapabilirsiniz.",
    },
    {
      title: "7. Yerleşim Ayarı",
      body: "Paneller arasındaki ayırıcıları sürükleyerek kontrol paneli, formül alanı, sahne ve grafik bölgesinin genişliklerini ihtiyacınıza göre ayarlayabilirsiniz. Böylece çalışma alanını kendi ekranınıza göre optimize edebilirsiniz.",
    },
  ];

  function approxValue(selector, expected, tolerance = 1e-6) {
    const element = document.querySelector(selector);
    const value = Number(element?.value);
    return Number.isFinite(value) && Math.abs(value - expected) <= tolerance;
  }

  function matchesValue(selector, expected) {
    return document.querySelector(selector)?.value === expected;
  }

  function elementIsVisible(element) {
    if (!element) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  const LEARN_STEPS = [
    {
      selector: "#controlPanel",
      title: "1. Simülasyon Parametreleri",
      body: "Öğren moduna hoş geldiniz. İlk olarak simülasyon parametrelerini kullandığımız paneli tanıyoruz. Füze, hedef ve zaman ayarlarının tamamı bu bölümden yönetilir.",
    },
    {
      selector: "[data-param='missileSpeed']",
      title: "2. Füze Hızı",
      body: "Şimdi füze hızını 260 m/s yapın. Sayısal alanları doğrudan yazarak değiştirebilirsiniz.",
      requirementText: "Beklenen değer: 260 m/s",
      isComplete: () => approxValue("[data-param='missileSpeed']", 260),
    },
    {
      selector: "[data-param='targetMotionModel']",
      title: "3. Hedef Hareket Modeli",
      body: "Hedef hareket modelini Sabit dönüş oranı seçeneğine getirin. Böylece hedefin sürekli dönüş yapan bir modeliyle çalışacağız.",
      requirementText: "Beklenen seçim: Sabit dönüş oranı",
      isComplete: () => matchesValue("[data-param='targetMotionModel']", "constant_turn"),
    },
    {
      selector: "[data-param='targetTurnRateDeg']",
      title: "4. Hedef Dönüş Oranı",
      body: "Şimdi hedef dönüş oranını 8 °/s girin. Bu alan sadece dönüş kullanan hedef modellerinde görünür.",
      requirementText: "Beklenen değer: 8 °/s",
      isComplete: () => approxValue("[data-param='targetTurnRateDeg']", 8),
    },
    {
      selector: "#algorithmButtons",
      title: "5. Örnek Algoritmalar",
      body: "Bu alanda örnek algoritmaları hızlıca seçebilirsiniz. Şu anda PNG seçili; kartlar üzerinden farklı algoritmalara geçebilirsiniz.",
    },
    {
      selector: "#guidanceExpression",
      title: "6. Güdüm Formülü",
      body: "Matematiksel ifade alanına tıklayın. Bu alan canlıdır; yazdığınız formül ve parametreler oynatma sırasında bile yeni çözüme uygulanabilir. Koşullu mantık için örneğin `if(R > 1200, N * V_m * lambda_dot, 0.7 * N * V_m * lambda_dot)` yazabilirsiniz.",
      requirementText: "Formül alanına bir kez tıklayın.",
      setup: ({ target, markCompleted }) => {
        const complete = () => markCompleted();
        target?.addEventListener("focus", complete);
        target?.addEventListener("click", complete);
        return () => {
          target?.removeEventListener("focus", complete);
          target?.removeEventListener("click", complete);
        };
      },
    },
    {
      selector: "[data-param='N']",
      title: "7. Navigasyon Sabiti",
      body: "Şimdi N değerini 3.5 yapın. Bu değer, oransal seyrüsefer benzeri algoritmaların agresifliğini değiştirir.",
      requirementText: "Beklenen değer: 3.5",
      isComplete: () => approxValue("[data-param='N']", 3.5),
    },
    {
      selector: "#sceneStartBtn",
      title: "8. Simülasyonu Çalıştırın",
      body: "Hazırsanız Başlat düğmesine basın. Öğren modu boyunca yaptığınız düzenlemeler yeni simülasyonda kullanılacaktır.",
      requirementText: "Başlat düğmesine basın.",
      setup: ({ target, markCompleted }) => {
        const handleClick = () => markCompleted();
        target?.addEventListener("click", handleClick);
        return () => {
          target?.removeEventListener("click", handleClick);
        };
      },
    },
    {
      selector: "#scenePanel",
      title: "9. Sahne ve Telemetri",
      body: "Bu bölümde füze ve hedefin yörüngesini, LOS çizgisini, ölçek bilgisini ve canlı telemetri kartlarını görürsünüz. Simülasyon çalışırken tüm hareket burada izlenir.",
    },
    {
      selector: "#plotsPanel",
      title: "10. Zaman Grafikleri",
      body: "Alt bölümde zamana bağlı grafikler bulunur. Buradan komut, gamma, menzil ve enerji gibi serileri inceleyebilirsiniz. Öğren modu tamamlandı; artık uygulamayı serbestçe kullanabilirsiniz.",
    },
  ];

  class GuidePanel {
    constructor(options = {}) {
      this.openButton = options.openButton ?? document.getElementById("guideBtn");
      this.steps = options.steps?.length ? options.steps : DEFAULT_STEPS;
      this.learnSteps = options.learnSteps?.length ? options.learnSteps : LEARN_STEPS;
      this.activeIndex = 0;
      this.learnIndex = 0;
      this.learnCleanup = null;
      this.learnStepDone = false;
      this.handlers = {
        onPrepareTutorial: null,
      };
      this.handleKeydown = (event) => this.onKeydown(event);
      this.handleLearnKeydown = (event) => this.onLearnKeydown(event);
      this.handleLearnRefresh = () => this.refreshLearnStep();
      this.build();
    }

    bind(handlers = {}) {
      this.handlers = {
        ...this.handlers,
        ...handlers,
      };
    }

    build() {
      const overlay = document.createElement("div");
      overlay.className = "guide-overlay is-hidden";

      const card = document.createElement("section");
      card.className = "guide-card";
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-modal", "true");
      card.setAttribute("aria-labelledby", "guideTitle");

      const head = document.createElement("div");
      head.className = "guide-head";

      const titleWrap = document.createElement("div");
      titleWrap.className = "guide-title-wrap";

      this.learnButton = document.createElement("button");
      this.learnButton.type = "button";
      this.learnButton.className = "guide-learn-button";
      this.learnButton.textContent = "Öğren";

      this.stepCounterEl = document.createElement("p");
      this.stepCounterEl.className = "guide-step-counter";

      this.titleEl = document.createElement("h3");
      this.titleEl.id = "guideTitle";

      titleWrap.append(this.learnButton, this.stepCounterEl, this.titleEl);

      this.closeButton = document.createElement("button");
      this.closeButton.type = "button";
      this.closeButton.className = "guide-close";
      this.closeButton.textContent = "X";
      this.closeButton.setAttribute("aria-label", "Rehberi kapat");

      head.append(titleWrap, this.closeButton);

      this.bodyEl = document.createElement("p");
      this.bodyEl.className = "guide-body";

      const footer = document.createElement("div");
      footer.className = "guide-footer";

      this.prevButton = document.createElement("button");
      this.prevButton.type = "button";
      this.prevButton.className = "guide-arrow";
      this.prevButton.textContent = "←";
      this.prevButton.setAttribute("aria-label", "Önceki adım");

      this.progressEl = document.createElement("div");
      this.progressEl.className = "guide-progress";

      this.nextButton = document.createElement("button");
      this.nextButton.type = "button";
      this.nextButton.className = "guide-arrow";
      this.nextButton.textContent = "→";
      this.nextButton.setAttribute("aria-label", "Sonraki adım");

      footer.append(this.prevButton, this.progressEl, this.nextButton);
      card.append(head, this.bodyEl, footer);
      overlay.append(card);

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          this.close();
        }
      });

      this.closeButton.addEventListener("click", () => this.close());
      this.prevButton.addEventListener("click", () => this.goTo(this.activeIndex - 1));
      this.nextButton.addEventListener("click", () => this.goTo(this.activeIndex + 1));
      this.learnButton.addEventListener("click", () => this.startLearnMode());
      this.openButton?.addEventListener("click", () => this.open());

      document.body.append(overlay);
      this.overlay = overlay;
      this.card = card;

      this.buildLearnOverlay();
      this.render();
    }

    buildLearnOverlay() {
      const overlay = document.createElement("div");
      overlay.className = "learn-overlay is-hidden";

      this.learnHighlight = document.createElement("div");
      this.learnHighlight.className = "learn-highlight";

      const card = document.createElement("section");
      card.className = "learn-card";
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-modal", "true");

      this.learnProgressEl = document.createElement("p");
      this.learnProgressEl.className = "learn-progress";

      this.learnTitleEl = document.createElement("h3");
      this.learnTitleEl.className = "learn-title";

      this.learnBodyEl = document.createElement("p");
      this.learnBodyEl.className = "learn-body";

      this.learnRequirementEl = document.createElement("p");
      this.learnRequirementEl.className = "learn-requirement is-hidden";

      this.learnStatusEl = document.createElement("div");
      this.learnStatusEl.className = "learn-status";

      const footer = document.createElement("div");
      footer.className = "learn-footer";

      this.learnPrevButton = document.createElement("button");
      this.learnPrevButton.type = "button";
      this.learnPrevButton.textContent = "Geri";

      this.learnNextButton = document.createElement("button");
      this.learnNextButton.type = "button";
      this.learnNextButton.className = "primary";
      this.learnNextButton.textContent = "İlerle";

      this.learnCloseButton = document.createElement("button");
      this.learnCloseButton.type = "button";
      this.learnCloseButton.textContent = "Kapat";

      footer.append(this.learnPrevButton, this.learnNextButton, this.learnCloseButton);
      card.append(
        this.learnProgressEl,
        this.learnTitleEl,
        this.learnBodyEl,
        this.learnRequirementEl,
        this.learnStatusEl,
        footer,
      );

      this.learnPrevButton.addEventListener("click", () => this.goToLearn(this.learnIndex - 1));
      this.learnNextButton.addEventListener("click", () => this.handleLearnNext());
      this.learnCloseButton.addEventListener("click", () => this.stopLearnMode());

      overlay.append(this.learnHighlight, card);
      document.body.append(overlay);

      this.learnOverlay = overlay;
      this.learnCard = card;
    }

    open() {
      if (!this.overlay) {
        return;
      }

      this.overlay.classList.remove("is-hidden");
      document.addEventListener("keydown", this.handleKeydown);
      this.render();
    }

    close() {
      this.overlay?.classList.add("is-hidden");
      document.removeEventListener("keydown", this.handleKeydown);
    }

    goTo(index) {
      const boundedIndex = Math.max(0, Math.min(index, this.steps.length - 1));
      this.activeIndex = boundedIndex;
      this.render();
    }

    onKeydown(event) {
      if (this.overlay?.classList.contains("is-hidden")) {
        return;
      }

      if (event.key === "Escape") {
        this.close();
      } else if (event.key === "ArrowLeft") {
        this.goTo(this.activeIndex - 1);
      } else if (event.key === "ArrowRight") {
        this.goTo(this.activeIndex + 1);
      }
    }

    render() {
      const step = this.steps[this.activeIndex];
      if (!step) {
        return;
      }

      this.stepCounterEl.textContent = `Adım ${this.activeIndex + 1} / ${this.steps.length}`;
      this.titleEl.textContent = step.title;
      this.bodyEl.textContent = step.body;
      this.progressEl.textContent = `${this.activeIndex + 1}. adım`;
      this.prevButton.disabled = this.activeIndex === 0;
      this.nextButton.disabled = this.activeIndex >= this.steps.length - 1;
    }

    startLearnMode() {
      this.close();
      this.handlers.onPrepareTutorial?.();
      this.learnOverlay?.classList.remove("is-hidden");
      document.addEventListener("keydown", this.handleLearnKeydown);
      document.addEventListener("input", this.handleLearnRefresh, true);
      document.addEventListener("change", this.handleLearnRefresh, true);
      document.addEventListener("click", this.handleLearnRefresh, true);
      window.addEventListener("resize", this.handleLearnRefresh);
      window.addEventListener("scroll", this.handleLearnRefresh, true);
      this.goToLearn(0);
    }

    stopLearnMode() {
      this.learnOverlay?.classList.add("is-hidden");
      this.cleanupLearnStep();
      document.removeEventListener("keydown", this.handleLearnKeydown);
      document.removeEventListener("input", this.handleLearnRefresh, true);
      document.removeEventListener("change", this.handleLearnRefresh, true);
      document.removeEventListener("click", this.handleLearnRefresh, true);
      window.removeEventListener("resize", this.handleLearnRefresh);
      window.removeEventListener("scroll", this.handleLearnRefresh, true);
    }

    onLearnKeydown(event) {
      if (this.learnOverlay?.classList.contains("is-hidden")) {
        return;
      }

      if (event.key === "Escape") {
        this.stopLearnMode();
      } else if (event.key === "ArrowLeft") {
        this.goToLearn(this.learnIndex - 1);
      } else if (event.key === "ArrowRight") {
        this.handleLearnNext();
      }
    }

    handleLearnNext() {
      const currentStep = this.learnSteps[this.learnIndex];
      const isLastStep = this.learnIndex >= this.learnSteps.length - 1;
      if (!isLastStep && this.stepRequiresCompletion(currentStep) && !this.isLearnStepComplete(currentStep)) {
        return;
      }

      if (isLastStep) {
        this.stopLearnMode();
        return;
      }

      this.goToLearn(this.learnIndex + 1);
    }

    goToLearn(index) {
      const boundedIndex = Math.max(0, Math.min(index, this.learnSteps.length - 1));
      this.cleanupLearnStep();
      this.learnIndex = boundedIndex;
      this.learnStepDone = false;
      const step = this.learnSteps[this.learnIndex];
      const target = this.getLearnTarget(step);

      target?.scrollIntoView?.({
        block: "center",
        inline: "nearest",
        behavior: "smooth",
      });

      if (typeof step?.setup === "function") {
        this.learnCleanup = step.setup({
          target,
          markCompleted: () => {
            this.learnStepDone = true;
            this.refreshLearnStep();
          },
        });
      }

      this.refreshLearnStep();
    }

    cleanupLearnStep() {
      if (typeof this.learnCleanup === "function") {
        this.learnCleanup();
      }
      this.learnCleanup = null;
    }

    getLearnTarget(step) {
      return step?.selector ? document.querySelector(step.selector) : null;
    }

    stepRequiresCompletion(step) {
      return Boolean(step?.requirementText || step?.isComplete || step?.setup);
    }

    isLearnStepComplete(step) {
      const predicateComplete = typeof step?.isComplete === "function" ? step.isComplete() : true;
      return predicateComplete && (!step?.setup || this.learnStepDone);
    }

    refreshLearnStep() {
      const step = this.learnSteps[this.learnIndex];
      if (!step) {
        return;
      }

      const target = this.getLearnTarget(step);
      const complete = this.isLearnStepComplete(step);
      const isLastStep = this.learnIndex >= this.learnSteps.length - 1;

      this.learnProgressEl.textContent = `Öğren modu · Adım ${this.learnIndex + 1} / ${this.learnSteps.length}`;
      this.learnTitleEl.textContent = step.title;
      this.learnBodyEl.textContent = step.body;

      if (step.requirementText) {
        this.learnRequirementEl.textContent = step.requirementText;
        this.learnRequirementEl.classList.remove("is-hidden");
      } else {
        this.learnRequirementEl.classList.add("is-hidden");
        this.learnRequirementEl.textContent = "";
      }

      this.learnStatusEl.textContent = this.stepRequiresCompletion(step)
        ? (complete ? "Durum: tamamlandı, ilerleyebilirsiniz." : "Durum: görev bekleniyor.")
        : "Durum: bilgi adımı.";

      this.learnPrevButton.disabled = this.learnIndex === 0;
      this.learnNextButton.disabled = !isLastStep && this.stepRequiresCompletion(step) && !complete;
      this.learnNextButton.textContent = isLastStep ? "Bitir" : "İlerle";

      this.positionLearnHighlight(target);
      this.positionLearnCard(target);
    }

    positionLearnHighlight(target) {
      if (!target || !elementIsVisible(target)) {
        this.learnHighlight.style.opacity = "0";
        return;
      }

      const rect = target.getBoundingClientRect();
      const padding = 10;
      this.learnHighlight.style.opacity = "1";
      this.learnHighlight.style.left = `${Math.max(8, rect.left - padding)}px`;
      this.learnHighlight.style.top = `${Math.max(8, rect.top - padding)}px`;
      this.learnHighlight.style.width = `${Math.max(40, rect.width + padding * 2)}px`;
      this.learnHighlight.style.height = `${Math.max(40, rect.height + padding * 2)}px`;
    }

    positionLearnCard(target) {
      const card = this.learnCard;
      if (!card) {
        return;
      }

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const cardRect = card.getBoundingClientRect();
      const margin = 16;

      if (!target || !elementIsVisible(target)) {
        card.style.left = `${Math.max(margin, (viewportWidth - cardRect.width) / 2)}px`;
        card.style.top = `${Math.max(margin, viewportHeight - cardRect.height - margin)}px`;
        return;
      }

      const rect = target.getBoundingClientRect();
      let left = rect.right + 18;
      let top = rect.top;

      if (left + cardRect.width > viewportWidth - margin) {
        left = rect.left - cardRect.width - 18;
      }

      if (left < margin) {
        left = Math.max(margin, rect.left);
        top = rect.bottom + 18;
      }

      if (top + cardRect.height > viewportHeight - margin) {
        top = viewportHeight - cardRect.height - margin;
      }

      if (top < margin) {
        top = margin;
      }

      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
    }
  }

  GuidanceSim.ui = GuidanceSim.ui || {};
  GuidanceSim.ui.GuidePanel = GuidePanel;
})();
