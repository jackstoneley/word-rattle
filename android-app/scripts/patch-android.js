// Adds Stoneley Games' native plugin, update installer, permissions, link handling, icons, splash and signing
// to the Android project that `npx cap add android` generates.
const fs = require("fs"), path = require("path");
const app = path.resolve(__dirname, ".."), droid = path.join(app, "android", "app");
const res = path.join(droid, "src", "main", "res");
const read = f => fs.readFileSync(f, "utf8");
const edit = (f, fn) => { const before = read(f), after = fn(before); if (after === before) throw new Error("patch-android: no change to " + f); fs.writeFileSync(f, after); };
const code = parseInt(process.env.VERSION_CODE || "1", 10);

// 1. plugin + activity
const pkgDir = path.join(droid, "src", "main", "java", "com", "jackstoneley", "wordrattle");
fs.mkdirSync(pkgDir, { recursive: true });
fs.copyFileSync(path.join(app, "native", "WordRattlePlugin.java"), path.join(pkgDir, "WordRattlePlugin.java"));
fs.copyFileSync(path.join(app, "native", "UpdateFileProvider.java"), path.join(pkgDir, "UpdateFileProvider.java"));
fs.mkdirSync(path.join(res, "xml"), { recursive: true });
fs.copyFileSync(path.join(app, "native", "update_paths.xml"), path.join(res, "xml", "update_paths.xml"));
fs.writeFileSync(path.join(pkgDir, "MainActivity.java"), `package com.jackstoneley.wordrattle;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WordRattlePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);

// 2. gradle: nearby dependency, signing, version
edit(path.join(droid, "build.gradle"), s => {
  s = s.replace(/android\s*\{/, `android {
    signingConfigs {
        debug {
            storeFile file("../../wordrattle.keystore")
            storePassword "wordrattle"
            keyAlias "wordrattle"
            keyPassword "wordrattle"
        }
    }`);
  s = s.replace(/versionCode\s+\d+/, "versionCode " + code).replace(/versionName\s+"[^"]*"/, `versionName "1.${code}"`);
  s = s.replace(/dependencies\s*\{/, `dependencies {
    implementation "com.google.android.gms:play-services-nearby:19.3.0"`);
  return s;
});

// 3. manifest: permissions, portrait, links
edit(path.join(droid, "src", "main", "AndroidManifest.xml"), s => {
  const perms = [
    '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
    '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
    '<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />',
    '<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />',
    '<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />',
    '<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />',
    '<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />',
    '<uses-permission android:name="android.permission.NEARBY_WIFI_DEVICES" />',
    '<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />',
    '<uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />',
    '<uses-permission android:name="android.permission.VIBRATE" />',
    '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />'
  ].join("\n    ");
  s = s.replace("<application", perms + "\n\n    <application");
  s = s.replace(/android:name="\.MainActivity"/, 'android:name=".MainActivity"\n            android:screenOrientation="portrait"');
  s = s.replace(/(<activity[\s\S]*?<\/intent-filter>)/, `$1

            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="jackstoneley.github.io" android:pathPrefix="/word-rattle" />
            </intent-filter>`);
  s = s.replace("</application>", `    <provider
            android:name=".UpdateFileProvider"
            android:authorities="\${applicationId}.updates"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/update_paths" />
        </provider>
    </application>`);
  return s;
});

// 4. icons + splash
for (const d of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
  const dir = path.join(res, "mipmap-" + d);
  if (!fs.existsSync(dir)) continue;
  for (const n of ["ic_launcher", "ic_launcher_round", "ic_launcher_foreground"])
    fs.copyFileSync(path.join(app, "assets", `${n}-${d}.png`), path.join(dir, n + ".png"));
}
const bg = path.join(res, "values", "ic_launcher_background.xml");
fs.writeFileSync(bg, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1F3A93</color>\n</resources>\n');
let splashes = 0;
for (const d of fs.readdirSync(res)) {
  const f = path.join(res, d, "splash.png");
  if (fs.existsSync(f)) { fs.copyFileSync(path.join(app, "assets", "splash.png"), f); splashes++; }
}
console.log(`Android project patched (version ${code}, ${splashes} splash images).`);
