import { describe, it, expect, vi, beforeEach } from "vitest";

function mockAudioContext() {
  const ctx = {
    state: "suspended",
    currentTime: 0,
    destination: {},
    resume: vi.fn(() => {
      ctx.state = "running";
    }),
    createOscillator: vi.fn(() => ({
      type: "",
      frequency: { value: 0 },
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createGain: vi.fn(() => ({
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis(),
    })),
  };
  return ctx;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("AudioContext", vi.fn(mockAudioContext));
  vi.unstubAllGlobals;
});

describe("no AudioContext available", () => {
  it("unlockAudio is a no-op", async () => {
    delete globalThis.AudioContext;
    delete globalThis.webkitAudioContext;
    const { unlockAudio } = await import("./sound");
    expect(() => unlockAudio()).not.toThrow();
  });

  it("playDing is a no-op", async () => {
    delete globalThis.AudioContext;
    delete globalThis.webkitAudioContext;
    const { playDing } = await import("./sound");
    expect(() => playDing()).not.toThrow();
  });
});

describe("unlockAudio", () => {
  it("resumes a suspended AudioContext", async () => {
    const { unlockAudio } = await import("./sound");
    unlockAudio();
    const ctx = AudioContext.mock.results[0].value;
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.state).toBe("running");
  });

  it("does not resume an already-running context", async () => {
    const { unlockAudio } = await import("./sound");
    unlockAudio(); // first call creates + resumes
    const ctx = AudioContext.mock.results[0].value;
    ctx.resume.mockClear();
    ctx.state = "running";
    unlockAudio();
    expect(ctx.resume).not.toHaveBeenCalled();
  });
});

describe("playDing", () => {
  it("creates oscillators and gain nodes for each harmonic", async () => {
    const { playDing } = await import("./sound");
    playDing();
    const ctx = AudioContext.mock.results[0].value;
    expect(ctx.createOscillator).toHaveBeenCalledTimes(3);
    expect(ctx.createGain).toHaveBeenCalledTimes(3);
  });

  it("starts and stops each oscillator", async () => {
    const { playDing } = await import("./sound");
    playDing();
    const ctx = AudioContext.mock.results[0].value;
    for (const { value: osc } of ctx.createOscillator.mock.results) {
      expect(osc.start).toHaveBeenCalledOnce();
      expect(osc.stop).toHaveBeenCalledOnce();
    }
  });

  it("reuses the same AudioContext across calls", async () => {
    const { playDing } = await import("./sound");
    playDing();
    playDing();
    expect(AudioContext).toHaveBeenCalledTimes(1);
  });
});
