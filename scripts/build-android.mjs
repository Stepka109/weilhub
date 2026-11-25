// Sestaví podepsanou aplikaci pro Android a zkopíruje ji do public/android.
// Potřebuje Android SDK (android/local.properties) a podpisový klíč
// (android/keystore.properties + .jks) – oboje jen na počítači správce, mimo git.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const android = join(root, "android");
if (!existsSync(join(android, "keystore.properties"))) {
  console.error("Chybí android/keystore.properties – bez podpisového klíče nejde aplikaci vydat.");
  process.exit(1);
}
const gradlew = process.platform === "win32" ? join(android, "gradlew.bat") : "./gradlew";
execFileSync(gradlew, ["assembleRelease", "--console=plain", "-q"], { cwd: android, stdio: "inherit", shell: process.platform === "win32" });

const base = process.env.LOCALAPPDATA ?? process.env.TMPDIR ?? "/tmp";
const apk = join(base, "weilhub-android-build", "app", "outputs", "apk", "release", "app-release.apk");
mkdirSync(join(root, "public", "android"), { recursive: true });
copyFileSync(apk, join(root, "public", "android", "WeilHub.apk"));
console.log(`Hotovo: public/android/WeilHub.apk (${Math.round(statSync(apk).size / 1024)} kB)`);
