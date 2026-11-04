'use client';

import { Check, CheckCircle2, Clock, FileText, Loader2, MapPin, Paperclip, Scale, Upload, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { abrirArquivo, api } from '@/lib/api';
import { dataHora, moeda, prazoRelativo, tamanho } from '@/lib/formato';
import { ANEXO_TIPO } from '@/lib/tipos';
import { Area, Botao, Campo, Entrada, cx, useAviso } from '@/components/ui';

interface Portal {
  escritorio: string;
  correspondente: { nome: string };
  envio: { status: string; valorProposto: string | null };
  ehExecutor: boolean;
  demanda: {
    numero: number;
    status: string;
    modo: 'DIRETO' | 'PROPOSTAS' | 'MARKETPLACE';
    servico: string;
    checklist: string[];
    cidade: string;
    prazo: string | null;
    valor: string | null;
    descricao: string;
    instrucoes: string | null;
    orgao: string | null;
    processoNumero: string | null;
    partes: string | null;
    local: string | null;
    devolucaoMotivo: string | null;
    entregaObservacao: string | null;
    anexos: { id: string; tipo: string; nomeArquivo: string; tamanho: number; createdAt: string }[];
    pagamento: { status: string; valor: string; pagoEm: string | null } | null;
  };
}

export default function PortalCorrespondente() {
  const { token } = useParams<{ token: string }>();
  const avisar = useAviso();
  const [p, setP] = useState<Portal | null>(null);
  const [erro, setErro] = useState('');
  const [acao, setAcao] = useState<string | null>(null);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [valor, setValor] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [obs, setObs] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);

  const carregar = useCallback(
    () => api<Portal>(`/portal/${token}`, { publico: true }).then(setP).catch((e) => setErro(e.message)),
    [token],
  );
  useEffect(() => {
    carregar();
  }, [carregar]);

  const fazer = async (chave: string, fn: () => Promise<Portal>, ok?: string) => {
    setAcao(chave);
    try {
      setP(await fn());
      if (ok) avisar(ok);
    } catch (e: any) {
      avisar(e.message, 'erro');
      carregar();
    } finally {
      setAcao(null);
    }
  };

  if (erro)
    return (
      <Casca>
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="font-medium text-gray-900">{erro}</p>
          <p className="mt-1 text-sm text-gray-500">Peça um novo link ao escritório.</p>
        </div>
      </Casca>
    );
  if (!p)
    return (
      <Casca>
        <div className="flex justify-center py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Casca>
    );

  const d = p.demanda;
  const prazo = prazoRelativo(d.prazo);
  const conviteAberto = ['VISUALIZADO', 'ENVIADO'].includes(p.envio.status) && d.status === 'AGUARDANDO';
  const propostaEnviada = p.envio.status === 'PROPOSTA' && d.status === 'AGUARDANDO';
  const encerradoParaMim = !p.ehExecutor && !conviteAberto && !propostaEnviada;
  const aguardandoEntrega = p.ehExecutor && (d.status === 'ACEITA' || d.status === 'EM_EXECUCAO');
  const pediuProposta = d.modo !== 'DIRETO';

  const entregar = () => {
    const fd = new FormData();
    if (obs.trim()) fd.append('observacao', obs.trim());
    arquivos.forEach((a) => fd.append('arquivos', a));
    fazer('entregar', () => api<Portal>(`/portal/${token}/entregar`, { form: fd, publico: true }), 'Comprovante enviado. Obrigado!').then(() => {
      setArquivos([]);
      setObs('');
    });
  };

  return (
    <Casca escritorio={p.escritorio}>
      <p className="mb-3 text-sm text-gray-600">Olá, {p.correspondente.nome.split(' ')[0]}!</p>

      {/* ───── situação ───── */}
      {encerradoParaMim && (
        <Aviso tom="cinza">
          {p.envio.status === 'RECUSADO'
            ? 'Você recusou esta demanda.'
            : d.status === 'CANCELADA'
              ? 'O escritório cancelou esta demanda.'
              : 'Esta demanda já foi assumida por outro correspondente. Obrigado pela disponibilidade!'}
        </Aviso>
      )}
      {propostaEnviada && <Aviso tom="azul">Proposta de {moeda(p.envio.valorProposto)} enviada. Você será avisado se for escolhido.</Aviso>}
      {p.ehExecutor && d.status === 'COMPROVANTE_ENVIADO' && <Aviso tom="azul">Comprovante enviado. O escritório vai conferir.</Aviso>}
      {p.ehExecutor && d.status === 'APROVADA' && <Aviso tom="verde">Entrega aprovada! O pagamento está a caminho.</Aviso>}
      {p.ehExecutor && d.status === 'PAGA' && (
        <Aviso tom="verde">
          Pagamento de {moeda(d.pagamento?.valor)} registrado em {dataHora(d.pagamento?.pagoEm)}.
        </Aviso>
      )}
      {p.ehExecutor && d.status === 'CANCELADA' && <Aviso tom="cinza">O escritório cancelou esta demanda.</Aviso>}
      {aguardandoEntrega && d.devolucaoMotivo && (
        <Aviso tom="ambar">
          <strong>O escritório pediu um ajuste:</strong> {d.devolucaoMotivo}
        </Aviso>
      )}

      {/* ───── a demanda ───── */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Demanda #{d.numero}</p>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">{d.servico}</h1>
        <div className="mt-3 space-y-1.5 text-sm text-gray-700">
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" /> {d.cidade}
            {d.orgao && ` · ${d.orgao}`}
          </p>
          {d.prazo && (
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" /> {dataHora(d.prazo)}
              {prazo && !['PAGA', 'APROVADA', 'CANCELADA', 'COMPROVANTE_ENVIADO'].includes(d.status) && (
                <span className={cx('text-xs font-medium', prazo.tom === 'vencido' ? 'text-red-600' : prazo.tom === 'atencao' ? 'text-amber-700' : 'text-gray-500')}>
                  ({prazo.texto})
                </span>
              )}
            </p>
          )}
          {d.valor && (
            <p className="text-base font-semibold text-gray-900">
              {moeda(d.valor)}
              {pediuProposta && !p.ehExecutor && <span className="ml-1 text-xs font-normal text-gray-500">valor de referência</span>}
            </p>
          )}
        </div>
        <p className="mt-4 whitespace-pre-line text-sm text-gray-800">{d.descricao}</p>
        {d.instrucoes && (
          <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
            <p className="text-xs font-semibold text-gray-500">O que entregar</p>
            <p className="whitespace-pre-line text-gray-800">{d.instrucoes}</p>
          </div>
        )}
        {d.checklist.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-gray-700">
            {d.checklist.map((c) => (
              <li key={c} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-marca-500" /> {c}
              </li>
            ))}
          </ul>
        )}

        {p.ehExecutor ? (
          <dl className="mt-4 grid gap-3 border-t border-gray-100 pt-4 text-sm">
            {d.processoNumero && (
              <div>
                <dt className="text-xs text-gray-500">Processo</dt>
                <dd className="font-mono text-xs">{d.processoNumero}</dd>
              </div>
            )}
            {d.partes && (
              <div>
                <dt className="text-xs text-gray-500">Partes</dt>
                <dd>{d.partes}</dd>
              </div>
            )}
            {d.local && (
              <div>
                <dt className="text-xs text-gray-500">Local</dt>
                <dd>
                  <a className="text-marca-600 underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent(d.local + ', ' + d.cidade)}`}>
                    {d.local}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        ) : (
          conviteAberto && <p className="mt-4 text-xs text-gray-500">Número do processo, partes, endereço e documentos aparecem depois que você aceitar.</p>
        )}

        {p.ehExecutor && d.anexos.length > 0 && (
          <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {d.anexos.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => abrirArquivo(`/portal/${token}/anexos/${a.id}`, true).catch((e) => avisar(e.message, 'erro'))}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                >
                  <Paperclip className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-marca-700">{a.nomeArquivo}</span>
                    <span className="text-xs text-gray-500">
                      {ANEXO_TIPO[a.tipo]} · {tamanho(a.tamanho)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ───── responder convite ───── */}
      {conviteAberto && !recusando && (
        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          {pediuProposta ? (
            <>
              <p className="font-semibold text-gray-900">Envie sua proposta</p>
              <div className="mt-3 space-y-3">
                <Campo rotulo="Seu valor (R$)">
                  <Entrada inputMode="decimal" placeholder="150,00" value={valor} onChange={(e) => setValor(e.target.value)} />
                </Campo>
                <Campo rotulo="Mensagem (opcional)">
                  <Entrada value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Ex.: consigo ir pela manhã" />
                </Campo>
              </div>
              <Botao
                className="mt-4 w-full py-3"
                disabled={!valor}
                carregando={acao === 'aceitar'}
                onClick={() =>
                  fazer(
                    'aceitar',
                    () =>
                      api<Portal>(`/portal/${token}/aceitar`, {
                        body: { valorProposto: Number(valor.replace(/\./g, '').replace(',', '.')), mensagem: mensagem || undefined },
                        publico: true,
                      }),
                    'Proposta enviada',
                  )
                }
              >
                Enviar proposta
              </Botao>
            </>
          ) : (
            <>
              <p className="font-semibold text-gray-900">Pode assumir esta demanda?</p>
              <p className="mt-1 text-sm text-gray-600">O primeiro a aceitar fica com ela.</p>
              <Botao
                variante="sucesso"
                className="mt-4 w-full py-3 text-base"
                carregando={acao === 'aceitar'}
                onClick={() => fazer('aceitar', () => api<Portal>(`/portal/${token}/aceitar`, { body: {}, publico: true }), 'Demanda aceita!')}
              >
                <CheckCircle2 className="h-5 w-5" /> Aceitar{d.valor ? ` por ${moeda(d.valor)}` : ''}
              </Botao>
            </>
          )}
          <button onClick={() => setRecusando(true)} className="mt-3 w-full py-2 text-sm font-medium text-gray-500">
            Não posso desta vez
          </button>
        </section>
      )}

      {conviteAberto && recusando && (
        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <Campo rotulo="Quer dizer o motivo? (opcional)">
            <Area value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: sem agenda nesse dia" />
          </Campo>
          <div className="mt-4 flex gap-2">
            <Botao variante="secundario" className="flex-1" onClick={() => setRecusando(false)}>
              Voltar
            </Botao>
            <Botao
              variante="perigo"
              className="flex-1"
              carregando={acao === 'recusar'}
              onClick={() => fazer('recusar', () => api<Portal>(`/portal/${token}/recusar`, { body: { motivo: motivo || undefined }, publico: true }))}
            >
              <X className="h-4 w-4" /> Recusar
            </Botao>
          </div>
        </section>
      )}

      {/* ───── entrega ───── */}
      {aguardandoEntrega && (
        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <p className="font-semibold text-gray-900">Enviar comprovante</p>
          <p className="mt-1 text-sm text-gray-600">Fotos, PDF da ata, protocolo — o que o escritório pediu.</p>
          <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 px-4 py-6 text-center hover:border-marca-500">
            <Upload className="h-6 w-6 text-gray-400" />
            <span className="text-sm font-medium text-marca-700">Escolher arquivos ou tirar foto</span>
            <span className="text-xs text-gray-500">até 10 arquivos de 20 MB</span>
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.mp3,.m4a,.ogg,.opus"
              className="hidden"
              onChange={(e) => setArquivos([...arquivos, ...Array.from(e.target.files ?? [])].slice(0, 10))}
            />
          </label>
          {arquivos.length > 0 && (
            <ul className="mt-3 space-y-1">
              {arquivos.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="truncate">{a.name}</span>
                  </span>
                  <button onClick={() => setArquivos(arquivos.filter((_, j) => j !== i))} aria-label="Remover">
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Campo rotulo="Relato / observações" className="mt-3">
            <Area rows={4} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Como foi, o que ficou decidido, próximos passos…" />
          </Campo>
          <Botao className="mt-4 w-full py-3" disabled={!arquivos.length && !obs.trim()} carregando={acao === 'entregar'} onClick={entregar}>
            Enviar comprovante
          </Botao>
          {d.status === 'ACEITA' && (
            <button
              onClick={() => fazer('iniciar', () => api<Portal>(`/portal/${token}/iniciar`, { method: 'POST', publico: true }), 'Marcado como em execução')}
              className="mt-3 w-full py-2 text-sm font-medium text-gray-500"
            >
              Avisar que já comecei
            </button>
          )}
        </section>
      )}
    </Casca>
  );
}

function Casca({ children, escritorio }: { children: React.ReactNode; escritorio?: string }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-marca-900 px-4 py-4 text-white">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-ouro-500">
            <Scale className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">{escritorio ?? 'Correspondentes'}</span>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-5 pb-16">{children}</main>
    </div>
  );
}

function Aviso({ tom, children }: { tom: 'verde' | 'azul' | 'ambar' | 'cinza'; children: React.ReactNode }) {
  const cores = {
    verde: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
    azul: 'bg-sky-50 text-sky-900 ring-sky-200',
    ambar: 'bg-amber-50 text-amber-900 ring-amber-200',
    cinza: 'bg-white text-gray-700 ring-gray-200',
  };
  return <div className={cx('mb-4 rounded-xl p-4 text-sm ring-1', cores[tom])}>{children}</div>;
}
