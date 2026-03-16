# Güdüm Angajman Simülatörü

## Proje amacı

Bu proje, kullanıcının kendi güdüm kanununu matematiksel ifade olarak tanımlayıp 2D `x-z` düzleminde füze-hedef angajmanını analiz edebilmesi için geliştirilmiş istemci taraflı bir uygulamadır.

Temel kullanım hedefleri:

- Güvenli bir ifade motoru ile güdüm formülü yazmak
- Füze ve hedef dinamiğini aynı ekranda izlemek
- Zaman serilerini grafiklerle incelemek
- PNG, BPG ve kullanıcı formülünü hızlıca karşılaştırmak
- Parametre süpürme ile hassasiyet analizi yapmak

## Dosya yapısı

```text
guidance_simulation/
|- index.html
|- styles.css
|- app.js
|- README.md
|- docs/
|  |- bpg_aciklama.tex
|- examples/
|  |- guidanceExamples.js
|- sim/
|  |- geometry.js
|  |- guidanceEngine.js
|  |- integrator.js
|  |- missileModel.js
|  |- simulationCore.js
|  |- targetModel.js
|- ui/
|  |- analysisPanel.js
|  |- controlPanel.js
|  |- editorPanel.js
|  |- guidePanel.js
|  |- layoutManager.js
|  |- plots.js
|  |- reportGenerator.js
|  |- scene2d.js
|  |- settingsPanel.js
|- utils/
   |- math.js
```

## Matematik modeli

### 1. Bağıl geometri

```text
dx = x_t - x_m
dz = z_t - z_m
R = sqrt(dx^2 + dz^2)
lambda = atan2(dz, dx)
vrel = [vx_t - vx_m, vz_t - vz_m]
Rdot = (dx * vrel_x + dz * vrel_z) / R
lambda_dot = (dx * vrel_z - dz * vrel_x) / R^2
closing_velocity = -Rdot
sigma = wrapAngle(lambda - gamma_m)
```

### 2. `az_demand` modu

```text
az_actual = sat(az_cmd, -a_max, +a_max)
gamma_dot = az_actual / V_m
```

### 3. `gamma_demand` modu

```text
gamma_cmd -> angle limit -> rate limit
gamma_error = wrapAngle(gamma_cmd - gamma_m)
gamma_dot_des = gamma_error / tau_gamma
gamma_dot = sat(gamma_dot_des, -a_max / V_m, +a_max / V_m)
az_actual = V_m * gamma_dot
```

### 4. Basit enerji modeli

```text
D = 0.5 * rho * V^2 * S * Cd
Vdot = (T - D) / m - g * sin(gamma_m)
```

### 5. Simülasyon sırası

Her adım aşağıdaki sırayla çalışır:

1. `state`: füze ve hedef durumları alınır
2. `derived`: bağıl geometri ve türetilmiş büyüklükler hesaplanır
3. `guidance`: kullanıcı formülü güvenli parser ile değerlendirilir
4. `control`: füze komutu türetilir
5. `dynamics`: füze ve hedef türevleri hesaplanır
6. `integration`: Euler entegrasyonu ile bir sonraki adıma geçilir
7. `history`: örnekler, grafikler ve animasyon için saklanır

## Desteklenen değişkenler

Formül motoru yalnızca izinli değişkenler ve matematik fonksiyonlarıyla çalışır.

Temel değişkenler:

- `t`, `dt`
- `x_m`, `z_m`, `x_t`, `z_t`
- `vx_m`, `vz_m`, `vx_t`, `vz_t`
- `V_m`, `V_t`
- `gamma_m`, `gamma_t`
- `dx`, `dz`
- `vrel_x`, `vrel_z`
- `R`, `Rdot`
- `lambda`, `lambda_dot`
- `sigma`, `sigma_dot`
- `closing_velocity`
- `xz_error`, `yanal_hata`
- `energy`, `energy_error`
- `az_prev`, `az_cmd_prev`, `az_actual_prev`
- `gamma_cmd_prev`, `gamma_error_prev`
- `N`, `k1`, `k2`
- `g`, `intercept_radius`, `gamma_tau`, `a_max`

İzinli fonksiyonlar:

- `sin`, `cos`, `tan`
- `asin`, `acos`, `atan`, `atan2`
- `sqrt`, `abs`
- `min`, `max`
- `pow`, `exp`, `log`
- `if(condition, dogru_dal, yanlis_dal)`
- `pi`

Not: hedefin kullanıcı tanımlı komut ifadesi de aynı güvenli ifade motorunu kullanır.
Kosullu mantık için ayrıca `>`, `>=`, `<`, `<=`, `==`, `!=`, `&&`, `||`, `!` ve `kosul ? a : b` yapısı desteklenir.

## Örnek formüller

- `PNG: N * V_m * lambda_dot`
- `BPG: gamma_m + k1 * sigma + k2 * lambda_dot`
- `Saf takip: lambda`
- `Sönümlü takip: gamma_m + 1.2 * sigma + 0.6 * lambda_dot`
- `Menzile duyarlı az komutu: N * closing_velocity * lambda_dot / max(R, intercept_radius)`
- `Kosullu seçim: if(R > 1200, N * V_m * lambda_dot, 0.7 * N * V_m * lambda_dot)`

## Hedef modelleri

Desteklenen hedef hareket modları:

- Sabit doğrusal uçuş
- Sabit gamma ile tırmanış / alçalma
- Sinüzoidal `z` manevrası
- Kaçınma manevrası
- Sabit dönüş oranı
- Waypoint takibi
- Kullanıcı tanımlı hedef komutu

## Arayüz özellikleri

- Sözdizimi renklendirmeli formül editörü
- Otomatik tamamlama
- Değişken tooltip’leri
- Anlık birim uyarıları
- Hatalı formülde simülasyonu engelleme
- Sürüklenebilir splitter yapısı
- Yeniden boyutlandırılabilir grafik paneli
- Canvas sahnesinde grid, eksen ve ölçek bilgisi
- Chart.js zaman grafikleri, zoom ve pan
- Parametre süpürme paneli
- Çoklu algoritma karşılaştırma ekranı
- PDF rapor üretimi
- Tema sistemi: `Radar`, `Su altı`, `Kilit`, `Açık`

## Dış bağımlılıklar

- `Chart.js`
- `chartjs-plugin-zoom`
- `Hammer.js`
- `jsPDF`

Uygulamanın simülasyon ve arayüz mantığı vanilla HTML/CSS/JavaScript ile yazılmıştır.

## Çalıştırma

1. `index.html` dosyasını tarayıcıda açın.
2. Bir örnek algoritma seçin veya kendi formülünüzü yazın.
3. Simülasyon parametrelerini düzenleyin.
4. Formül ve hedef komutu geçerli ise `Başlat` ile simülasyonu çalıştırın.
5. `Parametre Süpürme` ve `Algoritma Karşılaştır` araçlarıyla analizi genişletin.
6. İsterseniz `Rapor Oluştur` ile PDF rapor alın.

## TODO listesi

- RK4 seçeneğini arayüze açmak
- Monte Carlo analizi eklemek
- Sensör gürültüsü ve gecikme modeli eklemek
- CSV / JSON dışa aktarma eklemek
- ISA atmosfer modeli ve irtifaya bağlı yoğunluk eklemek
- Çoklu hedef / çoklu füze senaryolarına genişlemek
- Editörde satır içi hata işaretleme ve daha gelişmiş tip/birim analizi eklemek
