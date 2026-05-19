import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import {
  AppButton,
  DateInput,
  DebitCardCard,
  EmptyState,
  MoneyInput,
  SummaryCard,
} from "../components";
import { colors, radii, spacing, typography } from "../styles/theme";
import type {
  DebitCard,
  DebitCardFormValues,
  DebitExpense,
  DebitExpenseFormValues,
} from "../types";
import {
  formatDateLabel,
  getMonthKey,
  getTodayISO,
  parseISODate,
} from "../utils/dateHelpers";
import { formatCurrencyWithCents } from "../utils/formatters";

type DebitCardsScreenProps = {
  bankSyncConfigured: boolean;
  bankSyncError: string | null;
  bankSyncLoading: boolean;
  debitCards: DebitCard[];
  expenses: DebitExpense[];
  lastBankSyncedAt: string | null;
  onAddDebitCard: (values: DebitCardFormValues) => void;
  onAddExpense: (values: DebitExpenseFormValues) => void;
  onConnectSandboxBank: () => void;
  onDeleteDebitCard: (card: DebitCard) => void;
  onDeleteExpense: (expense: DebitExpense) => void;
  onRefreshBankBalances: () => void;
};

type DebitCardErrors = Partial<Record<keyof DebitCardFormValues, string>>;
type ExpenseErrors = Partial<
  Record<"debitCardId" | "date" | "merchant" | "amount", string>
>;

function numberFromInput(value: string): number {
  return Number(value.replace(/,/g, "").trim());
}

function expenseTotal(expenses: DebitExpense[]): number {
  return expenses.reduce((total, expense) => total + expense.amount, 0);
}

function formatSyncTimestamp(value: string | null): string {
  if (!value) {
    return "Not synced";
  }

  return new Date(value).toLocaleString();
}

