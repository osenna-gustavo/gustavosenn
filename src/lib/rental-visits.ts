export const RENTAL_STATUSES = ['agendar_visita', 'visita_agendada', 'visitado', 'descartado'] as const;
export type RentalStatus = typeof RENTAL_STATUSES[number];
export const DEFAULT_RENTAL_STATUS: RentalStatus = 'agendar_visita';

const visitParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function visitToInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(visitParts.formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function visitToISO(value: string): string | null {
  if (!value) return null;
  const local = Date.parse(`${value}:00Z`);
  if (Number.isNaN(local)) return null;
  let instant = local;
  // Resolve the named timezone independently of the browser's timezone.
  for (let i = 0; i < 3; i++) {
    const represented = Date.parse(`${visitToInput(new Date(instant).toISOString())}:00Z`);
    const difference = local - represented;
    instant += difference;
    if (difference === 0) break;
  }
  return new Date(instant).toISOString();
}

export function formatVisit(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const weekday = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(date).replace(/\.$/, '');
  const day = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  return `${weekday}, ${day} às ${time}`;
}