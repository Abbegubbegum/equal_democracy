import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { AlternativeMarker } from "@repo/types";
import AmberSlider from "./AmberSlider";
import { formatMnkr } from "./budget";

const BLUE = "#002d75";
const YELLOW = "#f5a623";
// Square, like the illustrations themselves (800×800), so the whole picture
// shows. 32 = the budget page's horizontal padding.
const CARD_SIZE = Dimensions.get("window").width - 32;

export interface BudgetPostView {
  id: string;
  kind: "expense" | "income";
  name: string;
  imageUrl?: string | null;
  color?: string;
  /** Current amount in kr — what the diagram and the saved proposal use. */
  amount: number;
  /** What the slider moves: kr for ordinary posts, tax rate in kr for tax. */
  slider: {
    value: number;
    min: number;
    max: number;
    step: number;
    default: number;
  };
  /** Set for the tax income post, where the slider is the tax rate. */
  taxRate?: boolean;
  /** Counted in the balance, not adjustable: no slider. */
  locked?: boolean;
  /** Short explanation, e.g. what a locked net post is made of. */
  note?: string | null;
  /** The parties' figures for this post, in the slider's unit. */
  markers: AlternativeMarker[];
}

const sek2 = (n: number) =>
  n.toLocaleString("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * One budget post. Collapsed: a compact row (image, name, amount). Tapped, it
 * unfolds into a card laid out like a question card on Hem — the post's own
 * illustration full-bleed — with the name in a Förslag-style dark box and the
 * amber slider along the bottom edge, as on the web.
 */
export default function BudgetPostCard({
  post,
  expanded,
  onToggle,
  onChange,
}: {
  post: BudgetPostView;
  expanded: boolean;
  onToggle: () => void;
  onChange: (sliderValue: number) => void;
}) {
  if (!expanded) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        {post.imageUrl ? (
          <Image
            source={{ uri: post.imageUrl }}
            style={styles.rowImage}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            recyclingKey={post.id}
          />
        ) : (
          <View
            style={[
              styles.rowImage,
              { backgroundColor: post.color || "#e5e7eb" },
            ]}
          />
        )}
        <View style={styles.rowText}>
          <Text style={styles.rowName}>{post.name}</Text>
          <Text style={styles.rowAmount}>{formatMnkr(post.amount)}</Text>
        </View>
        {post.locked && (
          <Ionicons name="lock-closed" size={14} color="#94a3b8" />
        )}
        <Ionicons name="chevron-down" size={18} color="#94a3b8" />
      </TouchableOpacity>
    );
  }

  const { slider } = post;
  const changed = Math.abs(slider.value - slider.default) > slider.step / 2;
  const fmt = (v: number) => (post.taxRate ? `${sek2(v)} kr` : formatMnkr(v));

  return (
    <View style={styles.card}>
      {post.imageUrl ? (
        <Image
          source={{ uri: post.imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={post.id}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: post.color || BLUE },
          ]}
        />
      )}
      <View style={styles.cardTint} />

      {/* Name — white on a semi-transparent dark box, as on Förslag. Tapping
          it folds the card back into a row. */}
      <TouchableOpacity
        style={styles.textBox}
        onPress={onToggle}
        activeOpacity={0.85}
      >
        <View style={styles.textBoxHeader}>
          <Text style={styles.label}>
            {post.kind === "income" ? "Intäkt" : "Utgift"}
          </Text>
          <Ionicons name="chevron-up" size={18} color="rgba(255,255,255,0.7)" />
        </View>
        <Text style={styles.title}>{post.name}</Text>
        <Text style={styles.amount}>{formatMnkr(post.amount)}</Text>
        {post.taxRate && (
          <Text style={styles.sub}>Skattesats {sek2(slider.value)} kr</Text>
        )}
      </TouchableOpacity>

      {/* Amber slider along the bottom edge — or, for a locked post, a note
          that it counts in the balance but can't be changed. */}
      <View style={styles.sliderBox}>
        {post.locked ? (
          <View style={styles.lockedRow}>
            <Ionicons
              name="lock-closed"
              size={14}
              color="rgba(255,255,255,0.8)"
            />
            <Text style={styles.lockedText}>
              {post.note ??
                "Låst belopp — ingår i balansen men går inte att ändra"}
            </Text>
          </View>
        ) : (
          <>
            {post.taxRate && <Text style={styles.sliderLabel}>Skattesats</Text>}
            <AmberSlider
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={slider.value}
              markerValue={slider.default}
              partyMarkers={post.markers}
              onChange={onChange}
            />
          </>
        )}
        {!post.locked && (
          <View style={styles.scale}>
            <Text style={styles.scaleText}>{fmt(slider.min)}</Text>
            {changed ? (
              <TouchableOpacity
                onPress={() => onChange(slider.default)}
                hitSlop={8}
              >
                <Text style={styles.reset}>
                  Återställ ({fmt(slider.default)})
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.scaleText}>Kommunens förslag</Text>
            )}
            <Text style={styles.scaleText}>{fmt(slider.max)}</Text>
          </View>
        )}
        {/* What each party proposes for this post — the legend for the
            coloured lines, and the real figure when a line is pinned to an
            end of the slider. */}
        {post.markers.length > 0 && (
          <View style={styles.legend}>
            {post.markers.map((m) => (
              <View key={m.key} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: m.color }]}
                />
                <Text style={styles.legendText}>
                  {m.key} {fmt(m.value)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 16,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  rowImage: { width: 64, height: 64, borderRadius: 12 },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  rowAmount: { fontSize: 13, color: "#475569", fontWeight: "600" },

  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 20,
    overflow: "hidden",
    justifyContent: "space-between",
    padding: 14,
  },
  cardTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.12)",
  },

  // Förslag's contentCard / proposalLabel / proposalTitle, scaled to a card.
  textBox: {
    backgroundColor: "rgba(0,0,0,0.50)",
    borderRadius: 16,
    padding: 16,
    gap: 2,
  },
  textBoxHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  title: { fontSize: 22, fontWeight: "900", color: "#fff", lineHeight: 28 },
  amount: { fontSize: 17, fontWeight: "800", color: YELLOW, marginTop: 2 },
  sub: { fontSize: 13, color: "rgba(255,255,255,0.85)" },

  sliderBox: {
    backgroundColor: "rgba(0,0,0,0.50)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  sliderLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 4,
  },
  scale: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scaleText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
  },
  reset: { fontSize: 12, color: YELLOW, fontWeight: "800" },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  lockedText: {
    flex: 1,
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 12,
    rowGap: 4,
    marginTop: 8,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.9)",
  },
  legendText: { fontSize: 11, color: "#fff", fontWeight: "700" },
});
