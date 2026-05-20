import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  loadAppData,
  loadInitialCardSetupSkipped,
  saveCreditCards,
  saveAppData,
  saveDebitCards,
  saveDebitExpenses,
  saveInitialCardSetupSkipped,
  savePaychecks,
  type StoredAppData,
} from "./src/storage/appStorage";
import {
  getValidCloudSession,
  loadCloudSnapshot,
  saveCloudSnapshot,
  signInWithEmail,
  signOutCloudAccount,
  signUpWithEmail,
  type CloudSession,
} from "./src/services/cloudAccount";
import { colors, premiumAccent, spacing } from "./src/styles/theme";
import type {
  CreditCard,
  CreditCardFormValues,
  DebitCard,
  DebitCardFormValues,
  DebitExpense,
  DebitExpenseFormValues,
  PaycheckFormValues,
  PaycheckPlan,
} from "./src/types";
import { calculatePayoff } from "./src/utils/payoffCalculator";
import {
  applyPaymentsToPortfolioCard,
  createPortfolioCard,
} from "./src/utils/creditCardPortfolio";
import {
  getActualPaidByCard,
  getConfirmedActualPaid,
} from "./src/utils/payoffCalculator";
import {
  getMonthKey,
  parseISODate,
  startOfMonth,
} from "./src/utils/dateHelpers";
import {
  AccountScreen,
  AddEditPaycheckScreen,
  CreditCardSetupScreen,
  CreditCardsScreen,
  DebitCardsScreen,
  ForecastScreen,
  HomeScreen,
  PaycheckPlannerScreen,
  PaymentCheckInScreen,
} from "./src/screens";

const APP_LOGO = require("./assets/app-logo.png");
const LAUNCH_BACKGROUND = "#004aad";
const PAID_OFF_BALANCE = 0.005;

type ScreenName =
  | "home"
  | "cards"
  | "debit"
  | "paychecks"
  | "forecast"
  | "cardSetup"
  | "paycheckForm"
  | "checkIn";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sortPaychecks(paychecks: PaycheckPlan[]): PaycheckPlan[] {
  return [...paychecks].sort((a, b) => a.paycheckDate.localeCompare(b.paycheckDate));
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function monthDiff(start: Date, monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return (year - start.getFullYear()) * 12 + (month - 1 - start.getMonth());
}

function paycheckCardPayments(
  paycheck: PaycheckPlan,
  creditCards: CreditCard[]
): NonNullable<PaycheckPlan["cardPayments"]> {
  if (paycheck.cardPayments?.length) {
    return creditCards.map((card) => {
      const existing = paycheck.cardPayments?.find(
        (payment) => payment.cardId === card.id
      );

      return {
        cardId: card.id,
        plannedAmount: existing?.plannedAmount ?? 0,
        actualAmount: existing?.actualAmount,
      };
    });
  }

  return creditCards.map((card, index) => ({
    cardId: card.id,
    plannedAmount: index === 0 ? paycheck.plannedCardPayment : 0,
    actualAmount: index === 0 ? paycheck.actualCardPayment : undefined,
  }));
}

function removePaidOffCardsFromFuturePlans(
  paychecks: PaycheckPlan[],
  creditCards: CreditCard[]
): PaycheckPlan[] {
  const cardStates = creditCards.reduce<
    Record<
      string,
      {
        balance: number;
        currentMonthIndex: number;
        monthlyRate: number;
        startMonth: Date;
      }
    >
  >(
    (acc, card) => {
      const createdAt = new Date(card.createdAt);
      const startDate = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;

      acc[card.id] = {
        balance: roundCurrency(Math.max(card.balance, 0)),
        currentMonthIndex: -1,
        monthlyRate: Math.max(card.apr, 0) / 100 / 12,
        startMonth: startOfMonth(startDate),
      };
      return acc;
    },
    {}
  );

  return sortPaychecks(paychecks).map((paycheck) => {
    const paycheckDate = parseISODate(paycheck.paycheckDate);
    const cardPayments = paycheckCardPayments(paycheck, creditCards);

    if (!paycheckDate) {
      return paycheck;
    }

    cardPayments.forEach((payment) => {
      const state = cardStates[payment.cardId];

      if (!state) {
        return;
      }

      const targetMonthIndex = Math.max(
        monthDiff(state.startMonth, getMonthKey(paycheckDate)),
        0
      );

      while (state.currentMonthIndex < targetMonthIndex) {
        state.currentMonthIndex += 1;
        state.balance = roundCurrency(
          state.balance + state.balance * state.monthlyRate
        );
      }
    });

    if (paycheck.status === "paid" || paycheck.status === "partial") {
      cardPayments.forEach((payment) => {
        const state = cardStates[payment.cardId];

        if (state) {
          state.balance = roundCurrency(
            Math.max(state.balance - (payment.actualAmount ?? 0), 0)
          );
        }
      });
      return paycheck;
    }

    if (paycheck.status !== "planned") {
      return paycheck;
    }

    const nextCardPayments = cardPayments.map((payment) => {
      const state = cardStates[payment.cardId];
      const remainingBalance = state?.balance ?? 0;
      const plannedAmount =
        remainingBalance <= PAID_OFF_BALANCE
          ? 0
          : Math.max(payment.plannedAmount, 0);

      if (state) {
        state.balance = roundCurrency(
          Math.max(remainingBalance - plannedAmount, 0)
        );
      }

      return {
        cardId: payment.cardId,
        plannedAmount,
      };
    });
    const plannedCardPayment = nextCardPayments.reduce(
      (total, payment) => total + payment.plannedAmount,
      0
    );

    return {
      ...paycheck,
      plannedCardPayment,
      cardPayments: nextCardPayments,
    };
  });
}

function sortDebitExpenses(expenses: DebitExpense[]): DebitExpense[] {
  return [...expenses].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  );
}

