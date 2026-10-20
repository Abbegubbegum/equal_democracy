import { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { G, Rect, Text as SvgText } from "react-native-svg";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";

/**
 * The budget diagram: the mobile port of the web's LayeredTreemaps +
 * SimpleTreemap (apps/web/components/budget/). Same data rules and the same
 * d3 squarify layout, so the boxes come out identical to the web; only the
 * rendering is react-native-svg instead of D3 on the DOM.
 *
 * Two treemaps stacked like cards — expenses and income — with three views:
 *   expenses-focus  expenses in front, income peeking out behind
 *   aligned         same position, income on top at half opacity, to compare
 *   income-focus    income in front, expenses peeking out behind
 * On the web the view cycles by tap/swipe on the cards; here it is an explicit
 * three-way switch (more discoverable on a phone), and tapping the card behind
 * brings it forward.
 */

export type BudgetViewMode = "expenses-focus" | "aligned" | "income-focus";

export interface TreemapPost {
  id: string;
  name: string;
  amount: number;
  color?: string;
}

const PEEK = 0.22; // share of the card height the back card shows above

// --- Ported from SimpleTreemap.tsx ---------------------------------------

function simplifyName(name: string): string {
  return name
    .replace(/nämnden?$/i, "")
    .replace(/^Generella statsbidrag och utjämning$/i, "Statsbidrag")
    .replace(/^Finansiella intäkter$/i, "Intäkter")
    .trim();
}

function hyphenateWord(word: string, maxChars: number): string {
  if (word.length <= maxChars) return word;
  const breakPoints = [
    "ning",
    "tion",
    "sion",
    "ling",
    "het",
    "ska",
    "ligt",
    "igt",
    "are",
    "or",
  ];
  for (const bp of breakPoints) {
    const index = word.indexOf(bp);
    if (index > 0 && index < maxChars - 1) {
      return word.substring(0, index + bp.length) + "-";
    }
  }
  return word.substring(0, maxChars - 1) + "-";
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = words[0] || "";
  const maxChars = Math.max(1, Math.floor(maxWidth / 10));
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const test = current + " " + word;
    if (test.length <= maxChars) {
      current = test;
    } else if (word.length > maxChars) {
      if (current.length > 0) lines.push(current);
      current = hyphenateWord(word, maxChars);
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

interface Cell {
  id: string;
  name: string;
  color?: string;
  value: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function layout(posts: TreemapPost[], width: number, height: number): Cell[] {
  const children = posts
    .filter((p) => p.amount > 0)
    .map((p) => ({
      id: p.id,
      name: simplifyName(p.name),
      color: p.color,
      value: Math.max(p.amount, 100_000), // minimum 0.1 mnkr, as on the web
    }))
    .sort((a, b) => a.value - b.value);
  if (children.length === 0 || width <= 0) return [];

  const root = hierarchy<any>({ name: "Budget", children })
    .sum((d) => d.value)
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
  treemap<any>()
    .size([width, height])
    .padding(2)
    .tile(treemapSquarify.ratio(1.5))(root);

  return root.leaves().map((leaf: any) => ({
    id: leaf.data.id,
    name: leaf.data.name,
    color: leaf.data.color,
    value: leaf.value,
    x0: leaf.x0,
    y0: leaf.y0,
    x1: leaf.x1,
    y1: leaf.y1,
  }));
}

function Treemap({
  posts,
  width,
  height,
  onCellPress,
}: {
  posts: TreemapPost[];
  width: number;
  height: number;
  onCellPress?: (id: string) => void;
}) {
  const cells = useMemo(
    () => layout(posts, width, height),
    [posts, width, height],
  );
  const total = cells.reduce((s, c) => s + c.value, 0) || 1;

  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill="#f9fafb" />
      {cells.map((c) => {
        const w = c.x1 - c.x0;
        const h = c.y1 - c.y0;
        const isSmall = c.value / total < 0.05;
        const lines = wrapText(c.name, w - 8);
        const fontSize = isSmall
          ? Math.max(8, Math.min(h / 2.5, 10))
          : Math.max(12, Math.min(w / 8, h / 6, 24));
        const top = isSmall ? h / 2 : Math.min(20 + fontSize, h / 3);
        const amountSize = isSmall
          ? Math.max(7, Math.min(h / 3, 9))
          : Math.max(10, Math.min(w / 10, h / 8, 18));
        return (
          <G
            key={c.id}
            x={c.x0}
            y={c.y0}
            onPress={onCellPress ? () => onCellPress(c.id) : undefined}
          >
            <Rect
              width={w}
              height={h}
              fill={c.color || "#9ca3af"}
              stroke="#fff"
              strokeWidth={2}
            />
            {lines.map((line, i) => (
              // SVG text sits on its baseline; the web uses "hanging", so
              // shift down by one font size to land in the same place.
              <SvgText
                key={i}
                x={w / 2}
                y={top + i * fontSize + fontSize * 0.85}
                textAnchor="middle"
                fill="#1e293b"
                fontSize={fontSize}
                fontWeight="bold"
              >
                {line}
              </SvgText>
            ))}
            <SvgText
              x={w / 2}
              y={top + lines.length * fontSize + 4 + amountSize * 0.85}
              textAnchor="middle"
              fill="#475569"
              fontSize={amountSize}
            >
              {`${(c.value / 1_000_000).toFixed(1)} mnkr`}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// --- Ported from LayeredTreemaps.tsx -------------------------------------

const VIEWS: { key: BudgetViewMode; label: string }[] = [
  { key: "expenses-focus", label: "Utgifter" },
  { key: "aligned", label: "Jämför" },
  { key: "income-focus", label: "Intäkter" },
];

export default function BudgetTreemap({
  expenses,
  income,
  viewMode,
  onViewModeChange,
  onPostPress,
}: {
  expenses: TreemapPost[];
  income: TreemapPost[];
  viewMode: BudgetViewMode;
  onViewModeChange: (mode: BudgetViewMode) => void;
  onPostPress?: (id: string) => void;
}) {
  const [width, setWidth] = useState(0);

  const totalExpenses = expenses.reduce((s, p) => s + p.amount, 0);
  const totalIncome = income.reduce((s, p) => s + p.amount, 0);

  // Width scaling exactly as LayeredTreemaps: the larger side is 100%, the
  // smaller loses 4× the difference so a surplus/deficit is visible.
  const maxTotal = Math.max(totalExpenses, totalIncome);
  const amplified = Math.abs(totalExpenses - totalIncome) * 4;
  const widthPct = (total: number, other: number) =>
    maxTotal > 0
      ? Math.max(
          20,
          Math.min(
            100,
            (total / maxTotal) * 100 -
              (total < other ? (amplified / maxTotal) * 100 : 0),
          ),
        )
      : 100;
  const expenseWidth = (width * widthPct(totalExpenses, totalIncome)) / 100;
  const incomeWidth = (width * widthPct(totalIncome, totalExpenses)) / 100;

  // Every expense post at its real amount, so a box reads the same figure as
  // its slider. Income without the state grants, as on the web.
  const expenseCells = expenses;
  const incomeCells = useMemo(
    () => income.filter((p) => !p.name.toLowerCase().includes("statsbidrag")),
    [income],
  );

  const balance = totalIncome - totalExpenses;
  const cardHeight = width * 0.75; // SimpleTreemap's 4:3
  const peek = cardHeight * PEEK;
  const offsetMode = viewMode !== "aligned";
  const incomeFront = viewMode !== "expenses-focus"; // income on top in aligned too

  const card = (kind: "expenses" | "income") => {
    const isExpenses = kind === "expenses";
    const inFront = isExpenses ? !incomeFront : incomeFront;
    const cardWidth = isExpenses ? expenseWidth : incomeWidth;
    return (
      <TouchableOpacity
        key={kind}
        activeOpacity={inFront ? 1 : 0.85}
        // Tapping the card behind brings it forward.
        onPress={
          inFront
            ? undefined
            : () =>
                onViewModeChange(isExpenses ? "expenses-focus" : "income-focus")
        }
        style={[
          styles.card,
          {
            width: cardWidth,
            height: cardHeight,
            left: (width - cardWidth) / 2,
            top: offsetMode && !inFront ? 0 : offsetMode ? peek : 0,
            zIndex: inFront ? 10 : 1,
            elevation: inFront ? 6 : 2,
            opacity: viewMode === "aligned" && !isExpenses ? 0.5 : 1,
          },
        ]}
      >
        <Treemap
          posts={isExpenses ? expenseCells : incomeCells}
          width={cardWidth}
          height={cardHeight}
          onCellPress={inFront ? onPostPress : undefined}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View>
      <Text
        style={[
          styles.balance,
          { color: balance >= 0 ? "#16a34a" : "#dc2626" },
        ]}
      >
        Balans: {balance > 0 ? "+" : ""}
        {(balance / 1_000_000).toFixed(0)} mnkr
      </Text>

      <View style={styles.switch}>
        {VIEWS.map((v) => (
          <TouchableOpacity
            key={v.key}
            style={[
              styles.switchBtn,
              viewMode === v.key && styles.switchBtnActive,
            ]}
            onPress={() => onViewModeChange(v.key)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.switchText,
                viewMode === v.key && styles.switchTextActive,
              ]}
            >
              {v.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: width ? cardHeight + (offsetMode ? peek : 0) : 0 }}
      >
        {width > 0 && (
          <>
            {card("income")}
            {card("expenses")}
          </>
        )}
      </View>
    </View>
  );
}

const BLUE = "#002d75";

const styles = StyleSheet.create({
  balance: { fontSize: 17, fontWeight: "800", marginBottom: 10 },
  switch: {
    flexDirection: "row",
    backgroundColor: "#eef2f7",
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
  },
  switchBtnActive: {
    backgroundColor: "#fff",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  switchText: { fontSize: 13, fontWeight: "700", color: "#64748b" },
  switchTextActive: { color: BLUE },
  card: {
    position: "absolute",
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
