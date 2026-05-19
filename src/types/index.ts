export type PaymentStatus = "planned" | "paid" | "partial" | "skipped";

export type CreditCard = {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimumMonthlyPayment: number;
  dueDay: number;
  createdAt: string;
  updatedAt: string;
};

export type DebitCard = {
  id: string;
  name: string;
  balance: number;
  source?: "manual" | "bank";
  externalAccountId?: string;
  institutionName?: string;
  mask?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type DebitExpense = {
  id: string;
  debitCardId: string;
  date: string;
  merchant: string;
  amount: number;
  category?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type CardPaymentAllocation = {
  cardId: string;
  plannedAmount: number;
  actualAmount?: number;
};

export type PaycheckPlan = {
  id: string;
  paycheckDate: string;
  expectedPaycheckAmount?: number;
  plannedCardPayment: number;
  actualCardPayment?: number;
  cardPayments?: CardPaymentAllocation[];
  status: PaymentStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type PayoffMonth = {
  monthIndex: number;
  monthLabel: string;
  startingBalance: number;
  payment: number;
  interest: number;
  principal: number;
  endingBalance: number;
};

export type PayoffResult = {
  months: number;
  estimatedPayoffDate: string | null;
  totalInterest: number;
  totalPaid: number;
  schedule: PayoffMonth[];
  warning?: string;
};

export type PayoffMode = "planned" | "actual";

export type CreditCardFormValues = {
  name: string;
  balance: number;
  apr: number;
  minimumMonthlyPayment: number;
  dueDay: number;
};

export type DebitCardFormValues = {
  name: string;
  balance: number;
};

export type DebitExpenseFormValues = {
  debitCardId: string;
  date: string;
  merchant: string;
  amount: number;
  category?: string;
  note?: string;
};

export type PaycheckFormValues = {
  paycheckDate: string;
  expectedPaycheckAmount?: number;
  plannedCardPayment: number;
  cardPayments: CardPaymentAllocation[];
  note?: string;
};
