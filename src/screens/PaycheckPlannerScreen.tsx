import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton, EmptyState, PaycheckCard } from "../components";
import { colors, spacing } from "../styles/theme";
import type { PaycheckPlan } from "../types";
import { formatMonthLabel, parseISODate } from "../utils/dateHelpers";

type PaycheckMonthGroup = {
  key: string;
  label: string;
  paychecks: PaycheckPlan[];
};

type PaycheckPlannerScreenProps = {
  paychecks: PaycheckPlan[];
  onAddPaycheck: () => void;
  onCheckIn: (paycheck: PaycheckPlan) => void;
  onDeletePaycheck: (paycheck: PaycheckPlan) => void;
  onEditPaycheck: (paycheck: PaycheckPlan) => void;
};

function monthLabelForPaycheck(paycheck: PaycheckPlan): string {
  const date = parseISODate(paycheck.paycheckDate);

  return date ? formatMonthLabel(date) : "No date";
}

function groupPaychecksByMonth(paychecks: PaycheckPlan[]): PaycheckMonthGroup[] {
  return paychecks.reduce<PaycheckMonthGroup[]>((groups, paycheck) => {
    const key = paycheck.paycheckDate.slice(0, 7) || "no-date";
    const existingGroup = groups.find((group) => group.key === key);

    if (existingGroup) {
      existingGroup.paychecks.push(paycheck);
      return groups;
    }

    groups.push({
      key,
      label: monthLabelForPaycheck(paycheck),
      paychecks: [paycheck],
    });

    return groups;
  }, []);
}

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
  const paycheckGroups = groupPaychecksByMonth(sortedPaychecks);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      directionalLockEnabled
      scrollEnabled={scrollEnabled}
      scrollEventThrottle={16}
    >
      <AppButton label="Add paycheck" onPress={onAddPaycheck} />

      {sortedPaychecks.length > 0 ? (
        <View style={styles.monthList}>
          {paycheckGroups.map((group) => (
            <View key={group.key} style={styles.monthGroup}>
              <Text style={styles.monthHeader}>{group.label}</Text>
              <View style={styles.list}>
                {group.paychecks.map((paycheck) => (
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
            </View>
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
  monthList: {
    gap: spacing.xl,
  },
  monthGroup: {
    gap: spacing.sm,
  },
  monthHeader: {
    color: colors.green,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  list: {
    gap: spacing.md,
  },
});
