/*
Copyright 2026 Element Software Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadUserVolume,
  saveUserVolume,
  loadScreenShareVolume,
  saveScreenShareVolume,
} from "./userVolumeStore";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("loadUserVolume", () => {
  it("returns 1 when no value is stored", () => {
    expect(loadUserVolume("@alice:example.org")).toBe(1);
  });

  it("returns the stored value when valid", () => {
    localStorage.setItem("ec-user-volume:@alice:example.org", "0.5");
    expect(loadUserVolume("@alice:example.org")).toBe(0.5);
  });

  it("returns 0 for stored value 0", () => {
    localStorage.setItem("ec-user-volume:@alice:example.org", "0");
    expect(loadUserVolume("@alice:example.org")).toBe(0);
  });

  it("returns 1 for stored value 1", () => {
    localStorage.setItem("ec-user-volume:@alice:example.org", "1");
    expect(loadUserVolume("@alice:example.org")).toBe(1);
  });

  it("returns 1 for corrupt JSON", () => {
    localStorage.setItem("ec-user-volume:@alice:example.org", "not-json{");
    expect(loadUserVolume("@alice:example.org")).toBe(1);
  });

  it("returns 1 for non-number values", () => {
    localStorage.setItem("ec-user-volume:@alice:example.org", '"a string"');
    expect(loadUserVolume("@alice:example.org")).toBe(1);
  });

  it("returns 1 for boolean values", () => {
    localStorage.setItem("ec-user-volume:@alice:example.org", "true");
    expect(loadUserVolume("@alice:example.org")).toBe(1);
  });

  it("returns 1 for object values", () => {
    localStorage.setItem("ec-user-volume:@alice:example.org", '{"a":1}');
    expect(loadUserVolume("@alice:example.org")).toBe(1);
  });

  it("clamps values greater than 1", () => {
    localStorage.setItem("ec-user-volume:@alice:example.org", "1.5");
    expect(loadUserVolume("@alice:example.org")).toBe(1);
  });

  it("clamps negative values to 0", () => {
    localStorage.setItem("ec-user-volume:@alice:example.org", "-0.3");
    expect(loadUserVolume("@alice:example.org")).toBe(0);
  });

  it("returns 1 for NaN string", () => {
    localStorage.setItem("ec-user-volume:@alice:example.org", "NaN");
    expect(loadUserVolume("@alice:example.org")).toBe(1);
  });

  it("returns 1 for Infinity string", () => {
    localStorage.setItem("ec-user-volume:@alice:example.org", "Infinity");
    expect(loadUserVolume("@alice:example.org")).toBe(1);
  });

  it("returns 1 when localStorage.getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage error");
    });
    expect(loadUserVolume("@alice:example.org")).toBe(1);
  });
});

describe("saveUserVolume", () => {
  it("writes to the correct key", () => {
    saveUserVolume("@alice:example.org", 0.7);
    expect(localStorage.getItem("ec-user-volume:@alice:example.org")).toBe(
      "0.7",
    );
  });

  it("overwrites a previously stored value", () => {
    saveUserVolume("@alice:example.org", 0.7);
    saveUserVolume("@alice:example.org", 0.3);
    expect(localStorage.getItem("ec-user-volume:@alice:example.org")).toBe(
      "0.3",
    );
  });

  it("does not throw when localStorage.setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => saveUserVolume("@alice:example.org", 0.7)).not.toThrow();
  });
});

describe("loadScreenShareVolume", () => {
  it("returns 1 when no value is stored", () => {
    expect(loadScreenShareVolume("@alice:example.org")).toBe(1);
  });

  it("returns the stored value when valid", () => {
    localStorage.setItem(
      "ec-screenshare-volume:@alice:example.org",
      "0.3",
    );
    expect(loadScreenShareVolume("@alice:example.org")).toBe(0.3);
  });

  it("uses a different key from user volume", () => {
    localStorage.setItem("ec-user-volume:@alice:example.org", "0.5");
    expect(loadScreenShareVolume("@alice:example.org")).toBe(1);
  });
});

describe("saveScreenShareVolume", () => {
  it("writes to the correct key", () => {
    saveScreenShareVolume("@alice:example.org", 0.4);
    expect(
      localStorage.getItem("ec-screenshare-volume:@alice:example.org"),
    ).toBe("0.4");
  });

  it("does not interfere with user volume key", () => {
    saveUserVolume("@alice:example.org", 0.7);
    saveScreenShareVolume("@alice:example.org", 0.4);
    expect(localStorage.getItem("ec-user-volume:@alice:example.org")).toBe(
      "0.7",
    );
    expect(
      localStorage.getItem("ec-screenshare-volume:@alice:example.org"),
    ).toBe("0.4");
  });
});
