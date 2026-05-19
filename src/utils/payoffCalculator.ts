import type {
  CreditCard,
  PaycheckPlan,
  PayoffMode,
  PayoffMonth,
  PayoffResult,
} from "../types";
import {
  addMonths,
  dateForDueDay,
  formatMonthLabel,
  getMonthKey,
  latestISODate,
  parseISODate,
  startOfMonth,
  toISODate,
} from "./dateHelpers";

const MAX_SIMULATION_MONTHS = 600;

type MonthlyPayments = Record<string, number>;
type MonthlyDates = Record<string, string[]>;

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getPlannedPaymentTotal(plan: PaycheckPlan): number {
  if (plan.cardPayments?.length) {
    return roundCurrency(
      plan.cardPayments.reduce((total, payment) => total + payment.plannedAmount, 0)
    );
  }

  return plan.plannedCardPayment;
}

export function getActualPaymentTotal(plan: PaycheckPlan): number {
  if (plan.cardPayments?.length) {
    return roundCurrency(
      plan.cardPayments.reduce(
        (total, payment) => total + (payment.actualAmount ?? 0),
        0
      )
    );
  }

  if (plan.status === "paid") {
    return plan.actualCardPayment ?? plan.plannedCardPayment;
  }

  if (plan.status === "partial") {
    return plan.actualCardPayment ?? 0;
  }

  return 0;
}

export function getActualPaidByCard(paychecks: PaycheckPlan[]): Record<string, number> {
  return paychecks.reduce<Record<string, number>>((acc, paycheck) => {
    if (!["paid", "partial"].includes(paycheck.status)) {
      return acc;
    }

    paycheck.cardPayments?.forEach((payment) => {
      acc[payment.cardId] = roundCurrency(
        (acc[payment.cardId] ?? 0) + (payment.actualAmount ?? 0)
      );
    });

    return acc;
  }, {});
}

function getPaymentAmount(plan: PaycheckPlan, mode: PayoffMode): number {
  if (mode === "planned") {
    return getPlannedPaymentTotal(plan);
  }

  return getActualPaymentTotal(plan);
}

function groupPaycheckPayments(
  paychecks: PaycheckPlan[],
  mode: PayoffMode
): { payments: MonthlyPayments; dates: MonthlyDates; lastPaymentKey: string | null } {
  return paychecks.reduce(
    (acc, paycheck) => {
      if (!parseISODate(paycheck.paycheckDate)) {
        return acc;
      }

      if (mode === "actual" && !["paid", "partial"].includes(paycheck.status)) {
        return acc;
      }

      const amount = getPaymentAmount(paycheck, mode);

      if (amount <= 0) {
        return acc;
      }

      const monthKey = getMonthKey(paycheck.paycheckDate);
      acc.payments[monthKey] = roundCurrency((acc.payments[monthKey] ?? 0) + amount);
      acc.dates[monthKey] = [...(acc.dates[monthKey] ?? []), paycheck.paycheckDate];

      if (!acc.lastPaymentKey || monthKey > acc.lastPaymentKey) {
        acc.lastPaymentKey = monthKey;
      }

      return acc;
    },
    { payments: {}, dates: {}, lastPaymentKey: null } as {
      payments: MonthlyPayments;
      dates: MonthlyDates;
      lastPaymentKey: string | null;
    }
  );
}

function monthDiff(start: Date, monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return (year - start.getFullYear()) * 12 + (month - 1 - start.getMonth());
}

function createWarning(
  mode: PayoffMode,
  hasPayments: boolean,
  balanceRemainsAfterKnownPayments: boolean,
  softWarning?: string
): string | undefined {
  if (!hasPayments) {
    return mode === "actual"
      ? "Actual estimate needs at least one confirmed paid or partial paycheck check-in."
      : "Add planned paycheck payments to estimate a payoff date.";
  }

  if (balanceRemainsAfterKnownPayments) {
    return mode === "actual"
      ? "Confirmed actual payments do not pay off the card yet. Check in more payments to estimate the actual payoff date."
      : "Known planned payments do not pay off the card. Add more future paychecks or increase planned payments.";
  }

  return softWarning;
}

