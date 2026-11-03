import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

const SOURCE_LABELS = {
  usda_fdc: "USDA",
  open_food_facts: "Product",
  custom: "Custom",
};

/** One tappable search result: name, kcal per 100 g, source badge. */
export default function SearchResultRow({ food, onSelect }) {
  const sourceLabel = SOURCE_LABELS[food.source];
  return (
    <Button
      type="button"
      onClick={() => onSelect(food)}
      className="w-full justify-between gap-3 text-left"
    >
      <span className="min-w-0">
        <span className="block break-words">
          {food.prepState ? `${food.name} · ${food.prepState}` : food.name}
        </span>
        <span className="block text-xs text-neutral-500 dark:text-neutral-400">
          {`${food.per100.kcal} kcal / 100 g`}
        </span>
      </span>
      {sourceLabel && <Badge className="shrink-0">{sourceLabel}</Badge>}
    </Button>
  );
}
