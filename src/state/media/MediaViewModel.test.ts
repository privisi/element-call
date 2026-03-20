/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, expect, onTestFinished, test, vi } from "vitest";
import {
  type LocalTrackPublication,
  LocalVideoTrack,
  Track,
  TrackEvent,
} from "livekit-client";
import { waitFor } from "@testing-library/dom";

import {
  mockLocalParticipant,
  mockMediaDevices,
  mockRtcMembership,
  mockLocalMedia,
  mockRemoteMedia,
  withTestScheduler,
  mockRemoteParticipant,
  mockRemoteScreenShare,
} from "../../utils/test";
import { constant } from "../Behavior";

global.MediaStreamTrack = class {} as unknown as {
  new (): MediaStreamTrack;
  prototype: MediaStreamTrack;
};
global.MediaStream = class {} as unknown as {
  new (): MediaStream;
  prototype: MediaStream;
};

const platformMock = vi.hoisted(() => vi.fn(() => "desktop"));
vi.mock("../../Platform", () => ({
  get platform(): string {
    return platformMock();
  },
}));

afterEach(() => {
  localStorage.clear();
});

const rtcMembership = mockRtcMembership("@alice:example.org", "AAAA");

test("control a participant's volume", () => {
  const setVolumeSpy = vi.fn();
  const vm = mockRemoteMedia(
    rtcMembership,
    {},
    mockRemoteParticipant({ setVolume: setVolumeSpy }),
  );
  withTestScheduler(({ expectObservable, schedule }) => {
    schedule("-ab---c---d|", {
      a() {
        // Try muting by toggling
        vm.togglePlaybackMuted();
        expect(setVolumeSpy).toHaveBeenLastCalledWith(0);
      },
      b() {
        // Try unmuting by dragging the slider back up
        vm.adjustPlaybackVolume(0.6);
        vm.adjustPlaybackVolume(0.8);
        vm.commitPlaybackVolume();
        expect(setVolumeSpy).toHaveBeenCalledWith(0.6);
        expect(setVolumeSpy).toHaveBeenLastCalledWith(0.8);
      },
      c() {
        // Try muting by dragging the slider back down
        vm.adjustPlaybackVolume(0.2);
        vm.adjustPlaybackVolume(0);
        vm.commitPlaybackVolume();
        expect(setVolumeSpy).toHaveBeenCalledWith(0.2);
        expect(setVolumeSpy).toHaveBeenLastCalledWith(0);
      },
      d() {
        // Try unmuting by toggling
        vm.togglePlaybackMuted();
        // The volume should return to the last non-zero committed volume
        expect(setVolumeSpy).toHaveBeenLastCalledWith(0.8);
      },
    });
    expectObservable(vm.playbackVolume$).toBe("ab(cd)(ef)g", {
      a: 1,
      b: 0,
      c: 0.6,
      d: 0.8,
      e: 0.2,
      f: 0,
      g: 0.8,
    });
  });
});

test("control a participant's screen share volume", () => {
  const setVolumeSpy = vi.fn();
  const vm = mockRemoteScreenShare(
    rtcMembership,
    {},
    mockRemoteParticipant({ setVolume: setVolumeSpy }),
  );
  withTestScheduler(({ expectObservable, schedule }) => {
    schedule("-ab---c---d|", {
      a() {
        // Try muting by toggling
        vm.togglePlaybackMuted();
        expect(setVolumeSpy).toHaveBeenLastCalledWith(
          0,
          Track.Source.ScreenShareAudio,
        );
      },
      b() {
        // Try unmuting by dragging the slider back up
        vm.adjustPlaybackVolume(0.6);
        vm.adjustPlaybackVolume(0.8);
        vm.commitPlaybackVolume();
        expect(setVolumeSpy).toHaveBeenCalledWith(
          0.6,
          Track.Source.ScreenShareAudio,
        );
        expect(setVolumeSpy).toHaveBeenLastCalledWith(
          0.8,
          Track.Source.ScreenShareAudio,
        );
      },
      c() {
        // Try muting by dragging the slider back down
        vm.adjustPlaybackVolume(0.2);
        vm.adjustPlaybackVolume(0);
        vm.commitPlaybackVolume();
        expect(setVolumeSpy).toHaveBeenCalledWith(
          0.2,
          Track.Source.ScreenShareAudio,
        );
        expect(setVolumeSpy).toHaveBeenLastCalledWith(
          0,
          Track.Source.ScreenShareAudio,
        );
      },
      d() {
        // Try unmuting by toggling
        vm.togglePlaybackMuted();
        // The volume should return to the last non-zero committed volume
        expect(setVolumeSpy).toHaveBeenLastCalledWith(
          0.8,
          Track.Source.ScreenShareAudio,
        );
      },
    });
    expectObservable(vm.playbackVolume$).toBe("ab(cd)(ef)g", {
      a: 1,
      b: 0,
      c: 0.6,
      d: 0.8,
      e: 0.2,
      f: 0,
      g: 0.8,
    });
  });
});

