import { View } from "react-native";

interface Props {
  size?: number;
  color?: string;
}

// Matches lucide-react ChevronsRight: two arms per chevron, rounded caps
// Upper arm: CCW -45° (points from upper-left to tip)
// Lower arm:  CW +45° (points from lower-left to tip)
export default function ChevronsRight({ size = 44, color = "#002d75" }: Props) {
  const scale      = size / 24;
  const armLen     = 7.5 * scale;             // arm length (≈7.07 in 24px viewbox)
  const thick      = 3   * scale;             // stroke thickness (matches web strokeWidth=3)
  const gap        = 1.5 * scale;             // space between the two chevrons
  const radius     = thick * 0.5;             // rounded end caps
  const chevWidth  = armLen / Math.SQRT2;     // horizontal span of one chevron
  const tipY       = size / 2;               // vertical center

  // left/top position of the rectangle BEFORE rotation
  // (rotation happens around the element center)
  const armLeft = (offsetX: number) => offsetX + chevWidth / 2 - armLen / 2;

  function Chevron({ offsetX }: { offsetX: number }) {
    const left = armLeft(offsetX);
    return (
      <>
        {/* Upper arm — CW +45°: goes from upper-left down to tip (\) */}
        <View style={{
          position: "absolute",
          width: armLen,
          height: thick,
          backgroundColor: color,
          borderRadius: radius,
          left,
          top: tipY - chevWidth / 2 - thick / 2,
          transform: [{ rotate: "45deg" }],
        }} />
        {/* Lower arm — CCW -45°: goes from lower-left up to tip (/) */}
        <View style={{
          position: "absolute",
          width: armLen,
          height: thick,
          backgroundColor: color,
          borderRadius: radius,
          left,
          top: tipY + chevWidth / 2 - thick / 2,
          transform: [{ rotate: "-45deg" }],
        }} />
      </>
    );
  }

  const totalW = 2 * chevWidth + gap;
  const startX = (size - totalW) / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Chevron offsetX={startX} />
      <Chevron offsetX={startX + chevWidth + gap} />
    </View>
  );
}
