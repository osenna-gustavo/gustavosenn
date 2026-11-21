import type { Account, AccountBalance, Category, Recurrence, RecurrenceInstance, Transaction } from '@/types/finance';
import { getBillingPeriod } from '@/lib/formatters';

/**
 * Posição de caixa de HOJE: dinheiro na conta x dinheiro comprometido.
 *
 * Regras (pedido do Gustavo de 20/11/2026, premissas do CFO pessoal):
 * - "Na conta" = último saldo informado de cada conta corrente/dinheiro ativa.
 * - Caixinhas (kind = 'caixinha') aparecem como reserva e NÃO entram no livre.
 * - "Comprometido" conta cada item pela DATA DE VENCIMENTO (ordem do Gustavo, 21/11/2026:
 *   "O que vence depois da data de corte, entra pro outro mês"): só entra o que vence entre
 *   o início e o fim do ciclo de hoje (dia 21 a 20). Recorrência/parcela vence no dia do mês
 *   da data de início dela; fatura do cartão vence no dia CREDIT_CARD_DUE_DAY.
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

export interface CommittedExpenseItem {
  recurrenceId: string;
  name: string;
  amount: number;
  categoryId: string;
  isInstallment: boolean;
  /** Data em que o dinheiro sai: vencimento da conta, ou vencimento da fatura quando é cobrada no cartão. */
  dueDate: Date;
  /** Cobrada no cartão de crédito (sai do caixa no pagamento da fatura). */
  onCard: boolean;
}

const CARD_NAME_PATTERN = /\bC6\b/i;

/**
 * Recorrência cobrada no cartão: o último lançamento vinculado foi no cartão de crédito
 * ou o nome cita o cartão C6 (decisão do CFO pela regra do Gustavo, 21/11/2026).
 */
export function isCardRecurrence(recurrence: Recurrence, lastLinkedPaymentMethod: string | undefined): boolean {
  if (lastLinkedPaymentMethod) return lastLinkedPaymentMethod === 'credit_card';
  return CARD_NAME_PATTERN.test(recurrence.name);
}

/** Vencimentos mensais de uma recorrência dentro de [from, to] (respeita início, fim e nº de parcelas). */
export function getRecurrenceDueDates(recurrence: Recurrence, from: Date, to: Date): Array<{ dueDate: Date; installmentNumber: number | null }> {
  const result: Array<{ dueDate: Date; installmentNumber: number | null }> = [];
  // Só recorrência mensal gera vencimento aqui (o app hoje só cadastra mensal).
  if (recurrence.frequency && recurrence.frequency !== 'monthly') return result;
  const firstDue = startOfDay(recurrence.startDate);
  const lastDue = recurrence.endDate ? endOfDay(recurrence.endDate) : null;
  const dueDay = firstDue.getDate();
  const fromDay = startOfDay(from);

  for (let year = from.getFullYear(), month = from.getMonth();
    year < to.getFullYear() || (year === to.getFullYear() && month <= to.getMonth());
    month === 11 ? (year += 1, month = 0) : (month += 1)) {
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const dueDate = new Date(year, month, Math.min(dueDay, lastDayOfMonth));
    if (dueDate < fromDay || dueDate > to) continue;
    if (dueDate < firstDue) continue;
    if (lastDue && dueDate > lastDue) continue;
    let installmentNumber: number | null = null;
    if (recurrence.totalInstallments) {
      installmentNumber = (year - firstDue.getFullYear()) * 12 + (month - firstDue.getMonth()) + 1;
      if (installmentNumber < 1 || installmentNumber > recurrence.totalInstallments) continue;
    }
    result.push({ dueDate, installmentNumber });
  }
  return result;
}

/** Início do ciclo anterior (mesmo dia, um mês antes). */
export function getPreviousCycleStart(cycleStart: Date): Date {
  return new Date(cycleStart.getFullYear(), cycleStart.getMonth() - 1, cycleStart.getDate());
}

/** Quantos dias antes do ciclo anterior buscar lançamentos para reconhecer pagamentos antecipados. */
export const PAYMENT_SEARCH_DAYS_BEFORE_PREVIOUS_CYCLE = 75;

