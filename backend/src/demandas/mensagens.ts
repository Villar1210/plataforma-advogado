import { formatarDataHora, formatarMoeda } from '../common/util';

export interface DadosMensagem {
  correspondente: string;
  escritorio: string;
  servico: string;
  cidade: string;
  prazo?: Date | null;
  valor?: unknown;
  link: string;
}

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0];

export function msgNovaDemanda(d: DadosMensagem) {
  return [
    `Olá, ${primeiroNome(d.correspondente)}! O escritório *${d.escritorio}* tem uma demanda para você:`,
    '',
    `*${d.servico}* em ${d.cidade}`,
    d.prazo ? `Prazo: ${formatarDataHora(d.prazo)}` : null,
    d.valor ? `Valor: ${formatarMoeda(d.valor)}` : null,
    '',
    'Veja os detalhes e responda (aceitar ou recusar) por este link:',
    d.link,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

export function msgLembrete(d: DadosMensagem, quando: string) {
  return [
    `Olá, ${primeiroNome(d.correspondente)}! Lembrete do escritório *${d.escritorio}*:`,
    '',
    `*${d.servico}* em ${d.cidade} — ${quando}${d.prazo ? ` (${formatarDataHora(d.prazo)})` : ''}.`,
    '',
    'Quando concluir, envie o comprovante por aqui:',
    d.link,
  ].join('\n');
}

export function msgDevolvida(d: DadosMensagem, motivo: string) {
  return [
    `Olá, ${primeiroNome(d.correspondente)}! O escritório *${d.escritorio}* pediu um ajuste na entrega de *${d.servico}*:`,
    '',
    `"${motivo}"`,
    '',
    'Envie o comprovante corrigido por aqui:',
    d.link,
  ].join('\n');
}

export function msgAprovada(d: DadosMensagem) {
  return `Olá, ${primeiroNome(d.correspondente)}! O escritório *${d.escritorio}* aprovou sua entrega de *${d.servico}*. O pagamento será feito conforme combinado. Obrigado!`;
}

export function msgPaga(d: DadosMensagem) {
  return `Olá, ${primeiroNome(d.correspondente)}! O pagamento de *${d.servico}* (${formatarMoeda(d.valor)}) foi registrado pelo escritório *${d.escritorio}*. O comprovante está no link: ${d.link}`;
}
