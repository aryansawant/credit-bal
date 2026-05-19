import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../styles/theme";

type SummaryCardProps = {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  style?: ViewStyle;
};

export function SummaryCard({ title, children, footer, style }: SummaryCardProps) {
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  title: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: spacing.md,
    textTransform: "uppercase",
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
});
