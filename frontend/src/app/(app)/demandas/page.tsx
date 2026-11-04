'use client';

import { AlertTriangle, Clock, MapPin, Paperclip, Plus, Search, User, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { moeda, prazoRelativo, dataHora } from '@/lib/formato';
import { DemandaStatus, STATUS } from '@/lib/tipos';
import { Botao, Carregando, cx, Entrada, Selo, Vazio } from '@/components/ui';

interface ItemDemanda {
  id: string;
  numero: number;
  status: DemandaStatus;
  prazo: string | null;
  valor: string | null;
  valorAcordado: string | null;
  servicoTexto: string | null;
  descricao: string;
  processoNumero: string | null;
  cidade: { nome: string; uf: string };
  servico: { nome: string } | null;
  correspondente: { nome: string } | null;
  pagamento: { status: string } | null;
  propostas: number;
  recusas: number;
  _count: { envios: number; anexos: number };
  updatedAt: string;
}

interface Resumo {
  porStatus: Partial<Record<DemandaStatus, number>>;
  prazosProximos: number;
  atrasadas: number;
  pagamentosPendentes: { quantidade: number; valor: string | number };
}

const COLUNAS: { titulo: string; status: DemandaStatus[]; dica: string }[] = [
  { titulo: 'Aguardando correspondente', status: ['RASCUNHO', 'AGUARDANDO'], dica: 'Enviadas, esperando aceite ou proposta' },
  { titulo: 'Em andamento', status: ['ACEITA', 'EM_EXECUCAO'], dica: 'Com correspondente definido' },
  { titulo: 'Para conferir', status: ['COMPROVANTE_ENVIADO'], dica: 'Comprovante recebido: aprove ou devolva' },
  { titulo: 'A pagar', status: ['APROVADA'], dica: 'Entrega aprovada, pagamento pendente' },
];

export default function Demandas() {
  const [lista, setLista] = useState<ItemDemanda[] | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [busca, setBusca] = useState('');
  const [encerradas, setEncerradas] = useState(false);

  useEffect(() => {
    api<Resumo>('/demandas/resumo').then(setResumo).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const q = new URLSearchParams();
      if (busca.trim()) q.set('q', busca.trim());
      if (encerradas) q.set('incluirEncerradas', 'true');
      api<ItemDemanda[]>(`/demandas?${q}`).then(setLista).catch(() => setLista([]));
    }, 250);
    return () => clearTimeout(t);
  }, [busca, encerradas]);

  const fechadas = useMemo(() => (lista ?? []).filter((d) => d.status === 'PAGA' || d.status === 'CANCELADA'), [lista]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Demandas</h1>
          <p className="text-sm text-gray-500">Do envio ao correspondente até o pagamento.</p>
        </div>
        <Link href="/demandas/nova">
          <Botao>
            <Plus className="h-4 w-4" /> Nova demanda
          </Botao>
        </Link>
      </div>

      {resumo && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador rotulo="Em aberto" valor={COLUNAS.flatMap((c) => c.status).reduce((s, st) => s + (resumo.porStatus[st] ?? 0), 0)} />
          <Indicador rotulo="Prazo em 48h" valor={resumo.prazosProximos} icone={<Clock className="h-4 w-4" />} tom={resumo.prazosProximos ? 'atencao' : undefined} />
          <Indicador rotulo="Prazo vencido" valor={resumo.atrasadas} icone={<AlertTriangle className="h-4 w-4" />} tom={resumo.atrasadas ? 'perigo' : undefined} />
          <Indicador
            rotulo="A pagar"
            valor={moeda(resumo.pagamentosPendentes.valor)}
            detalhe={`${resumo.pagamentosPendentes.quantidade} pagamento(s)`}
            icone={<Wallet className="h-4 w-4" />}
            href="/pagamentos"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Entrada
            className="pl-9"
            placeholder="Buscar por nº, processo, partes, cidade, correspondente…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={encerradas} onChange={(e) => setEncerradas(e.target.checked)} className="rounded" />
          Mostrar encerradas
        </label>
      </div>

      {!lista ? (
        <Carregando />
      ) : lista.length === 0 && !busca && resumo && Object.values(resumo.porStatus).reduce((a, b) => a + (b ?? 0), 0) === 0 ? (
        <Vazio
          titulo="Nenhuma demanda ainda"
          texto="Crie a primeira demanda, escolha o correspondente e envie o convite pelo WhatsApp."
          acao={
            <Link href="/demandas/nova">
              <Botao>
                <Plus className="h-4 w-4" /> Nova demanda
              </Botao>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUNAS.map((col) => {
              const itens = lista.filter((d) => col.status.includes(d.status));
              return (
                <section key={col.titulo} className="flex flex-col rounded-xl bg-gray-100/80 p-2">
                  <header className="px-2 pb-2 pt-1">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-gray-800">{col.titulo}</h2>
                      <span className="rounded-full bg-white px-2 text-xs font-semibold text-gray-600">{itens.length}</span>
                    </div>
                    <p className="text-xs text-gray-500">{col.dica}</p>
                  </header>
                  <div className="flex flex-col gap-2">
                    {itens.map((d) => (
                      <CartaoDemanda key={d.id} d={d} />
                    ))}
                    {itens.length === 0 && <p className="px-2 py-6 text-center text-xs text-gray-400">Nada aqui</p>}
                  </div>
                </section>
              );
            })}
          </div>

          {encerradas && fechadas.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-gray-800">Encerradas</h2>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {fechadas.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link href={`/demandas/${d.id}`} className="font-medium text-gray-900 hover:underline">
                            #{d.numero} · {d.servico?.nome ?? d.servicoTexto}
                          </Link>
                          <p className="text-xs text-gray-500">
                            {d.cidade.nome}/{d.cidade.uf} {d.correspondente && `· ${d.correspondente.nome}`}
                          </p>
                        </td>
                        <td className="hidden px-4 py-3 text-gray-600 sm:table-cell">{moeda(d.valorAcordado ?? d.valor)}</td>
                        <td className="px-4 py-3 text-right">
                          <Selo cor={STATUS[d.status].cor}>{STATUS[d.status].rotulo}</Selo>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  detalhe,
  icone,
  tom,
  href,
}: {
  rotulo: string;
  valor: React.ReactNode;
  detalhe?: string;
  icone?: React.ReactNode;
  tom?: 'atencao' | 'perigo';
  href?: string;
}) {
  const corpo = (
    <div
      className={cx(
        'h-full rounded-xl border bg-white p-4',
        tom === 'perigo' ? 'border-red-200' : tom === 'atencao' ? 'border-amber-200' : 'border-gray-200',
        href && 'transition hover:border-marca-200',
      )}
    >
      <div className={cx('flex items-center gap-1.5 text-xs font-medium', tom === 'perigo' ? 'text-red-600' : tom === 'atencao' ? 'text-amber-700' : 'text-gray-500')}>
        {icone} {rotulo}
      </div>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{valor}</p>
      {detalhe && <p className="text-xs text-gray-500">{detalhe}</p>}
    </div>
  );
  return href ? <Link href={href}>{corpo}</Link> : corpo;
}

function CartaoDemanda({ d }: { d: ItemDemanda }) {
  const prazo = ['AGUARDANDO', 'ACEITA', 'EM_EXECUCAO', 'RASCUNHO'].includes(d.status) ? prazoRelativo(d.prazo) : null;
  let quem: React.ReactNode;
  if (d.correspondente) quem = d.correspondente.nome;
  else if (d.status === 'RASCUNHO') quem = <span className="text-amber-700">Ainda não enviada</span>;
  else if (d.propostas) quem = <span className="font-medium text-amber-700">{d.propostas} proposta(s) para escolher</span>;
  else if (d.recusas && d.recusas >= d._count.envios) quem = <span className="text-red-600">Todos recusaram</span>;
  else quem = `Enviada a ${d._count.envios}`;

  return (
    <Link href={`/demandas/${d.id}`} className="block rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:border-marca-200 hover:shadow">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-gray-900">{d.servico?.nome ?? d.servicoTexto}</p>
        <span className="shrink-0 text-xs text-gray-400">#{d.numero}</span>
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs text-gray-600">
        <MapPin className="h-3 w-3" /> {d.cidade.nome}/{d.cidade.uf}
      </p>
      {d.processoNumero && <p className="mt-0.5 truncate font-mono text-[11px] text-gray-500">{d.processoNumero}</p>}
      <p className="mt-2 flex items-center gap-1 text-xs text-gray-700">
        <User className="h-3 w-3 text-gray-400" /> {quem}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        {prazo ? (
          <span
            title={dataHora(d.prazo)}
            className={cx(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium',
              prazo.tom === 'vencido' ? 'bg-red-50 text-red-700' : prazo.tom === 'atencao' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-600',
            )}
          >
            <Clock className="h-3 w-3" /> {prazo.texto}
          </span>
        ) : d.status === 'COMPROVANTE_ENVIADO' ? (
          <span className="font-medium text-violet-700">Conferir entrega</span>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-2 text-gray-500">
          {d._count.anexos > 0 && (
            <span className="flex items-center gap-0.5">
              <Paperclip className="h-3 w-3" />
              {d._count.anexos}
            </span>
          )}
          {moeda(d.valorAcordado ?? d.valor)}
        </span>
      </div>
    </Link>
  );
}
