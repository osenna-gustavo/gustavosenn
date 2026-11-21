import type { Account, AccountBalance, Category, Recurrence, RecurrenceInstance, Transaction } from '@/types/finance';
import { computeCycleCommitments, type CommittedExpenseItem } from '@/lib/cycle-commitments';
import { getBillingPeriod } from '@/lib/formatters';

/**
 * Posição de caixa de HOJE: dinheiro na conta x dinheiro comprometido.
 *
 * Regras (pedido do Gustavo de 20/11/2026, premissas do CFO pessoal):
 * - "Na conta" = último saldo informado de cada conta corrente/dinheiro ativa.
 * - Caixinhas (kind = 'caixinha') aparecem como reserva e NÃO entram no livre.
 * - "Comprometido" = recorrências e parcelas ainda pendentes no ciclo de hoje
 *   (mesma regra do restante do app) + compras no cartão de crédito ainda não pagas.
 * - Recorrências de categorias de reserva/aporte não contam como gasto.
 * - Lançamentos ignorados ou com affects_budget = false ficam fora.
 */

/** Fatura do cartão C6: fecha dia 17 e vence dia 26 (considerada paga no vencimento). */
export const CREDIT_CARD_CLOSE_DAY = 17;
export const CREDIT_CARD_DUE_DAY = 26;

/** Saldo com mais dias que isso aparece como desatualizado. */
export const STALE_BALANCE_DAYS = 3;

