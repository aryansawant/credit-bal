import { useState } from "react";
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
import type { CreditCard, PaycheckFormValues, PaycheckPlan } from "../types";
import { getTodayISO, parseISODate } from "../utils/dateHelpers";

type AddEditPaycheckScreenProps = {
  cards: CreditCard[];
  initialPaycheck?: PaycheckPlan | null;
  onCancel: () => void;
  onSave: (values: PaycheckFormValues) => void;
};

type FormErrors = Partial<
  Record<"paycheckDate" | "expectedPaycheckAmount" | "plannedCardPayment", string>
>;

function numberFromInput(value: string): number {
  return Number(value.replace(/,/g, "").trim());
}

export function AddEditPaycheckScreen({
  cards,
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

  function validate(): PaycheckFormValues | null {
    const parsedExpected = expectedPaycheckAmount.trim()
      ? numberFromInput(expectedPaycheckAmount)
      : undefined;
    const cardPayments = cards.map((card) => ({
      cardId: card.id,
      plannedAmount: plannedByCard[card.id]?.trim()
        ? numberFromInput(plannedByCard[card.id])
        : 0,
    }));
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

            {cards.map((card) => (
              <MoneyInput
                error={errors.plannedCardPayment}
                key={card.id}
                label={card.name}
                onChangeText={(value) =>
                  setPlannedByCard((current) => ({ ...current, [card.id]: value }))
                }
                placeholder="0"
                value={plannedByCard[card.id] ?? ""}
              />
            ))}

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
