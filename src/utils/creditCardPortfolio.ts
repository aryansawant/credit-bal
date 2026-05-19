import type { CreditCard } from "../types";

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getTotalCardBalance(cards: CreditCard[]): number {
  return roundCurrency(cards.reduce((total, card) => total + card.balance, 0));
}

export function getTotalMinimumPayment(cards: CreditCard[]): number {
  return roundCurrency(
    cards.reduce((total, card) => total + card.minimumMonthlyPayment, 0)
  );
}

export function getWeightedApr(cards: CreditCard[]): number {
  const totalBalance = getTotalCardBalance(cards);

  if (totalBalance <= 0) {
    return 0;
  }

  return (
    cards.reduce((total, card) => total + card.balance * card.apr, 0) /
    totalBalance
  );
}

export function getEarliestCreatedAt(cards: CreditCard[]): string {
  return [...cards].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
    ?.createdAt;
}

export function createPortfolioCard(cards: CreditCard[]): CreditCard | null {
  if (cards.length === 0) {
    return null;
  }

  const totalBalance = getTotalCardBalance(cards);
  const earliestCreatedAt = getEarliestCreatedAt(cards) ?? new Date().toISOString();

  return {
    id: "portfolio",
    name: cards.length === 1 ? cards[0].name : "All credit cards",
    balance: totalBalance,
    apr: getWeightedApr(cards),
    minimumMonthlyPayment: getTotalMinimumPayment(cards),
    dueDay: Math.min(...cards.map((card) => card.dueDay)),
    createdAt: earliestCreatedAt,
    updatedAt: new Date().toISOString(),
  };
}

export function applyPaymentsToPortfolioCard(
  portfolioCard: CreditCard,
  paymentTotal: number
): CreditCard {
  return {
    ...portfolioCard,
    balance: roundCurrency(Math.max(portfolioCard.balance - paymentTotal, 0)),
  };
}
