# Güdüm Angajman Simülatörü

Tamamen istemci tarafında çalışan, vanilla HTML/CSS/JavaScript tabanlı bir 2D füze-hedef angajman prototipidir.

## Kullanım

1. `index.html` dosyasını tarayıcıda doğrudan açın.
2. Sol menüden `PNG` veya `BPG` örneğini seçin.
3. Üst panelden başlangıç koşullarını, hız modelini ve çıktı modunu değiştirin.
4. `Başlat` ile simülasyonu yeniden üretin, `Durdur` ve `Devam Et` ile animasyonu kontrol edin.
5. Alt bölümdeki checkbox etiketleri ile zaman grafiklerini açıp kapatın.

## Notlar

- Tüm iç hesaplar radyan cinsindedir; arayüz girişleri derece olarak verilir.
- Formül motoru güvenli bir ayrıştırıcı kullanır, `eval` kullanılmaz.
- Grafikler için Chart.js CDN sürümü yüklenir. İnternet yoksa simülasyon yine çalışır, sadece alt grafikler görünmeyebilir.

## TODO

- Sözdizimi renklendirmeli formül editörü
- Kullanıcı tanımlı ek parametreler için dinamik alan üretimi
- Çoklu hedef ve manevra yapan hedef modelleri
- RK4 seçimi ve entegratör tercihinin arayüze açılması
- Simülasyon çıktısının CSV/JSON dışa aktarımı
