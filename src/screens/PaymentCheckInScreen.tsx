import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton, MoneyInput, SummaryCard } from "../components";
import { colors, radii, spacing, typography } from "../styles/theme";
import type { CardPaymentAllocation, CreditCard, PaymentStatus, PaycheckPlan } from "../types";
import { formatDateLabel } from "../utils/dateHelpers";
import { formatCurrencyWithCents } from "../utils/formatters";

type CheckInMode = "planned" | "different" | "skipped";
type PaymentTarget = "all" | string;

type PaymentCheckInScreenProps = {
  cards: CreditCard[];
  paycheck: PaycheckPlan;
  onCancel: () => void;
  onSave: (updates: {
    status: PaymentStatus;
    actualCardPayment: number;
    cardPayments: CardPaymentAllocation[];
  }) => void;
};

function getInitialMode(paycheck: PaycheckPlan): CheckInMode {
  if (paycheck.status === "skipped") {
    return "skipped";
  }

  if (
    paycheck.status === "partial" ||
    (typeof paycheck.actualCardPayment === "number" &&
      paycheck.actualCardPayment !== paycheck.plannedCardPayment)
  ) {
    return "different";
  }

  return "planned";
}

function numberFromInput(value: string): number {
  return Number(value.replace(/,/g, "").trim());
}

function actualPaymentTotal(payments: CardPaymentAllocation[]): number {
  return payments.reduce(
    (total, payment) => total + (payment.actualAmount ?? 0),
    0
  );
}

function getInitialPaymentTarget(
  cards: CreditCard[],
  paycheck: PaycheckPlan
): PaymentTarget {
  const cardIds = new Set(cards.map((card) => card.id));
  const actualPayments =
    paycheck.cardPayments?.filter(
      (payment) => cardIds.has(payment.cardId) && (payment.actualAmount ?? 0) > 0
    ) ?? [];

  if (actualPayments.length === 1) {
    return actualPayments[0].cardId;
  }

  const plannedPayments =
    paycheck.cardPayments?.filter(
      (payment) => cardIds.has(payment.cardId) && payment.plannedAmount > 0
    ) ?? [];

  if (plannedPayments.length === 1) {
    return plannedPayments[0].cardId;
  }

  return cards.length === 1 ? cards[0].id : "all";
}

