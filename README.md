# Gudum Angajman Simulatoru

## Proje Amaci

Bu proje, kullanicinin kendi gudum kanununu matematiksel ifade olarak tanimlayip 2D `x-z` duzleminde fuze ve hedef angajmanini simule edebilmesi icin gelistirilmis tek sayfa bir istemci tarafli uygulamadir.

Hedefler:

- Gudum formullerini guvenli sekilde yazip dogrulamak
- Fuze ve hedef geometrisini canli olarak gormek
- Zamana bagli kontrol ve geometri serilerini analiz etmek
- PNG ve BPG benzeri algoritmalari hizlica deneyebilmek

## Dosya Yapisi

```text
guidance_simulation/
|- index.html
|- styles.css
|- app.js
|- README.md
|- docs/
|  |- bpg_aciklama.tex
|- utils/
|  |- math.js
|- examples/
|  |- guidanceExamples.js
|- sim/
|  |- integrator.js
|  |- missileModel.js
|  |- targetModel.js
|  |- geometry.js
|  |- guidanceEngine.js
|  |- simulationCore.js
|- ui/
   |- controlPanel.js
   |- editorPanel.js
   |- plots.js
   |- scene2d.js
   |- layoutManager.js
```

## Mimari Ozet

Simulasyon cekirdegi asagidaki sira ile calisir:

1. `state`: anlik fuze ve hedef durumlari tutulur
2. `derived`: bagil geometri ve turetilmis buyuklukler hesaplanir
3. `guidance`: kullanici formulu guvenli parser ile degerlendirilir
4. `control`: `az_demand` veya `gamma_demand` komutlari elde edilir
5. `dynamics`: fuze ve hedef turevleri hesaplanir
6. `integration`: Euler integrasyonu ile bir sonraki adima gecilir
7. `history`: grafikler ve animasyon icin zaman serisi saklanir

## Matematik Modeli

### 1. Bagil Geometri

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

### 2. az_demand Modu

Kullanici formulu dogrudan yanal ivme komutu uretir.

```text
az_actual = sat(az_cmd, -a_max, +a_max)
gamma_dot = az_actual / V_m
```

### 3. gamma_demand Modu

Kullanici formulu ucus yolu acisi komutu uretir.

```text
gamma_cmd -> angle limit -> rate limit
gamma_error = wrapAngle(gamma_cmd - gamma_m)
gamma_dot_des = gamma_error / tau_gamma
gamma_dot = sat(gamma_dot_des, -a_max / V_m, +a_max / V_m)
az_actual = V_m * gamma_dot
```

### 4. Basit Enerji Modeli

```text
D = 0.5 * rho * V^2 * S * Cd
Vdot = (T - D) / m - g * sin(gamma_m)
```

Mevcut surumde `rho` sabit alinmistir. Mimari, ileride ISA atmosfer modeli eklenebilecek sekilde hazirlanmistir.

### 5. Hedef Hareket Modelleri

- Sabit dogrusal ucus
- Sabit gamma ile tirmanis / alcalis
- Sinuzoidal `z` manevrasi

## Desteklenen Degiskenler

Formul motoru yalnizca izinli degiskenler ve fonksiyonlari kabul eder.

Temel degiskenler:

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

Izinli matematik fonksiyonlari:

- `sin`, `cos`, `tan`
- `asin`, `acos`, `atan`, `atan2`
- `sqrt`, `abs`
- `min`, `max`
- `pow`, `exp`, `log`
- `pi`

## Ornek Formuller

### PNG

```text
N * V_m * lambda_dot
```

### BPG benzeri gamma komutu

```text
gamma_m + k1 * sigma + k2 * lambda_dot
```

### Saf pursuit

```text
lambda
```

### Sonumlu pursuit

```text
gamma_m + 1.2 * sigma + 0.6 * lambda_dot
```

### Menzile duyarli deneysel az komutu

```text
N * closing_velocity * lambda_dot / max(R, intercept_radius)
```

## Arayuz Ozellikleri

- Profesyonel koyu tema
- Sol form ulasimi ile sag sahne arasinda suruklenebilir splitter
- Alt grafik paneli icin yeniden boyutlandirma splitter'i
- Canvas sahnesinde grid, eksen etiketleri ve olcek bilgisi
- Telemetri ve sonuc kartlari
- Chart.js tabanli grafikler
- Grafiklerde zoom / pan ve zoom sifirlama
- Gercek zamanli formul dogrulama
- Hatali formulde simulasyonun baslatilmasini engelleme

## Dis Bagimliliklar

- `Chart.js`
- `chartjs-plugin-zoom`
- `Hammer.js`

Tum diger kisimlar vanilla HTML/CSS/JavaScript ile yazilmistir.

## Calistirma

1. `index.html` dosyasini tarayicida acin.
2. Sol menuden ornek algoritma secin.
3. Parametreleri degistirin.
4. Formul dogrulama alaninin gecerli oldugunu kontrol edin.
5. `Baslat` ile simulasyonu yeniden uretin.

## TODO

- RK4 secenegini arayuze acmak
- Sonuc verilerini CSV / JSON disa aktarmak
- Daha gelismis hedef manevra kutuphanesi eklemek
- ISA atmosfer modeli ve irtifaya bagli yogunluk secenegi eklemek
- Formul editorune syntax highlighting ve satir ici hata isaretleme eklemek
- Canvas sahnesine gecici olcum araci ve LOS aci gostergesi eklemek
