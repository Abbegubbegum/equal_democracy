import { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const BLUE   = "#002d75";
const YELLOW = "#f5a623";

interface Props {
  visible: boolean;
  title: string;
  subtitle: string;
  stars: number;
  onDone: () => void;
}

export default function CelebrationModal({ visible, title, subtitle, stars, onDone }: Props) {
  const scale   = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.5);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, tension: 120, friction: 7, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  const displayStars = Math.min(stars, 5);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDone}>
        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>

          {/* Star burst */}
          <View style={styles.starBurst}>
            {Array.from({ length: displayStars }).map((_, i) => (
              <Ionicons
                key={i}
                name="star"
                size={i === Math.floor(displayStars / 2) ? 38 : 28}
                color={YELLOW}
                style={{ transform: [{ rotate: `${(i - Math.floor(displayStars / 2)) * 12}deg` }] }}
              />
            ))}
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.earnedBadge}>
            <Ionicons name="star" size={15} color={BLUE} />
            <Text style={styles.earnedText}>
              +{stars} {stars === 1 ? "stjärna" : "stjärnor"}
            </Text>
          </View>

          <Text style={styles.hint}>Tryck var som helst för att fortsätta</Text>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: "center",
    gap: 10,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  starBurst: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: BLUE,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 15,
    color: "#555",
    textAlign: "center",
    lineHeight: 22,
  },
  earnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: YELLOW,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 6,
  },
  earnedText: {
    fontSize: 15,
    fontWeight: "800",
    color: BLUE,
  },
  hint: {
    fontSize: 12,
    color: "#bbb",
    marginTop: 4,
  },
});