export function PaymentCheckInScreen({
  cards,
  paycheck,
  onCancel,
  onSave,
}: PaymentCheckInScreenProps) {
  const [mode, setMode] = useState<CheckInMode>(getInitialMode(paycheck));
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget>(() =>
    getInitialPaymentTarget(cards, paycheck)
  );
  const [actualByCard, setActualByCard] = useState<Record<string, string>>(
    () =>
      cards.reduce<Record<string, string>>((acc, card, index) => {
        const existing = paycheck.cardPayments?.find(
          (payment) => payment.cardId === card.id
        );
        const fallbackActual =
          !paycheck.cardPayments?.length && index === 0
            ? paycheck.actualCardPayment ?? paycheck.plannedCardPayment
            : undefined;

        acc[card.id] =
          typeof existing?.actualAmount === "number"
            ? String(existing.actualAmount)
            : typeof fallbackActual === "number"
              ? String(fallbackActual)
              : String(existing?.plannedAmount ?? 0);
        return acc;
      }, {})
  );
  const [error, setError] = useState<string | undefined>();
  const selectedTargetCard =
    paymentTarget === "all"
      ? null
      : cards.find((card) => card.id === paymentTarget) ?? null;
  const plannedPayments = useMemo<CardPaymentAllocation[]>(() => {
    const storedPayments = paycheck.cardPayments ?? [];

    return cards.map((card, index) => {
      const existing = storedPayments.find(
        (payment) => payment.cardId === card.id
      );

      if (existing) {
        return existing;
      }

      return {
        cardId: card.id,
        plannedAmount:
          storedPayments.length === 0 && index === 0
            ? paycheck.plannedCardPayment
            : 0,
      };
    });
  }, [cards, paycheck.cardPayments, paycheck.plannedCardPayment]);
  const plannedTotal = useMemo(
    () =>
      plannedPayments.reduce(
        (total, payment) => total + payment.plannedAmount,
        0
      ),
    [plannedPayments]
  );
  const selectedPlannedTotal = useMemo(() => {
    if (paymentTarget === "all") {
      return plannedTotal;
    }

    return (
      plannedPayments.find((payment) => payment.cardId === paymentTarget)
        ?.plannedAmount ?? 0
    );
  }, [paymentTarget, plannedPayments, plannedTotal]);
  const selectedPlanLabel =
    paymentTarget === "all"
      ? "Planned card payment"
      : `Planned for ${selectedTargetCard?.name ?? "selected card"}`;
  const differenceLabel =
    paymentTarget === "all" ? "Actual vs planned" : "Actual vs selected plan";

  const previewActual = useMemo(() => {
    if (mode === "skipped") {
      return 0;
    }

    if (mode === "planned") {
      return selectedPlannedTotal;
    }

    if (paymentTarget !== "all") {
      const parsed = numberFromInput(actualByCard[paymentTarget] ?? "0");
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    const total = cards.reduce((sum, card) => {
      const parsed = numberFromInput(actualByCard[card.id] ?? "0");
      return Number.isFinite(parsed) ? sum + parsed : sum;
    }, 0);
    return Number.isFinite(total) ? total : undefined;
  }, [actualByCard, cards, mode, paymentTarget, selectedPlannedTotal]);

  const difference =
    typeof previewActual === "number"
      ? previewActual - selectedPlannedTotal
      : undefined;

  function handleSave() {
    if (mode === "planned") {
      const cardPayments = plannedPayments.map((payment) => ({
        ...payment,
        actualAmount:
          paymentTarget === "all"
            ? payment.plannedAmount
            : payment.cardId === paymentTarget
              ? selectedPlannedTotal
              : payment.actualAmount ?? 0,
      }));
      const savedActualTotal = actualPaymentTotal(cardPayments);
      onSave({
        status:
          savedActualTotal === 0
            ? "skipped"
            : savedActualTotal >= plannedTotal
              ? "paid"
              : "partial",
        actualCardPayment: savedActualTotal,
        cardPayments,
      });
      return;
    }

    if (mode === "skipped") {
      onSave({
        status: "skipped",
        actualCardPayment: 0,
        cardPayments: plannedPayments.map((payment) => ({
          ...payment,
          actualAmount: 0,
        })),
      });
      return;
    }

    const cardPayments = plannedPayments.map((payment) => {
      const parsedActual =
        paymentTarget === "all"
          ? numberFromInput(actualByCard[payment.cardId] ?? "0")
          : payment.cardId === paymentTarget
            ? numberFromInput(actualByCard[paymentTarget] ?? "0")
            : payment.actualAmount ?? 0;
      return {
        ...payment,
        actualAmount: Number.isFinite(parsedActual) ? parsedActual : Number.NaN,
      };
    });
    const parsedActual = actualPaymentTotal(cardPayments);

    if (
      cardPayments.some(
        (payment) =>
          !Number.isFinite(payment.actualAmount) || (payment.actualAmount ?? 0) < 0
      )
    ) {
      setError("Actual payment cannot be negative.");
      return;
    }

    setError(undefined);
    onSave({
      status:
        parsedActual === 0
          ? "skipped"
          : parsedActual >= plannedTotal
            ? "paid"
            : "partial",
      actualCardPayment: parsedActual,
      cardPayments,
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Payment check-in</Text>
        <Text style={styles.title}>{formatDateLabel(paycheck.paycheckDate)}</Text>
        <Text style={styles.subtitle}>
          {selectedPlanLabel}: {formatCurrencyWithCents(selectedPlannedTotal)}
        </Text>
      </View>

      <SummaryCard title="What happened?">
        <View style={styles.optionGroup}>
          <AppButton
            label="Paid planned amount"
            onPress={() => setMode("planned")}
            variant={mode === "planned" ? "primary" : "secondary"}
          />
          <AppButton
            label="Paid different amount"
            onPress={() => setMode("different")}
            variant={mode === "different" ? "primary" : "secondary"}
          />
          <AppButton
            label="Skipped"
            onPress={() => setMode("skipped")}
            variant={mode === "skipped" ? "danger" : "secondary"}
          />
        </View>
      </SummaryCard>

      {mode !== "skipped" ? (
        <SummaryCard title="Paid toward">
          <View style={styles.optionGroup}>
            <AppButton
              label="All cards"
              onPress={() => setPaymentTarget("all")}
              variant={paymentTarget === "all" ? "primary" : "secondary"}
            />
            {cards.map((card) => (
              <AppButton
                key={card.id}
                label={card.name}
                onPress={() => setPaymentTarget(card.id)}
                variant={paymentTarget === card.id ? "primary" : "secondary"}
              />
            ))}
          </View>
        </SummaryCard>
      ) : null}

      {mode === "different" ? (
        <SummaryCard>
          <View style={styles.actualInputs}>
            {(paymentTarget === "all"
              ? plannedPayments
              : plannedPayments.filter((payment) => payment.cardId === paymentTarget)
            ).map((payment) => {
              const card = cards.find((item) => item.id === payment.cardId);

              return (
                <MoneyInput
                  error={error}
                  key={payment.cardId}
                  label={
                    paymentTarget === "all"
                      ? card?.name ?? "Card"
                      : selectedTargetCard?.name ?? card?.name ?? "Card"
                  }
                  onChangeText={(value) =>
                    setActualByCard((current) => ({
                      ...current,
                      [payment.cardId]: value,
                    }))
                  }
                  placeholder={String(payment.plannedAmount)}
                  value={actualByCard[payment.cardId] ?? ""}
                />
              );
            })}
          </View>
        </SummaryCard>
      ) : null}

      <SummaryCard title="Difference">
        <View style={styles.differenceCard}>
          <Text style={styles.differenceLabel}>Check-in total</Text>
          <Text style={styles.totalValue}>
            {typeof previewActual === "number"
              ? formatCurrencyWithCents(previewActual)
              : "Enter amount"}
          </Text>
          <View style={styles.differenceDivider} />
          <Text style={styles.differenceLabel}>{differenceLabel}</Text>
          <Text
            style={[
              styles.differenceValue,
              (difference ?? 0) >= 0 ? styles.positive : styles.negative,
            ]}
          >
            {typeof difference === "number"
              ? `${difference >= 0 ? "+" : ""}${formatCurrencyWithCents(difference)}`
              : "Enter amount"}
          </Text>
        </View>
      </SummaryCard>

      <View style={styles.actions}>
        <AppButton label="Save check-in" onPress={handleSave} />
        <AppButton label="Cancel" onPress={onCancel} variant="ghost" />
      </View>
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
    gap: spacing.sm,
    paddingTop: spacing.md,
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
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
  },
  optionGroup: {
    gap: spacing.sm,
  },
  actualInputs: {
    gap: spacing.lg,
  },
  differenceCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  differenceLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
  totalValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
  },
  differenceDivider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  differenceValue: {
    fontSize: 30,
    fontWeight: "900",
  },
  positive: {
    color: colors.green,
  },
  negative: {
    color: colors.red,
  },
  actions: {
    gap: spacing.sm,
  },
});
