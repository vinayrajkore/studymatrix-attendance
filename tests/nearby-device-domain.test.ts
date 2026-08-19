import { describe, expect, it } from "vitest";
import { describeNearbyDeviceError } from "../shared/nearby-device-domain";

describe("Bluetooth discovery guidance", () => {
  it("converts common permission and adapter failures into actionable guidance", () => {
    expect(describeNearbyDeviceError(new Error("Nearby-device permission was denied"))).toContain("Allow it");
    expect(describeNearbyDeviceError(new Error("Bluetooth adapter is disabled"))).toContain("Turn it on");
  });

  it("explains scanner concurrency and preview limitations", () => {
    expect(describeNearbyDeviceError(new Error("Bluetooth adapter is already in discovery"))).toContain("already running");
    expect(describeNearbyDeviceError(new Error("Use a custom Android build"))).toContain("installed StudyMatrix Android build");
  });
});