test("local media remembers whether it should always be shown", () => {
  const vm1 = mockLocalMedia(
    rtcMembership,
    {},
    mockLocalParticipant({}),
    mockMediaDevices({}),
  );
  withTestScheduler(({ expectObservable, schedule }) => {
    schedule("-a|", { a: () => vm1.setAlwaysShow(false) });
    expectObservable(vm1.alwaysShow$).toBe("ab", { a: true, b: false });
  });

  // Next local media should start out *not* always shown
  const vm2 = mockLocalMedia(
    rtcMembership,
    {},
    mockLocalParticipant({}),
    mockMediaDevices({}),
  );
  withTestScheduler(({ expectObservable, schedule }) => {
    schedule("-a|", { a: () => vm2.setAlwaysShow(true) });
    expectObservable(vm2.alwaysShow$).toBe("ab", { a: false, b: true });
  });
});

test("switch cameras", async () => {
  // Camera switching is only available on mobile
  platformMock.mockReturnValue("android");
  onTestFinished(() => void platformMock.mockReset());

  // Construct a mock video track which knows how to be restarted
  const track = new LocalVideoTrack({
    getConstraints() {},
    addEventListener() {},
    removeEventListener() {},
  } as unknown as MediaStreamTrack);

  let deviceId = "front camera";
  const restartTrack = vi.fn(async ({ facingMode }) => {
    deviceId = facingMode === "user" ? "front camera" : "back camera";
    track.emit(TrackEvent.Restarted);
    return Promise.resolve();
  });
  track.restartTrack = restartTrack;

  Object.defineProperty(track, "mediaStreamTrack", {
    get() {
      return {
        label: "Video",
        getSettings: (): object => ({
          deviceId,
          facingMode: deviceId === "front camera" ? "user" : "environment",
        }),
      };
    },
  });

  const selectVideoInput = vi.fn();

  const vm = mockLocalMedia(
    rtcMembership,
    {},
    mockLocalParticipant({
      getTrackPublication() {
        return { track } as unknown as LocalTrackPublication;
      },
    }),
    mockMediaDevices({
      videoInput: {
        available$: constant(new Map()),
        selected$: constant(undefined),
        select: selectVideoInput,
      },
    }),
  );

  // Switch to back camera
  vm.switchCamera$.value!();
  expect(restartTrack).toHaveBeenCalledExactlyOnceWith({
    facingMode: "environment",
  });
  await waitFor(() => {
    expect(selectVideoInput).toHaveBeenCalledTimes(1);
    expect(selectVideoInput).toHaveBeenCalledWith("back camera");
  });
  expect(deviceId).toBe("back camera");

  // Switch to front camera
  vm.switchCamera$.value!();
  expect(restartTrack).toHaveBeenCalledTimes(2);
  expect(restartTrack).toHaveBeenLastCalledWith({ facingMode: "user" });
  await waitFor(() => {
    expect(selectVideoInput).toHaveBeenCalledTimes(2);
    expect(selectVideoInput).toHaveBeenLastCalledWith("front camera");
  });
  expect(deviceId).toBe("front camera");
});

test("remote media is in waiting state when participant has not yet connected", () => {
  const vm = mockRemoteMedia(rtcMembership, {}, null); // null participant
  expect(vm.waitingForMedia$.value).toBe(true);
});

test("remote media is not in waiting state when participant is connected", () => {
  const vm = mockRemoteMedia(rtcMembership, {}, mockRemoteParticipant({}));
  expect(vm.waitingForMedia$.value).toBe(false);
});

test("remote media is not in waiting state when participant is connected with no publications", () => {
  const vm = mockRemoteMedia(
    rtcMembership,
    {},
    mockRemoteParticipant({
      getTrackPublication: () => undefined,
      getTrackPublications: () => [],
    }),
  );
  expect(vm.waitingForMedia$.value).toBe(false);
});

