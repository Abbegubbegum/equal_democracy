import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient } from "./api";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

interface Message {
  role: "xai" | "user";
  text: string;
}

const TAB_LABEL: Record<string, string> = {
  "/": "Hem",
  "/my-questions": "Mina frågor",
  "/vote": "Rösta",
  "/proposals": "Förslag",
  "/archive": "Arkiv",
};

const QUICK_ACTIONS: Record<string, { label: string; message: string }[]> = {
  "/": [
    {
      label: "Vad är MAJ?",
      message: "Vad är MAJ och hur fungerar det i appen?",
    },
    {
      label: "Förklara appen",
      message: "Hur fungerar Vallentuna Framåt-appen?",
    },
  ],
  "/my-questions": [
    {
      label: "Vad är Mina frågor?",
      message: "Vad är Mina frågor och hur väljer jag vilka ämnen jag ser?",
    },
    {
      label: "Hur ändrar jag intressen?",
      message: "Hur ändrar jag mina valda intresseområden?",
    },
  ],
  "/vote": [
    {
      label: "Förklara frågan",
      message: "Kan du förklara vad dagens omröstningsfråga handlar om?",
    },
    {
      label: "Vad är konsekvensen?",
      message: "Vad händer beroende på utfallet av omröstningen?",
    },
  ],
  "/proposals": [
    {
      label: "Hjälp mig skriva",
      message: "Hjälp mig formulera ett bra medborgarförslag.",
    },
    {
      label: "Vad är ett bra förslag?",
      message: "Hur skriver man ett effektivt medborgarförslag?",
    },
  ],
  "/archive": [
    {
      label: "Sammanfatta arkivet",
      message: "Kan du sammanfatta vad som hänt i tidigare sessioner?",
    },
    {
      label: "Vad är topplistan?",
      message: "Hur bestäms vilka förslag som hamnar i topplistan?",
    },
  ],
};

const COMMON_ACTIONS = [
  {
    label: "Skriv ett inlägg",
    message: "Hjälp mig skriva ett övertygande inlägg om min åsikt.",
  },
  {
    label: "Lämna ett förslag",
    message: "Hjälp mig lämna ett medborgarförslag steg för steg.",
  },
];

const GREETING = "Vad kan jag hjälpa dig med?";

type MdToken =
  | { type: "plain"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "code"; text: string };

function parseInline(text: string): MdToken[] {
  const tokens: MdToken[] = [];
  // **bold**, *italic*, `code` — italics and code don't cross newlines
  const regex = /\*\*([^*]+?)\*\*|\*([^*\n]+?)\*|`([^`\n]+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push({ type: "plain", text: text.slice(last, m.index) });
    }
    if (m[1] !== undefined) tokens.push({ type: "bold", text: m[1] });
    else if (m[2] !== undefined) tokens.push({ type: "italic", text: m[2] });
    else if (m[3] !== undefined) tokens.push({ type: "code", text: m[3] });
    last = m.index + m[0].length;
  }
  if (last < text.length)
    tokens.push({ type: "plain", text: text.slice(last) });
  return tokens;
}

function MarkdownText({
  text,
  baseStyle,
}: {
  text: string;
  baseStyle: React.ComponentProps<typeof Text>["style"];
}) {
  const tokens = parseInline(text);
  const mono = Platform.OS === "ios" ? "Menlo" : "monospace";
  return (
    <Text style={baseStyle}>
      {tokens.map((t, i) => {
        switch (t.type) {
          case "bold":
            return (
              <Text key={i} style={{ fontWeight: "700" }}>
                {t.text}
              </Text>
            );
          case "italic":
            return (
              <Text key={i} style={{ fontStyle: "italic" }}>
                {t.text}
              </Text>
            );
          case "code":
            return (
              <Text
                key={i}
                style={{
                  fontFamily: mono,
                  backgroundColor: "rgba(0,0,0,0.07)",
                }}
              >
                {t.text}
              </Text>
            );
          default:
            return <Text key={i}>{t.text}</Text>;
        }
      })}
    </Text>
  );
}

