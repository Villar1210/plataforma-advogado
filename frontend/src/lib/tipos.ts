export type DemandaStatus =
  | 'RASCUNHO'
  | 'AGUARDANDO'
  | 'ACEITA'
  | 'EM_EXECUCAO'
  | 'COMPROVANTE_ENVIADO'
  | 'APROVADA'
  | 'PAGA'
  | 'CANCELADA';

export const STATUS: Record<DemandaStatus, { rotulo: string; cor: string }> = {
  RASCUNHO: { rotulo: 'Rascunho', cor: 'bg-gray-100 text-gray-700 ring-gray-200' },
  AGUARDANDO: { rotulo: 'Aguardando correspondente', cor: 'bg-amber-50 text-amber-800 ring-amber-200' },
  ACEITA: { rotulo: 'Aceita', cor: 'bg-sky-50 text-sky-800 ring-sky-200' },
  EM_EXECUCAO: { rotulo: 'Em execução', cor: 'bg-indigo-50 text-indigo-800 ring-indigo-200' },
  COMPROVANTE_ENVIADO: { rotulo: 'Comprovante enviado', cor: 'bg-violet-50 text-violet-800 ring-violet-200' },
  APROVADA: { rotulo: 'Aprovada · a pagar', cor: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  PAGA: { rotulo: 'Paga', cor: 'bg-emerald-600 text-white ring-emerald-600' },
  CANCELADA: { rotulo: 'Cancelada', cor: 'bg-red-50 text-red-700 ring-red-200' },
};

export const ENVIO_STATUS: Record<string, { rotulo: string; cor: string }> = {
  ENVIADO: { rotulo: 'Enviado', cor: 'bg-gray-100 text-gray-700 ring-gray-200' },
  VISUALIZADO: { rotulo: 'Visualizou', cor: 'bg-sky-50 text-sky-800 ring-sky-200' },
  ACEITO: { rotulo: 'Aceitou', cor: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  PROPOSTA: { rotulo: 'Enviou proposta', cor: 'bg-amber-50 text-amber-800 ring-amber-200' },
  RECUSADO: { rotulo: 'Recusou', cor: 'bg-red-50 text-red-700 ring-red-200' },
  CANCELADO: { rotulo: 'Cancelado', cor: 'bg-gray-100 text-gray-500 ring-gray-200' },
};

export const ANEXO_TIPO: Record<string, string> = {
  DOCUMENTO_PROCESSO: 'Documento do processo',
  PROCURACAO: 'Procuração',
  SUBSTABELECIMENTO: 'Substabelecimento',
  COMPROVANTE_ENTREGA: 'Comprovante de entrega',
  COMPROVANTE_PAGAMENTO: 'Comprovante de pagamento',
  OUTRO: 'Outro',
};

export interface Cidade {
  id: number;
  nome: string;
  uf: string;
}

export interface Servico {
  id: number;
  nome: string;
  grupo: string;
  prazoObrigatorio: boolean;
  checklist: string[];
}

export interface Correspondente {
  id: string;
  nome: string;
  whatsapp: string;
  email?: string | null;
  ehAdvogado: boolean;
  oab?: string | null;
  oabUf?: string | null;
  cpfCnpj?: string | null;
  pixTipo?: string | null;
  pixChave?: string | null;
  bio?: string | null;
  notaMedia?: number | null;
  totalAvaliacoes: number;
  cidades: Cidade[];
  servicos: { id: number; nome: string }[];
  favorito: boolean;
  valorReferencia?: string | null;
  observacoes?: string | null;
  demandasConcluidas: number;
}
