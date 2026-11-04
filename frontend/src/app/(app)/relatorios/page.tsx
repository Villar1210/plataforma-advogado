'use client';

import { Download } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { API_URL, api, getToken } from '@/lib/api';
import { data, moeda } from '@/lib/formato';
import { Cidade, Correspondente, DemandaStatus, Servico, STATUS } from '@/lib/tipos';
import { CidadeBusca } from '@/components/CidadeBusca';
import { Botao, Campo, Carregando, Entrada, Selecao, Selo, useAviso } from '@/components/ui';

interface Linha {
  id: string;
  numero: number;
  criadaEm: string;
  servico: string;
  cidade: string;
  correspondente: string;
  status: DemandaStatus;
  valor: number;
  pagamento: string;
  nota: number | null;
}

const hoje = new Date();
const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
const iso = (d: Date) => d.toLocaleDateString('sv-SE');

export default function Relatorios() {
  const avisar = useAviso();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [corrs, setCorrs] = useState<Correspondente[]>([]);
  const [f, setF] = useState({ inicio: iso(inicioMes), fim: iso(hoje), servicoId: '', correspondenteId: '', status: '', pagamento: '' });
  const [cidade, setCidade] = useState<Cidade | null>(null);
  const [dados, setDados] = useState<{ linhas: Linha[]; totais: { demandas: number; valorTotal: number; valorPago: number; valorPendente: number } } | null>(null);
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    api<Servico[]>('/servicos').then(setServicos).catch(() => {});
    api<Correspondente[]>('/correspondentes').then(setCorrs).catch(() => {});
  }, []);

  const query = () => {
    const q = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && q.set(k, v));
    if (cidade) q.set('cidadeId', String(cidade.id));
    return q;
  };

  useEffect(() => {
    setDados(null);
    api(`/relatorios/demandas?${query()}`).then(setDados).catch(() => setDados({ linhas: [], totais: { demandas: 0, valorTotal: 0, valorPago: 0, valorPendente: 0 } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, cidade]);

  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function baixar() {
    setBaixando(true);
    try {
      const q = query();
      q.set('formato', 'csv');
      const res = await fetch(`${API_URL}/relatorios/demandas?${q}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error('Não foi possível gerar o arquivo');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await res.blob());
      a.download = `demandas-${f.inicio}-a-${f.fim}.csv`;
      a.click();
    } catch (e: any) {
      avisar(e.message, 'erro');
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Relatórios</h1>
          <p className="text-sm text-gray-500">Demandas por período, serviço, cidade e correspondente.</p>
        </div>
        <Botao variante="secundario" onClick={baixar} carregando={baixando}>
          <Download className="h-4 w-4" /> Baixar planilha (CSV)
        </Botao>
      </div>

      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Campo rotulo="De">
          <Entrada type="date" value={f.inicio} onChange={(e) => set('inicio', e.target.value)} />
        </Campo>
        <Campo rotulo="Até">
          <Entrada type="date" value={f.fim} onChange={(e) => set('fim', e.target.value)} />
        </Campo>
        <Campo rotulo="Serviço">
          <Selecao value={f.servicoId} onChange={(e) => set('servicoId', e.target.value)}>
            <option value="">Todos</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Cidade">
          <CidadeBusca valor={cidade} aoEscolher={setCidade} placeholder="Todas" />
        </Campo>
        <Campo rotulo="Correspondente">
          <Selecao value={f.correspondenteId} onChange={(e) => set('correspondenteId', e.target.value)}>
            <option value="">Todos</option>
            {corrs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Status da demanda">
          <Selecao value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">Todos</option>
            {(Object.keys(STATUS) as DemandaStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS[s].rotulo}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Pagamento">
          <Selecao value={f.pagamento} onChange={(e) => set('pagamento', e.target.value)}>
            <option value="">Todos</option>
            <option value="PENDENTE">Pendente</option>
            <option value="PAGO">Pago</option>
          </Selecao>
        </Campo>
      </div>

      {!dados ? (
        <Carregando />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Total rotulo="Demandas" valor={dados.totais.demandas} />
            <Total rotulo="Valor total" valor={moeda(dados.totais.valorTotal)} />
            <Total rotulo="Pago" valor={moeda(dados.totais.valorPago)} />
            <Total rotulo="A pagar" valor={moeda(dados.totais.valorPendente)} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Demanda</th>
                  <th className="px-4 py-2.5 font-medium">Correspondente</th>
                  <th className="px-4 py-2.5 font-medium">Criada</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dados.linhas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                      Nenhuma demanda com esses filtros.
                    </td>
                  </tr>
                )}
                {dados.linhas.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/demandas/${l.id}`} className="font-medium text-gray-900 hover:underline">
                        #{l.numero} · {l.servico}
                      </Link>
                      <p className="text-xs text-gray-500">{l.cidade}</p>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {l.correspondente || '—'}
                      {l.nota && <span className="ml-1 text-xs text-gray-500">★ {l.nota}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{data(l.criadaEm)}</td>
                    <td className="px-4 py-2.5">
                      <Selo cor={STATUS[l.status].cor}>{STATUS[l.status].rotulo}</Selo>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{moeda(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Total({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{rotulo}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{valor}</p>
    </div>
  );
}
