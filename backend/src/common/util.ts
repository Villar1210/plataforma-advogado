import { randomBytes } from 'crypto';

export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Mantém só dígitos e garante o DDI 55 para números brasileiros. */
export function normalizarWhatsapp(numero: string): string {
  const d = (numero ?? '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return '55' + d;
  return d;
}

export function gerarToken(): string {
  return randomBytes(24).toString('base64url');
}

export function slugify(s: string): string {
  return normalizar(s).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function formatarMoeda(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarDataHora(d?: Date | null): string {
  if (!d) return '';
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function linkWhatsapp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
