export const moeda = (v: unknown) =>
  v === null || v === undefined || v === ''
    ? '—'
    : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const dataHora = (d?: string | Date | null) =>
  d
    ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

export const data = (d?: string | Date | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');

export const telefone = (w?: string | null) => {
  if (!w) return '';
  const d = w.replace(/^55/, '');
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : w;
};

export const tamanho = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** "em 3 dias", "há 2 horas", "vencido" */
export function prazoRelativo(d?: string | null): { texto: string; tom: 'ok' | 'atencao' | 'vencido' } | null {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  const h = ms / 3600e3;
  if (ms < 0) return { texto: `vencido há ${Math.abs(h) < 24 ? `${Math.max(1, Math.round(-h))}h` : `${Math.round(-h / 24)}d`}`, tom: 'vencido' };
  if (h < 24) return { texto: `em ${Math.max(1, Math.round(h))}h`, tom: 'atencao' };
  if (h < 48) return { texto: 'amanhã', tom: 'atencao' };
  return { texto: `em ${Math.round(h / 24)} dias`, tom: 'ok' };
}

/** Converte "2026-11-05T14:30" (local) em ISO. */
export const localParaIso = (v: string) => (v ? new Date(v).toISOString() : undefined);
export const isoParaLocal = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
