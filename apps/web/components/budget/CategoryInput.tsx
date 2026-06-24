import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { fetchWithCsrf } from "../../lib/fetch-with-csrf";

function CategoryRating({ sessionId, category }) {
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [aggregate, setAggregate] = useState({
    averageRating: category.averageRating || 0,
    ratingCount: category.ratingCount || 0,
  });

  async function submitRating(value) {
    setSubmitting(true);
    try {
      const res = await fetchWithCsrf("/api/budget/categories/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          categoryId: category.id,
          rating: value,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRating(value);
        setAggregate({
          averageRating: data.averageRating,
          ratingCount: data.ratingCount,
        });
      } else if (res.status === 401) {
        alert("Du måste logga in för att betygsätta.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-1 mb-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={submitting}
          onClick={() => submitRating(n)}
          className="p-0"
          title={`Betygsätt ${n} av 5`}
        >
          <Star
            className={`w-4 h-4 ${
              n <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"
            }`}
          />
        </button>
      ))}
      {aggregate.ratingCount > 0 && (
        <span className="text-xs text-amber-600 ml-1">
          {aggregate.averageRating.toFixed(1)} ({aggregate.ratingCount})
        </span>
      )}
    </div>
  );
}

/**
 * Category Input Component
 * Allows users to input budget amounts with horizontal slider
 */
