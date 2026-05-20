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
import { colors, radii, spacing } from "../styles/theme";
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
  addDebitCardFormVisible: boolean;
  debitCards: DebitCard[];
  expenses: DebitExpense[];
  onAddDebitCard: (values: DebitCardFormValues) => void;
  onAddExpense: (values: DebitExpenseFormValues) => void;
  onCloseAddDebitCard: () => void;
  onDeleteDebitCard: (card: DebitCard) => void;
  onDeleteExpense: (expense: DebitExpense) => void;
  onOpenAddDebitCard: () => void;
  onUpdateDebitCard: (card: DebitCard, values: DebitCardFormValues) => void;
  onUpdateExpense: (
    expense: DebitExpense,
    values: DebitExpenseFormValues
  ) => void;
};

type DebitCardErrors = Partial<Record<keyof DebitCardFormValues, string>>;
type ExpenseErrors = Partial<Record<"debitCardId" | "date" | "amount", string>>;

function numberFromInput(value: string): number {
  return Number(value.replace(/,/g, "").trim());
}

function expenseTotal(expenses: DebitExpense[]): number {
  return expenses.reduce((total, expense) => total + expense.amount, 0);
}

export function DebitCardsScreen({
  addDebitCardFormVisible,
  debitCards,
  expenses,
  onAddDebitCard,
  onAddExpense,
  onCloseAddDebitCard,
  onDeleteDebitCard,
  onDeleteExpense,
  onOpenAddDebitCard,
  onUpdateDebitCard,
  onUpdateExpense,
}: DebitCardsScreenProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const cardOffsets = useRef<Record<string, number>>({});
  const previousAddDebitFormVisible = useRef(addDebitCardFormVisible);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardName, setCardName] = useState("");
  const [cardBalance, setCardBalance] = useState("");
  const [expenseDate, setExpenseDate] = useState(getTodayISO());
  const [amount, setAmount] = useState("");
  const [editingDebitCardId, setEditingDebitCardId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
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
  const editingExpense = useMemo(
    () => expenses.find((expense) => expense.id === editingExpenseId) ?? null,
    [editingExpenseId, expenses]
  );
  const editingDebitCard = useMemo(
    () => debitCards.find((card) => card.id === editingDebitCardId) ?? null,
    [debitCards, editingDebitCardId]
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
      resetExpenseForm();
    }

    if (
      editingDebitCardId &&
      !debitCards.some((card) => card.id === editingDebitCardId)
    ) {
      resetDebitCardForm();
    }
  }, [debitCards, editingDebitCardId, selectedCardId]);

  useEffect(() => {
    if (
      !previousAddDebitFormVisible.current &&
      addDebitCardFormVisible &&
      editingDebitCardId
    ) {
      resetDebitCardForm();
    }
    previousAddDebitFormVisible.current = addDebitCardFormVisible;
  }, [addDebitCardFormVisible, editingDebitCardId]);

  function resetDebitCardForm() {
    setCardName("");
    setCardBalance("");
    setEditingDebitCardId(null);
    setCardErrors({});
  }

  function resetExpenseForm() {
    setAmount("");
    setExpenseDate(getTodayISO());
    setEditingExpenseId(null);
    setExpenseErrors({});
  }

  function selectCard(cardId: string) {
    const nextSelectedCardId = cardId === selectedCardId ? null : cardId;

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
        if (!nextSelectedCardId) {
          return;
        }

        const y = cardOffsets.current[nextSelectedCardId];

        if (typeof y === "number") {
          scrollViewRef.current?.scrollTo({
            animated: true,
            y: Math.max(y - spacing.lg, 0),
          });
        }
      }
    );
    setSelectedCardId(nextSelectedCardId);
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
      merchant: "Expense",
      amount: parsedAmount,
    };
  }

  function handleSaveDebitCard() {
    const values = validateDebitCard();

    if (!values) {
      return;
    }

    if (editingDebitCard) {
      onUpdateDebitCard(editingDebitCard, values);
    } else {
      onAddDebitCard(values);
    }

    resetDebitCardForm();
    onCloseAddDebitCard();
  }

  function handleCancelDebitCardForm() {
    resetDebitCardForm();
    onCloseAddDebitCard();
  }

  function handleEditDebitCard(card: DebitCard) {
    onCloseAddDebitCard();
    setEditingDebitCardId(card.id);
    setCardName(card.name);
    setCardBalance(String(card.balance));
    setCardErrors({});
  }

  function handleSaveExpense() {
    const values = validateExpense();

    if (!values) {
      return;
    }

    if (editingExpense) {
      onUpdateExpense(editingExpense, values);
    } else {
      onAddExpense(values);
    }

    resetExpenseForm();
  }

  function handleEditExpense(expense: DebitExpense) {
    setEditingExpenseId(expense.id);
    setExpenseDate(expense.date);
    setAmount(String(expense.amount));
    setExpenseErrors({});
  }

  function handleDeleteExpense(expense: DebitExpense) {
    if (editingExpenseId === expense.id) {
      resetExpenseForm();
    }

    onDeleteExpense(expense);
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
                        <View style={styles.inlineActions}>
                          <AppButton
                            label="Edit balance"
                            onPress={() => handleEditDebitCard(card)}
                            variant="secondary"
                          />
                          <AppButton
                            label="Delete"
                            onPress={() => onDeleteDebitCard(card)}
                            variant="danger"
                          />
                        </View>
                      </View>

                      <View style={styles.detailGrid}>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Available</Text>
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
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            actionLabel="Add card"
            message="Add a debit card balance, then log each purchase as an expense."
            onAction={onOpenAddDebitCard}
            title="No debit cards yet"
          />
        )}

        {addDebitCardFormVisible || editingDebitCard ? (
          <SummaryCard
            title={editingDebitCard ? "Edit debit card" : "Add debit card"}
          >
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

              <View style={styles.formActions}>
                <AppButton
                  label={editingDebitCard ? "Save debit card" : "Add debit card"}
                  onPress={handleSaveDebitCard}
                />
                <AppButton
                  label="Cancel"
                  onPress={handleCancelDebitCardForm}
                  variant="secondary"
                />
              </View>
            </View>
          </SummaryCard>
        ) : null}

        {selectedCard ? (
          <SummaryCard title={editingExpense ? "Edit expense" : "Add expense"}>
            <View style={styles.form}>
              <DateInput
                error={expenseErrors.date}
                label="Date"
                onChangeText={setExpenseDate}
                value={expenseDate}
              />

              <MoneyInput
                error={expenseErrors.amount}
                label="Amount"
                onChangeText={setAmount}
                placeholder="42.50"
                value={amount}
              />

              {expenseErrors.debitCardId ? (
                <Text style={styles.error}>{expenseErrors.debitCardId}</Text>
              ) : null}

              <View style={styles.formActions}>
                <AppButton
                  label={editingExpense ? "Save expense" : "Add expense"}
                  onPress={handleSaveExpense}
                />
                {editingExpense ? (
                  <AppButton
                    label="Cancel"
                    onPress={resetExpenseForm}
                    variant="secondary"
                  />
                ) : null}
              </View>
            </View>
          </SummaryCard>
        ) : null}

        {selectedCard ? (
          <SummaryCard title="Recent expenses">
            {selectedExpenses.length > 0 ? (
              <View style={styles.expenseList}>
                {selectedExpenses.map((expense) => (
                  <View key={expense.id} style={styles.expenseItem}>
                    <View style={styles.expenseMain}>
                      <Text numberOfLines={1} style={styles.expenseMerchant}>
                        Expense
                      </Text>
                      <Text style={styles.expenseMeta}>
                        {formatDateLabel(expense.date)}
                      </Text>
                    </View>
                    <View style={styles.expenseAside}>
                      <Text style={styles.expenseAmount}>
                        {formatCurrencyWithCents(expense.amount)}
                      </Text>
                      <View style={styles.expenseActions}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => handleEditExpense(expense)}
                          style={({ pressed }) => [
                            styles.editExpense,
                            pressed ? styles.pressed : null,
                          ]}
                        >
                          <Text style={styles.editExpenseText}>Edit</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => handleDeleteExpense(expense)}
                          style={({ pressed }) => [
                            styles.deleteExpense,
                            pressed ? styles.pressed : null,
                          ]}
                        >
                          <Text style={styles.deleteExpenseText}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.helper}>
                No expenses logged for this debit card.
              </Text>
            )}
          </SummaryCard>
        ) : null}
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
  inlineActions: {
    gap: spacing.sm,
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
  formActions: {
    gap: spacing.sm,
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
  expenseAside: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  expenseAmount: {
    color: colors.red,
    fontSize: 17,
    fontWeight: "900",
  },
  expenseActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  editExpense: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  editExpenseText: {
    color: colors.green,
    fontSize: 13,
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
