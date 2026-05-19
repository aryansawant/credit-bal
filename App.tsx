import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
  connectSandboxBank,
  isBankSyncConfigured,
  syncBankBalances,
  type BankAccountBalance,
} from "./src/services/bankSync";
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

function sortDebitExpenses(expenses: DebitExpense[]): DebitExpense[] {
  return [...expenses].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  );
}

function bankAccountBalanceValue(account: BankAccountBalance): number {
  return account.available ?? account.current ?? 0;
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

function screenTitle(screen: ScreenName): string {
  switch (screen) {
    case "paychecks":
      return "Paychecks";
    case "cards":
    case "cardSetup":
      return "Cards";
    case "debit":
      return "Debit";
    case "forecast":
      return "Forecast";
    default:
      return "Debt Cal";
  }
}

function accountInitial(session: CloudSession | null): string {
  const email = session?.user.email;

  return email ? email.trim().charAt(0).toUpperCase() : "A";
}

function accountLabel(session: CloudSession | null): string {
  return session?.user.email ?? "Sign in";
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [debitCards, setDebitCards] = useState<DebitCard[]>([]);
  const [debitExpenses, setDebitExpenses] = useState<DebitExpense[]>([]);
  const [paychecks, setPaychecks] = useState<PaycheckPlan[]>([]);
  const [screen, setScreen] = useState<ScreenName>("home");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activePaycheckId, setActivePaycheckId] = useState<string | null>(null);
  const [bankSyncLoading, setBankSyncLoading] = useState(false);
  const [bankSyncError, setBankSyncError] = useState<string | null>(null);
  const [lastBankSyncedAt, setLastBankSyncedAt] = useState<string | null>(null);
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(null);
  const [cloudSyncLoading, setCloudSyncLoading] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [lastCloudSyncedAt, setLastCloudSyncedAt] = useState<string | null>(null);
  const [initialCardSetupSkipped, setInitialCardSetupSkipped] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);

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
        setLastBankSyncedAt(
          data.debitCards
            .map((card) => card.lastSyncedAt)
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1) ?? null
        );
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
    setLastBankSyncedAt(
      data.debitCards
        .map((card) => card.lastSyncedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null
    );
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

  async function persistSyncedBankAccounts(accounts: BankAccountBalance[]) {
    const now = new Date().toISOString();
    const nextCards = [...debitCards];

    accounts.forEach((account) => {
      const existingIndex = nextCards.findIndex(
        (card) => card.externalAccountId === account.accountId
      );
      const maskedName = account.mask
        ? `${account.name} ${account.mask}`
        : account.name;
      const nextCard: DebitCard = {
        id:
          existingIndex >= 0
            ? nextCards[existingIndex].id
            : createId("bank-debit"),
        createdAt: existingIndex >= 0 ? nextCards[existingIndex].createdAt : now,
        updatedAt: now,
        balance: bankAccountBalanceValue(account),
        externalAccountId: account.accountId,
        institutionName: account.institutionName,
        lastSyncedAt: now,
        mask: account.mask ?? undefined,
        name: account.institutionName
          ? `${account.institutionName} ${maskedName}`
          : maskedName,
        source: "bank",
      };

      if (existingIndex >= 0) {
        nextCards[existingIndex] = nextCard;
      } else {
        nextCards.push(nextCard);
      }
    });

    const sorted = [...nextCards].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
    setDebitCards(sorted);
    await saveDebitCards(sorted);
    setLastBankSyncedAt(now);
    await persistCloudData(currentAppData({ debitCards: sorted }));
  }

  async function persistPaychecks(nextPaychecks: PaycheckPlan[]) {
    const sorted = sortPaychecks(nextPaychecks);
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

  async function handleConnectSandboxBank() {
    setBankSyncLoading(true);
    setBankSyncError(null);

    try {
      const accounts = await connectSandboxBank(cloudSession?.accessToken);
      await persistSyncedBankAccounts(accounts);
    } catch (error) {
      setBankSyncError(
        error instanceof Error ? error.message : "Could not connect sandbox bank."
      );
    } finally {
      setBankSyncLoading(false);
    }
  }

  async function handleRefreshBankBalances() {
    setBankSyncLoading(true);
    setBankSyncError(null);

    try {
      const accounts = await syncBankBalances(
        true,
        cloudSession?.accessToken
      );
      await persistSyncedBankAccounts(accounts);
    } catch (error) {
      setBankSyncError(
        error instanceof Error ? error.message : "Could not refresh bank balances."
      );
    } finally {
      setBankSyncLoading(false);
    }
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

  async function handleUploadDeviceData() {
    if (!cloudSession) {
      return;
    }

    setCloudSyncLoading(true);
    setCloudSyncError(null);

    try {
      const snapshot = await saveCloudSnapshot(cloudSession, currentAppData());
      setLastCloudSyncedAt(snapshot.updatedAt);
    } catch (error) {
      setCloudSyncError(
        error instanceof Error ? error.message : "Could not upload device data."
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

  if (loading) {
    return (
      <SafeAreaView style={styles.app}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.green} />
          <Text style={styles.loadingText}>Loading planner</Text>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  if ((cards.length === 0 && !initialCardSetupSkipped) || screen === "cardSetup") {
    return (
      <SafeAreaView style={styles.app}>
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
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  if (screen === "paycheckForm") {
    return (
      <SafeAreaView style={styles.app}>
        <AddEditPaycheckScreen
          cards={cards}
          initialPaycheck={activePaycheck}
          onCancel={() => {
            setActivePaycheckId(null);
            setScreen("paychecks");
          }}
          onSave={handleSavePaycheck}
        />
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  if (screen === "checkIn" && activePaycheck) {
    return (
      <SafeAreaView style={styles.app}>
        <PaymentCheckInScreen
          cards={cards}
          onCancel={() => {
            setActivePaycheckId(null);
            setScreen("paychecks");
          }}
          onSave={handleSaveCheckIn}
          paycheck={activePaycheck}
        />
        <StatusBar style="dark" />
      </SafeAreaView>
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
        bankSyncConfigured={isBankSyncConfigured()}
        bankSyncError={bankSyncError}
        bankSyncLoading={bankSyncLoading}
        debitCards={debitCards}
        expenses={debitExpenses}
        lastBankSyncedAt={lastBankSyncedAt}
        onAddDebitCard={handleSaveDebitCard}
        onAddExpense={handleSaveDebitExpense}
        onConnectSandboxBank={handleConnectSandboxBank}
        onDeleteDebitCard={handleDeleteDebitCard}
        onDeleteExpense={handleDeleteDebitExpense}
        onRefreshBankBalances={handleRefreshBankBalances}
      />
    ) : portfolioCard && safePlannedResult && safeActualResult ? (
      <HomeScreen
        actualResult={safeActualResult}
        cards={adjustedCards}
        onOpenCards={() => setScreen("cards")}
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

  return (
    <SafeAreaView style={styles.app}>
      <View style={styles.appHeader}>
        <Text style={styles.appHeaderTitle}>{screenTitle(screen)}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setAccountModalVisible(true)}
          style={({ pressed }) => [
            styles.accountButton,
            pressed ? styles.accountButtonPressed : null,
          ]}
        >
          <View style={styles.accountAvatar}>
            <Text style={styles.accountAvatarText}>
              {accountInitial(cloudSession)}
            </Text>
          </View>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            numberOfLines={1}
            style={styles.accountLabel}
          >
            {accountLabel(cloudSession)}
          </Text>
        </Pressable>
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
            label="Cards"
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
              <View>
                <Text style={styles.accountModalEyebrow}>Account</Text>
                <Text style={styles.accountModalTitle}>
                  {cloudSession ? "Account details" : "Sign in"}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAccountModalVisible(false)}
                style={({ pressed }) => [
                  styles.modalCloseButton,
                  pressed ? styles.accountButtonPressed : null,
                ]}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>
            <AccountScreen
              error={cloudSyncError}
              lastSyncedAt={lastCloudSyncedAt}
              loading={cloudSyncLoading}
              onDownloadCloud={handleDownloadCloudData}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
              onSignUp={handleSignUp}
              onUploadDevice={handleUploadDeviceData}
              session={cloudSession}
            />
          </View>
        </View>
      </Modal>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: {
    backgroundColor: colors.background,
    flex: 1,
  },
  appHeader: {
    alignItems: "center",
    backgroundColor: colors.background,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  appHeaderTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
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
  main: {
    flex: 1,
  },
  loading: {
    alignItems: "center",
    flex: 1,
    gap: spacing.md,
    justifyContent: "center",
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "700",
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
    backgroundColor: "rgba(0,0,0,0.58)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  accountModalCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    height: "78%",
    maxWidth: 520,
    maxHeight: "90%",
    padding: spacing.lg,
    width: "100%",
  },
  accountModalHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  accountModalEyebrow: {
    color: colors.green,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  accountModalTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  modalCloseButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalCloseText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
});
