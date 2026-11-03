import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadLS, saveLS } from "../../lib/storage";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { FoodProvider } from "../context/FoodContext";
import { K_FOOD_TARGETS } from "../lib/keys";
import { todayLocal } from "../lib/localDate";
import TargetsEditor from "./TargetsEditor";

const OLD = {
  from: "2026-11-01",
  kcal: 1800,
  protein: 120,
  carb: 200,
  fat: 60,
};
const OLDER = {
  from: "2026-10-01",
  kcal: 1700,
  protein: 110,
  carb: 190,
  fat: 55,
};

function setup() {
  const user = userEvent.setup();
  render(
    <ConfirmProvider>
      <FoodProvider>
        <TargetsEditor />
      </FoodProvider>
    </ConfirmProvider>,
  );
  return user;
}

async function fill(user, label, value) {
  const field = screen.getByLabelText(label);
  await user.clear(field);
  if (value !== "") await user.type(field, value);
}

describe("TargetsEditor", () => {
  it("saves a target with the chosen from-date and shows it in history", async () => {
    saveLS(K_FOOD_TARGETS, [OLD]);
    const user = setup();
    await fill(user, "Calories", "2000");
    await fill(user, "Protein (g)", "150");
    await fill(user, "Carbs (g)", "220");
    await fill(user, "Fat (g)", "70");
    await fill(user, "Applies from", "2026-11-05");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(loadLS(K_FOOD_TARGETS)).toEqual([
      OLD,
      { from: "2026-11-05", kcal: 2000, protein: 150, carb: 220, fat: 70 },
    ]);
    expect(
      screen.getByRole("button", { name: "Edit 2026-11-05" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Calories")).toHaveValue(2000);
  });

  it("starts empty and blocked with no target, defaulting from to today", () => {
    setup();
    expect(screen.getByLabelText("Calories")).toHaveValue(null);
    expect(screen.getByLabelText("Applies from")).toHaveValue(todayLocal());
    expect(screen.getByText("kcal must be above 0")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
  });

  it("shows the implied kcal helper and disables Save on kcal 0", async () => {
    const user = setup();
    await fill(user, "Calories", "0");
    await fill(user, "Protein (g)", "100");
    await fill(user, "Carbs (g)", "100");
    await fill(user, "Fat (g)", "10");
    expect(screen.getByText("Macros imply 890 kcal")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await fill(user, "Calories", "2000");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await fill(user, "Protein (g)", "");
    expect(screen.getByText("Macros imply 490 kcal")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("replaces a row saved with an existing from-date", async () => {
    saveLS(K_FOOD_TARGETS, [OLDER, OLD]);
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Edit 2026-11-01" }));
    await fill(user, "Calories", "1900");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(loadLS(K_FOOD_TARGETS)).toEqual([OLDER, { ...OLD, kcal: 1900 }]);
  });

  it("edit loads a history row into the form; delete removes it after confirm", async () => {
    saveLS(K_FOOD_TARGETS, [OLDER, OLD]);
    const user = setup();
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("2026-11-01")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Edit 2026-10-01" }));
    expect(screen.getByLabelText("Calories")).toHaveValue(1700);
    expect(screen.getByLabelText("Protein (g)")).toHaveValue(110);
    expect(screen.getByLabelText("Carbs (g)")).toHaveValue(190);
    expect(screen.getByLabelText("Fat (g)")).toHaveValue(55);
    expect(screen.getByLabelText("Applies from")).toHaveValue("2026-10-01");

    await user.click(screen.getByRole("button", { name: "Delete 2026-11-01" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(loadLS(K_FOOD_TARGETS)).toEqual([OLDER, OLD]);

    await user.click(screen.getByRole("button", { name: "Delete 2026-11-01" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(loadLS(K_FOOD_TARGETS)).toEqual([OLDER]);
    expect(screen.getByLabelText("Calories")).toHaveValue(1700);
  });

  it("prefills from the target in force today, not a future one, and keeps from at today", () => {
    const older = {
      from: "1990-01-01",
      kcal: 1400,
      protein: 90,
      carb: 140,
      fat: 45,
    };
    const past = {
      from: "2000-01-01",
      kcal: 1500,
      protein: 100,
      carb: 150,
      fat: 50,
    };
    const future = {
      from: "2999-01-01",
      kcal: 3000,
      protein: 200,
      carb: 300,
      fat: 100,
    };
    saveLS(K_FOOD_TARGETS, [older, past, future]);
    setup();
    expect(screen.getByLabelText("Calories")).toHaveValue(1500);
    expect(screen.getByLabelText("Protein (g)")).toHaveValue(100);
    expect(screen.getByLabelText("Carbs (g)")).toHaveValue(150);
    expect(screen.getByLabelText("Fat (g)")).toHaveValue(50);
    expect(screen.getByLabelText("Applies from")).toHaveValue(todayLocal());
  });

  it("deleting the only target leaves no target", async () => {
    saveLS(K_FOOD_TARGETS, [OLD]);
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Delete 2026-11-01" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(loadLS(K_FOOD_TARGETS)).toEqual([]);
    expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
