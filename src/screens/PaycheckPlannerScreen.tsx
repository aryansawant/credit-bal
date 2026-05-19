import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton, EmptyState, PaycheckCard } from "../components";
import { colors, spacing, typography } from "../styles/theme";
import type { PaycheckPlan } from "../types";

type PaycheckPlannerScreenProps = {
  paychecks: PaycheckPlan[];
  onAddPaycheck: () => void;
  onCheckIn: (paycheck: PaycheckPlan) => void;
  onDeletePaycheck: (paycheck: PaycheckPlan) => void;
  onEditPaycheck: (paycheck: PaycheckPlan) => void;
};

export function PaycheckPlannerScreen({
  paychecks,
  onAddPaycheck,
  onCheckIn,
  onDeletePaycheck,
  onEditPaycheck,
}: PaycheckPlannerScreenProps) {
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const sortedPaychecks = [...paychecks].sort((a, b) =>
    a.paycheckDate.localeCompare(b.paycheckDate)
  );

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      directionalLockEnabled
      scrollEnabled={scrollEnabled}
      scrollEventThrottle={16}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Future paychecks</Text>
          <Text style={styles.title}>Payment plans</Text>
        </View>
      </View>

      <AppButton label="Add paycheck" onPress={onAddPaycheck} />

      {sortedPaychecks.length > 0 ? (
        <View style={styles.list}>
          {sortedPaychecks.map((paycheck) => (
            <PaycheckCard
              key={paycheck.id}
              onCheckIn={() => onCheckIn(paycheck)}
              onDelete={() => onDeletePaycheck(paycheck)}
              onEdit={() => onEditPaycheck(paycheck)}
              onSwipeActiveChange={(active) => setScrollEnabled(!active)}
              paycheck={paycheck}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          message="Add upcoming paychecks and decide how much each one should send to the card."
          title="No paycheck plans yet"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingTop: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.green,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "900",
  },
  list: {
    gap: spacing.md,
  },
});
