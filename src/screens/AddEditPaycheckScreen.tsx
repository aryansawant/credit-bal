import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppButton, DateInput, MoneyInput, SummaryCard } from "../components";
import { colors, radii, spacing, typography } from "../styles/theme";
import type {
  CreditCard,
  PaycheckFormValues,
  PaycheckPlan,
} from "../types";
import {
  addMonths,
  getMonthKey,
  getTodayISO,
  parseISODate,
  startOfMonth,
} from "../utils/dateHelpers";
import { formatCurrencyWithCents } from "../utils/formatters";

type AddEditPaycheckScreenProps = {
  cards: CreditCard[];
  paychecks: PaycheckPlan[];
  initialPaycheck?: PaycheckPlan | null;
  onCancel: () => void;
  onSave: (values: PaycheckFormValues) => void;
};

type FormErrors = Partial<
  Record<"paycheckDate" | "expectedPaycheckAmount" | "plannedCardPayment", string>
>;

const PAID_OFF_BALANCE = 0.005;

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function numberFromInput(value: string): number {
  return Number(value.replace(/,/g, "").trim());
}

function safePaymentAmount(value: string | undefined): number {
  if (!value?.trim()) {
    return 0;
  }

  const parsed = numberFromInput(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function paymentForCard(
  paycheck: PaycheckPlan,
  card: CreditCard,
  cards: CreditCard[]
): number {
  if (paycheck.status === "skipped") {
    return 0;
  }

  const storedPayment = paycheck.cardPayments?.find(
    (payment) => payment.cardId === card.id
  );

  if (storedPayment) {
    return paycheck.status === "planned"
      ? storedPayment.plannedAmount
      : storedPayment.actualAmount ?? 0;
  }

  if (cards[0]?.id !== card.id) {
    return 0;
  }

  if (paycheck.status === "planned") {
    return paycheck.plannedCardPayment;
  }

  return paycheck.actualCardPayment ?? 0;
}

function monthDiff(start: Date, monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return (year - start.getFullYear()) * 12 + (month - 1 - start.getMonth());
}

function projectedCardBalanceAtPaycheck({
  card,
  cards,
  currentPayment,
  initialPaycheck,
  paycheckDate,
  paychecks,
}: {
  card: CreditCard;
  cards: CreditCard[];
  currentPayment: number;
  initialPaycheck?: PaycheckPlan | null;
  paycheckDate: string;
  paychecks: PaycheckPlan[];
}): { before: number; after: number } {
  const selectedDate = parseISODate(paycheckDate);

  if (!selectedDate || card.balance <= 0) {
    const balance = Math.max(card.balance, 0);
    return {
      before: balance,
      after: Math.max(balance - currentPayment, 0),
    };
  }

  const createdAt = new Date(card.createdAt);
  const startDate = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
  const simulationStart = startOfMonth(startDate);
  const selectedMonthKey = getMonthKey(selectedDate);
  const selectedMonthIndex = Math.max(monthDiff(simulationStart, selectedMonthKey), 0);
  const monthlyRate = Math.max(card.apr, 0) / 100 / 12;
  const priorPaymentsByMonth = paychecks.reduce<Record<string, number>>(
    (acc, paycheck) => {
      if (
        paycheck.id === initialPaycheck?.id ||
        !parseISODate(paycheck.paycheckDate) ||
        paycheck.paycheckDate >= paycheckDate
      ) {
        return acc;
      }

      const amount = paymentForCard(paycheck, card, cards);

      if (amount <= 0) {
        return acc;
      }

      const monthKey = getMonthKey(paycheck.paycheckDate);
      acc[monthKey] = roundCurrency((acc[monthKey] ?? 0) + amount);
      return acc;
    },
    {}
  );

  let balance = roundCurrency(card.balance);

  for (let monthIndex = 0; monthIndex <= selectedMonthIndex; monthIndex += 1) {
    const monthDate = addMonths(simulationStart, monthIndex);
    const monthKey = getMonthKey(monthDate);
    const interest = roundCurrency(balance * monthlyRate);
    const balanceWithInterest = roundCurrency(balance + interest);
    const priorPayment = roundCurrency(priorPaymentsByMonth[monthKey] ?? 0);

    if (monthKey === selectedMonthKey) {
      const before = roundCurrency(Math.max(balanceWithInterest - priorPayment, 0));
      return {
        before,
        after: roundCurrency(Math.max(before - currentPayment, 0)),
      };
    }

    balance = roundCurrency(Math.max(balanceWithInterest - priorPayment, 0));
  }

  return {
    before: balance,
    after: roundCurrency(Math.max(balance - currentPayment, 0)),
  };
}

function hasProjectedBalance(value: number): boolean {
  return value > PAID_OFF_BALANCE;
}

export function AddEditPaycheckScreen({
  cards,
  paychecks,
  initialPaycheck,
  onCancel,
  onSave,
}: AddEditPaycheckScreenProps) {
  const [paycheckDate, setPaycheckDate] = useState(
    initialPaycheck?.paycheckDate ?? getTodayISO()
  );
  const [expectedPaycheckAmount, setExpectedPaycheckAmount] = useState(
    typeof initialPaycheck?.expectedPaycheckAmount === "number"
      ? String(initialPaycheck.expectedPaycheckAmount)
      : ""
  );
  const [plannedByCard, setPlannedByCard] = useState<Record<string, string>>(
    () =>
      cards.reduce<Record<string, string>>((acc, card, index) => {
        const existing = initialPaycheck?.cardPayments?.find(
          (payment) => payment.cardId === card.id
        );
        const legacyAmount =
          !initialPaycheck?.cardPayments?.length && index === 0
            ? initialPaycheck?.plannedCardPayment
            : undefined;

        acc[card.id] =
          typeof existing?.plannedAmount === "number"
            ? String(existing.plannedAmount)
            : typeof legacyAmount === "number"
              ? String(legacyAmount)
              : "";
        return acc;
      }, {})
  );
  const [note, setNote] = useState(initialPaycheck?.note ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const cardBalancePreviews = useMemo(
    () =>
      cards.reduce<Record<string, { before: number; after: number }>>(
        (acc, card) => {
          acc[card.id] = projectedCardBalanceAtPaycheck({
            card,
            cards,
            currentPayment: safePaymentAmount(plannedByCard[card.id]),
            initialPaycheck,
            paycheckDate,
            paychecks,
          });
          return acc;
        },
        {}
      ),
    [cards, initialPaycheck, paycheckDate, paychecks, plannedByCard]
  );
  const planCards = cards.filter((card) =>
    hasProjectedBalance(cardBalancePreviews[card.id]?.before ?? card.balance)
  );
  const remainingBalance = roundCurrency(
    cards.reduce(
      (total, card) => total + (cardBalancePreviews[card.id]?.after ?? 0),
      0
    )
  );

  function validate(): PaycheckFormValues | null {
    const parsedExpected = expectedPaycheckAmount.trim()
      ? numberFromInput(expectedPaycheckAmount)
      : undefined;
    const cardPayments = cards.map((card) => {
      const projectedBefore = cardBalancePreviews[card.id]?.before ?? card.balance;
      const enteredAmount = plannedByCard[card.id]?.trim()
        ? numberFromInput(plannedByCard[card.id])
        : 0;

      return {
        cardId: card.id,
        plannedAmount: hasProjectedBalance(projectedBefore)
          ? enteredAmount
          : 0,
      };
    });
    const parsedPlanned = cardPayments.reduce(
      (total, payment) => total + payment.plannedAmount,
      0
    );
    const nextErrors: FormErrors = {};

    if (!parseISODate(paycheckDate)) {
      nextErrors.paycheckDate = "Enter a valid date.";
    }

    if (
      typeof parsedExpected === "number" &&
      (!Number.isFinite(parsedExpected) || parsedExpected <= 0)
    ) {
      nextErrors.expectedPaycheckAmount =
        "Expected paycheck must be greater than 0.";
    }

    if (
      cardPayments.some(
        (payment) => !Number.isFinite(payment.plannedAmount) || payment.plannedAmount < 0
      )
    ) {
      nextErrors.plannedCardPayment = "Planned payment cannot be negative.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return null;
    }

    return {
      paycheckDate,
      expectedPaycheckAmount: parsedExpected,
      plannedCardPayment: parsedPlanned,
      cardPayments,
      note: note.trim() || undefined,
    };
  }

  function handleSave() {
    const values = validate();

    if (values) {
      onSave(values);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Paycheck planning</Text>
          <Text style={styles.title}>
            {initialPaycheck ? "Edit paycheck" : "Add paycheck"}
          </Text>
        </View>

        <SummaryCard>
          <View style={styles.form}>
            <DateInput
              error={errors.paycheckDate}
              label="Paycheck date"
              onChangeText={setPaycheckDate}
              value={paycheckDate}
            />

            <MoneyInput
              error={errors.expectedPaycheckAmount}
              helper="Optional."
              label="Expected paycheck amount"
              onChangeText={setExpectedPaycheckAmount}
              placeholder="1200"
              value={expectedPaycheckAmount}
            />

            {planCards.length === 0 ? (
              <Text style={styles.paidOffNotice}>
                All cards are projected to be paid off before this paycheck.
              </Text>
            ) : null}

            {planCards.map((card) => {
              const projectedBefore =
                cardBalancePreviews[card.id]?.before ?? card.balance;
              const projectedAfter =
                cardBalancePreviews[card.id]?.after ?? projectedBefore;

              return (
                <View key={card.id} style={styles.cardPlanGroup}>
                  <MoneyInput
                    error={errors.plannedCardPayment}
                    label={card.name}
                    onChangeText={(value) =>
                      setPlannedByCard((current) => ({
                        ...current,
                        [card.id]: value,
                      }))
                    }
                    placeholder="0"
                    value={plannedByCard[card.id] ?? ""}
                  />
                  <View style={styles.balancePreviewRow}>
                    <Text style={[styles.balancePreviewText, styles.beforeText]}>
                      Before {formatCurrencyWithCents(projectedBefore)}
                    </Text>
                    <Text style={[styles.balancePreviewText, styles.afterText]}>
                      After payment {formatCurrencyWithCents(projectedAfter)}
                    </Text>
                  </View>
                </View>
              );
            })}

            <View style={styles.remainingBalance}>
              <Text style={styles.remainingBalanceLabel}>Remaining balance</Text>
              <Text style={styles.remainingBalanceValue}>
                {formatCurrencyWithCents(remainingBalance)}
              </Text>
            </View>

            <View style={styles.group}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                multiline
                onChangeText={setNote}
                placeholder="Optional note"
                placeholderTextColor={colors.textMuted}
                style={styles.noteInput}
                textAlignVertical="top"
                value={note}
              />
            </View>
          </View>
        </SummaryCard>

        <View style={styles.actions}>
          <AppButton
            label={initialPaycheck ? "Save paycheck" : "Add paycheck"}
            onPress={handleSave}
          />
          <AppButton label="Cancel" onPress={onCancel} variant="ghost" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  form: {
    gap: spacing.lg,
  },
  cardPlanGroup: {
    gap: spacing.xs,
  },
  balancePreviewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  balancePreviewText: {
    fontSize: 13,
    fontWeight: "800",
  },
  beforeText: {
    color: colors.red,
  },
  afterText: {
    color: colors.green,
  },
  paidOffNotice: {
    color: colors.green,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 22,
    textAlign: "center",
  },
  remainingBalance: {
    alignItems: "center",
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    paddingTop: spacing.lg,
  },
  remainingBalanceLabel: {
    color: colors.green,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  remainingBalanceValue: {
    color: colors.green,
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
  },
  group: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  helper: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 108,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  actions: {
    gap: spacing.sm,
  },
});
