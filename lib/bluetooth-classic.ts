import { PermissionsAndroid, Platform } from "react-native";
import { describeNearbyDeviceError } from "@/shared/nearby-device-domain";

export type StudyMatrixDevice = {
  name: string;
  address: string;
  rssi: number;
};

const studyMatrixTag = /^SM-[A-Z0-9]+$/;

async function requestDiscoveryPermissions() {
  if (Platform.OS !== "android") throw new Error("Bluetooth attendance discovery is available only on Android");

  const permissions = Platform.Version >= 31
    ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const results = await PermissionsAndroid.requestMultiple(permissions);
  const granted = Object.values(results).every((status) => status === PermissionsAndroid.RESULTS.GRANTED);
  if (!granted) throw new Error("Nearby-device permission is required to scan attendance device tags");
}

function toStudyMatrixDevice(device: { name: string; address: string; rssi: Number }): StudyMatrixDevice | undefined {
  const name = device.name?.trim().toUpperCase();
  if (!name || !studyMatrixTag.test(name)) return undefined;
  return { name, address: device.address, rssi: Number(device.rssi) };
}

/**
 * Discovers locally visible Android Bluetooth Classic devices whose broadcast name
 * follows the student identifier convention `SM-<ENROLLMENT_NUMBER>`.
 * This runs only in a custom Android build; Expo Go does not include the native bridge.
 */
export async function scanStudyMatrixDevices(onFound?: (device: StudyMatrixDevice) => void): Promise<StudyMatrixDevice[]> {
  if (Platform.OS !== "android") throw new Error("Use a custom Android build to run Bluetooth attendance discovery");
  await requestDiscoveryPermissions();

  const { default: BluetoothClassic } = await import("react-native-bluetooth-classic");
  if (!(await BluetoothClassic.isBluetoothAvailable())) throw new Error("This device does not support Bluetooth");

  if (!(await BluetoothClassic.isBluetoothEnabled())) {
    const enabled = await BluetoothClassic.requestBluetoothEnabled();
    if (!enabled) throw new Error("Turn on Bluetooth to start attendance discovery");
  }

  const found = new Map<string, StudyMatrixDevice>();
  const capture = (candidate: { name: string; address: string; rssi: Number }) => {
    const device = toStudyMatrixDevice(candidate);
    if (device && !found.has(device.address)) {
      found.set(device.address, device);
      onFound?.(device);
    }
  };

  const subscription = BluetoothClassic.onDeviceDiscovered((event) => capture(event.device));
  try {
    const discovered = await BluetoothClassic.startDiscovery();
    discovered.forEach(capture);
    return [...found.values()];
  } finally {
    subscription.remove();
  }
}

export async function cancelStudyMatrixDiscovery() {
  if (Platform.OS !== "android") return false;
  const { default: BluetoothClassic } = await import("react-native-bluetooth-classic");
  return BluetoothClassic.cancelDiscovery();
}

export async function setStudyMatrixDeviceName(deviceTag: string) {
  if (!studyMatrixTag.test(deviceTag)) throw new Error("The StudyMatrix device tag format is invalid");
  if (Platform.OS !== "android") throw new Error("Bluetooth device-name setup is available only on Android");
  await requestDiscoveryPermissions();
  const { default: BluetoothClassic } = await import("react-native-bluetooth-classic");
  if (!(await BluetoothClassic.isBluetoothAvailable())) throw new Error("This device does not support Bluetooth");
  if (!(await BluetoothClassic.isBluetoothEnabled())) {
    const enabled = await BluetoothClassic.requestBluetoothEnabled();
    if (!enabled) throw new Error("Turn on Bluetooth before setting the StudyMatrix device name");
  }
  const updated = await BluetoothClassic.setBluetoothAdapterName(deviceTag);
  if (!updated) throw new Error("Android did not accept the Bluetooth device name change");
  return deviceTag;
}

export function describeBluetoothDiscoveryError(error: unknown) {
  return describeNearbyDeviceError(error);
}
