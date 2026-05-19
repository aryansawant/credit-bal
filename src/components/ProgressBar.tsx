import { DimensionValue, StyleSheet, View } from "react-native";
import { colors, radii } from "../styles/theme";

type ProgressBarProps = {
  progress: number;
};

export function ProgressBar({ progress }: ProgressBarProps) {
  const width = `${Math.max(0, Math.min(progress, 1)) * 100}%` as DimensionValue;

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    height: 10,
    overflow: "hidden",
    width: "100%",
  },
  fill: {
    backgroundColor: colors.green,
    borderRadius: radii.sm,
    height: "100%",
  },
});
