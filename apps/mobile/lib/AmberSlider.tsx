import { useRef, useState } from "react";
import { View, StyleSheet, PanResponder } from "react-native";

const YELLOW = "#f5a623";

/**
 * Horizontal amber slider — the mobile counterpart of the web budget sliders
 * (apps/web/components/budget/CategoryInput.tsx): amber fill from the minimum,
 * a white tick at the municipality's figure, a round amber thumb.
 *
 * Built on PanResponder rather than a slider package so it needs no native
 * module (works in Expo Go) and can be styled exactly. It claims the gesture
 * as soon as the finger lands on it and refuses to hand it back, so dragging
 * inside a ScrollView adjusts the value instead of scrolling the page.
 */
export default function AmberSlider({
  min,
  max,
  step,
  value,
  markerValue,
  onChange,
  onRelease,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  /** Where the white tick goes — the default the user is adjusting from. */
  markerValue?: number;
  onChange: (value: number) => void;
  onRelease?: () => void;
}) {
  const [width, setWidth] = useState(0);
  const startX = useRef(0);

  // The responder is created once; read the latest props through a ref.
  const latest = useRef({ min, max, step, width, onChange, onRelease });
  latest.current = { min, max, step, width, onChange, onRelease };

  const toValue = (x: number) => {
    const { min, max, step, width } = latest.current;
    if (width <= 0) return min;
    const ratio = Math.min(1, Math.max(0, x / width));
    const raw = min + ratio * (max - min);
    const snapped = Math.round((raw - min) / step) * step + min;
    return Math.min(max, Math.max(min, Number(snapped.toFixed(4))));
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        startX.current = e.nativeEvent.locationX;
        latest.current.onChange(toValue(startX.current));
      },
      onPanResponderMove: (_e, g) => {
        latest.current.onChange(toValue(startX.current + g.dx));
      },
      onPanResponderRelease: () => latest.current.onRelease?.(),
      onPanResponderTerminate: () => latest.current.onRelease?.(),
    }),
  ).current;

  const pos = (v: number) =>
    max > min
      ? ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * width
      : 0;

  return (
    <View
      style={styles.hitArea}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...responder.panHandlers}
    >
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.fill, { width: pos(value) }]} />
      </View>
      {markerValue !== undefined && width > 0 && (
        <View
          pointerEvents="none"
          style={[styles.marker, { left: pos(markerValue) - 1 }]}
        />
      )}
      {width > 0 && (
        <View
          pointerEvents="none"
          style={[styles.thumb, { left: pos(value) - THUMB / 2 }]}
        />
      )}
    </View>
  );
}

const THUMB = 26;

const styles = StyleSheet.create({
  // Taller than the track so it is easy to grab with a thumb.
  hitArea: { height: 40, justifyContent: "center" },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: YELLOW, borderRadius: 4 },
  marker: {
    position: "absolute",
    top: 12,
    width: 2,
    height: 16,
    borderRadius: 1,
    backgroundColor: "#fff",
  },
  thumb: {
    position: "absolute",
    top: (40 - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: YELLOW,
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
});
