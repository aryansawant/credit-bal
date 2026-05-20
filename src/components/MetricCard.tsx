import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../styles/theme";

type MetricTone = "default" | "green" | "blue" | "amber" | "red";

type MetricCardProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: MetricTone;
  accentBackgroundColor?: string;
  accentColor?: string;
};

const toneStyles: Record<MetricTone, { backgroundColor: string; color: string }> = {
  default: { backgroundColor: colors.surface, color: colors.text },
  green: { backgroundColor: colors.greenSoft, color: colors.green },
  blue: { backgroundColor: colors.blueSoft, color: colors.blue },
  amber: { backgroundColor: colors.amberSoft, color: colors.amber },
  red: { backgroundColor: colors.redSoft, color: colors.red },
};

export function MetricCard({
  accentBackgroundColor,
  accentColor,
  label,
  value,
  helper,
  tone = "default",
}: MetricCardProps) {
  const selectedTone = toneStyles[tone];
  const backgroundColor = accentBackgroundColor ?? selectedTone.backgroundColor;
  const valueColor = accentColor ?? selectedTone.color;

  return (
    <View style={[styles.card, { backgroundColor }]}>
      <Text style={styles.label}>{label}</Text>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        numberOfLines={1}
        style={[styles.value, { color: valueColor }]}
      >
        {value}
      </Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minHeight: 112,
    padding: spacing.lg,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  value: {
    color: colors.text,
    fontSize: 27,
    fontWeight: "800",
  },
  helper: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});
