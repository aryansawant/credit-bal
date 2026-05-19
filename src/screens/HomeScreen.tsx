import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  AppButton,
  EmptyState,
  MetricCard,
  ProgressBar,
  SummaryCard,
} from "../components";
import { colors, spacing, typography } from "../styles/theme";
import type { CreditCard, PaycheckPlan, PayoffResult } from "../types";
import { formatDateLabel, getTodayISO } from "../utils/dateHelpers";
import {
  formatCurrency,
  formatCurrencyWithCents,
  formatPercent,
} from "../utils/formatters";
import {
  getFuturePlannedTotal,
  getPlanProgress,
} from "../utils/payoffCalculator";

type HomeScreenProps = {
  cards: CreditCard[];
  startingCards: CreditCard[];
  portfolioCard: CreditCard;
  paychecks: PaycheckPlan[];
  startingBalance: number;
  plannedResult: PayoffResult;
  actualResult: PayoffResult;
  onOpenCards: () => void;
};

function getNextPaycheck(paychecks: PaycheckPlan[]): PaycheckPlan | undefined {
  const today = getTodayISO();

  return [...paychecks]
    .filter((paycheck) => paycheck.paycheckDate >= today)
    .sort((a, b) => a.paycheckDate.localeCompare(b.paycheckDate))[0];
}

function payoffDateCopy(result: PayoffResult): string {
  return result.estimatedPayoffDate
    ? formatDateLabel(result.estimatedPayoffDate)
    : "Needs more plan";
}

