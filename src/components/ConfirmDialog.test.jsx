import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmProvider, useConfirm } from "./ConfirmDialog";

/** Harness: a consumer that opens the dialog and records the result. */
function Caller({ onResult, opts }) {
  const confirm = useConfirm();
  return (
    <button onClick={() => confirm(opts).then(onResult)}>open dialog</button>
  );
}

const setup = (opts = {}) => {
  const onResult = vi.fn();
  const user = userEvent.setup();
  render(
    <ConfirmProvider>
      <Caller onResult={onResult} opts={opts} />
    </ConfirmProvider>,
  );
  return { onResult, user };
};

describe("ConfirmProvider / useConfirm", () => {
  it("renders the provided title, message, and confirm text", async () => {
    const { user } = setup({
      title: "Delete workout?",
      message: "It will be gone.",
      confirmText: "Delete it",
    });
    await user.click(screen.getByText("open dialog"));
    expect(screen.getByText("Delete workout?")).toBeInTheDocument();
    expect(screen.getByText("It will be gone.")).toBeInTheDocument();
    expect(screen.getByText("Delete it")).toBeInTheDocument();
  });

  it("resolves true on confirm", async () => {
    const { onResult, user } = setup({ confirmText: "Yes" });
    await user.click(screen.getByText("open dialog"));
    await user.click(screen.getByText("Yes"));
    expect(onResult).toHaveBeenCalledWith(true);
    expect(screen.queryByText("Yes")).not.toBeInTheDocument(); // closed
  });

  it("resolves false on cancel", async () => {
    const { onResult, user } = setup();
    await user.click(screen.getByText("open dialog"));
    await user.click(screen.getByText("Cancel"));
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it("resolves false on Escape", async () => {
    const { onResult, user } = setup();
    await user.click(screen.getByText("open dialog"));
    await user.keyboard("{Escape}");
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it("resolves false on backdrop click", async () => {
    const { onResult, user } = setup();
    await user.click(screen.getByText("open dialog"));
    await user.click(document.querySelector("div.bg-black\\/50"));
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it("throws when useConfirm is used outside the provider", () => {
    // Silence React's error boundary logging for the expected throw.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Caller onResult={() => {}} opts={{}} />)).toThrow(
      /within <ConfirmProvider>/,
    );
    spy.mockRestore();
  });
});