test("remote media is not in waiting state when user does not intend to publish anywhere", () => {
  const vm = mockRemoteMedia(
    rtcMembership,
    {},
    mockRemoteParticipant({}),
    undefined, // No room (no advertised transport)
  );
  expect(vm.waitingForMedia$.value).toBe(false);
});

test("remote media starts with persisted volume", () => {
  localStorage.setItem("ec-user-volume:@alice:example.org", "0.5");
  const setVolumeSpy = vi.fn();
  const vm = mockRemoteMedia(
    rtcMembership,
    {},
    mockRemoteParticipant({ setVolume: setVolumeSpy }),
  );
  expect(vm.playbackVolume$.value).toBe(0.5);
  expect(setVolumeSpy).toHaveBeenCalledWith(0.5);
});

test("remote media persists volume on commit", () => {
  const vm = mockRemoteMedia(
    rtcMembership,
    {},
    mockRemoteParticipant({ setVolume: vi.fn() }),
  );
  vm.adjustPlaybackVolume(0.7);
  vm.commitPlaybackVolume();
  expect(localStorage.getItem("ec-user-volume:@alice:example.org")).toBe(
    "0.7",
  );
});

test("remote media with persisted volume 0 starts muted and unmutes to 1", () => {
  localStorage.setItem("ec-user-volume:@alice:example.org", "0");
  const setVolumeSpy = vi.fn();
  const vm = mockRemoteMedia(
    rtcMembership,
    {},
    mockRemoteParticipant({ setVolume: setVolumeSpy }),
  );
  expect(vm.playbackVolume$.value).toBe(0);
  vm.togglePlaybackMuted();
  expect(vm.playbackVolume$.value).toBe(1);
  expect(setVolumeSpy).toHaveBeenLastCalledWith(1);
});

test("remote screen share starts with persisted volume", () => {
  localStorage.setItem("ec-screenshare-volume:@alice:example.org", "0.3");
  const setVolumeSpy = vi.fn();
  const vm = mockRemoteScreenShare(
    rtcMembership,
    {},
    mockRemoteParticipant({ setVolume: setVolumeSpy }),
  );
  expect(vm.playbackVolume$.value).toBe(0.3);
  expect(setVolumeSpy).toHaveBeenCalledWith(
    0.3,
    Track.Source.ScreenShareAudio,
  );
});

test("remote screen share persists volume on commit", () => {
  const vm = mockRemoteScreenShare(
    rtcMembership,
    {},
    mockRemoteParticipant({ setVolume: vi.fn() }),
  );
  vm.adjustPlaybackVolume(0.4);
  vm.commitPlaybackVolume();
  expect(
    localStorage.getItem("ec-screenshare-volume:@alice:example.org"),
  ).toBe("0.4");
});

test("remote media supports amplified volume above 1.0", () => {
  const setVolumeSpy = vi.fn();
  const vm = mockRemoteMedia(
    rtcMembership,
    {},
    mockRemoteParticipant({ setVolume: setVolumeSpy }),
  );
  vm.adjustPlaybackVolume(1.5);
  vm.commitPlaybackVolume();
  expect(vm.playbackVolume$.value).toBe(1.5);
  expect(setVolumeSpy).toHaveBeenCalledWith(1.5);
  expect(localStorage.getItem("ec-user-volume:@alice:example.org")).toBe(
    "1.5",
  );
});

test("remote media starts with persisted amplified volume", () => {
  localStorage.setItem("ec-user-volume:@alice:example.org", "1.8");
  const setVolumeSpy = vi.fn();
  const vm = mockRemoteMedia(
    rtcMembership,
    {},
    mockRemoteParticipant({ setVolume: setVolumeSpy }),
  );
  expect(vm.playbackVolume$.value).toBe(1.8);
  expect(setVolumeSpy).toHaveBeenCalledWith(1.8);
});

test("remote media mute/unmute at amplified volume restores last committed volume", () => {
  const setVolumeSpy = vi.fn();
  const vm = mockRemoteMedia(
    rtcMembership,
    {},
    mockRemoteParticipant({ setVolume: setVolumeSpy }),
  );
  vm.adjustPlaybackVolume(1.5);
  vm.commitPlaybackVolume();
  expect(vm.playbackVolume$.value).toBe(1.5);
  vm.togglePlaybackMuted();
  expect(vm.playbackVolume$.value).toBe(0);
  expect(setVolumeSpy).toHaveBeenCalledWith(0);
  vm.togglePlaybackMuted();
  expect(vm.playbackVolume$.value).toBe(1.5);
  expect(setVolumeSpy).toHaveBeenLastCalledWith(1.5);
});