export default function CategoryInput({
  category,
  allocation,
  onUpdate,
  readOnly = false,
  sessionId,
}) {
  // Calculate slider range based on budget size
  // For larger budgets, we need larger scales
  // Minimum on LEFT, default in MIDDLE, maximum on RIGHT
  const defaultValue = category.defaultAmount || category.amount;

  // Ensure minValue is less than defaultValue (use 70% of default as minimum if not specified)
  let minValue =
    category.minAmount < defaultValue
      ? category.minAmount
      : Math.floor(defaultValue * 0.7);

  // Calculate maximum so that default is in the middle
  // If default should be at 50%, then: maxValue = minValue + 2 * (defaultValue - minValue)
  const maxValue = minValue + 2 * (defaultValue - minValue);

  // If there's a fixed portion, adjust min/max to account for it
  const fixedAmount = category.fixedPercentage
    ? (category.fixedPercentage / 100) * defaultValue
    : 0;

  if (fixedAmount > 0) {
    // Minimum must include the fixed portion
    minValue = Math.max(minValue, fixedAmount);
  }

  // Initialize with allocation amount if available, otherwise use defaultValue
  const initialValue =
    allocation?.amount !== undefined ? allocation.amount : defaultValue;
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  // Sync with allocation prop changes - use effect only to update when external value changes
  const allocationAmount = allocation?.amount;
  useEffect(() => {
    // Only update if we have a valid allocation amount that's different from current value
    if (allocationAmount !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(allocationAmount);
    } else {
      // If allocation is cleared, reset to default
      setValue(defaultValue);
    }
  }, [allocationAmount, defaultValue]);

  function handleSliderChange(e) {
    const newAmount = parseInt(e.target.value);
    setValue(newAmount);
    onUpdate(category.id, newAmount);
  }

  function handleEditClick() {
    setIsEditing(true);
    setEditValue((value / 1000000).toFixed(1));
  }

  function handleEditChange(e) {
    setEditValue(e.target.value);
  }

  function handleEditBlur() {
    const newMnkr = parseFloat(editValue);
    if (!isNaN(newMnkr)) {
      const newAmount = newMnkr * 1000000;
      // Validate range
      if (newAmount >= minValue && newAmount <= maxValue) {
        setValue(newAmount);
        onUpdate(category.id, newAmount);
      } else {
        // Reset to current value if out of range
        setEditValue((value / 1000000).toFixed(1));
      }
    }
    setIsEditing(false);
  }

  function handleResetToDefault() {
    setValue(defaultValue);
    onUpdate(category.id, defaultValue);
  }

  function handleEditKeyDown(e) {
    if (e.key === "Enter") {
      handleEditBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue((value / 1000000).toFixed(1));
    }
  }

  const isFixed = category.isFixed;
  const valueInMnkr = (value / 1000000).toFixed(1);
  const minInMnkr = (minValue / 1000000).toFixed(1);
  const maxInMnkr = (maxValue / 1000000).toFixed(1);
  const defaultInMnkr = (defaultValue / 1000000).toFixed(1);
  const fixedInMnkr = (fixedAmount / 1000000).toFixed(1);

  // Calculate percentage position of default (minimum is always at 0%)
  const defaultPercentage =
    ((defaultValue - minValue) / (maxValue - minValue)) * 100;
  const currentPercentage = ((value - minValue) / (maxValue - minValue)) * 100;
  const fixedPercentage =
    fixedAmount > 0
      ? ((fixedAmount - minValue) / (maxValue - minValue)) * 100
      : 0;

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {category.imageUrl && (
            <img
              src={category.imageUrl}
              alt=""
              className="w-8 h-8 rounded object-cover"
            />
          )}
          <h3 className="font-medium text-gray-900">{category.name}</h3>
          {isFixed && (
            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
              Fixed
            </span>
          )}
        </div>
        <div className="text-right">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                value={editValue}
                onChange={handleEditChange}
                onBlur={handleEditBlur}
                onKeyDown={handleEditKeyDown}
                className="w-24 px-2 py-1 text-lg font-bold text-gray-900 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <span className="text-sm text-gray-600">mnkr</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition-colors"
              onClick={handleEditClick}
              title="Click to edit"
            >
              <span className="text-lg font-bold text-gray-900">
                {valueInMnkr}
              </span>
              <span className="text-sm text-gray-600">mnkr</span>
            </div>
          )}
        </div>
      </div>

      {sessionId && (
        <CategoryRating sessionId={sessionId} category={category} />
      )}

      {isFixed ? (
        <div className="py-2 text-sm text-gray-500 italic">
          This amount is fixed and cannot be changed
        </div>
      ) : (
        <>
          <div className="relative mb-2">
            {/* Slider track - minimum on LEFT, maximum on RIGHT */}
            <div className="relative h-2 bg-gray-200 rounded-full">
              {/* Fixed portion overlay (if applicable) */}
              {fixedAmount > 0 && (
                <div
                  className="absolute top-0 bottom-0 left-0 bg-red-100 rounded-l-full"
                  style={{
                    width: `${fixedPercentage}%`,
                    backgroundImage:
                      "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0, 0, 0, 0.1) 2px, rgba(0, 0, 0, 0.1) 4px)",
                  }}
                />
              )}
              {/* Default position marker (blue tick) */}
              <div
                className="absolute w-0.5 bg-blue-500 z-10"
                style={{
                  left: `${defaultPercentage}%`,
                  top: "-4px",
                  bottom: "-4px",
                }}
              />
              {/* Filled track from left (minimum) to current position */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-emerald-500 rounded-full"
                style={{
                  width: `${currentPercentage}%`,
                }}
              />
            </div>

            {/* Slider input */}
            <input
              type="range"
              min={minValue}
              max={maxValue}
              step={Math.max(1000000, Math.floor((maxValue - minValue) / 100))} // Step size based on range
              value={value}
              onChange={handleSliderChange}
              disabled={readOnly}
              className="absolute top-0 w-full h-2 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              style={{ zIndex: 20 }}
            />
          </div>

          {/* Labels */}
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span className="text-red-600 font-medium">
              Min: {minInMnkr} mnkr
              {fixedAmount > 0 && (
                <span className="block text-xs text-gray-500 italic">
                  ({fixedInMnkr} mnkr fixed)
                </span>
              )}
            </span>
            <button
              onClick={handleResetToDefault}
              className="text-blue-600 font-medium hover:text-blue-800 hover:underline cursor-pointer"
            >
              Default: {defaultInMnkr} mnkr
            </button>
            <span className="text-gray-700 font-medium">
              Max: {maxInMnkr} mnkr
            </span>
          </div>
        </>
      )}
    </div>
  );
}