const CASH_ACCOUNT_KINDS = ['conta_corrente', 'dinheiro'];
const RESERVE_ACCOUNT_KIND = 'caixinha';
const CREDIT_CARD_ACCOUNT_KIND = 'cartao_credito';
const RESERVE_CATEGORY_PATTERN = /reserva|investiment|aporte|caixinha/i;

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/** Ciclo (mês/ano do app) que contém a data: dia closeDay+1 em diante já é o ciclo seguinte. */
export function getCycleForDate(date: Date, closeDay: number): { month: number; year: number } {
  let month = date.getMonth();
  let year = date.getFullYear();
  if (date.getDate() > closeDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return { month, year };
}

export function getCycleRangeForDate(date: Date, closeDay: number) {
  const cycle = getCycleForDate(date, closeDay);
  return { ...cycle, range: getBillingPeriod(cycle.month, cycle.year, closeDay) };
}

/** Fim do dia de fechamento da última fatura cujo vencimento já chegou (fatura paga). */
export function getLastPaidInvoiceClose(today: Date): Date {
  const dueThisMonth = new Date(today.getFullYear(), today.getMonth(), CREDIT_CARD_DUE_DAY);
  const closeMonthOffset = startOfDay(today) >= dueThisMonth ? 0 : -1;
  return endOfDay(new Date(today.getFullYear(), today.getMonth() + closeMonthOffset, CREDIT_CARD_CLOSE_DAY));
}

/** Vencimento da fatura em que a compra cai. */
export function getInvoiceDueDate(purchaseDate: Date): Date {
  const offset = purchaseDate.getDate() <= CREDIT_CARD_CLOSE_DAY ? 0 : 1;
  return new Date(purchaseDate.getFullYear(), purchaseDate.getMonth() + offset, CREDIT_CARD_DUE_DAY);
}

export interface AccountPosition {
  account: Account;
  balance: number | null;
  referenceDate: Date | null;
  isStale: boolean;
}

export interface OpenInvoice {
  dueDate: Date;
  amount: number;
  count: number;
}

export interface CashPosition {
  cycle: { month: number; year: number; start: Date; end: Date };
  cashAccounts: AccountPosition[];
  reserveAccounts: AccountPosition[];
  cashTotal: number;
  reserveTotal: number;
  hasAnyCashBalance: boolean;
  hasStaleBalance: boolean;
  recurringItems: CommittedExpenseItem[];
  installmentItems: CommittedExpenseItem[];
  recurringTotal: number;
  installmentTotal: number;
  openInvoices: OpenInvoice[];
  openInvoiceTotal: number;
  committedTotal: number;
  freeTotal: number;
}

export interface CashPositionInput {
  today: Date;
  cycle: { month: number; year: number; start: Date; end: Date };
  accounts: Account[];
  latestBalances: AccountBalance[];
  categories: Category[];
  recurrences: Recurrence[];
  instances: RecurrenceInstance[];
  cycleTransactions: Transaction[];
  cardTransactions: Transaction[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeCashPosition(input: CashPositionInput): CashPosition {
  const { today, cycle, accounts, latestBalances, categories, recurrences, instances, cycleTransactions, cardTransactions } = input;
  const balanceByAccount = new Map(latestBalances.map(balance => [balance.accountId, balance]));

  const toPosition = (account: Account): AccountPosition => {
    const latest = balanceByAccount.get(account.id);
    const referenceDate = latest ? latest.referenceDate : null;
    const ageDays = referenceDate ? Math.floor((startOfDay(today).getTime() - startOfDay(referenceDate).getTime()) / DAY_MS) : null;
    return {
      account,
      balance: latest ? latest.balance : null,
      referenceDate,
      isStale: ageDays !== null && ageDays > STALE_BALANCE_DAYS,
    };
  };

  const activeAccounts = accounts.filter(account => account.isActive);
  const cashAccounts = activeAccounts.filter(account => CASH_ACCOUNT_KINDS.includes(account.kind)).map(toPosition);
  const reserveAccounts = activeAccounts.filter(account => account.kind === RESERVE_ACCOUNT_KIND).map(toPosition);
  const cashTotal = round2(cashAccounts.reduce((sum, position) => sum + (position.balance ?? 0), 0));
  const reserveTotal = round2(reserveAccounts.reduce((sum, position) => sum + (position.balance ?? 0), 0));

  // Recorrências e parcelas pendentes do ciclo de hoje (mesma regra do orçamento).
  const reserveCategoryIds = new Set(
    categories.filter(category => RESERVE_CATEGORY_PATTERN.test(category.name)).map(category => category.id),
  );
  // Lançamento ignorado não paga a recorrência: só lançamentos válidos a tiram do comprometido.
  const countedCycleTransactions = cycleTransactions.filter(transaction => transaction.status !== 'ignored');
  const commitments = computeCycleCommitments(recurrences, instances, countedCycleTransactions, cycle.month, cycle.year);
  const pendingItems = commitments.committedExpenseItems
    .filter(item => !reserveCategoryIds.has(item.categoryId))
    .sort((a, b) => b.amount - a.amount);
  const recurringItems = pendingItems.filter(item => !item.isInstallment);
  const installmentItems = pendingItems.filter(item => item.isInstallment);
  const recurringTotal = round2(recurringItems.reduce((sum, item) => sum + item.amount, 0));
  const installmentTotal = round2(installmentItems.reduce((sum, item) => sum + item.amount, 0));

  // Compras no cartão de crédito ainda não pagas, agrupadas por vencimento da fatura.
  const cardAccountIds = new Set(
    accounts.filter(account => account.kind === CREDIT_CARD_ACCOUNT_KIND).map(account => account.id),
  );
  const lastPaidClose = getLastPaidInvoiceClose(today);
  const invoices = new Map<string, OpenInvoice>();
  for (const transaction of cardTransactions) {
    if (transaction.paymentMethod !== 'credit_card') continue;
    if (!transaction.accountId || !cardAccountIds.has(transaction.accountId)) continue;
    if (transaction.status === 'ignored' || transaction.affectsBudget === false) continue;
    if (transaction.date <= lastPaidClose) continue;
    const dueDate = getInvoiceDueDate(transaction.date);
    const key = dueDate.toISOString();
    const invoice = invoices.get(key) ?? { dueDate, amount: 0, count: 0 };
    invoice.amount += transaction.type === 'receita' ? -transaction.amount : transaction.amount;
    invoice.count += 1;
    invoices.set(key, invoice);
  }
  const openInvoices = Array.from(invoices.values())
    .map(invoice => ({ ...invoice, amount: round2(invoice.amount) }))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const openInvoiceTotal = round2(openInvoices.reduce((sum, invoice) => sum + invoice.amount, 0));

  const committedTotal = round2(recurringTotal + installmentTotal + openInvoiceTotal);

  return {
    cycle,
    cashAccounts,
    reserveAccounts,
    cashTotal,
    reserveTotal,
    hasAnyCashBalance: cashAccounts.some(position => position.balance !== null),
    hasStaleBalance: cashAccounts.some(position => position.isStale),
    recurringItems,
    installmentItems,
    recurringTotal,
    installmentTotal,
    openInvoices,
    openInvoiceTotal,
    committedTotal,
    freeTotal: round2(cashTotal - committedTotal),
  };
}

/**
 * Lê o saldo como aparece no app do banco: "1.234,56", "1234,56", "1.000", "-50,00", "R$ 7.234,96".
 * Devolve null quando o texto não é um valor válido (nada é gravado nesse caso).
 */
export function parseBalanceInput(raw: string): number | null {
  let text = raw.replace(/R\$/gi, '').replace(/\s/g, '');
  if (!text) return null;
  let sign = 1;
  if (text.startsWith('-')) {
    sign = -1;
    text = text.slice(1);
  }
  if (!/^[\d.,]+$/.test(text)) return null;

  let normalized: string;
  if (text.includes(',')) {
    // Vírgula = decimal; pontos = milhar.
    if ((text.match(/,/g) || []).length > 1) return null;
    const [intPart, decPart] = text.split(',');
    if (decPart.length > 2) return null;
    if (intPart.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(intPart)) return null;
    normalized = `${intPart.replace(/\./g, '') || '0'}.${decPart || '0'}`;
  } else if (text.includes('.')) {
    // Sem vírgula: "1.000" e "12.345.678" = milhar; "1234.5" = decimal.
    if (/^\d{1,3}(\.\d{3})+$/.test(text)) normalized = text.replace(/\./g, '');
    else if (/^\d+\.\d{1,2}$/.test(text)) normalized = text;
    else return null;
  } else {
    normalized = text;
  }

  const [integerDigits = ''] = normalized.split('.');
  if (!/\d/.test(text)) return null;
  if (integerDigits.replace(/^0+(?=\d)/, '').length > 12) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 100) / 100;
  // "-0,00" vira 0 (sem sinal).
  return rounded === 0 ? 0 : sign * rounded;
}

/**
 * O painel só calcula depois que o app terminou de carregar os dados (com ou sem contas).
 * Enquanto carrega, mostra o esqueleto; terminou (mesmo com lista vazia ou erro), calcula e mostra o estado real.
 */
export function canComputeCashPosition(appState: { isInitialized: boolean; isLoading: boolean }): boolean {
  return appState.isInitialized && !appState.isLoading;
}