function hasAnyAppData(data: StoredAppData): boolean {
  return (
    data.creditCards.length > 0 ||
    data.debitCards.length > 0 ||
    data.debitExpenses.length > 0 ||
    data.paychecks.length > 0
  );
}

function TabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabButton,
        active && styles.tabButtonActive,
        pressed && styles.tabButtonPressed,
      ]}
    >
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        numberOfLines={1}
        style={[styles.tabText, active && styles.tabTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type AppHeaderContent = {
  eyebrow: string;
  title: string;
};

function appHeaderContent({
  hasPayoffDashboard,
  screen,
}: {
  hasPayoffDashboard: boolean;
  screen: ScreenName;
}): AppHeaderContent {
  switch (screen) {
    case "paychecks":
      return { eyebrow: "Future paychecks", title: "Payment plans" };
    case "cards":
    case "cardSetup":
      return { eyebrow: "Credit Cards", title: "Card balances" };
    case "debit":
      return { eyebrow: "Debit cards", title: "Spending tracker" };
    case "forecast":
      return hasPayoffDashboard
        ? { eyebrow: "Forecast", title: "Payoff estimate" }
        : { eyebrow: "Credit Disk", title: "Card balances" };
    default:
      return hasPayoffDashboard
        ? {
            eyebrow: "Credit Disk",
            title: "Payoff dashboard",
          }
        : { eyebrow: "Credit Disk", title: "Card balances" };
  }
}

function accountInitial(session: CloudSession | null): string {
  const email = session?.user.email;

  return email ? email.trim().charAt(0).toUpperCase() : "?";
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashOpacity] = useState(() => new Animated.Value(1));
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [debitCards, setDebitCards] = useState<DebitCard[]>([]);
  const [debitExpenses, setDebitExpenses] = useState<DebitExpense[]>([]);
  const [paychecks, setPaychecks] = useState<PaycheckPlan[]>([]);
  const [screen, setScreen] = useState<ScreenName>("home");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activePaycheckId, setActivePaycheckId] = useState<string | null>(null);
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(null);
  const [cloudSyncLoading, setCloudSyncLoading] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [lastCloudSyncedAt, setLastCloudSyncedAt] = useState<string | null>(null);
  const [initialCardSetupSkipped, setInitialCardSetupSkipped] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [debitCardFormVisible, setDebitCardFormVisible] = useState(false);

  useEffect(() => {
    let mounted = true;

    Promise.all([loadAppData(), loadInitialCardSetupSkipped()])
      .then(([data, skipped]) => {
        if (!mounted) {
          return;
        }

        setCards(data.creditCards);
        setInitialCardSetupSkipped(skipped);
        setDebitCards(data.debitCards);
        setDebitExpenses(sortDebitExpenses(data.debitExpenses));
        setPaychecks(sortPaychecks(data.paychecks));
        getValidCloudSession()
          .then(async (session) => {
            if (mounted && session) {
              setCloudSession(session);
              const snapshot = await loadCloudSnapshot(session);

              if (mounted && snapshot && hasAnyAppData(snapshot.data)) {
                await applyAppData(snapshot.data);
                setLastCloudSyncedAt(snapshot.updatedAt);
              }
            }
          })
          .catch(() => undefined);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    const fadeTimer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        duration: 450,
        toValue: 0,
        useNativeDriver: true,
      }).start(() => setSplashVisible(false));
    }, 650);

    return () => clearTimeout(fadeTimer);
  }, [loading, splashOpacity]);

  const adjustedCards = useMemo(() => {
    const paidByCard = getActualPaidByCard(paychecks);

    return cards.map((card) => ({
      ...card,
      balance: Math.max(card.balance - (paidByCard[card.id] ?? 0), 0),
    }));
  }, [cards, paychecks]);
  const startingPortfolioCard = useMemo(() => createPortfolioCard(cards), [cards]);
  const portfolioCard = useMemo(() => {
    if (!startingPortfolioCard) {
      return null;
    }

    return applyPaymentsToPortfolioCard(
      startingPortfolioCard,
      getConfirmedActualPaid(paychecks)
    );
  }, [paychecks, startingPortfolioCard]);
  const plannedResult = useMemo(
    () =>
      portfolioCard
        ? calculatePayoff(
            portfolioCard,
            paychecks,
            "planned",
            new Date(portfolioCard.createdAt)
          )
        : null,
    [portfolioCard, paychecks]
  );
  const actualResult = useMemo(
    () =>
      portfolioCard
        ? calculatePayoff(
            portfolioCard,
            paychecks,
            "actual",
            new Date(portfolioCard.createdAt)
          )
        : null,
    [portfolioCard, paychecks]
  );
  const activeCard = cards.find((card) => card.id === activeCardId);
  const activePaycheck = paychecks.find(
    (paycheck) => paycheck.id === activePaycheckId
  );

  function currentAppData(overrides: Partial<StoredAppData> = {}): StoredAppData {
    return {
      creditCards: overrides.creditCards ?? cards,
      debitCards: overrides.debitCards ?? debitCards,
      debitExpenses: overrides.debitExpenses ?? debitExpenses,
      paychecks: overrides.paychecks ?? paychecks,
    };
  }

  async function applyAppData(data: StoredAppData) {
    const sortedPaychecks = sortPaychecks(data.paychecks);
    const sortedDebitExpenses = sortDebitExpenses(data.debitExpenses);

    setCards(data.creditCards);
    setDebitCards(data.debitCards);
    setDebitExpenses(sortedDebitExpenses);
    setPaychecks(sortedPaychecks);
    await saveAppData({
      creditCards: data.creditCards,
      debitCards: data.debitCards,
      debitExpenses: sortedDebitExpenses,
      paychecks: sortedPaychecks,
    });
  }

  async function persistCloudData(
    data: StoredAppData,
    session = cloudSession
  ) {
    if (!session) {
      return;
    }

    try {
      const snapshot = await saveCloudSnapshot(session, data);
      setLastCloudSyncedAt(snapshot.updatedAt);
      setCloudSyncError(null);
    } catch (error) {
      setCloudSyncError(
        error instanceof Error ? error.message : "Could not sync account data."
      );
    }
  }

  async function persistCards(nextCards: CreditCard[]) {
    const sorted = [...nextCards].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    setCards(sorted);
    await saveCreditCards(sorted);
    await persistCloudData(currentAppData({ creditCards: sorted }));
  }

  async function persistDebitCards(nextCards: DebitCard[]) {
    const sorted = [...nextCards].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    setDebitCards(sorted);
    await saveDebitCards(sorted);
    await persistCloudData(currentAppData({ debitCards: sorted }));
  }

  async function persistPaychecks(nextPaychecks: PaycheckPlan[]) {
    const sorted = removePaidOffCardsFromFuturePlans(nextPaychecks, cards);
    setPaychecks(sorted);
    await savePaychecks(sorted);
    await persistCloudData(currentAppData({ paychecks: sorted }));
  }

  async function handleSaveCard(values: CreditCardFormValues) {
    const now = new Date().toISOString();

    if (activeCard) {
      await persistCards(
        cards.map((card) =>
          card.id === activeCard.id
            ? {
                ...card,
                ...values,
                updatedAt: now,
              }
            : card
        )
      );
    } else {
      const nextCard: CreditCard = {
        id: createId("card"),
        createdAt: now,
        updatedAt: now,
        ...values,
      };

      await persistCards([...cards, nextCard]);
    }

    setActiveCardId(null);
    setInitialCardSetupSkipped(false);
    await saveInitialCardSetupSkipped(false);
    setScreen("cards");
  }

  async function handleSkipInitialCardSetup() {
    setInitialCardSetupSkipped(true);
    await saveInitialCardSetupSkipped(true);
    setScreen("debit");
  }

  async function handleSaveDebitCard(values: DebitCardFormValues) {
    const now = new Date().toISOString();
    const nextCard: DebitCard = {
      id: createId("debit"),
      createdAt: now,
      source: "manual",
      updatedAt: now,
      ...values,
    };

    await persistDebitCards([...debitCards, nextCard]);
  }

  async function handleUpdateDebitCard(
    cardToUpdate: DebitCard,
    values: DebitCardFormValues
  ) {
    const now = new Date().toISOString();

    await persistDebitCards(
      debitCards.map((card) =>
        card.id === cardToUpdate.id
          ? {
              ...card,
              ...values,
              updatedAt: now,
            }
          : card
      )
    );
  }

  async function handleSaveDebitExpense(values: DebitExpenseFormValues) {
    const now = new Date().toISOString();
    const nextExpense: DebitExpense = {
      id: createId("expense"),
      createdAt: now,
      updatedAt: now,
      ...values,
    };
    const nextCards = debitCards.map((card) =>
      card.id === values.debitCardId
        ? {
            ...card,
            balance: card.balance - values.amount,
            updatedAt: now,
          }
        : card
    );
    const nextExpenses = sortDebitExpenses([...debitExpenses, nextExpense]);

    setDebitCards(nextCards);
    setDebitExpenses(nextExpenses);
    await Promise.all([
      saveDebitCards(nextCards),
      saveDebitExpenses(nextExpenses),
    ]);
    await persistCloudData(
      currentAppData({ debitCards: nextCards, debitExpenses: nextExpenses })
    );
  }

  async function handleUpdateDebitExpense(
    expenseToUpdate: DebitExpense,
    values: DebitExpenseFormValues
  ) {
    const now = new Date().toISOString();
    const nextCards = debitCards.map((card) => {
      if (
        card.id !== expenseToUpdate.debitCardId &&
        card.id !== values.debitCardId
      ) {
        return card;
      }

      const restoredAmount =
        card.id === expenseToUpdate.debitCardId ? expenseToUpdate.amount : 0;
      const nextExpenseAmount = card.id === values.debitCardId ? values.amount : 0;

      return {
        ...card,
        balance: card.balance + restoredAmount - nextExpenseAmount,
        updatedAt: now,
      };
    });
    const nextExpenses = sortDebitExpenses(
      debitExpenses.map((expense) =>
        expense.id === expenseToUpdate.id
          ? {
              ...expense,
              ...values,
              updatedAt: now,
            }
          : expense
      )
    );

    setDebitCards(nextCards);
    setDebitExpenses(nextExpenses);
    await Promise.all([
      saveDebitCards(nextCards),
      saveDebitExpenses(nextExpenses),
    ]);
    await persistCloudData(
      currentAppData({ debitCards: nextCards, debitExpenses: nextExpenses })
    );
  }

  async function handleSavePaycheck(values: PaycheckFormValues) {
    const now = new Date().toISOString();

    if (activePaycheck) {
      await persistPaychecks(
        paychecks.map((paycheck) =>
          paycheck.id === activePaycheck.id
            ? {
                ...paycheck,
                ...values,
                updatedAt: now,
              }
            : paycheck
        )
      );
    } else {
      const nextPaycheck: PaycheckPlan = {
        id: createId("paycheck"),
        status: "planned",
        createdAt: now,
        updatedAt: now,
        ...values,
      };

      await persistPaychecks([...paychecks, nextPaycheck]);
    }

    setActivePaycheckId(null);
    setScreen("paychecks");
  }

  async function handleSaveCheckIn(updates: {
    status: PaycheckPlan["status"];
    actualCardPayment: number;
    cardPayments: PaycheckPlan["cardPayments"];
  }) {
    if (!activePaycheck) {
      setScreen("paychecks");
      return;
    }

    const now = new Date().toISOString();

    await persistPaychecks(
      paychecks.map((paycheck) =>
        paycheck.id === activePaycheck.id
          ? {
              ...paycheck,
              ...updates,
              updatedAt: now,
            }
          : paycheck
      )
    );

    setActivePaycheckId(null);
    setScreen("paychecks");
  }

  async function handleAccountSession(nextSession: CloudSession) {
    setCloudSession(nextSession);
    const snapshot = await loadCloudSnapshot(nextSession);

    if (snapshot && hasAnyAppData(snapshot.data)) {
      await applyAppData(snapshot.data);
      setLastCloudSyncedAt(snapshot.updatedAt);
      return;
    }

    const data = currentAppData();
    const saved = await saveCloudSnapshot(nextSession, data);
    setLastCloudSyncedAt(saved.updatedAt);
  }

  async function handleSignIn(email: string, password: string) {
    setCloudSyncLoading(true);
    setCloudSyncError(null);

    try {
      const session = await signInWithEmail(email, password);
      await handleAccountSession(session);
    } catch (error) {
      setCloudSyncError(
        error instanceof Error ? error.message : "Could not sign in."
      );
    } finally {
      setCloudSyncLoading(false);
    }
  }

  async function handleSignUp(email: string, password: string) {
    setCloudSyncLoading(true);
    setCloudSyncError(null);

    try {
      const session = await signUpWithEmail(email, password);
      await handleAccountSession(session);
    } catch (error) {
      setCloudSyncError(
        error instanceof Error ? error.message : "Could not create account."
      );
    } finally {
      setCloudSyncLoading(false);
    }
  }

  async function handleSignOut() {
    if (!cloudSession) {
      return;
    }

    setCloudSyncLoading(true);
    setCloudSyncError(null);

    try {
      await signOutCloudAccount(cloudSession);
      setCloudSession(null);
      setLastCloudSyncedAt(null);
    } catch (error) {
      setCloudSyncError(
        error instanceof Error ? error.message : "Could not sign out."
      );
    } finally {
      setCloudSyncLoading(false);
    }
  }

  async function handleDownloadCloudData() {
    if (!cloudSession) {
      return;
    }

    setCloudSyncLoading(true);
    setCloudSyncError(null);

    try {
      const snapshot = await loadCloudSnapshot(cloudSession);

      if (!snapshot) {
        setCloudSyncError("No cloud data found for this account.");
        return;
      }

      await applyAppData(snapshot.data);
      setLastCloudSyncedAt(snapshot.updatedAt);
    } catch (error) {
      setCloudSyncError(
        error instanceof Error ? error.message : "Could not restore cloud data."
      );
    } finally {
      setCloudSyncLoading(false);
    }
  }

  async function handleDeleteDebitCard(cardToDelete: DebitCard) {
    const nextCards = debitCards.filter((card) => card.id !== cardToDelete.id);
    const nextExpenses = debitExpenses.filter(
      (expense) => expense.debitCardId !== cardToDelete.id
    );

    setDebitCards(nextCards);
    setDebitExpenses(nextExpenses);
    await Promise.all([
      saveDebitCards(nextCards),
      saveDebitExpenses(nextExpenses),
    ]);
    await persistCloudData(
      currentAppData({ debitCards: nextCards, debitExpenses: nextExpenses })
    );
  }

  async function handleDeleteDebitExpense(expenseToDelete: DebitExpense) {
    const now = new Date().toISOString();
    const nextCards = debitCards.map((card) =>
      card.id === expenseToDelete.debitCardId
        ? {
            ...card,
            balance: card.balance + expenseToDelete.amount,
            updatedAt: now,
          }
        : card
    );
    const nextExpenses = debitExpenses.filter(
      (expense) => expense.id !== expenseToDelete.id
    );

    setDebitCards(nextCards);
    setDebitExpenses(nextExpenses);
    await Promise.all([
      saveDebitCards(nextCards),
      saveDebitExpenses(nextExpenses),
    ]);
    await persistCloudData(
      currentAppData({ debitCards: nextCards, debitExpenses: nextExpenses })
    );
  }

  async function handleDeletePaycheck(paycheckToDelete: PaycheckPlan) {
    if (activePaycheckId === paycheckToDelete.id) {
      setActivePaycheckId(null);
    }

    await persistPaychecks(
      paychecks.filter((paycheck) => paycheck.id !== paycheckToDelete.id)
    );
  }

  function openPaycheckForm(paycheck?: PaycheckPlan) {
    setActivePaycheckId(paycheck?.id ?? null);
    setScreen("paycheckForm");
  }

  function openCheckIn(paycheck: PaycheckPlan) {
    setActivePaycheckId(paycheck.id);
    setScreen("checkIn");
  }

  function openCardForm(card?: CreditCard) {
    setActiveCardId(card?.id ?? null);
    setScreen("cardSetup");
  }

  function renderAppShell(children: React.ReactNode) {
    return (
      <SafeAreaView style={styles.app}>
        {children}
        {splashVisible ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.launchSplash, { opacity: splashOpacity }]}
          >
            <Image
              accessibilityIgnoresInvertColors
              source={APP_LOGO}
              style={styles.launchLogo}
            />
          </Animated.View>
        ) : null}
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  if (loading) {
    return renderAppShell(null);
  }

  if ((cards.length === 0 && !initialCardSetupSkipped) || screen === "cardSetup") {
    return renderAppShell(
        <CreditCardSetupScreen
          existingCardCount={cards.length}
          initialCard={activeCard}
          onCancel={
            cards.length > 0 || initialCardSetupSkipped
              ? () => {
                  setActiveCardId(null);
                  setScreen(cards.length > 0 ? "cards" : "debit");
                }
              : undefined
          }
          onSave={handleSaveCard}
          onSkip={handleSkipInitialCardSetup}
        />
    );
  }

  if (screen === "paycheckForm") {
    return renderAppShell(
        <AddEditPaycheckScreen
          cards={cards}
          initialPaycheck={activePaycheck}
          paychecks={paychecks}
          onCancel={() => {
            setActivePaycheckId(null);
            setScreen("paychecks");
          }}
          onSave={handleSavePaycheck}
        />
    );
  }

  if (screen === "checkIn" && activePaycheck) {
    return renderAppShell(
        <PaymentCheckInScreen
          cards={cards}
          onCancel={() => {
            setActivePaycheckId(null);
            setScreen("paychecks");
          }}
          onSave={handleSaveCheckIn}
          paycheck={activePaycheck}
        />
    );
  }

  const safePlannedResult = portfolioCard
    ? plannedResult ??
      calculatePayoff(
        portfolioCard,
        paychecks,
        "planned",
        new Date(portfolioCard.createdAt)
      )
    : null;
  const safeActualResult = portfolioCard
    ? actualResult ??
      calculatePayoff(
        portfolioCard,
        paychecks,
        "actual",
        new Date(portfolioCard.createdAt)
      )
    : null;
  const hasPayoffDashboard = Boolean(
    portfolioCard && safePlannedResult && safeActualResult
  );
  const headerContent = appHeaderContent({
    hasPayoffDashboard,
    screen,
  });
  const showCreditAddAction =
    screen === "cards" || (!hasPayoffDashboard && screen === "home");
  const showDebitAddAction = screen === "debit";

  const mainScreen =
    screen === "forecast" && portfolioCard && safePlannedResult && safeActualResult ? (
      <ForecastScreen
        actualResult={safeActualResult}
        cards={adjustedCards}
        onAddPaycheck={() => openPaycheckForm()}
        paychecks={paychecks}
        plannedResult={safePlannedResult}
        portfolioCard={portfolioCard}
      />
    ) : screen === "forecast" ? (
      <CreditCardsScreen
        cards={adjustedCards}
        onAddCard={() => openCardForm()}
        onEditCard={openCardForm}
      />
    ) : screen === "cards" ? (
      <CreditCardsScreen
        cards={adjustedCards}
        onAddCard={() => openCardForm()}
        onEditCard={openCardForm}
      />
    ) : screen === "paychecks" ? (
      <PaycheckPlannerScreen
        onAddPaycheck={() => openPaycheckForm()}
        onCheckIn={openCheckIn}
        onDeletePaycheck={handleDeletePaycheck}
        onEditPaycheck={openPaycheckForm}
        paychecks={paychecks}
      />
    ) : screen === "debit" ? (
      <DebitCardsScreen
        addDebitCardFormVisible={debitCardFormVisible}
        debitCards={debitCards}
        expenses={debitExpenses}
        onAddDebitCard={handleSaveDebitCard}
        onAddExpense={handleSaveDebitExpense}
        onCloseAddDebitCard={() => setDebitCardFormVisible(false)}
        onDeleteDebitCard={handleDeleteDebitCard}
        onDeleteExpense={handleDeleteDebitExpense}
        onOpenAddDebitCard={() => setDebitCardFormVisible(true)}
        onUpdateDebitCard={handleUpdateDebitCard}
        onUpdateExpense={handleUpdateDebitExpense}
      />
    ) : portfolioCard && safePlannedResult && safeActualResult ? (
      <HomeScreen
        actualResult={safeActualResult}
        cards={adjustedCards}
        paychecks={paychecks}
        plannedResult={safePlannedResult}
        startingBalance={startingPortfolioCard?.balance ?? portfolioCard.balance}
        startingCards={cards}
        portfolioCard={portfolioCard}
      />
    ) : (
      <CreditCardsScreen
        cards={adjustedCards}
        onAddCard={() => openCardForm()}
        onEditCard={openCardForm}
      />
    );

  return renderAppShell(
    <>
      <View style={styles.appHeader}>
        <View style={styles.appHeaderText}>
          <Text style={styles.appHeaderEyebrow}>{headerContent.eyebrow}</Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            numberOfLines={1}
            style={styles.appHeaderTitle}
          >
            {headerContent.title}
          </Text>
        </View>
        {showCreditAddAction || showDebitAddAction ? (
          <Pressable
            accessibilityLabel={
              showDebitAddAction ? "Add debit card" : "Add credit card"
            }
            accessibilityRole="button"
            onPress={() => {
              if (showDebitAddAction) {
                setDebitCardFormVisible(true);
                return;
              }

              openCardForm();
            }}
            style={({ pressed }) => [
              styles.headerAddButton,
              pressed ? styles.accountButtonPressed : null,
            ]}
          >
            <Text style={styles.headerAddText}>+</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityLabel={cloudSession ? "Account" : "Sign in"}
            accessibilityRole="button"
            onPress={() => setAccountModalVisible(true)}
            style={({ pressed }) => [
              styles.accountButton,
              cloudSession ? styles.accountButtonSignedIn : null,
              pressed ? styles.accountButtonPressed : null,
            ]}
          >
            {cloudSession ? (
              <View style={styles.accountAvatar}>
                <Text style={styles.accountAvatarText}>
                  {accountInitial(cloudSession)}
                </Text>
              </View>
            ) : (
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                numberOfLines={1}
                style={styles.accountLabel}
              >
                Sign in
              </Text>
            )}
          </Pressable>
        )}
      </View>
      <View style={styles.main}>{mainScreen}</View>
      <View style={styles.tabBarWrap}>
        <View style={styles.tabBar}>
          <TabButton
            active={screen === "home"}
            label="Home"
            onPress={() => setScreen("home")}
          />
          <TabButton
            active={screen === "paychecks"}
            label="Paychecks"
            onPress={() => setScreen("paychecks")}
          />
          <TabButton
            active={screen === "cards"}
            label="Credit"
            onPress={() => setScreen("cards")}
          />
          <TabButton
            active={screen === "debit"}
            label="Debit"
            onPress={() => setScreen("debit")}
          />
          <TabButton
            active={screen === "forecast"}
            label="Forecast"
            onPress={() => setScreen("forecast")}
          />
        </View>
      </View>
      <Modal
        animationType="fade"
        onRequestClose={() => setAccountModalVisible(false)}
        transparent
        visible={accountModalVisible}
      >
        <View style={styles.accountModalBackdrop}>
          <View style={styles.accountModalCard}>
            <View style={styles.accountModalHeader}>
              <Text style={styles.accountModalTitle}>
                {cloudSession ? "Account" : "Sign in"}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAccountModalVisible(false)}
                style={({ pressed }) => [
                  styles.modalCloseButton,
                  pressed ? styles.accountButtonPressed : null,
                ]}
              >
                <Text style={styles.modalCloseText}>Done</Text>
              </Pressable>
            </View>
            <AccountScreen
              error={cloudSyncError}
              lastSyncedAt={lastCloudSyncedAt}
              loading={cloudSyncLoading}
              onClearError={() => setCloudSyncError(null)}
              onDownloadCloud={handleDownloadCloudData}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
              onSignUp={handleSignUp}
              session={cloudSession}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  app: {
    backgroundColor: colors.background,
    flex: 1,
  },
  launchSplash: {
    alignItems: "center",
    backgroundColor: LAUNCH_BACKGROUND,
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 100,
  },
  launchLogo: {
    borderRadius: 32,
    height: 148,
    width: 148,
  },
  appHeader: {
    alignItems: "center",
    backgroundColor: colors.background,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  appHeaderText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  appHeaderEyebrow: {
    color: colors.green,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  appHeaderTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
  },
  accountButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    maxWidth: 180,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  accountButtonSignedIn: {
    justifyContent: "center",
    maxWidth: 44,
    paddingHorizontal: spacing.xs,
    width: 44,
  },
  accountButtonPressed: {
    opacity: 0.72,
  },
  accountAvatar: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderRadius: 999,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  accountAvatarText: {
    color: colors.green,
    fontSize: 14,
    fontWeight: "900",
  },
  accountLabel: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  headerAddButton: {
    alignItems: "center",
    backgroundColor: colors.green,
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  headerAddText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 26,
  },
  main: {
    flex: 1,
  },
  tabBarWrap: {
    backgroundColor: colors.background,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs,
  },
  tabButton: {
    alignItems: "center",
    borderRadius: 22,
    flex: 1,
    gap: spacing.xs,
    minHeight: 50,
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  tabButtonActive: {
    backgroundColor: premiumAccent.soft,
  },
  tabButtonPressed: {
    opacity: 0.72,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
  },
  tabTextActive: {
    color: premiumAccent.color,
  },
  accountModalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.32)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  accountModalCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 520,
    maxHeight: "82%",
    padding: spacing.xl,
    width: "100%",
  },
  accountModalHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  accountModalTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
  },
  modalCloseButton: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  modalCloseText: {
    color: colors.green,
    fontSize: 17,
    fontWeight: "600",
  },
});
