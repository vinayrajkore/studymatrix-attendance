export function describeNearbyDeviceError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to start nearby-device discovery";
  const normalized = message.toLowerCase();
  if (normalized.includes("permission") || normalized.includes("nearby-device")) return "Nearby-device permission is required. Allow it in the Android prompt, then try again.";
  if (normalized.includes("turn on bluetooth") || normalized.includes("disabled")) return "Bluetooth is off. Turn it on, confirm the Android prompt, and start the scan again.";
  if (normalized.includes("already in discovery")) return "Another Bluetooth discovery is already running. Wait for it to finish or cancel it first.";
  if (normalized.includes("custom android build")) return "Bluetooth attendance discovery requires the installed StudyMatrix Android build, not the standard preview.";
  return message;
}