export function calculatePayoff(
  card: CreditCard,
  paychecks: PaycheckPlan[],
  mode: PayoffMode = "planned",
  startDate = new Date()
): PayoffResult {
  if (card.balance <= 0) {
    return {
      months: 0,
      estimatedPayoffDate: toISODate(startDate),
      totalInterest: 0,
      totalPaid: 0,
      schedule: [],
      warning: "This card is already paid off.",
    };
  }

  if (card.apr < 0) {
    return {
      months: 0,
      estimatedPayoffDate: null,
      totalInterest: 0,
      totalPaid: 0,
      schedule: [],
      warning: "APR cannot be negative.",
    };
  }

  const { payments, dates, lastPaymentKey } = groupPaycheckPayments(paychecks, mode);
  const hasPayments = Object.keys(payments).length > 0;

  if (!hasPayments || !lastPaymentKey) {
    return {
      months: 0,
      estimatedPayoffDate: null,
      totalInterest: 0,
      totalPaid: 0,
      schedule: [],
      warning: createWarning(mode, false, false),
    };
  }

  const simulationStart = startOfMonth(startDate);
  const lastKnownPaymentIndex = Math.max(monthDiff(simulationStart, lastPaymentKey), 0);
  const monthlyRate = card.apr / 100 / 12;
  const schedule: PayoffMonth[] = [];
  let balance = roundCurrency(card.balance);
  let totalInterest = 0;
  let totalPaid = 0;
  let softWarning: string | undefined;
  const maxMonths = Math.min(MAX_SIMULATION_MONTHS, lastKnownPaymentIndex + 1);

  for (let monthIndex = 0; monthIndex < maxMonths; monthIndex += 1) {
    const monthDate = addMonths(simulationStart, monthIndex);
    const monthKey = getMonthKey(monthDate);
    const plannedPayment = roundCurrency(payments[monthKey] ?? 0);
    const startingBalance = roundCurrency(balance);
    const interest = roundCurrency(startingBalance * monthlyRate);
    const payment = roundCurrency(Math.min(plannedPayment, startingBalance + interest));
    const principal = roundCurrency(payment - interest);
    const endingBalance = roundCurrency(Math.max(startingBalance - principal, 0));

    if (
      mode === "planned" &&
      plannedPayment > 0 &&
      plannedPayment < card.minimumMonthlyPayment &&
      !softWarning
    ) {
      softWarning =
        "One or more planned monthly payments are below the card minimum payment.";
    }

    if (plannedPayment > 0 && plannedPayment <= interest && !softWarning) {
      softWarning =
        "One or more monthly payments do not cover estimated monthly interest.";
    }

    if (plannedPayment > 0 || schedule.length > 0) {
      schedule.push({
        monthIndex,
        monthLabel: formatMonthLabel(monthDate),
        startingBalance,
        payment,
        interest,
        principal,
        endingBalance,
      });
    }

    totalInterest = roundCurrency(totalInterest + interest);
    totalPaid = roundCurrency(totalPaid + payment);
    balance = endingBalance;

    if (endingBalance <= 0) {
      const payoffDate =
        latestISODate(dates[monthKey] ?? []) ??
        toISODate(dateForDueDay(monthDate, card.dueDay));

      return {
        months: monthIndex + 1,
        estimatedPayoffDate: payoffDate,
        totalInterest,
        totalPaid,
        schedule,
        warning: softWarning,
      };
    }
  }

  return {
    months: schedule.length,
    estimatedPayoffDate: null,
    totalInterest,
    totalPaid,
    schedule,
    warning: createWarning(mode, true, balance > 0, softWarning),
  };
}

export function getConfirmedActualPaid(paychecks: PaycheckPlan[]): number {
  return roundCurrency(
    paychecks.reduce((total, paycheck) => total + getActualPaymentTotal(paycheck), 0)
  );
}

export function getPlanProgress(
  paychecks: PaycheckPlan[],
  today = new Date()
): {
  plannedDueTotal: number;
  actualDueTotal: number;
  difference: number;
} {
  const todayKey = toISODate(today);

  const totals = paychecks.reduce(
    (acc, paycheck) => {
      const isDue = paycheck.paycheckDate <= todayKey || paycheck.status !== "planned";

      if (!isDue) {
        return acc;
      }

      acc.plannedDueTotal += getPlannedPaymentTotal(paycheck);

      acc.actualDueTotal += getActualPaymentTotal(paycheck);

      return acc;
    },
    { plannedDueTotal: 0, actualDueTotal: 0 }
  );

  return {
    plannedDueTotal: roundCurrency(totals.plannedDueTotal),
    actualDueTotal: roundCurrency(totals.actualDueTotal),
    difference: roundCurrency(totals.actualDueTotal - totals.plannedDueTotal),
  };
}

export function getFuturePlannedTotal(
  paychecks: PaycheckPlan[],
  today = new Date()
): number {
  const todayKey = toISODate(today);

  return roundCurrency(
    paychecks.reduce((total, paycheck) => {
      if (paycheck.paycheckDate >= todayKey && paycheck.status === "planned") {
        return total + getPlannedPaymentTotal(paycheck);
      }

      return total;
    }, 0)
  );
}
