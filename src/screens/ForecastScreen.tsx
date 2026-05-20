import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { EmptyState, MetricCard, SummaryCard } from "../components";
import {
  colors,
  premiumAccent,
  radii,
  spacing,
} from "../styles/theme";
import type { CreditCard, PaycheckPlan, PayoffMode, PayoffResult } from "../types";
import { formatDateLabel } from "../utils/dateHelpers";
import {
  formatCurrency,
  formatCurrencyWithCents,
} from "../utils/formatters";

type ForecastScreenProps = {
  cards: CreditCard[];
  portfolioCard: CreditCard;
  paychecks: PaycheckPlan[];
  plannedResult: PayoffResult;
  actualResult: PayoffResult;
  onAddPaycheck: () => void;
};

function resultForMode(
  mode: PayoffMode,
  plannedResult: PayoffResult,
  actualResult: PayoffResult
): PayoffResult {
  return mode === "planned" ? plannedResult : actualResult;
}

function payoffMetricValue(result: PayoffResult): string {
  if (result.estimatedPayoffDate) {
    return formatDateLabel(result.estimatedPayoffDate);
  }

  return result.remainingBalance > 0
    ? `${formatCurrencyWithCents(result.remainingBalance)} short`
    : "Not available";
}

function payoffMetricHelper(result: PayoffResult): string {
  return result.estimatedPayoffDate
    ? "Estimated debt-free date"
    : "More planned payment needed";
}

function forecastWarning(result: PayoffResult): string | undefined {
  if (result.estimatedPayoffDate || result.remainingBalance <= 0) {
    return result.warning;
  }

  return `Add about ${formatCurrencyWithCents(
    result.remainingBalance
  )} more to a future paycheck to see a payoff date.`;
}

export function ForecastScreen({
  cards,
  portfolioCard,
  paychecks,
  plannedResult,
  actualResult,
  onAddPaycheck,
}: ForecastScreenProps) {
  const [mode, setMode] = useState<PayoffMode>("planned");
  const accent = premiumAccent;
  const selectedResult = resultForMode(mode, plannedResult, actualResult);
  const selectedWarning = forecastWarning(selectedResult);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.segmented}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setMode("planned")}
          style={[
            styles.segment,
            mode === "planned" && {
              backgroundColor: accent.soft,
              borderColor: accent.color,
            },
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              mode === "planned" && { color: accent.color },
            ]}
          >
            Planned
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setMode("actual")}
          style={[
            styles.segment,
            mode === "actual" && {
              backgroundColor: accent.soft,
              borderColor: accent.color,
            },
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              mode === "actual" && { color: accent.color },
            ]}
          >
            Actual
          </Text>
        </Pressable>
      </View>

      <SummaryCard title={mode === "planned" ? "Planned forecast" : "Actual forecast"}>
        <Text style={styles.cardName}>
          {cards.length} card{cards.length === 1 ? "" : "s"} combined
        </Text>
        <Text style={[styles.balance, { color: accent.color }]}>
          {formatCurrencyWithCents(portfolioCard.balance)}
        </Text>
        <Text style={styles.helper}>
          {mode === "planned"
            ? "Uses planned card payments from entered paychecks and a balance-weighted portfolio APR."
            : "Uses confirmed paid and partial check-ins only with a balance-weighted portfolio APR."}
        </Text>
        {selectedWarning ? (
          <Text style={styles.warning}>{selectedWarning}</Text>
        ) : null}
      </SummaryCard>

      <View style={styles.metricRow}>
        <MetricCard
          accentBackgroundColor={accent.soft}
          accentColor={accent.color}
          helper={payoffMetricHelper(selectedResult)}
          label="Payoff date"
          value={payoffMetricValue(selectedResult)}
        />
        <MetricCard
          helper="Months in simulation"
          label="Months left"
          tone="blue"
          value={`${selectedResult.months}`}
        />
      </View>

      <View style={styles.metricRow}>
        <MetricCard
          helper="Estimated interest"
          label="Total interest"
          tone="amber"
          value={formatCurrency(selectedResult.totalInterest)}
        />
        <MetricCard
          helper="Payments applied"
          label="Total paid"
          value={formatCurrency(selectedResult.totalPaid)}
        />
      </View>

      <SummaryCard title="Month-by-month breakdown">
        {selectedResult.schedule.length > 0 ? (
          <View style={styles.schedule}>
            {selectedResult.schedule.map((month) => (
              <View key={`${mode}-${month.monthIndex}`} style={styles.monthRow}>
                <View style={styles.monthHeader}>
                  <Text style={styles.monthLabel}>{month.monthLabel}</Text>
                  <Text style={[styles.monthEnding, { color: accent.color }]}>
                    {formatCurrencyWithCents(month.endingBalance)}
                  </Text>
                </View>
                <View style={styles.monthGrid}>
                  <Text style={styles.monthDetail}>
                    Start {formatCurrencyWithCents(month.startingBalance)}
                  </Text>
                  <Text style={styles.monthDetail}>
                    Pay {formatCurrencyWithCents(month.payment)}
                  </Text>
                  <Text style={styles.monthDetail}>
                    Interest {formatCurrencyWithCents(month.interest)}
                  </Text>
                  <Text style={styles.monthDetail}>
                    Principal {formatCurrencyWithCents(month.principal)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            actionLabel={paychecks.length === 0 ? "Add paycheck" : undefined}
            message="There is no monthly schedule to show yet."
            onAction={paychecks.length === 0 ? onAddPaycheck : undefined}
            title="No forecast schedule"
          />
        )}
      </SummaryCard>

      <Text style={styles.disclaimer}>
        These estimates are for planning only and may not match your credit card
        issuer's exact interest calculation. Multiple-card forecasts use a
        balance-weighted APR approximation.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  segmented: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    flexDirection: "row",
    padding: spacing.xs,
  },
  segment: {
    alignItems: "center",
    borderColor: "transparent",
    borderWidth: 1,
    borderRadius: radii.sm,
    flex: 1,
    paddingVertical: spacing.md,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "800",
  },
  cardName: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "800",
  },
  balance: {
    color: colors.text,
    fontSize: 38,
    fontWeight: "900",
    marginTop: spacing.xs,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  warning: {
    color: colors.amber,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: spacing.md,
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  schedule: {
    gap: spacing.md,
  },
  monthRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.md,
  },
  monthHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  monthLabel: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  monthEnding: {
    color: colors.green,
    fontSize: 17,
    fontWeight: "900",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  monthDetail: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    minWidth: "46%",
  },
  disclaimer: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