/** Pagamento feito do dia do vencimento até esses dias depois paga ESSE vencimento (atraso curto). */
export const LATE_PAYMENT_GRACE_DAYS = 7;
/** Pagamento feito até esses dias antes do vencimento também paga ESSE vencimento (ex.: Gás pago 20 para vencer 21). */
export const EARLY_PAYMENT_NEAR_DAYS = 5;

/**
 * Casa pagamentos com vencimentos de UMA recorrência, 1 pagamento por vencimento, em 2 passos:
 * 1) lançamento vinculado feito de EARLY_PAYMENT_NEAR_DAYS antes até LATE_PAYMENT_GRACE_DAYS depois do vencimento
 *    paga esse vencimento (vale o mais próximo);
 * 2) para os vencimentos que sobraram, do mais novo para o mais antigo, cada um leva o pagamento mais
 *    recente ainda livre feito depois do dia do vencimento anterior (pagamento antecipado, até no ciclo anterior).
 * Devolve os vencimentos que ficaram sem pagamento.
 */
export function matchRecurrencePayments(dueDates: Date[], payments: Date[], until: Date): Date[] {
  const available = payments.filter(date => date <= until).sort((x, y) => x.getTime() - y.getTime());
  const used = new Set<number>();
  const paidDues = new Set<number>();
  const ascending = [...dueDates].sort((x, y) => x.getTime() - y.getTime());

  // Passo 1: pago perto do vencimento (poucos dias antes até LATE_PAYMENT_GRACE_DAYS depois); vale o mais próximo.
  for (const dueDate of ascending) {
    const from = startOfDay(new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate() - EARLY_PAYMENT_NEAR_DAYS));
    const to = endOfDay(new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate() + LATE_PAYMENT_GRACE_DAYS));
    let index = -1;
    let bestDistance = Infinity;
    available.forEach((date, position) => {
      if (used.has(position) || date < from || date > to) return;
      const distance = Math.abs(date.getTime() - dueDate.getTime());
      if (distance < bestDistance) {
        bestDistance = distance;
        index = position;
      }
    });
    if (index !== -1) {
      used.add(index);
      paidDues.add(dueDate.getTime());
    }
  }

  // Passo 2: pagamento antecipado (ou atraso longo) para o que sobrou.
  const unpaid: Date[] = [];
  for (const dueDate of [...ascending].reverse()) {
    if (paidDues.has(dueDate.getTime())) continue;
    const previousMonthLastDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), 0).getDate();
    const previousDue = new Date(dueDate.getFullYear(), dueDate.getMonth() - 1, Math.min(dueDate.getDate(), previousMonthLastDay));
    // Pagamento feito no próprio dia do vencimento anterior pertence ao vencimento anterior.
    const threshold = endOfDay(previousDue);
    let index = -1;
    for (let position = available.length - 1; position >= 0; position -= 1) {
      if (!used.has(position) && available[position] > threshold) {
        index = position;
        break;
      }
    }
    if (index === -1) unpaid.push(dueDate);
    else used.add(index);
  }
  return unpaid.sort((x, y) => x.getTime() - y.getTime());
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
  /** Vencidos no ciclo anterior e ainda não pagos (continuam saindo). */
  overdueItems: CommittedExpenseItem[];
  overdueTotal: number;
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
  /** Instâncias de recorrência dos meses que o ciclo toca (para reconhecer vínculo e "ignorar"). */
  instances: RecurrenceInstance[];
  /** Lançamentos de (início do ciclo anterior − 75 dias) até o fim do ciclo, para reconhecer pagamentos. */
  recentTransactions: Transaction[];
  cardTransactions: Transaction[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeCashPosition(input: CashPositionInput): CashPosition {
  const { today, cycle, accounts, latestBalances, categories, recurrences, instances, recentTransactions, cardTransactions } = input;
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

  // Recorrências e parcelas que VENCEM dentro do ciclo de hoje e ainda não foram pagas.
  const reserveCategoryIds = new Set(
    categories.filter(category => RESERVE_CATEGORY_PATTERN.test(category.name)).map(category => category.id),
  );
  const instanceRecurrence = new Map(instances.map(instance => [instance.id, instance.recurrenceId]));
  // Lançamento ignorado não paga a recorrência: só lançamentos válidos contam como pagamento.
  const paymentsByRecurrence = new Map<string, Date[]>();
  const lastPaymentByRecurrence = new Map<string, { date: Date; method: string }>();
  for (const transaction of recentTransactions) {
    if (transaction.status === 'ignored') continue;
    const recurrenceId = transaction.recurrenceId
      ?? (transaction.recurrenceInstanceId ? instanceRecurrence.get(transaction.recurrenceInstanceId) : undefined);
    if (!recurrenceId) continue;
    const list = paymentsByRecurrence.get(recurrenceId) ?? [];
    list.push(transaction.date);
    paymentsByRecurrence.set(recurrenceId, list);
    const last = lastPaymentByRecurrence.get(recurrenceId);
    if (!last || transaction.date > last.date) {
      lastPaymentByRecurrence.set(recurrenceId, { date: transaction.date, method: transaction.paymentMethod });
    }
  }

  const previousCycleStart = getPreviousCycleStart(cycle.start);
  const pendingItems: CommittedExpenseItem[] = [];
  const overdueItems: CommittedExpenseItem[] = [];
  for (const recurrence of recurrences) {
    if (!recurrence.isActive || recurrence.type !== 'despesa') continue;
    if (reserveCategoryIds.has(recurrence.categoryId)) continue;
    // Vencimentos do ciclo anterior (podem estar atrasados) e do ciclo de hoje.
    // Inclui um vencimento antes do ciclo anterior só para casar o pagamento dele (não é exibido).
    const dueDates = getRecurrenceDueDates(recurrence, getPreviousCycleStart(previousCycleStart), cycle.end)
      .map(item => item.dueDate)
      .filter(dueDate => {
        const dueCycle = getCycleForDate(dueDate, cycle.end.getDate());
        return !instances.some(instance =>
          instance.recurrenceId === recurrence.id && instance.status === 'ignored'
          && instance.month === dueCycle.month && instance.year === dueCycle.year);
      });
    const unpaid = matchRecurrencePayments(dueDates, paymentsByRecurrence.get(recurrence.id) ?? [], cycle.end);
    const onCard = isCardRecurrence(recurrence, lastPaymentByRecurrence.get(recurrence.id)?.method);
    for (const chargeDate of unpaid) {
      // No cartão, o dinheiro sai no vencimento da fatura em que a cobrança cai.
      const dueDate = onCard ? getInvoiceDueDate(chargeDate) : chargeDate;
      if (dueDate > cycle.end) continue;
      if (onCard) {
        // Fatura já vencida = já paga (o saldo informado já reflete); só conta a que ainda vai vencer.
        if (dueDate < startOfDay(cycle.start)) continue;
      } else if (dueDate < startOfDay(previousCycleStart)) {
        continue;
      }
      const item: CommittedExpenseItem = {
        recurrenceId: recurrence.id,
        name: recurrence.name,
        amount: recurrence.amount,
        categoryId: recurrence.categoryId,
        isInstallment: Boolean(recurrence.totalInstallments),
        dueDate,
        onCard,
      };
      if (dueDate < startOfDay(cycle.start)) overdueItems.push(item);
      else pendingItems.push(item);
    }
  }
  pendingItems.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || b.amount - a.amount);
  overdueItems.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || b.amount - a.amount);
  const overdueTotal = round2(overdueItems.reduce((sum, item) => sum + item.amount, 0));
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
    // Fatura que vence depois do fim do ciclo é paga no ciclo seguinte.
    if (dueDate > cycle.end) continue;
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

  const committedTotal = round2(overdueTotal + recurringTotal + installmentTotal + openInvoiceTotal);

  return {
    cycle,
    cashAccounts,
    reserveAccounts,
    cashTotal,
    reserveTotal,
    hasAnyCashBalance: cashAccounts.some(position => position.balance !== null),
    hasStaleBalance: cashAccounts.some(position => position.isStale),
    overdueItems,
    overdueTotal,
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