export default function XAIModal({
  visible,
  onClose,
  pathname,
}: {
  visible: boolean;
  onClose: () => void;
  pathname: string;
}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: "xai", text: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reported, setReported] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMessages([{ role: "xai", text: GREETING }]);
      setInput("");
      setReported(false);
      setReportSent(false);
    }
  }, [visible]);

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      dotAnim.stopAnimation();
      dotAnim.setValue(0);
    }
  }, [loading, dotAnim]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setLoading(true);
    try {
      const tab = TAB_LABEL[pathname] ?? "";
      const { reply } = await apiClient<{ reply: string }>("/api/mobile/xai", {
        method: "POST",
        body: JSON.stringify({ message: msg, context: tab }),
      });
      setMessages((prev) => [...prev, { role: "xai", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "xai",
          text: "Jag är tillfälligt otillgänglig. Försök igen om en stund.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function report() {
    setReported(true);
    setTimeout(() => setReportSent(true), 400);
  }

  const tabActions = QUICK_ACTIONS[pathname] ?? [];
  const allActions = [...tabActions, ...COMMON_ACTIONS];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.kav}
          pointerEvents="box-none"
        >
          <View style={[s.sheet, { paddingBottom: insets.bottom + 8 }]}>
            {/* Header */}
            <View style={s.handle} />
            <View style={s.header}>
              <View style={s.headerLeft}>
                <View style={s.xaiDot}>
                  <Ionicons name="sparkles" size={14} color={YELLOW} />
                </View>
                <Text style={s.headerTitle}>MAJ</Text>
                <Text style={s.headerSub}>Din demokratiske assistent</Text>
              </View>
              <View style={s.headerRight}>
                <TouchableOpacity
                  style={[s.reportBtn, reported && s.reportBtnSent]}
                  onPress={report}
                  disabled={reported}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={reportSent ? "checkmark-circle" : "flag-outline"}
                    size={14}
                    color={reported ? "#16a34a" : "#dc2626"}
                  />
                  <Text style={[s.reportText, reported && s.reportTextSent]}>
                    {reportSent ? "Anmält" : "Anmäl MAJ"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={12}
                  style={{ marginLeft: 8 }}
                >
                  <Ionicons name="close" size={22} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              style={s.messages}
              contentContainerStyle={s.messagesContent}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((m, i) => (
                <View
                  key={i}
                  style={[
                    s.bubble,
                    m.role === "user" ? s.bubbleUser : s.bubbleXAI,
                  ]}
                >
                  {m.role === "xai" && (
                    <View style={s.bubbleIcon}>
                      <Ionicons name="sparkles" size={11} color={YELLOW} />
                    </View>
                  )}
                  {m.role === "xai" ? (
                    <MarkdownText text={m.text} baseStyle={s.bubbleText} />
                  ) : (
                    <Text style={[s.bubbleText, s.bubbleTextUser]}>
                      {m.text}
                    </Text>
                  )}
                </View>
              ))}
              {loading && (
                <View style={[s.bubble, s.bubbleXAI]}>
                  <View style={s.bubbleIcon}>
                    <Ionicons name="sparkles" size={11} color={YELLOW} />
                  </View>
                  <Animated.Text
                    style={[
                      s.bubbleText,
                      {
                        opacity: dotAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 1],
                        }),
                      },
                    ]}
                  >
                    ···
                  </Animated.Text>
                </View>
              )}
            </ScrollView>

            {/* Quick actions */}
            {messages.length <= 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.chips}
                contentContainerStyle={s.chipsContent}
              >
                {allActions.map((a) => (
                  <TouchableOpacity
                    key={a.label}
                    style={s.chip}
                    onPress={() => send(a.message)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.chipText}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Input */}
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                placeholder="Skriv din fråga…"
                placeholderTextColor="#aaa"
                value={input}
                onChangeText={setInput}
                maxLength={500}
                multiline
                returnKeyType="send"
                onSubmitEditing={() => send(input)}
                blurOnSubmit
              />
              <TouchableOpacity
                style={[
                  s.sendBtn,
                  (!input.trim() || loading) && s.sendBtnDisabled,
                ]}
                onPress={() => send(input)}
                disabled={!input.trim() || loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="arrow-up" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  kav: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    height: "82%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 10,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  xaiDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: BLUE },
  headerSub: { fontSize: 12, color: "#888" },
  headerRight: { flexDirection: "row", alignItems: "center" },

  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#fff5f5",
  },
  reportBtnSent: { borderColor: "#86efac", backgroundColor: "#f0fdf4" },
  reportText: { fontSize: 12, color: "#dc2626", fontWeight: "600" },
  reportTextSent: { color: "#16a34a" },

  messages: { flex: 1, paddingHorizontal: 16 },
  messagesContent: { paddingVertical: 12, gap: 10 },

  bubble: {
    maxWidth: "85%",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  bubbleXAI: {
    backgroundColor: "#f1f5f9",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: BLUE,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
    flexDirection: "row-reverse",
  },
  bubbleIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  bubbleText: { fontSize: 14, color: "#222", lineHeight: 20, flexShrink: 1 },
  bubbleTextUser: { color: "#fff" },

  chips: { maxHeight: 44, marginVertical: 8 },
  chipsContent: { paddingHorizontal: 16, gap: 8, flexDirection: "row" },
  chip: {
    borderWidth: 1.5,
    borderColor: BLUE,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "#f0f4ff",
  },
  chipText: { fontSize: 13, color: BLUE, fontWeight: "600" },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f0f0f0",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111",
    backgroundColor: "#f9fafb",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
});
