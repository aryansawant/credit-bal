import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../styles/theme";
import type { PaymentStatus } from "../types";

type StatusBadgeProps = {
  status: PaymentStatus;
};

const statusCopy: Record<PaymentStatus, string> = {
  planned: "Planned",
  paid: "Paid",
  partial: "Partial",
  skipped: "Skipped",
};

const statusColors: Record<
  PaymentStatus,
  { backgroundColor: string; color: string }
> = {
  planned: { backgroundColor: colors.blueSoft, color: colors.blue },
  paid: { backgroundColor: colors.greenSoft, color: colors.green },
  partial: { backgroundColor: colors.amberSoft, color: colors.amber },
  skipped: { backgroundColor: colors.redSoft, color: colors.red },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const selected = statusColors[status];

  return (
    <View style={[styles.badge, { backgroundColor: selected.backgroundColor }]}>
      <Text style={[styles.text, { color: selected.color }]}>{statusCopy[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: {
    fontSize: 12,
    fontWeight: "800",
  },
});
