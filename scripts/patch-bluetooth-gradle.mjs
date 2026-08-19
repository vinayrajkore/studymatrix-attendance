import fs from "node:fs";
import path from "node:path";

const gradleFile = path.join(
  process.cwd(),
  "node_modules",
  "react-native-bluetooth-classic",
  "android",
  "build.gradle",
);
const packageFile = path.join(
  process.cwd(),
  "node_modules",
  "react-native-bluetooth-classic",
  "android",
  "src",
  "main",
  "java",
  "kjd",
  "reactnative",
  "bluetooth",
  "RNBluetoothClassicPackage.java",
);

if (!fs.existsSync(gradleFile)) {
  console.warn("[bluetooth-gradle-patch] Bluetooth Classic module is not installed; skipping native patch.");
  process.exit(0);
}

const legacyBuildscript = `buildscript {
    repositories {
        google()
        mavenCentral()
    }

    dependencies {
        classpath 'com.android.tools.build:gradle:3.4.3'
    }
}

`;

let source = fs.readFileSync(gradleFile, "utf8");
source = source
  .replace(legacyBuildscript, "")
  .replace("lintOptions {", "lint {")
  .replace(
    "implementation 'com.facebook.react:react-native:0.71.0-rc.0'",
    "implementation(\"com.facebook.react:react-android\")",
  );

if (!source.includes("implementation(\"com.facebook.react:react-android\")") || source.includes("agp:3.4.3")) {
  throw new Error("Unable to apply the required Android Gradle compatibility repair to react-native-bluetooth-classic.");
}

fs.writeFileSync(gradleFile, source);

if (fs.existsSync(packageFile)) {
  const legacyCreateJsModules = `    /**
     * @deprecated in version 0.47
     */
    @Deprecated
    public List<Class<? extends JavaScriptModule>> createJSModules() {
        return Collections.emptyList();
    }

`;
  const packageSource = fs
    .readFileSync(packageFile, "utf8")
    .replace("import com.facebook.react.bridge.JavaScriptModule;\n", "")
    .replace(legacyCreateJsModules, "");
  if (packageSource.includes("JavaScriptModule")) {
    throw new Error("Unable to remove the obsolete JavaScriptModule API from react-native-bluetooth-classic.");
  }
  fs.writeFileSync(packageFile, packageSource);
}

console.log("[bluetooth-gradle-patch] Applied React Native 0.81 / Android Gradle Plugin 8 compatibility repair.");