export function DebitCardsScreen({
  bankSyncConfigured,
  bankSyncError,
  bankSyncLoading,
  debitCards,
  expenses,
  lastBankSyncedAt,
  onAddDebitCard,
  onAddExpense,
  onConnectSandboxBank,
  onDeleteDebitCard,
  onDeleteExpense,
  onRefreshBankBalances,
}: DebitCardsScreenProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const cardOffsets = useRef<Record<string, number>>({});
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardName, setCardName] = useState("");
  const [cardBalance, setCardBalance] = useState("");
  const [expenseDate, setExpenseDate] = useState(getTodayISO());
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [cardErrors, setCardErrors] = useState<DebitCardErrors>({});
  const [expenseErrors, setExpenseErrors] = useState<ExpenseErrors>({});
  const selectedCard = useMemo(
    () => debitCards.find((card) => card.id === selectedCardId) ?? null,
    [debitCards, selectedCardId]
  );
  const selectedIndex = selectedCard
    ? debitCards.findIndex((card) => card.id === selectedCard.id)
    : -1;
  const selectedExpenses = useMemo(
    () =>
      expenses
        .filter((expense) => expense.debitCardId === selectedCard?.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, selectedCard]
  );
  const totalDebitBalance = debitCards.reduce(
    (total, card) => total + card.balance,
    0
  );
  const currentMonthKey = getMonthKey(new Date());
  const monthExpenseTotal = expenseTotal(
    expenses.filter((expense) => getMonthKey(expense.date) === currentMonthKey)
  );

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (
      selectedCardId &&
      !debitCards.some((card) => card.id === selectedCardId)
    ) {
      setSelectedCardId(null);
    }
  }, [debitCards, selectedCardId]);

  function selectCard(cardId: string) {
    if (cardId === selectedCardId) {
      return;
    }

    LayoutAnimation.configureNext(
      {
        duration: 380,
        create: {
          duration: 220,
          property: LayoutAnimation.Properties.opacity,
          type: LayoutAnimation.Types.easeInEaseOut,
        },
        delete: {
          duration: 180,
          property: LayoutAnimation.Properties.opacity,
          type: LayoutAnimation.Types.easeInEaseOut,
        },
        update: {
          duration: 380,
          type: LayoutAnimation.Types.easeInEaseOut,
        },
      },
      () => {
        const y = cardOffsets.current[cardId];

        if (typeof y === "number") {
          scrollViewRef.current?.scrollTo({
            animated: true,
            y: Math.max(y - spacing.lg, 0),
          });
        }
      }
    );
    setSelectedCardId(cardId);
  }

  function validateDebitCard(): DebitCardFormValues | null {
    const parsedBalance = numberFromInput(cardBalance);
    const nextErrors: DebitCardErrors = {};

    if (!cardName.trim()) {
      nextErrors.name = "Card name is required.";
    }

    if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
      nextErrors.balance = "Balance must be 0 or higher.";
    }

    setCardErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return null;
    }

    return {
      name: cardName.trim(),
      balance: parsedBalance,
    };
  }

  function validateExpense(): DebitExpenseFormValues | null {
    const parsedAmount = numberFromInput(amount);
    const nextErrors: ExpenseErrors = {};

    if (!selectedCard) {
      nextErrors.debitCardId = "Choose a debit card.";
    }

    if (!parseISODate(expenseDate)) {
      nextErrors.date = "Enter a valid date.";
    }

    if (!merchant.trim()) {
      nextErrors.merchant = "Merchant is required.";
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      nextErrors.amount = "Amount must be greater than 0.";
    }

    setExpenseErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !selectedCard) {
      return null;
    }

    return {
      debitCardId: selectedCard.id,
      date: expenseDate,
      merchant: merchant.trim(),
      amount: parsedAmount,
      category: category.trim() || undefined,
      note: note.trim() || undefined,
    };
  }

  function handleAddDebitCard() {
    const values = validateDebitCard();

    if (!values) {
      return;
    }

    onAddDebitCard(values);
    setCardName("");
    setCardBalance("");
    setCardErrors({});
  }

  function handleAddExpense() {
    const values = validateExpense();

    if (!values) {
      return;
    }

    onAddExpense(values);
    setMerchant("");
    setAmount("");
    setCategory("");
    setNote("");
    setExpenseDate(getTodayISO());
    setExpenseErrors({});
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ref={scrollViewRef}
        style={styles.screen}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>Debit cards</Text>
            <Text style={styles.title}>Spending tracker</Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <SummaryCard style={styles.metricCard} title="Debit balance">
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              numberOfLines={1}
              style={styles.metricValue}
            >
              {formatCurrencyWithCents(totalDebitBalance)}
            </Text>
          </SummaryCard>
          <SummaryCard style={styles.metricCard} title="This month">
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              numberOfLines={1}
              style={styles.metricValue}
            >
              {formatCurrencyWithCents(monthExpenseTotal)}
            </Text>
          </SummaryCard>
        </View>

        <SummaryCard title="Bank sync">
          <View style={styles.syncPanel}>
            <View style={styles.syncStatusRow}>
              <Text style={styles.syncLabel}>Last synced</Text>
              <Text style={styles.syncValue}>
                {formatSyncTimestamp(lastBankSyncedAt)}
              </Text>
            </View>
            <View style={styles.syncActions}>
              <AppButton
                disabled={!bankSyncConfigured || bankSyncLoading}
                label="Connect sandbox bank"
                loading={bankSyncLoading}
                onPress={onConnectSandboxBank}
                variant="secondary"
              />
              <AppButton
                disabled={!bankSyncConfigured || bankSyncLoading}
                label="Refresh balances"
                onPress={onRefreshBankBalances}
                variant="secondary"
              />
            </View>
            {!bankSyncConfigured ? (
              <Text style={styles.helper}>
                Add your Supabase URL and anon key to enable bank sync.
              </Text>
            ) : null}
            {bankSyncError ? (
              <Text style={styles.error}>{bankSyncError}</Text>
            ) : null}
          </View>
        </SummaryCard>

        {debitCards.length > 0 ? (
          <View style={styles.walletStack}>
            {debitCards.map((card, index) => {
              const selected = selectedCard?.id === card.id;
              const cardExpenses = expenses.filter(
                (expense) => expense.debitCardId === card.id
              );
              const cardMonthTotal = expenseTotal(
                cardExpenses.filter(
                  (expense) => getMonthKey(expense.date) === currentMonthKey
                )
              );
              const followsExpandedCard = selectedIndex >= 0 && index > selectedIndex;

              return (
                <View
                  key={card.id}
                  onLayout={(event) => {
                    cardOffsets.current[card.id] = event.nativeEvent.layout.y;
                  }}
                  style={[
                    styles.walletItem,
                    index > 0 && styles.overlappedWalletItem,
                    followsExpandedCard && styles.afterExpandedWalletItem,
                  ]}
                >
                  <DebitCardCard
                    card={card}
                    index={index}
                    onPress={() => selectCard(card.id)}
                    selected={selected}
                  />

                  {selected ? (
                    <View style={styles.inlineDetails}>
                      <View style={styles.inlineHeader}>
                        <View style={styles.inlineTitleWrap}>
                          <Text style={styles.inlineEyebrow}>
                            Selected debit card
                          </Text>
                          <Text style={styles.selectedName}>{card.name}</Text>
                        </View>
                        <AppButton
                          label="Delete"
                          onPress={() => onDeleteDebitCard(card)}
                          variant="danger"
                        />
                      </View>

                      <View style={styles.detailGrid}>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>
                            {card.source === "bank" ? "Synced balance" : "Available"}
                          </Text>
                          <Text
                            adjustsFontSizeToFit
                            minimumFontScale={0.78}
                            numberOfLines={1}
                            style={[
                              styles.detailValue,
                              card.balance < 0 ? styles.negative : null,
                            ]}
                          >
                            {formatCurrencyWithCents(card.balance)}
                          </Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Total expenses</Text>
                          <Text style={styles.detailValue}>
                            {formatCurrencyWithCents(expenseTotal(cardExpenses))}
                          </Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>This month</Text>
                          <Text style={styles.detailValue}>
                            {formatCurrencyWithCents(cardMonthTotal)}
                          </Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Source</Text>
                          <Text style={styles.detailValue}>
                            {card.source === "bank" ? "Bank" : "Manual"}
                          </Text>
                        </View>
                      </View>
                      {card.source === "bank" ? (
                        <Text style={styles.helper}>
                          Synced from {card.institutionName ?? "your bank"}
                          {card.lastSyncedAt
                            ? ` on ${formatSyncTimestamp(card.lastSyncedAt)}`
                            : ""}
                          .
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            message="Add a debit card balance, then log each purchase as an expense."
            title="No debit cards yet"
          />
        )}

        <SummaryCard title="Add debit card">
          <View style={styles.form}>
            <View style={styles.group}>
              <Text style={styles.label}>Card name</Text>
              <TextInput
                onChangeText={setCardName}
                placeholder="Checking debit"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, cardErrors.name && styles.inputError]}
                value={cardName}
              />
              {cardErrors.name ? (
                <Text style={styles.error}>{cardErrors.name}</Text>
              ) : null}
            </View>

            <MoneyInput
              error={cardErrors.balance}
              label="Current balance"
              onChangeText={setCardBalance}
              placeholder="500"
              value={cardBalance}
            />

            <AppButton label="Add debit card" onPress={handleAddDebitCard} />
          </View>
        </SummaryCard>

        {selectedCard ? (
          <SummaryCard title="Add expense">
            <View style={styles.form}>
              <DateInput
                error={expenseErrors.date}
                label="Expense date"
                onChangeText={setExpenseDate}
                value={expenseDate}
              />

              <View style={styles.group}>
                <Text style={styles.label}>Merchant</Text>
                <TextInput
                  onChangeText={setMerchant}
                  placeholder="Grocery store"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, expenseErrors.merchant && styles.inputError]}
                  value={merchant}
                />
                {expenseErrors.merchant ? (
                  <Text style={styles.error}>{expenseErrors.merchant}</Text>
                ) : null}
              </View>

              <MoneyInput
                error={expenseErrors.amount}
                label="Amount"
                onChangeText={setAmount}
                placeholder="42.50"
                value={amount}
              />

              <View style={styles.group}>
                <Text style={styles.label}>Category</Text>
                <TextInput
                  onChangeText={setCategory}
                  placeholder="Food"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={category}
                />
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

              {expenseErrors.debitCardId ? (
                <Text style={styles.error}>{expenseErrors.debitCardId}</Text>
              ) : null}

              <AppButton label="Add expense" onPress={handleAddExpense} />
            </View>
          </SummaryCard>
        ) : null}

        <SummaryCard title="Recent expenses">
          {selectedExpenses.length > 0 ? (
            <View style={styles.expenseList}>
              {selectedExpenses.map((expense) => (
                <View key={expense.id} style={styles.expenseItem}>
                  <View style={styles.expenseMain}>
                    <Text numberOfLines={1} style={styles.expenseMerchant}>
                      {expense.merchant}
                    </Text>
                    <Text style={styles.expenseMeta}>
                      {formatDateLabel(expense.date)}
                      {expense.category ? ` | ${expense.category}` : ""}
                    </Text>
                    {expense.note ? (
                      <Text numberOfLines={2} style={styles.expenseNote}>
                        {expense.note}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.expenseAside}>
                    <Text style={styles.expenseAmount}>
                      {formatCurrencyWithCents(expense.amount)}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onDeleteExpense(expense)}
                      style={({ pressed }) => [
                        styles.deleteExpense,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      <Text style={styles.deleteExpenseText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.helper}>No expenses logged for this debit card.</Text>
          )}
        </SummaryCard>
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
  screen: {
    backgroundColor: colors.background,
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
  metricRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
  },
  metricValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
  },
  syncPanel: {
    gap: spacing.md,
  },
  syncStatusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  syncLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  syncValue: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
  },
  syncActions: {
    gap: spacing.sm,
  },
  walletStack: {
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  walletItem: {
    position: "relative",
  },
  overlappedWalletItem: {
    marginTop: -112,
  },
  afterExpandedWalletItem: {
    marginTop: spacing.lg,
  },
  inlineDetails: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  inlineHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  inlineTitleWrap: {
    flex: 1,
  },
  inlineEyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  selectedName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  detailItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    flexGrow: 1,
    minWidth: "46%",
    padding: spacing.md,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  detailValue: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
  },
  negative: {
    color: colors.red,
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
  inputError: {
    borderColor: colors.red,
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 92,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "700",
  },
  expenseList: {
    gap: spacing.md,
  },
  expenseItem: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  expenseMain: {
    flex: 1,
    minWidth: 0,
  },
  expenseMerchant: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  expenseMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  expenseNote: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  expenseAside: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  expenseAmount: {
    color: colors.red,
    fontSize: 17,
    fontWeight: "900",
  },
  deleteExpense: {
    backgroundColor: colors.redSoft,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  deleteExpenseText: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
});
