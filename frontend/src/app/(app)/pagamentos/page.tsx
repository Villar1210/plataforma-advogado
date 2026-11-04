'use client';

import { Copy, FileText } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { abrirArquivo, api } from '@/lib/api';
import { data, dataHora, moeda } from '@/lib/formato';
import { Carregando, cx, Selo, useAviso, Vazio } from '@/components/ui';

interface Pagamento {
  id: string;
  status: 'PENDENTE' | 'PAGO' | 'CANCELADO';
  valor: string;
  vencimento: string | null;
  pagoEm: string | null;
  metodo: string | null;
  comprovante: { id: string; nomeArquivo: string } | null;
  demanda: {
    id: string;
    numero: number;
    servico: { nome: string } | null;
    servicoTexto: string | null;
    cidade: { nome: string; uf: string };
    correspondente: { id: string; nome: string; pixTipo: string | null; pixChave: string | null } | null;
  };
}

export default function Pagamentos() {
  const avisar = useAviso();
  const [aba, setAba] = useState<'PENDENTE' | 'PAGO'>('PENDENTE');
  const [lista, setLista] = useState<Pagamento[] | null>(null);

  useEffect(() => {
    setLista(null);
    api<Pagamento[]>(`/pagamentos?status=${aba}`).then(setLista).catch(() => setLista([]));
  }, [aba]);

  const total = (lista ?? []).reduce((s, p) => s + Number(p.valor), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Pagamentos</h1>
        <p className="text-sm text-gray-500">Gerados automaticamente quando você aprova uma entrega.</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          {(['PENDENTE', 'PAGO'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={cx('rounded-md px-4 py-1.5 text-sm font-medium', aba === a ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600')}
            >
              {a === 'PENDENTE' ? 'A pagar' : 'Pagos'}
            </button>
          ))}
        </div>
        {lista && lista.length > 0 && (
          <p className="text-sm text-gray-600">
            Total: <strong className="text-gray-900">{moeda(total)}</strong>
          </p>
        )}
      </div>

      {!lista ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Vazio titulo={aba === 'PENDENTE' ? 'Nada a pagar' : 'Nenhum pagamento registrado'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Demanda</th>
                <th className="px-4 py-2.5 font-medium">Correspondente</th>
                <th className="px-4 py-2.5 font-medium">{aba === 'PENDENTE' ? 'Pix' : 'Pago em'}</th>
                <th className="px-4 py-2.5 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/demandas/${p.demanda.id}`} className="font-medium text-gray-900 hover:underline">
                      #{p.demanda.numero} · {p.demanda.servico?.nome ?? p.demanda.servicoTexto}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {p.demanda.cidade.nome}/{p.demanda.cidade.uf}
                      {aba === 'PENDENTE' && p.vencimento && ` · vence ${data(p.vencimento)}`}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.demanda.correspondente?.nome ?? '—'}</td>
                  <td className="px-4 py-3">
                    {aba === 'PENDENTE' ? (
                      p.demanda.correspondente?.pixChave ? (
                        <button
                          onClick={() => navigator.clipboard.writeText(p.demanda.correspondente!.pixChave!).then(() => avisar('Chave Pix copiada'))}
                          className="flex items-center gap-1 font-mono text-xs text-gray-800 hover:text-marca-600"
                        >
                          {p.demanda.correspondente.pixChave} <Copy className="h-3 w-3" />
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">sem chave</span>
                      )
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-700">{dataHora(p.pagoEm)}</span>
                        <Selo cor="bg-gray-100 text-gray-700 ring-gray-200">{p.metodo}</Selo>
                        {p.comprovante && (
                          <button onClick={() => abrirArquivo(`/anexos/${p.comprovante!.id}`).catch((e) => avisar(e.message, 'erro'))} title="Comprovante" className="text-marca-600">
                            <FileText className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{moeda(p.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {aba === 'PENDENTE' && lista && lista.length > 0 && (
        <p className="text-xs text-gray-500">Para registrar um pagamento, abra a demanda e use “Registrar pagamento”.</p>
      )}
    </div>
  );
}
