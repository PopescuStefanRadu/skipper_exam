import type { CapacitorConfig } from "@capacitor/cli";

// The Android app: the built web app, served from the device.
const config: CapacitorConfig = {
  appId: "ro.skipperexam.app",
  appName: "Examen CAA",
  webDir: "dist",
};

export default config;
