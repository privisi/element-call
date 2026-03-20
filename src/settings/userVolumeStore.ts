/*
Copyright 2026 Element Software Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

const USER_VOLUME_PREFIX = "ec-user-volume:";
const SCREENSHARE_VOLUME_PREFIX = "ec-screenshare-volume:";

function loadVolume(storageKey: string): number {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return 1;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "number" || !isFinite(value)) return 1;
    return Math.max(0, Math.min(1, value));
  } catch {
    return 1;
  }
}

function saveVolume(storageKey: string, volume: number): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(volume));
  } catch {
    // Storage unavailable or full — degrade gracefully
  }
}

export function loadUserVolume(userId: string): number {
  return loadVolume(`${USER_VOLUME_PREFIX}${userId}`);
}

export function saveUserVolume(userId: string, volume: number): void {
  saveVolume(`${USER_VOLUME_PREFIX}${userId}`, volume);
}

export function loadScreenShareVolume(userId: string): number {
  return loadVolume(`${SCREENSHARE_VOLUME_PREFIX}${userId}`);
}

export function saveScreenShareVolume(userId: string, volume: number): void {
  saveVolume(`${SCREENSHARE_VOLUME_PREFIX}${userId}`, volume);
}
