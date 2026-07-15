import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";

// Animated brand loop shown while the app reads in data. Full-screen on the
// same blue (#002d75) as the native splash so the static splash blends
// seamlessly into this animation with no white flash. expo-image auto-plays
// animated GIFs (React Native's built-in <Image> doesn't animate GIFs on
// Android), and the GIF's own loop count keeps it running.
const LOOP = require("../assets/gifloop.gif");

export default function LoadingLoop() {
  return (
    <View style={styles.container}>
      <Image
        source={LOOP}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        autoplay
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#002d75" },
});
