import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton, MoneyInput, SummaryCard } from "../components";
import { colors, radii, spacing, typography } from "../styles/theme";
import type { CardPaymentAllocation, CreditCard, PaymentStatus, PaycheckPlan } from "../types";
import { formatDateLabel } from "../utils/dateHelpers";
import { formatCurrencyWithCents } from "../utils/formatters";

type CheckInMode = "planned" | "different" | "skipped";

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

export function PaymentCheckInScreen({
  cards,
  paycheck,
  onCancel,
  onSave,
}: PaymentCheckInScreenProps) {
  const [mode, setMode] = useState<CheckInMode>(getInitialMode(paycheck));
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

  const previewActual = useMemo(() => {
    if (mode === "planned") {
      return paycheck.plannedCardPayment;
    }

    if (mode === "skipped") {
      return 0;
    }

    const total = cards.reduce((sum, card) => {
      const parsed = numberFromInput(actualByCard[card.id] ?? "0");
      return Number.isFinite(parsed) ? sum + parsed : sum;
    }, 0);
    return Number.isFinite(total) ? total : undefined;
  }, [actualByCard, cards, mode, paycheck.plannedCardPayment]);

  function plannedCardPayments(): CardPaymentAllocation[] {
    if (paycheck.cardPayments?.length) {
      return paycheck.cardPayments;
    }

    return cards.map((card, index) => ({
      cardId: card.id,
      plannedAmount: index === 0 ? paycheck.plannedCardPayment : 0,
    }));
  }

  const difference =
    typeof previewActual === "number"
      ? previewActual - paycheck.plannedCardPayment
      : undefined;

  function handleSave() {
    if (mode === "planned") {
      const cardPayments = plannedCardPayments().map((payment) => ({
        ...payment,
        actualAmount: payment.plannedAmount,
      }));
      onSave({
        status: "paid",
        actualCardPayment: paycheck.plannedCardPayment,
        cardPayments,
      });
      return;
    }

    if (mode === "skipped") {
      onSave({
        status: "skipped",
        actualCardPayment: 0,
        cardPayments: plannedCardPayments().map((payment) => ({
          ...payment,
          actualAmount: 0,
        })),
      });
      return;
    }

    const cardPayments = plannedCardPayments().map((payment) => {
      const parsedActual = numberFromInput(actualByCard[payment.cardId] ?? "0");
      return {
        ...payment,
        actualAmount: Number.isFinite(parsedActual) ? parsedActual : Number.NaN,
      };
    });
    const parsedActual = cardPayments.reduce(
      (total, payment) => total + payment.actualAmount!,
      0
    );

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
          : parsedActual >= paycheck.plannedCardPayment
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
          Planned card payment:{" "}
          {formatCurrencyWithCents(paycheck.plannedCardPayment)}
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

      {mode === "different" ? (
        <SummaryCard>
          <View style={styles.actualInputs}>
            {plannedCardPayments().map((payment) => {
              const card = cards.find((item) => item.id === payment.cardId);

              return (
                <MoneyInput
                  error={error}
                  key={payment.cardId}
                  label={card?.name ?? "Card"}
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
          <Text style={styles.differenceLabel}>Actual vs planned</Text>
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
