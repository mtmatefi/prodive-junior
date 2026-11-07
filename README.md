# ProDive Junior – Riffretter 🐠

360°-Tauchabenteuer für Kinder (5–10 J.) auf Bali, mit Ayu & Wayan. DE · EN · ID.

- `app/` – Spiel (HTML/JS, three.js)
- `native/` – Capacitor-7-Android-Projekt (`app.prodive.junior`), inkl. In-App-Updater
- `docs/` – Download-Seite (GitHub Pages → prodive.app/junior)
- `tools/release.sh` – baut APK, schreibt `latest.json`, erstellt GitHub-Release

## Bauen
```
cd native && npm ci
rm -rf www && mkdir www && cp -r ../app/. www/ && npx cap sync android
cd android && ./gradlew assembleDebug -Pvc=4 -Pvn=1.4
```

## Updates
Die App liest `releases/latest/download/latest.json` und lädt die neue APK direkt in der App.
