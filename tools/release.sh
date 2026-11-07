#!/bin/bash
# Seaducation Junior release: build APK with the next versionCode, publish it on GitHub Releases (latest.json + APK).
# usage: release.sh "Was ist neu (de)" ["What's new (en)"] ["Apa yang baru (id)"]
set -e
REPO=mtmatefi/prodive-junior
STATE=/home/claude/tools/release_state.json
VC=$(python3 -c "import json;print(json.load(open('$STATE'))['vc']+1)" 2>/dev/null || echo 2)
VN="1.$VC"
cd /home/claude/apk && rm -rf www && mkdir www && cp -r /home/claude/sea/app/. www/ && npx cap sync android >/dev/null 2>&1
cd android && ./gradlew assembleDebug -q -Pvc=$VC -Pvn=$VN
APK=/tmp/ProDive-Junior-$VN.apk; cp app/build/outputs/apk/debug/app-debug.apk $APK; cp $APK /mnt/user-data/outputs/ProDive-Junior.apk
NDE="${1:-Neue Version}"; NEN="${2:-$NDE}"; NID="${3:-$NDE}"
python3 - "$VC" "$VN" "$NDE" "$NEN" "$NID" "$REPO" > /tmp/latest.json <<'PY'
import json,sys
vc,vn,de,en,i,repo=sys.argv[1:]
print(json.dumps({"versionCode":int(vc),"versionName":vn,"notes":{"de":de,"en":en,"id":i},
 "apk":f"https://github.com/{repo}/releases/download/v{vn}/ProDive-Junior.apk"},ensure_ascii=False))
PY
cp $APK /tmp/ProDive-Junior.apk
gh release create "v$VN" /tmp/ProDive-Junior.apk /tmp/latest.json -R $REPO -t "Seaducation Junior $VN" -n "$NDE" --latest
echo "{\"vc\": $VC}" > $STATE
echo "RELEASED $VN (versionCode $VC)"
