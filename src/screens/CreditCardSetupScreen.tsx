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
import { AppButton, MoneyInput, SummaryCard } from "../components";
import { colors, radii, spacing, typography } from "../styles/theme";
import type { CreditCard, CreditCardFormValues } from "../types";

type CreditCardSetupScreenProps = {
  initialCard?: CreditCard | null;
  onSave: (values: CreditCardFormValues) => void;
  onCancel?: () => void;
  onSkip?: () => void;
  existingCardCount?: number;
};

type FormErrors = Partial<Record<keyof CreditCardFormValues, string>>;

function numberFromInput(value: string): number {
  return Number(value.replace(/,/g, "").trim());
}

export function CreditCardSetupScreen({
  existingCardCount = 0,
  initialCard,
  onSave,
  onCancel,
  onSkip,
}: CreditCardSetupScreenProps) {
  const [name, setName] = useState(initialCard?.name ?? "");
  const [balance, setBalance] = useState(
    initialCard ? String(initialCard.balance) : ""
  );
  const [apr, setApr] = useState(initialCard ? String(initialCard.apr) : "");
  const [minimumPayment, setMinimumPayment] = useState(
    initialCard ? String(initialCard.minimumMonthlyPayment) : ""
  );
  const [dueDay, setDueDay] = useState(
    initialCard ? String(initialCard.dueDay) : ""
  );
  const [errors, setErrors] = useState<FormErrors>({});

  function validate(): CreditCardFormValues | null {
    const parsedBalance = numberFromInput(balance);
    const parsedApr = numberFromInput(apr);
    const parsedMinimum = numberFromInput(minimumPayment);
    const parsedDueDay = Number(dueDay.trim());
    const nextErrors: FormErrors = {};

    if (!name.trim()) {
      nextErrors.name = "Card name is required.";
    }

    if (!Number.isFinite(parsedBalance) || parsedBalance <= 0) {
      nextErrors.balance = "Balance must be greater than 0.";
    }

    if (!Number.isFinite(parsedApr) || parsedApr < 0) {
      nextErrors.apr = "APR must be 0 or higher.";
    }

    if (!Number.isFinite(parsedMinimum) || parsedMinimum <= 0) {
      nextErrors.minimumMonthlyPayment =
        "Minimum monthly payment must be greater than 0.";
    }

    if (
      !Number.isInteger(parsedDueDay) ||
      parsedDueDay < 1 ||
      parsedDueDay > 31
    ) {
      nextErrors.dueDay = "Due day must be between 1 and 31.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return null;
    }

    return {
      name: name.trim(),
      balance: parsedBalance,
      apr: parsedApr,
      minimumMonthlyPayment: parsedMinimum,
      dueDay: parsedDueDay,
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
          <Text style={styles.eyebrow}>Credit Disk</Text>
          <Text style={styles.title}>
            {initialCard ? "Edit your card" : "Set up your card"}
          </Text>
          <Text style={styles.subtitle}>
            {existingCardCount > 0
              ? "Add another credit card and the dashboard will roll it into your combined balance."
              : "Add your first credit card, then add more cards when you are ready."}
          </Text>
        </View>

        <SummaryCard>
          <View style={styles.form}>
            <View style={styles.group}>
              <Text style={styles.label}>Card name</Text>
              <TextInput
                onChangeText={setName}
                placeholder="Chase Freedom"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, errors.name && styles.inputError]}
                value={name}
              />
              {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}
            </View>

            <MoneyInput
              error={errors.balance}
              label="Current balance"
              onChangeText={setBalance}
              placeholder="3500"
              value={balance}
            />

            <View style={styles.group}>
              <Text style={styles.label}>APR</Text>
              <View style={[styles.inputWrap, errors.apr && styles.inputError]}>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={setApr}
                  placeholder="24.99"
                  placeholderTextColor={colors.textMuted}
                  style={styles.percentInput}
                  value={apr}
                />
                <Text style={styles.suffix}>%</Text>
              </View>
              {errors.apr ? <Text style={styles.error}>{errors.apr}</Text> : null}
            </View>

            <MoneyInput
              error={errors.minimumMonthlyPayment}
              label="Minimum monthly payment"
              onChangeText={setMinimumPayment}
              placeholder="95"
              value={minimumPayment}
            />

            <View style={styles.group}>
              <Text style={styles.label}>Payment due day</Text>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setDueDay}
                placeholder="15"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, errors.dueDay && styles.inputError]}
                value={dueDay}
              />
              {errors.dueDay ? (
                <Text style={styles.error}>{errors.dueDay}</Text>
              ) : (
                <Text style={styles.helper}>Enter a day from 1 to 31.</Text>
              )}
            </View>
          </View>
        </SummaryCard>

        <View style={styles.actions}>
          <AppButton
            label={initialCard ? "Save card" : "Add card"}
            onPress={handleSave}
          />
          {onCancel ? (
            <AppButton label="Cancel" onPress={onCancel} variant="ghost" />
          ) : null}
          {!initialCard && existingCardCount === 0 && onSkip ? (
            <AppButton
              label="Set up later"
              onPress={onSkip}
              variant="secondary"
            />
          ) : null}
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
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 22,
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
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inputWrap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  inputError: {
    borderColor: colors.red,
  },
  percentInput: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    paddingVertical: spacing.md,
  },
  suffix: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: "800",
  },
  helper: {
    color: colors.textMuted,
    fontSize: 13,
  },
  error: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "700",
  },
  actions: {
    gap: spacing.sm,
  },
});
