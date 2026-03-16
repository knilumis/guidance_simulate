(() => {
  const GuidanceSim = window.GuidanceSim || (window.GuidanceSim = {});
  const THREE_SCRIPT_SOURCES = [
    "./vendor/three.min.js",
    "https://unpkg.com/three@0.152.2/build/three.min.js",
    "https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js",
  ];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(start, end, amount) {
    return start + ((end - start) * amount);
  }

  function createSkyTexture(THREE) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#e6f7ff");
    gradient.addColorStop(0.36, "#a8d5ff");
    gradient.addColorStop(0.74, "#70afe5");
    gradient.addColorStop(1, "#4b7fc0");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalAlpha = 0.32;
    for (let index = 0; index < 26; index += 1) {
      const x = Math.random() * canvas.width;
      const y = 120 + (Math.random() * canvas.height * 0.6);
      const width = 120 + (Math.random() * 230);
      const height = 34 + (Math.random() * 76);
      const cloud = ctx.createRadialGradient(x, y, width * 0.16, x, y, width);
      cloud.addColorStop(0, "rgba(255,255,255,0.96)");
      cloud.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = cloud;
      ctx.beginPath();
      ctx.ellipse(x, y, width, height, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace || texture.colorSpace;
    return texture;
  }

  function createCloudTexture(THREE) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(128, 128, 16, 128, 128, 118);
    gradient.addColorStop(0, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.46, "rgba(255,255,255,0.75)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(128, 128, 118, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace || texture.colorSpace;
    return texture;
  }

  function createFlashTexture(THREE) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(128, 128, 6, 128, 128, 124);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.22, "rgba(255,241,193,0.96)");
    gradient.addColorStop(0.58, "rgba(255,186,96,0.5)");
    gradient.addColorStop(1, "rgba(255,120,32,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace || texture.colorSpace;
    return texture;
  }

  function buildJetModel(THREE) {
    const group = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xdbe3eb,
      metalness: 0.22,
      roughness: 0.54,
      flatShading: true,
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: 0x55697d,
      metalness: 0.28,
      roughness: 0.58,
      flatShading: true,
    });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x7fc0ff,
      roughness: 0.1,
      transmission: 0.78,
      thickness: 0.45,
      transparent: true,
      opacity: 0.9,
    });

    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.1, 18, 10), bodyMaterial);
    fuselage.rotation.x = Math.PI / 2;
    group.add(fuselage);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.58, 4.8, 12), bodyMaterial);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 11;
    group.add(nose);

    const engine = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.2, 10), accentMaterial);
    engine.rotation.x = -Math.PI / 2;
    engine.position.z = -10.8;
    group.add(engine);

    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.65, 16, 12), glassMaterial);
    canopy.scale.set(0.75, 0.42, 1.35);
    canopy.position.set(0, 1.15, 1.9);
    group.add(canopy);

    const wings = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.24, 3.4), bodyMaterial);
    wings.position.set(0, -0.15, 0.55);
    group.add(wings);

    const wingTips = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.16, 1.45), accentMaterial);
    wingTips.position.set(0, -0.05, -1.55);
    wingTips.rotation.z = 0.08;
    group.add(wingTips);

    const tailWing = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.18, 1.5), accentMaterial);
    tailWing.position.set(0, 0.4, -7.8);
    group.add(tailWing);

    const verticalTail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.2, 2.45), accentMaterial);
    verticalTail.position.set(0, 1.55, -7.65);
    verticalTail.rotation.x = 0.18;
    group.add(verticalTail);

    const intakeLeft = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 2.4), accentMaterial);
    intakeLeft.position.set(-1.4, -0.4, 1.6);
    group.add(intakeLeft);

    const intakeRight = intakeLeft.clone();
    intakeRight.position.x = 1.4;
    group.add(intakeRight);

    group.scale.setScalar(2.5);
    return group;
  }

  class EasterEgg3D {
    constructor() {
      this.overlay = document.getElementById("easterEggOverlay");
      this.viewport = document.getElementById("easterEggViewport");
      this.targetBoxEl = document.getElementById("easterEggTargetBox");
      this.crosshairEl = this.viewport?.querySelector(".easter-egg-crosshair") ?? null;
      this.closeButton = document.getElementById("easterEggCloseBtn");
      this.statusEl = document.getElementById("easterEggStatus");
      this.captionEl = document.getElementById("easterEggCaption");
      this.animationFrame = null;
      this.lastFrameTime = null;
      this.loadPromise = null;
      this.isOpenFlag = false;
      this.isSceneReady = false;

      this.elapsed = 0;
      this.phase = "idle";
      this.resultTimer = 0;
      this.lockTime = 0;
      this.maxDuration = 24;
      this.interceptDistance = 34;
      this.missileSpeed = 250;

      this.input = {
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
      };

      this.steering = {
        yaw: 0,
        pitch: 0,
      };

      this.renderFrame = this.renderFrame.bind(this);
      this.resizeHandler = () => this.handleResize();
      this.pointerMoveHandler = (event) => this.updatePointer(event);
      this.pointerLeaveHandler = () => this.centerPointer();
      this.keyHandler = (event) => {
        if (event.key === "Escape") {
          this.close();
        }
        if (event.key.toLowerCase() === "r" && this.isOpenFlag && this.phase !== "approach") {
          this.resetSequence();
        }
      };

      this.closeButton?.addEventListener("click", () => this.close());
      this.overlay?.addEventListener("click", (event) => {
        if (event.target === this.overlay) {
          this.close();
        }
      });

      this.viewport?.addEventListener("mousemove", this.pointerMoveHandler);
      this.viewport?.addEventListener("mouseleave", this.pointerLeaveHandler);
    }

    isOpen() {
      return this.isOpenFlag;
    }

    setHud(status, caption) {
      if (this.statusEl) {
        this.statusEl.textContent = status;
      }
      if (this.captionEl) {
        this.captionEl.textContent = caption;
      }
    }

    updatePointer(event) {
      if (!this.viewport || this.phase !== "approach") {
        return;
      }

      const rect = this.viewport.getBoundingClientRect();
      const normalizedX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const normalizedY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      this.input.targetX = clamp(normalizedX, -1, 1);
      this.input.targetY = clamp(-normalizedY, -1, 1);
    }

    centerPointer() {
      this.input.targetX = 0;
      this.input.targetY = 0;
    }

    updateCrosshair(lockStrength = 0) {
      if (!this.crosshairEl) {
        return;
      }

      const offsetX = this.input.x * 54;
      const offsetY = -this.input.y * 42;
      const scale = 1 + (lockStrength * 0.08);
      this.crosshairEl.style.transform = `translate(calc(-50% + ${offsetX.toFixed(1)}px), calc(-50% + ${offsetY.toFixed(1)}px)) scale(${scale.toFixed(3)})`;
      this.crosshairEl.style.opacity = String(0.76 + (lockStrength * 0.24));
    }

    hideTargetBox() {
      this.targetBoxEl?.classList.add("is-hidden");
    }

    updateTargetBox(screenVector, lockStrength = 0) {
      if (!this.viewport || !this.targetBoxEl) {
        return;
      }

      if (!Number.isFinite(screenVector?.x) || !Number.isFinite(screenVector?.y) || screenVector.z <= -1 || screenVector.z >= 1) {
        this.hideTargetBox();
        return;
      }

      const width = this.viewport.clientWidth;
      const height = this.viewport.clientHeight;
      const pixelX = ((screenVector.x + 1) * 0.5) * width;
      const pixelY = ((-screenVector.y + 1) * 0.5) * height;
      const size = lerp(74, 46, clamp((1 - screenVector.z) * 0.35, 0, 1));
      const opacity = 0.58 + (lockStrength * 0.42);

      this.targetBoxEl.classList.remove("is-hidden");
      this.targetBoxEl.style.left = `${pixelX.toFixed(1)}px`;
      this.targetBoxEl.style.top = `${pixelY.toFixed(1)}px`;
      this.targetBoxEl.style.width = `${size.toFixed(1)}px`;
      this.targetBoxEl.style.height = `${size.toFixed(1)}px`;
      this.targetBoxEl.style.opacity = opacity.toFixed(3);
    }

    async ensureThreeLoaded() {
      if (window.THREE) {
        return true;
      }

      if (this.loadPromise) {
        return this.loadPromise;
      }

      const trySource = (index) => new Promise((resolve) => {
        if (index >= THREE_SCRIPT_SOURCES.length) {
          resolve(false);
          return;
        }

        const script = document.createElement("script");
        const timeoutId = window.setTimeout(() => {
          script.onload = null;
          script.onerror = null;
          script.remove();
          resolve(trySource(index + 1));
        }, 3500);
        script.src = THREE_SCRIPT_SOURCES[index];
        script.async = true;
        script.defer = true;
        script.crossOrigin = "anonymous";
        script.dataset.threeLoader = "dynamic";
        script.onload = () => {
          window.clearTimeout(timeoutId);
          resolve(Boolean(window.THREE));
        };
        script.onerror = () => {
          window.clearTimeout(timeoutId);
          script.remove();
          resolve(trySource(index + 1));
        };
        document.head.append(script);
      });

      this.loadPromise = Promise.resolve(trySource(0))
        .then((value) => Boolean(value))
        .finally(() => {
          this.loadPromise = null;
        });

      return this.loadPromise;
    }

    ensureScene() {
      if (this.isSceneReady) {
        return true;
      }

      if (!this.viewport || !window.THREE) {
        this.setHud("3D motoru yüklenemedi", "Yerel veya ağ kaynağı başlatılamadı.");
        return false;
      }

      const THREE = window.THREE;
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace || this.renderer.outputColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping || this.renderer.toneMapping;
      this.renderer.toneMappingExposure = 1.06;
      this.renderer.domElement.className = "easter-egg-canvas";
      this.viewport.append(this.renderer.domElement);

      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.FogExp2(0x8dbef0, 0.00078);

      this.camera = new THREE.PerspectiveCamera(76, 1, 0.1, 6000);
      this.camera.position.set(0, 118, 40);

      const hemisphere = new THREE.HemisphereLight(0xeef7ff, 0x6b8cad, 1.55);
      this.scene.add(hemisphere);

      const sun = new THREE.DirectionalLight(0xffffff, 1.65);
      sun.position.set(-120, 220, 80);
      this.scene.add(sun);

      const fill = new THREE.DirectionalLight(0x92c6ff, 0.5);
      fill.position.set(140, 80, -60);
      this.scene.add(fill);

      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(2600, 32, 20),
        new THREE.MeshBasicMaterial({
          map: createSkyTexture(THREE),
          side: THREE.BackSide,
          fog: false,
        }),
      );
      this.scene.add(sky);

      this.clouds = [];
      const cloudMaterial = new THREE.SpriteMaterial({
        map: createCloudTexture(THREE),
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      });
      for (let index = 0; index < 34; index += 1) {
        const sprite = new THREE.Sprite(cloudMaterial.clone());
        sprite.scale.setScalar(120 + Math.random() * 170);
        sprite.position.set(
          (Math.random() - 0.5) * 900,
          70 + Math.random() * 180,
          -300 - Math.random() * 1800,
        );
        sprite.material.opacity = 0.26 + Math.random() * 0.34;
        sprite.userData.drift = 16 + Math.random() * 28;
        sprite.userData.offsetX = (Math.random() - 0.5) * 12;
        sprite.userData.offsetY = (Math.random() - 0.5) * 5;
        this.clouds.push(sprite);
        this.scene.add(sprite);
      }

      this.target = buildJetModel(THREE);
      this.scene.add(this.target);
      this.targetVelocity = new THREE.Vector3();
      this.previousTargetPosition = new THREE.Vector3();
      this.targetScreen = new THREE.Vector3();
      this.impactOrigin = new THREE.Vector3();

      const flashMaterial = new THREE.SpriteMaterial({
        map: createFlashTexture(THREE),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.flash = new THREE.Sprite(flashMaterial);
      this.flash.visible = false;
      this.scene.add(this.flash);

      const particleCount = 160;
      const positions = new Float32Array(particleCount * 3);
      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const particleMaterial = new THREE.PointsMaterial({
        color: 0xffd7b0,
        size: 6.5,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });
      this.explosionParticles = new THREE.Points(particleGeometry, particleMaterial);
      this.explosionParticles.visible = false;
      this.scene.add(this.explosionParticles);
      this.particleVelocity = Array.from({ length: particleCount }, () => new THREE.Vector3());

      this.startPosition = new THREE.Vector3(0, 112, 140);
      this.missilePosition = this.startPosition.clone();
      this.missileForward = new THREE.Vector3(0, 0, -1);
      this.missileVelocity = new THREE.Vector3(0, 0, -this.missileSpeed);
      this.tempForward = new THREE.Vector3();
      this.tempLook = new THREE.Vector3();
      this.tempUp = new THREE.Vector3(0, 1, 0);

      this.isSceneReady = true;
      this.handleResize();
      return true;
    }

    handleResize() {
      if (!this.isSceneReady || !this.viewport) {
        return;
      }

      const width = Math.max(this.viewport.clientWidth, 320);
      const height = Math.max(this.viewport.clientHeight, 240);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
    }

    resetSequence() {
      const THREE = window.THREE;
      this.elapsed = 0;
      this.resultTimer = 0;
      this.lockTime = 0;
      this.phase = "approach";
      this.lastFrameTime = null;

      this.input.x = 0;
      this.input.y = 0;
      this.input.targetX = 0;
      this.input.targetY = 0;
      this.steering.yaw = 0;
      this.steering.pitch = 0;
      this.updateCrosshair(0);
      this.hideTargetBox();

      this.missilePosition.copy(this.startPosition);
      this.missileForward.set(0, 0, -1);
      this.missileVelocity.set(0, 0, -this.missileSpeed);

      this.target.visible = true;
      this.target.scale.setScalar(2.5);
      this.target.rotation.set(0, Math.PI, 0);
      this.target.position.set(0, 128, -1240);
      this.previousTargetPosition.copy(this.target.position);
      this.targetVelocity.set(0, 0, 0);

      this.flash.visible = false;
      this.flash.material.opacity = 0;
      this.flash.scale.setScalar(1);
      this.explosionParticles.visible = false;
      this.explosionParticles.material.opacity = 0;
      this.explosionParticles.geometry.attributes.position.array.fill(0);
      this.explosionParticles.geometry.attributes.position.needsUpdate = true;

      this.camera.position.copy(this.startPosition);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(new THREE.Vector3(0, 128, -1240));

      this.setHud(
        "Seeker aktif",
        "Fare ile yön verin, hedefi nişangaha alın. Başarısız olursanız R ile yeniden deneyin.",
      );
    }

    computeTargetPosition(time) {
      return {
        x: Math.sin(time * 0.62) * 110 + Math.sin(time * 1.8) * 18,
        y: 136 + Math.cos(time * 0.74) * 36 + Math.sin(time * 1.55) * 8,
        z: -1240 + time * 52,
      };
    }

    updateClouds(deltaTime) {
      this.clouds.forEach((cloud) => {
        cloud.position.z += cloud.userData.drift * deltaTime;
        cloud.position.x += cloud.userData.offsetX * deltaTime * 0.3;
        cloud.position.y += cloud.userData.offsetY * deltaTime * 0.16;

        if (cloud.position.z - this.camera.position.z > 240) {
          cloud.position.z = this.camera.position.z - (1400 + Math.random() * 900);
          cloud.position.x = this.camera.position.x + ((Math.random() - 0.5) * 900);
          cloud.position.y = 70 + Math.random() * 180;
        }
      });
    }

    startIntercept() {
      this.phase = "success";
      this.resultTimer = 0;
      this.impactOrigin.copy(this.target.position);
      this.target.visible = false;
      this.hideTargetBox();

      this.flash.visible = true;
      this.flash.position.copy(this.impactOrigin);
      this.flash.material.opacity = 1;

      this.explosionParticles.visible = true;
      this.explosionParticles.position.copy(this.impactOrigin);
      this.explosionParticles.material.opacity = 1;

      this.particleVelocity.forEach((velocity) => {
        velocity.set(
          (Math.random() - 0.5) * 2.4,
          (Math.random() - 0.35) * 2.1,
          (Math.random() - 0.5) * 2.6,
        ).normalize().multiplyScalar(18 + (Math.random() * 34));
      });

      this.setHud(
        "Önleme başarılı",
        "Temas doğrulandı. Parlama efekti sonrasında R ile tekrar deneyebilirsiniz.",
      );
    }

    startMiss() {
      if (this.phase !== "approach") {
        return;
      }

      this.phase = "missed";
      this.resultTimer = 0;
      this.hideTargetBox();
      this.setHud(
        "Hedef kaçtı",
        "Takip penceresi kapandı. R ile yeniden deneyebilir veya X ile çıkabilirsiniz.",
      );
    }

    updateSuccess(deltaTime) {
      this.resultTimer += deltaTime;
      const localTime = this.resultTimer;
      const { geometry, material } = this.explosionParticles;
      const positions = geometry.attributes.position.array;

      for (let index = 0; index < this.particleVelocity.length; index += 1) {
        const velocity = this.particleVelocity[index];
        const damping = 1 - clamp(localTime / 2.4, 0, 0.82);
        positions[index * 3] = velocity.x * localTime * damping * 9;
        positions[(index * 3) + 1] = velocity.y * localTime * damping * 7.5;
        positions[(index * 3) + 2] = velocity.z * localTime * damping * 9;
      }

      geometry.attributes.position.needsUpdate = true;
      material.opacity = Math.max(0, 1 - (localTime * 0.56));
      this.flash.material.opacity = Math.max(0, 1 - (localTime * 1.35));
      this.flash.scale.setScalar(16 + (localTime * 60));

      this.camera.position.lerp(
        this.impactOrigin.clone().add(new window.THREE.Vector3(0, 1.6, 42)),
        0.08,
      );
      this.camera.lookAt(this.impactOrigin);
    }

    updateMiss(deltaTime) {
      this.resultTimer += deltaTime;
      this.missilePosition.addScaledVector(this.missileVelocity, deltaTime);
      this.camera.position.copy(this.missilePosition);
      this.tempLook.copy(this.missilePosition).addScaledVector(this.missileForward, 220);
      this.camera.lookAt(this.tempLook);
      this.updateCrosshair(0);
    }

    updateApproach(deltaTime, targetVector) {
      this.target.position.copy(targetVector);
      if (this.targetVelocity.lengthSq() > 0.0001) {
        this.target.lookAt(targetVector.clone().add(this.targetVelocity.clone().multiplyScalar(18)));
      }
      this.target.rotation.z = Math.sin(this.elapsed * 1.45) * 0.12;

      this.input.x = lerp(this.input.x, this.input.targetX, clamp(deltaTime * 5.6, 0, 1));
      this.input.y = lerp(this.input.y, this.input.targetY, clamp(deltaTime * 5.6, 0, 1));
      this.steering.yaw = lerp(this.steering.yaw, this.input.x * 0.74, clamp(deltaTime * 2.9, 0, 1));
      this.steering.pitch = lerp(this.steering.pitch, this.input.y * 0.46, clamp(deltaTime * 2.9, 0, 1));

      this.tempForward.set(
        Math.sin(this.steering.yaw) * Math.cos(this.steering.pitch),
        Math.sin(this.steering.pitch),
        -Math.cos(this.steering.yaw) * Math.cos(this.steering.pitch),
      ).normalize();

      this.missileForward.lerp(this.tempForward, clamp(deltaTime * 3.8, 0, 1)).normalize();
      this.missileVelocity.copy(this.missileForward).multiplyScalar(this.missileSpeed);
      this.missilePosition.addScaledVector(this.missileVelocity, deltaTime);

      const cameraJitter = new window.THREE.Vector3(
        Math.sin(this.elapsed * 16) * 0.18,
        Math.cos(this.elapsed * 12) * 0.14,
        0,
      );
      this.camera.position.copy(this.missilePosition).add(cameraJitter);
      this.tempLook.copy(this.missilePosition).addScaledVector(this.missileForward, 220);
      this.camera.lookAt(this.tempLook);

      this.tempUp.set(this.input.x * 0.12, 1, 0).normalize();
      this.camera.up.lerp(this.tempUp, clamp(deltaTime * 5, 0, 1));

      const distance = this.missilePosition.distanceTo(targetVector);
      this.targetScreen.copy(targetVector).project(this.camera);
      const onScreen = this.targetScreen.z > -1 && this.targetScreen.z < 1;
      const radialError = onScreen ? Math.hypot(this.targetScreen.x, this.targetScreen.y) : 4;
      const lockCandidate = onScreen && radialError < 0.18;
      this.lockTime = lockCandidate
        ? Math.min(this.lockTime + (deltaTime * 1.35), 1.1)
        : Math.max(this.lockTime - (deltaTime * 0.9), 0);

      const lockRatio = clamp(this.lockTime / 1.0, 0, 1);
      const lockPercent = Math.round(lockRatio * 100);
      this.updateCrosshair(lockRatio);
      this.updateTargetBox(this.targetScreen, lockRatio);

      if (lockPercent >= 96) {
        this.setHud("Kilit hazır", `Menzil ${distance.toFixed(0)} m. Hedefi merkezde tutun, temas penceresi açıldı.`);
      } else if (lockPercent > 0) {
        this.setHud("Kilit kuruluyor", `Menzil ${distance.toFixed(0)} m. Kilit ${lockPercent}%.`);
      } else {
        this.setHud("Seeker aktif", `Fare ile yön verin. Menzil ${distance.toFixed(0)} m.`);
      }

      if ((distance < this.interceptDistance && radialError < 0.24) || (distance < 58 && lockRatio > 0.74)) {
        this.startIntercept();
        return;
      }

      if (
        this.elapsed > this.maxDuration
        || distance > 2600
        || this.missilePosition.y < 20
        || (this.targetScreen.z > 1.08 && distance > 120)
      ) {
        this.startMiss();
      }
    }

    updateScene(deltaTime) {
      this.elapsed = Math.min(this.elapsed + deltaTime, 40);
      this.updateClouds(deltaTime);

      const targetPosition = this.computeTargetPosition(this.elapsed);
      const targetVector = new window.THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z);
      this.targetVelocity.copy(targetVector).sub(this.previousTargetPosition);
      this.previousTargetPosition.copy(targetVector);

      if (this.phase === "approach") {
        this.updateApproach(deltaTime, targetVector);
      } else if (this.phase === "success") {
        this.updateSuccess(deltaTime);
      } else if (this.phase === "missed") {
        this.target.position.copy(targetVector);
        if (this.targetVelocity.lengthSq() > 0.0001) {
          this.target.lookAt(targetVector.clone().add(this.targetVelocity.clone().multiplyScalar(18)));
        }
        this.targetScreen.copy(targetVector).project(this.camera);
        this.updateTargetBox(this.targetScreen, 0.2);
        this.updateMiss(deltaTime);
      }
    }

    renderFrame(time) {
      if (!this.isOpenFlag) {
        return;
      }

      if (this.lastFrameTime == null) {
        this.lastFrameTime = time;
      }

      const deltaTime = Math.min((time - this.lastFrameTime) / 1000, 0.05);
      this.lastFrameTime = time;

      this.updateScene(deltaTime);
      this.renderer.render(this.scene, this.camera);
      this.animationFrame = window.requestAnimationFrame(this.renderFrame);
    }

    async open() {
      this.overlay?.classList.remove("is-hidden");
      this.overlay?.setAttribute("aria-hidden", "false");
      document.body.classList.add("easter-egg-open");

      if (!this.isSceneReady && !window.THREE) {
        this.setHud("3D motoru yükleniyor", "Yerel motor hazırlanıyor, lütfen bekleyin.");
      }

      const hasThree = await this.ensureThreeLoaded();
      if (!hasThree || !this.ensureScene()) {
        this.setHud("3D motoru yüklenemedi", "Yerel dosya veya ağ kaynağı başlatılamadı.");
        return;
      }

      this.resetSequence();
      this.isOpenFlag = true;
      window.addEventListener("resize", this.resizeHandler);
      window.addEventListener("keydown", this.keyHandler);
      this.handleResize();
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = window.requestAnimationFrame(this.renderFrame);
    }

    close() {
      this.isOpenFlag = false;
      this.centerPointer();
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
      this.overlay?.classList.add("is-hidden");
      this.overlay?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("easter-egg-open");
      window.removeEventListener("resize", this.resizeHandler);
      window.removeEventListener("keydown", this.keyHandler);
    }
  }

  GuidanceSim.ui = GuidanceSim.ui || {};
  GuidanceSim.ui.EasterEgg3D = EasterEgg3D;
})();
