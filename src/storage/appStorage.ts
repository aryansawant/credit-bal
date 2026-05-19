import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CreditCard, DebitCard, DebitExpense, PaycheckPlan } from "../types";

const STORAGE_KEYS = {
  cardSetupSkipped: "ccpp.cardSetupSkipped.v1",
  creditCard: "ccpp.creditCard.v1",
  creditCards: "ccpp.creditCards.v1",
  debitCards: "ccpp.debitCards.v1",
  debitExpenses: "ccpp.debitExpenses.v1",
  paychecks: "ccpp.paychecks.v1",
};

export type StoredAppData = {
  creditCards: CreditCard[];
  debitCards: DebitCard[];
  debitExpenses: DebitExpense[];
  paychecks: PaycheckPlan[];
};

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function loadAppData(): Promise<StoredAppData> {
  const [
    creditCardsValue,
    creditCardValue,
    debitCardsValue,
    debitExpensesValue,
    paychecksValue,
  ] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.creditCards),
    AsyncStorage.getItem(STORAGE_KEYS.creditCard),
    AsyncStorage.getItem(STORAGE_KEYS.debitCards),
    AsyncStorage.getItem(STORAGE_KEYS.debitExpenses),
    AsyncStorage.getItem(STORAGE_KEYS.paychecks),
  ]);
  const migratedCard = safeParse<CreditCard | null>(creditCardValue, null);
  const creditCards =
    safeParse<CreditCard[]>(creditCardsValue, []).length > 0
      ? safeParse<CreditCard[]>(creditCardsValue, [])
      : migratedCard
        ? [migratedCard]
        : [];

  return {
    creditCards,
    debitCards: safeParse<DebitCard[]>(debitCardsValue, []),
    debitExpenses: safeParse<DebitExpense[]>(debitExpensesValue, []),
    paychecks: safeParse<PaycheckPlan[]>(paychecksValue, []),
  };
}

export async function loadInitialCardSetupSkipped(): Promise<boolean> {
  return (await AsyncStorage.getItem(STORAGE_KEYS.cardSetupSkipped)) === "true";
}

export async function saveInitialCardSetupSkipped(value: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.cardSetupSkipped, value ? "true" : "false");
}

export async function saveCreditCards(cards: CreditCard[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.creditCards, JSON.stringify(cards));
}

export async function saveDebitCards(cards: DebitCard[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.debitCards, JSON.stringify(cards));
}

export async function saveDebitExpenses(expenses: DebitExpense[]): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.debitExpenses,
    JSON.stringify(expenses)
  );
}

export async function savePaychecks(paychecks: PaycheckPlan[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.paychecks, JSON.stringify(paychecks));
}

export async function saveAppData(data: StoredAppData): Promise<void> {
  await Promise.all([
    saveCreditCards(data.creditCards),
    saveDebitCards(data.debitCards),
    saveDebitExpenses(data.debitExpenses),
    savePaychecks(data.paychecks),
  ]);
}

export async function clearAppData(): Promise<void> {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.creditCard,
    STORAGE_KEYS.cardSetupSkipped,
    STORAGE_KEYS.creditCards,
    STORAGE_KEYS.debitCards,
    STORAGE_KEYS.debitExpenses,
    "ccpp.bankOwnerKey.v1",
    STORAGE_KEYS.paychecks,
  ]);
}
