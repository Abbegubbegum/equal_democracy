import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

export interface VoteCounts {
  ja: number;
  nej: number;
  abstar: number;
}

export interface VotingSession {
  id: string;
  question: string;
  imageUrl: string | null;
  isActive: boolean;
  startDate: string;
  createdAt: string;
  voteCounts: VoteCounts;
  userVote: "ja" | "nej" | "abstar" | null;
  categories?: string[];
}

const ALTS: { key: "ja" | "nej" | "abstar"; label: string }[] = [
  { key: "ja", label: "Ja" },
  { key: "nej", label: "Nej" },
  { key: "abstar", label: "Avstår" },
];

// Shared "fråga"-card used by both the Rösta carousel and the Mina frågor
// category view — keeps the interactive Ja/Nej/Avstå voting UI identical
// in both places.
export function VotingQuestionCard({
  session,
  selected,
  onSelect,
  onVote,
  submitting,
}: {
  session: VotingSession;
  selected: "ja" | "nej" | "abstar" | null;
  onSelect: (key: "ja" | "nej" | "abstar") => void;
  onVote: () => void;
  submitting: boolean;
}) {
  const total =
    session.voteCounts.ja + session.voteCounts.nej + session.voteCounts.abstar;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  const isPrimary = session.isActive;
  const showResults = session.userVote != null || !isPrimary;
  const displayDate = new Date(
    session.startDate || session.createdAt,
  ).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <View style={styles.card}>
      <View style={styles.dateLine}>
        <Ionicons
          name={isPrimary ? "calendar-outline" : "time-outline"}
          size={12}
          color="#666"
        />
        <Text style={styles.dateText}>{displayDate}</Text>
      </View>

      <Text style={styles.question}>{session.question}</Text>

      <View style={styles.alternatives}>
        {ALTS.map(({ key, label }) => {
          const isSelected = isPrimary
            ? selected === key
            : session.userVote === key;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.alternative,
                isSelected && styles.alternativeSelected,
              ]}
              onPress={() => isPrimary && !showResults && onSelect(key)}
              activeOpacity={isPrimary && !showResults ? 0.75 : 1}
            >
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected && <View style={styles.radioDot} />}
              </View>
              <Text
                style={[
                  styles.alternativeLabel,
                  isSelected && styles.alternativeLabelSelected,
                ]}
              >
                {label}
              </Text>
              {showResults && (
                <View style={styles.resultOuter}>
                  <View style={styles.resultBarWrap}>
                    {pct(session.voteCounts[key]) > 0 && (
                      <View
                        style={[
                          styles.resultFill,
                          { flex: pct(session.voteCounts[key]) / 100 },
                        ]}
                      />
                    )}
                  </View>
                  <Text style={styles.resultPct}>
                    {pct(session.voteCounts[key])}%
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {isPrimary && !showResults ? (
        <TouchableOpacity
          style={[
            styles.voteBtn,
            (!selected || submitting) && styles.voteBtnDisabled,
          ]}
          onPress={onVote}
          disabled={!selected || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={BLUE} />
          ) : (
            <>
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={BLUE}
              />
              <Text style={styles.voteBtnText}>Rösta</Text>
            </>
          )}
        </TouchableOpacity>
      ) : isPrimary ? (
        <View style={styles.votedBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
          <Text style={styles.votedText}>
            Din röst är registrerad · {total} totalt
          </Text>
        </View>
      ) : (
        <View style={styles.votedBadge}>
          <Text style={styles.votedText}>
            {total} {total === 1 ? "röst" : "röster"}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.68)",
    borderRadius: 18,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  dateLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateText: { fontSize: 11, color: "#666", fontWeight: "600" },
  question: { fontSize: 19, fontWeight: "800", color: "#111", lineHeight: 26 },

  alternatives: { gap: 7 },
  alternative: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    backgroundColor: "#fafafa",
  },
  alternativeSelected: { borderColor: BLUE, backgroundColor: "#eef2ff" },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: BLUE },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE },
  alternativeLabel: { fontSize: 16, fontWeight: "600", color: "#444" },
  alternativeLabelSelected: { color: BLUE },

  resultOuter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  resultBarWrap: {
    flex: 1,
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  resultFill: { height: "100%" as any, backgroundColor: BLUE, borderRadius: 4 },
  resultPct: {
    fontSize: 12,
    color: BLUE,
    fontWeight: "700",
    minWidth: 34,
    textAlign: "right",
  },

  voteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: YELLOW,
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  voteBtnDisabled: { opacity: 0.45 },
  voteBtnText: { color: BLUE, fontSize: 16, fontWeight: "800" },
  votedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  votedText: { fontSize: 13, color: "#444", fontWeight: "600" },
});