export function HomeScreen({
  cards,
  startingCards,
  portfolioCard,
  paychecks,
  startingBalance,
  plannedResult,
  actualResult,
  onOpenCards,
}: HomeScreenProps) {
  const [selectedBalanceId, setSelectedBalanceId] = useState<string>("all");
  const nextPaycheck = getNextPaycheck(paychecks);
  const startingCardById = useMemo(
    () => new Map(startingCards.map((card) => [card.id, card])),
    [startingCards]
  );
  const selectedCard =
    selectedBalanceId === "all"
      ? undefined
      : cards.find((card) => card.id === selectedBalanceId);
  const selectedStartingCard = selectedCard
    ? startingCardById.get(selectedCard.id)
    : undefined;
  const displayedBalance = selectedCard?.balance ?? portfolioCard.balance;
  const displayedStartingBalance =
    selectedStartingCard?.balance ??
    (selectedCard ? selectedCard.balance : startingBalance);
  const displayedPaid = Math.max(displayedStartingBalance - displayedBalance, 0);
  const progress =
    displayedStartingBalance > 0
      ? Math.min(displayedPaid / displayedStartingBalance, 1)
      : 1;
  const progressLabel = formatPercent(progress * 100);
  const balanceTitle = selectedCard
    ? `${selectedCard.name} balance`
    : "Combined card balance";
  const futurePlanned = getFuturePlannedTotal(paychecks);
  const planProgress = getPlanProgress(paychecks);
  const aheadBehindCopy =
    planProgress.plannedDueTotal === 0
      ? "No check-ins due yet"
      : planProgress.difference === 0
        ? "You are on plan"
        : planProgress.difference > 0
          ? `You are ${formatCurrencyWithCents(planProgress.difference)} ahead of your plan`
          : `You are ${formatCurrencyWithCents(Math.abs(planProgress.difference))} behind your plan`;

  useEffect(() => {
    if (
      selectedBalanceId !== "all" &&
      !cards.some((card) => card.id === selectedBalanceId)
    ) {
      setSelectedBalanceId("all");
    }
  }, [cards, selectedBalanceId]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>
            {cards.length} card{cards.length === 1 ? "" : "s"}
          </Text>
          <Text style={styles.title}>Payoff dashboard</Text>
        </View>
        <AppButton label="Cards" onPress={onOpenCards} variant="secondary" />
      </View>

      <SummaryCard
        footer={
          <View style={styles.progressFooter}>
            <Text style={styles.progressText}>Payment progress</Text>
            <Text style={styles.progressValue}>{progressLabel}</Text>
          </View>
        }
        style={styles.balanceCard}
        title={balanceTitle}
      >
        <View style={styles.balanceTabs}>
          <Pressable
            onPress={() => setSelectedBalanceId("all")}
            style={[
              styles.balanceTab,
              selectedBalanceId === "all" ? styles.balanceTabActive : null,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.balanceTabText,
                selectedBalanceId === "all" ? styles.balanceTabTextActive : null,
              ]}
            >
              All
            </Text>
          </Pressable>
          {cards.map((card) => {
            const isActive = selectedBalanceId === card.id;

            return (
              <Pressable
                key={card.id}
                onPress={() => setSelectedBalanceId(card.id)}
                style={[
                  styles.balanceTab,
                  isActive ? styles.balanceTabActive : null,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.balanceTabText,
                    isActive ? styles.balanceTabTextActive : null,
                  ]}
                >
                  {card.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          numberOfLines={1}
          style={styles.balance}
        >
          {formatCurrencyWithCents(displayedBalance)}
        </Text>
        <ProgressBar progress={progress} />
      </SummaryCard>

      <View style={styles.metricRow}>
        <MetricCard
          helper={`${plannedResult.months} month estimate`}
          label="Planned payoff"
          tone="green"
          value={payoffDateCopy(plannedResult)}
        />
        <MetricCard
          helper="Confirmed check-ins only"
          label="Actual payoff"
          tone="blue"
          value={payoffDateCopy(actualResult)}
        />
      </View>

      <View style={styles.metricRow}>
        <MetricCard
          helper="Future planned paycheck payments"
          label="Planned ahead"
          value={formatCurrency(futurePlanned)}
        />
        <MetricCard
          helper="Paid vs due planned payments"
          label="Ahead / behind"
          tone={planProgress.difference < 0 ? "red" : "green"}
          value={
            planProgress.plannedDueTotal === 0
              ? "$0"
              : formatCurrencyWithCents(planProgress.difference)
          }
        />
      </View>

      <SummaryCard title="Plan status">
        <Text
          style={[
            styles.statusText,
            planProgress.difference < 0 ? styles.negative : styles.positive,
          ]}
        >
          {aheadBehindCopy}
        </Text>
        {plannedResult.warning ? (
          <Text style={styles.warning}>{plannedResult.warning}</Text>
        ) : null}
      </SummaryCard>

      <SummaryCard title="Next paycheck">
        {nextPaycheck ? (
          <View style={styles.nextPaycheck}>
            <Text style={styles.nextPayment}>
              Next planned payment:{" "}
              {formatCurrencyWithCents(nextPaycheck.plannedCardPayment)}
            </Text>
            <Text style={styles.nextDate}>
              on {formatDateLabel(nextPaycheck.paycheckDate)}
            </Text>
            {typeof nextPaycheck.expectedPaycheckAmount === "number" ? (
              <Text style={styles.helper}>
                Expected paycheck:{" "}
                {formatCurrencyWithCents(nextPaycheck.expectedPaycheckAmount)}
              </Text>
            ) : null}
          </View>
        ) : (
          <EmptyState
            message="Create your first future paycheck plan to start forecasting."
            title="No upcoming paychecks"
          />
        )}
      </SummaryCard>
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
  balance: {
    color: colors.text,
    fontSize: 42,
    fontWeight: "900",
    marginBottom: spacing.lg,
  },
  balanceCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  balanceTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  balanceTab: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    maxWidth: "100%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  balanceTabActive: {
    backgroundColor: colors.greenSoft,
  },
  balanceTabText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "900",
  },
  balanceTabTextActive: {
    color: colors.green,
  },
  progressFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  progressValue: {
    color: colors.green,
    fontSize: 18,
    fontWeight: "900",
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  statusText: {
    fontSize: 22,
    fontWeight: "900",
  },
  positive: {
    color: colors.green,
  },
  negative: {
    color: colors.red,
  },
  warning: {
    color: colors.amber,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: spacing.md,
  },
  nextPaycheck: {
    gap: spacing.xs,
  },
  nextPayment: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  nextDate: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  helper: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.xs,
  },
});
