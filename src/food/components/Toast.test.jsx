import { act, fireEvent, render, screen } from "@testing-library/react";
import Toast from "./Toast";

describe("Toast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the message in a status region", () => {
    render(<Toast message="Logged Egg" onDone={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Logged Egg");
  });

  it("calls onDone once, after the default duration", () => {
    const onDone = vi.fn();
    render(<Toast message="Logged Egg" onDone={onDone} />);
    act(() => vi.advanceTimersByTime(2999));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(10000));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("honours durationMs", () => {
    const onDone = vi.fn();
    render(<Toast message="Logged Egg" onDone={onDone} durationMs={500} />);
    act(() => vi.advanceTimersByTime(500));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("the action calls onAction", () => {
    const onAction = vi.fn();
    render(
      <Toast
        message="Logged Egg"
        actionLabel="Undo"
        onAction={onAction}
        onDone={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("renders no button without an action label", () => {
    render(<Toast message="Logged Egg" onDone={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("a changed onDone does not restart the timer, and the latest one is called", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Toast message="Logged Egg" onDone={first} />);
    act(() => vi.advanceTimersByTime(2000));
    rerender(<Toast message="Logged Egg" onDone={second} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("does not call onDone after unmount", () => {
    const onDone = vi.fn();
    const { unmount } = render(<Toast message="Logged Egg" onDone={onDone} />);
    unmount();
    act(() => vi.advanceTimersByTime(5000));
    expect(onDone).not.toHaveBeenCalled();
  });
});
