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

  class GuidePanel {
    constructor(options = {}) {
      this.openButton = options.openButton ?? document.getElementById("guideBtn");
      this.steps = options.steps?.length ? options.steps : DEFAULT_STEPS;
      this.activeIndex = 0;
      this.handleKeydown = (event) => this.onKeydown(event);
      this.build();
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

      this.stepCounterEl = document.createElement("p");
      this.stepCounterEl.className = "guide-step-counter";

      this.titleEl = document.createElement("h3");
      this.titleEl.id = "guideTitle";

      titleWrap.append(this.stepCounterEl, this.titleEl);

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
      this.openButton?.addEventListener("click", () => this.open());

      document.body.append(overlay);
      this.overlay = overlay;
      this.card = card;

      this.render();
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
  }

  GuidanceSim.ui = GuidanceSim.ui || {};
  GuidanceSim.ui.GuidePanel = GuidePanel;
})();
