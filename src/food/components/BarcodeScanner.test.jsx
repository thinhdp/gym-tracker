import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createDetector } from "../lib/barcode";
import BarcodeScanner from "./BarcodeScanner";

vi.mock("../lib/barcode", async (importActual) => ({
  ...(await importActual()),
  createDetector: vi.fn(),
}));

const original = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");

function setMediaDevices(value) {
  Object.defineProperty(navigator, "mediaDevices", {
    value,
    configurable: true,
    writable: true,
  });
}

function setup() {
  const onDetected = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <BarcodeScanner onDetected={onDetected} onCancel={onCancel} />,
  );
  return { ...view, onDetected, onCancel, user: userEvent.setup() };
}

describe("BarcodeScanner", () => {
  beforeEach(() => {
    createDetector.mockReset();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (original) Object.defineProperty(navigator, "mediaDevices", original);
    else delete navigator.mediaDevices;
    vi.restoreAllMocks();
  });

  it("without mediaDevices shows the manual field, rejects a bad code and submits a valid trimmed one", async () => {
    setMediaDevices(undefined);
    const { user, onDetected } = setup();
    await screen.findByText("Camera unavailable");

    await user.type(screen.getByLabelText("Barcode"), "1234");
    await user.click(screen.getByRole("button", { name: "Use" }));
    expect(screen.getByText("Enter 8 to 14 digits")).toBeInTheDocument();
    expect(onDetected).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Barcode"));
    await user.type(screen.getByLabelText("Barcode"), "  8934563138165 ");
    await user.click(screen.getByRole("button", { name: "Use" }));
    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(onDetected).toHaveBeenCalledWith("8934563138165");
    expect(screen.getByLabelText("Barcode")).toHaveAttribute(
      "inputmode",
      "numeric",
    );
    expect(createDetector).not.toHaveBeenCalled();
  });

  it("falls back to the manual field when getUserMedia rejects and creates no detector", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    setMediaDevices({ getUserMedia });
    setup();
    await screen.findByText("Camera unavailable");
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: "environment" },
    });
    expect(createDetector).not.toHaveBeenCalled();
  });

  it("reports a decoded code once and stops the track and detector on unmount", async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    setMediaDevices({ getUserMedia: vi.fn().mockResolvedValue(stream) });
    const detector = {
      detectOnce: vi.fn().mockResolvedValue("8934563138165"),
      stop: vi.fn(),
    };
    createDetector.mockResolvedValue(detector);

    const { onDetected, unmount } = setup();
    await waitFor(() => expect(onDetected).toHaveBeenCalledTimes(1));
    expect(onDetected).toHaveBeenCalledWith("8934563138165");
    expect(screen.queryByText("Camera unavailable")).toBeNull();

    unmount();
    expect(track.stop).toHaveBeenCalled();
    expect(detector.stop).toHaveBeenCalled();
    expect(onDetected).toHaveBeenCalledTimes(1);
  });

  it("skips an invalid decode and keeps scanning", async () => {
    setMediaDevices({
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
    });
    const detector = {
      detectOnce: vi
        .fn()
        .mockResolvedValueOnce("abc")
        .mockResolvedValueOnce("12345678"),
      stop: vi.fn(),
    };
    createDetector.mockResolvedValue(detector);

    const { onDetected } = setup();
    await waitFor(() => expect(onDetected).toHaveBeenCalledTimes(1));
    expect(onDetected).toHaveBeenCalledWith("12345678");
    expect(detector.detectOnce).toHaveBeenCalledTimes(2);
  });

  it("Cancel stops the camera and calls onCancel", async () => {
    const track = { stop: vi.fn() };
    setMediaDevices({
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }),
    });
    const detector = {
      detectOnce: vi.fn(() => new Promise(() => {})),
      stop: vi.fn(),
    };
    createDetector.mockResolvedValue(detector);

    const { user, onCancel } = setup();
    await waitFor(() => expect(detector.detectOnce).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(track.stop).toHaveBeenCalled();
    expect(detector.stop).toHaveBeenCalled();
  });
});
