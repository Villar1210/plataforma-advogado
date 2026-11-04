'use client';

import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  FileText,
  MapPin,
  MessageCircle,
  Paperclip,
  Pencil,
  Send,
  Star,
  Trash2,
  Undo2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { abrirArquivo, api } from '@/lib/api';
import { dataHora, isoParaLocal, localParaIso, moeda, prazoRelativo, tamanho, telefone } from '@/lib/formato';
import { ANEXO_TIPO, Correspondente, DemandaStatus, ENVIO_STATUS, STATUS } from '@/lib/tipos';
import { Area, Botao, Campo, Carregando, Cartao, cx, Entrada, Modal, Selecao, Selo, useAcao, useAviso } from '@/components/ui';

interface Envio {
  id: string;
  status: string;
  token: string;
  valorProposto: string | null;
  mensagem: string | null;
  motivoRecusa: string | null;
  visualizadoEm: string | null;
  respondidoEm: string | null;
  linkPortal: string;
  linkWhatsapp: string;
  correspondenteId: string;
  correspondente: { id: string; nome: string; whatsapp: string; ehAdvogado: boolean; notaMedia: number | null };
}

interface Anexo {
  id: string;
  tipo: string;
  nomeArquivo: string;
  tamanho: number;
  createdAt: string;
  enviadoPorCorrespondenteId: string | null;
}

interface Demanda {
  id: string;
  numero: number;
  status: DemandaStatus;
  modo: 'DIRETO' | 'PROPOSTAS' | 'MARKETPLACE';
  tipoCorrespondente: string;
  cidade: { id: number; nome: string; uf: string };
  servico: { id: number; nome: string; checklist: string[] } | null;
  servicoTexto: string | null;
  processoNumero: string | null;
  partes: string | null;
  orgao: string | null;
  local: string | null;
  prazo: string | null;
  valor: string | null;
  valorAcordado: string | null;
  descricao: string;
  instrucoes: string | null;
  entregaObservacao: string | null;
  entregueEm: string | null;
  devolucaoMotivo: string | null;
  motivoCancelamento: string | null;
  correspondenteId: string | null;
  correspondente: { id: string; nome: string; whatsapp: string; email: string | null; oab: string | null; oabUf: string | null; pixTipo: string | null; pixChave: string | null } | null;
  criadoPor: { nome: string } | null;
  createdAt: string;
  envios: Envio[];
  anexos: Anexo[];
  eventos: { id: string; tipo: string; descricao: string; createdAt: string; autorUsuario: { nome: string } | null; autorCorrespondente: { nome: string } | null }[];
  pagamento: { id: string; status: string; valor: string; vencimento: string | null; pagoEm: string | null; metodo: string | null; comprovante: { id: string; nomeArquivo: string } | null } | null;
  avaliacao: { nota: number; noPrazo: boolean; comentario: string | null } | null;
  avisoWhatsapp?: string | null;
}

export default function DetalhePage() {
  return (
    <Suspense>
      <Detalhe />
    </Suspense>
  );
}

function Detalhe() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const avisar = useAviso();
  const { executar, carregando } = useAcao();
  const [d, setD] = useState<Demanda | null>(null);
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState<null | 'enviar' | 'devolver' | 'cancelar' | 'pagar' | 'editar' | 'anexar'>(null);
  const [aviso, setAviso] = useState<{ titulo: string; link: string } | null>(null);
  const [recemEnviada, setRecemEnviada] = useState(params.get('enviada') === '1');

  const carregar = useCallback(() => api<Demanda>(`/demandas/${id}`).then(setD).catch((e) => setErro(e.message)), [id]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  /** Aplica a resposta de uma ação e, se vier mensagem pronta, oferece o WhatsApp. */
  const aplicar = (r: Demanda | undefined, tituloAviso?: string) => {
    if (!r) return;
    setD(r);
    setModal(null);
    if (r.avisoWhatsapp && tituloAviso) setAviso({ titulo: tituloAviso, link: r.avisoWhatsapp });
  };

  if (erro) return <p className="py-16 text-center text-gray-500">{erro}</p>;
  if (!d) return <Carregando />;

  const nomeServico = d.servico?.nome ?? d.servicoTexto;
  const prazo = prazoRelativo(d.prazo);
  const abertos = d.envios.filter((e) => !['CANCELADO'].includes(e.status));
  const executor = d.envios.find((e) => e.correspondenteId === d.correspondenteId);
  const encerrada = d.status === 'PAGA' || d.status === 'CANCELADA';
  const comprovantes = d.anexos.filter((a) => a.tipo === 'COMPROVANTE_ENTREGA');
  const docs = d.anexos.filter((a) => a.tipo !== 'COMPROVANTE_ENTREGA');

  return (
    <div className="space-y-5 pb-10">
      <Link href="/demandas" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> Demandas
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">{nomeServico}</h1>
            <Selo cor={STATUS[d.status].cor}>{STATUS[d.status].rotulo}</Selo>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
            <span>#{d.numero}</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {d.cidade.nome}/{d.cidade.uf}
            </span>
            {d.prazo && (
              <span className={cx(prazo?.tom === 'vencido' && !encerrada && 'font-semibold text-red-600')}>
                Prazo {dataHora(d.prazo)} {!encerrada && prazo && `(${prazo.texto})`}
              </span>
            )}
            <span>{moeda(d.valorAcordado ?? d.valor)}</span>
          </p>
        </div>
        {!encerrada && (
          <div className="flex gap-2">
            <Botao variante="secundario" tamanho="sm" onClick={() => setModal('editar')}>
              <Pencil className="h-4 w-4" /> Editar
            </Botao>
            {d.status !== 'APROVADA' && (
              <Botao variante="perigo" tamanho="sm" onClick={() => setModal('cancelar')}>
                Cancelar demanda
              </Botao>
            )}
          </div>
        )}
      </header>

      {recemEnviada && abertos.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-emerald-900">Demanda salva. Agora avise pelo WhatsApp.</p>
              <p className="text-sm text-emerald-800">Cada botão abre o WhatsApp com a mensagem e o link do convite prontos — é só tocar em enviar.</p>
            </div>
            <button onClick={() => setRecemEnviada(false)} className="text-emerald-700" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {abertos.map((e) => (
              <a key={e.id} href={e.linkWhatsapp} target="_blank" rel="noreferrer">
                <Botao variante="sucesso" tamanho="sm">
                  <MessageCircle className="h-4 w-4" /> {e.correspondente.nome}
                </Botao>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* ───── painel da etapa atual ───── */}
          {d.status === 'RASCUNHO' && (
            <Cartao titulo="Próximo passo">
              <p className="text-sm text-gray-600">Esta demanda ainda não foi enviada a nenhum correspondente.</p>
              <Botao className="mt-3" onClick={() => setModal('enviar')}>
                <Send className="h-4 w-4" /> Escolher e enviar
              </Botao>
            </Cartao>
          )}

          {d.status === 'AGUARDANDO' && (
            <Cartao
              titulo={d.modo === 'PROPOSTAS' ? 'Propostas' : 'Convites enviados'}
              acao={
                <Botao variante="fantasma" tamanho="sm" onClick={() => setModal('enviar')}>
                  <Send className="h-4 w-4" /> Enviar para mais
                </Botao>
              }
            >
              <p className="mb-3 text-sm text-gray-600">
                {d.modo === 'PROPOSTAS'
                  ? 'Cada correspondente responde com um valor. Escolha a melhor proposta.'
                  : 'O primeiro que aceitar fica com a demanda. Você também pode designar alguém diretamente.'}
              </p>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {d.envios.map((e) => (
                  <LinhaEnvio
                    key={e.id}
                    e={e}
                    modo={d.modo}
                    carregando={carregando}
                    aoEscolher={() => executar('esc' + e.id, () => api<Demanda>(`/demandas/${d.id}/envios/${e.id}/escolher`, { method: 'POST' }), 'Correspondente definido').then((r) => aplicar(r))}
                    aoCancelar={() => executar('can' + e.id, () => api<Demanda>(`/demandas/${d.id}/envios/${e.id}/cancelar`, { method: 'POST' })).then((r) => aplicar(r))}
                  />
                ))}
              </ul>
            </Cartao>
          )}

          {(d.status === 'ACEITA' || d.status === 'EM_EXECUCAO') && d.correspondente && (
            <Cartao titulo="Em andamento">
              {d.devolucaoMotivo && (
                <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  <strong>Devolvida para ajuste:</strong> {d.devolucaoMotivo}
                </div>
              )}
              <Executor d={d} />
              <div className="mt-4 flex flex-wrap gap-2">
                {executor && (
                  <a href={`https://wa.me/${d.correspondente.whatsapp}`} target="_blank" rel="noreferrer">
                    <Botao variante="secundario" tamanho="sm">
                      <MessageCircle className="h-4 w-4" /> Conversar no WhatsApp
                    </Botao>
                  </a>
                )}
                {executor && <CopiarLink link={executor.linkPortal} rotulo="Copiar link do correspondente" />}
                {d.status === 'ACEITA' && (
                  <Botao
                    variante="secundario"
                    tamanho="sm"
                    carregando={carregando === 'iniciar'}
                    onClick={() => executar('iniciar', () => api<Demanda>(`/demandas/${d.id}/iniciar`, { method: 'POST' })).then((r) => aplicar(r))}
                  >
                    Marcar como em execução
                  </Botao>
                )}
              </div>
              <p className="mt-3 text-xs text-gray-500">Quando terminar, o correspondente envia o comprovante pelo link e você é avisado aqui.</p>
            </Cartao>
          )}

          {d.status === 'COMPROVANTE_ENVIADO' && (
            <Cartao titulo="Conferir entrega" className="border-violet-200">
              <Executor d={d} />
              <p className="mt-3 text-xs text-gray-500">Entregue em {dataHora(d.entregueEm)}</p>
              {d.entregaObservacao && <p className="mt-2 whitespace-pre-line rounded-lg bg-gray-50 p-3 text-sm text-gray-800">{d.entregaObservacao}</p>}
              {d.servico && d.servico.checklist.length > 0 && (
                <p className="mt-2 text-xs text-gray-500">Esperado: {d.servico.checklist.join(', ')}</p>
              )}
              <ListaAnexos anexos={comprovantes} />
              <div className="mt-4 flex flex-wrap gap-2">
                <Botao
                  variante="sucesso"
                  carregando={carregando === 'aprovar'}
                  onClick={() => executar('aprovar', () => api<Demanda>(`/demandas/${d.id}/aprovar`, { method: 'POST' }), 'Entrega aprovada').then((r) => aplicar(r, 'Avisar o correspondente da aprovação'))}
                >
                  <Check className="h-4 w-4" /> Aprovar entrega
                </Botao>
                <Botao variante="secundario" onClick={() => setModal('devolver')}>
                  <Undo2 className="h-4 w-4" /> Devolver para ajuste
                </Botao>
              </div>
            </Cartao>
          )}

          {d.status === 'APROVADA' && d.pagamento && (
            <Cartao titulo="Pagamento pendente" className="border-emerald-200">
              <Executor d={d} />
              <div className="mt-3 grid gap-3 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-gray-500">Valor</p>
                  <p className="text-lg font-semibold">{moeda(d.pagamento.valor)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Pix ({d.correspondente?.pixTipo ?? '—'})</p>
                  {d.correspondente?.pixChave ? <CopiarTexto texto={d.correspondente.pixChave} /> : <p className="text-gray-500">Não cadastrado</p>}
                </div>
              </div>
              <Botao className="mt-4" onClick={() => setModal('pagar')}>
                <Wallet className="h-4 w-4" /> Registrar pagamento
              </Botao>
            </Cartao>
          )}

          {d.status === 'PAGA' && d.pagamento && (
            <Cartao titulo="Encerrada">
              <p className="text-sm text-gray-700">
                Paga em {dataHora(d.pagamento.pagoEm)} via {d.pagamento.metodo} — {moeda(d.pagamento.valor)} para {d.correspondente?.nome}.
              </p>
              {d.pagamento.comprovante && (
                <button
                  onClick={() => abrirArquivo(`/anexos/${d.pagamento!.comprovante!.id}`).catch((e) => avisar(e.message, 'erro'))}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-marca-600 hover:underline"
                >
                  <FileText className="h-4 w-4" /> Comprovante de pagamento
                </button>
              )}
            </Cartao>
          )}

          {d.status === 'CANCELADA' && (
            <Cartao titulo="Cancelada">
              <p className="text-sm text-gray-700">{d.motivoCancelamento}</p>
            </Cartao>
          )}

          {(d.status === 'APROVADA' || d.status === 'PAGA') && d.correspondente && (
            <Avaliacao d={d} aoSalvar={(r) => setD(r)} />
          )}

          {/* ───── dados ───── */}
          <Cartao titulo="Dados da demanda">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Dado rotulo="Processo" valor={d.processoNumero} mono />
              <Dado rotulo="Partes" valor={d.partes} />
              <Dado rotulo="Órgão / vara" valor={d.orgao} />
              <Dado rotulo="Local" valor={d.local} />
              <Dado rotulo="Contratação" valor={d.modo === 'PROPOSTAS' ? 'Por propostas' : 'Direta'} />
              <Dado rotulo="Correspondente" valor={d.tipoCorrespondente === 'APENAS_ADVOGADOS' ? 'Apenas advogados' : 'Qualquer'} />
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500">Descrição</dt>
                <dd className="whitespace-pre-line text-gray-900">{d.descricao}</dd>
              </div>
              {d.instrucoes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-gray-500">O que deve ser entregue</dt>
                  <dd className="whitespace-pre-line text-gray-900">{d.instrucoes}</dd>
                </div>
              )}
            </dl>
          </Cartao>

          <Cartao
            titulo="Arquivos"
            acao={
              !encerrada && (
                <Botao variante="fantasma" tamanho="sm" onClick={() => setModal('anexar')}>
                  <Upload className="h-4 w-4" /> Anexar
                </Botao>
              )
            }
          >
            {d.anexos.length === 0 ? (
              <p className="text-sm text-gray-500">Anexe procuração, substabelecimento ou documentos do processo. O correspondente vê depois de aceitar.</p>
            ) : (
              <>
                {docs.length === 0 && <p className="text-sm text-gray-500">Nenhum documento do escritório anexado.</p>}
                <ListaAnexos
                  anexos={docs}
                  aoRemover={
                    encerrada
                      ? undefined
                      : (a) => executar('rm' + a.id, () => api(`/anexos/${a.id}`, { method: 'DELETE' }), 'Arquivo removido').then((r) => r && carregar())
                  }
                />
                {comprovantes.length > 0 && (
                  <>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Enviados pelo correspondente</p>
                    <ListaAnexos anexos={comprovantes} />
                  </>
                )}
              </>
            )}
          </Cartao>
        </div>

        {/* ───── histórico ───── */}
        <aside>
          <Cartao titulo="Histórico">
            <ol className="relative space-y-4 border-l border-gray-200 pl-4">
              {d.eventos.map((ev) => (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-marca-500 ring-4 ring-white" />
                  <p className="text-sm text-gray-900">{ev.descricao}</p>
                  <p className="text-xs text-gray-500">
                    {dataHora(ev.createdAt)}
                    {ev.autorUsuario && ` · ${ev.autorUsuario.nome}`}
                  </p>
                </li>
              ))}
            </ol>
          </Cartao>
        </aside>
      </div>

      {/* ───── modais ───── */}
      <ModalEnviar aberto={modal === 'enviar'} d={d} aoFechar={() => setModal(null)} aoEnviar={(r) => { aplicar(r); setRecemEnviada(true); }} />

      <ModalMotivo
        aberto={modal === 'devolver'}
        titulo="Devolver para ajuste"
        rotulo="O que precisa ser corrigido?"
        botao="Devolver"
        carregando={carregando === 'devolver'}
        aoFechar={() => setModal(null)}
        aoConfirmar={(motivo) =>
          executar('devolver', () => api<Demanda>(`/demandas/${d.id}/devolver`, { body: { motivo } }), 'Devolvida ao correspondente').then((r) =>
            aplicar(r, 'Avisar o correspondente do ajuste'),
          )
        }
      />

      <ModalMotivo
        aberto={modal === 'cancelar'}
        titulo="Cancelar demanda"
        rotulo="Motivo do cancelamento"
        botao="Cancelar demanda"
        perigo
        carregando={carregando === 'cancelar'}
        aoFechar={() => setModal(null)}
        aoConfirmar={(motivo) => executar('cancelar', () => api<Demanda>(`/demandas/${d.id}/cancelar`, { body: { motivo } }), 'Demanda cancelada').then((r) => aplicar(r))}
      />

      <ModalPagar aberto={modal === 'pagar'} d={d} aoFechar={() => setModal(null)} aoPagar={(r) => aplicar(r, 'Avisar o correspondente do pagamento')} />
      <ModalEditar aberto={modal === 'editar'} d={d} aoFechar={() => setModal(null)} aoSalvar={(r) => aplicar(r)} />
      <ModalAnexar aberto={modal === 'anexar'} d={d} aoFechar={() => setModal(null)} aoSalvar={(r) => aplicar(r)} />

      <Modal aberto={!!aviso} aoFechar={() => setAviso(null)} titulo={aviso?.titulo ?? ''}>
        <p className="text-sm text-gray-600">A mensagem já está pronta. Abra o WhatsApp e toque em enviar.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => setAviso(null)}>
            Agora não
          </Botao>
          <a href={aviso?.link} target="_blank" rel="noreferrer" onClick={() => setAviso(null)}>
            <Botao variante="sucesso">
              <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
            </Botao>
          </a>
        </div>
      </Modal>
    </div>
  );
}

function Dado({ rotulo, valor, mono }: { rotulo: string; valor?: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{rotulo}</dt>
      <dd className={cx('text-gray-900', mono && 'font-mono text-xs')}>{valor || '—'}</dd>
    </div>
  );
}

function Executor({ d }: { d: Demanda }) {
  if (!d.correspondente) return null;
  const c = d.correspondente;
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-marca-100 font-semibold text-marca-800">{c.nome[0]}</div>
      <div>
        <Link href={`/correspondentes/${c.id}`} className="font-medium text-gray-900 hover:underline">
          {c.nome}
        </Link>
        <p className="text-xs text-gray-500">
          {telefone(c.whatsapp)}
          {c.oab && ` · OAB ${c.oab}/${c.oabUf}`}
        </p>
      </div>
    </div>
  );
}

function LinhaEnvio({
  e,
  modo,
  carregando,
  aoEscolher,
  aoCancelar,
}: {
  e: Envio;
  modo: string;
  carregando: string | null;
  aoEscolher: () => void;
  aoCancelar: () => void;
}) {
  const aberto = ['ENVIADO', 'VISUALIZADO', 'PROPOSTA'].includes(e.status);
  return (
    <li className={cx('p-3', !aberto && 'opacity-60')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
            {e.correspondente.nome}
            <Selo cor={ENVIO_STATUS[e.status].cor}>{ENVIO_STATUS[e.status].rotulo}</Selo>
          </p>
          <p className="text-xs text-gray-500">
            {e.status === 'PROPOSTA' && <strong className="text-gray-900">{moeda(e.valorProposto)}</strong>}
            {e.status === 'PROPOSTA' && e.mensagem && ` · "${e.mensagem}"`}
            {e.status === 'RECUSADO' && (e.motivoRecusa ? `Motivo: ${e.motivoRecusa}` : 'Sem motivo informado')}
            {e.status === 'VISUALIZADO' && `Abriu em ${dataHora(e.visualizadoEm)}`}
            {e.status === 'ENVIADO' && 'Ainda não abriu o link'}
          </p>
        </div>
        {aberto && (
          <div className="flex flex-wrap gap-1.5">
            <a href={e.linkWhatsapp} target="_blank" rel="noreferrer" title="Enviar convite pelo WhatsApp">
              <Botao variante="secundario" tamanho="sm">
                <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp
              </Botao>
            </a>
            <CopiarLink link={e.linkPortal} />
            <Botao
              tamanho="sm"
              variante={e.status === 'PROPOSTA' ? 'primario' : 'secundario'}
              carregando={carregando === 'esc' + e.id}
              onClick={aoEscolher}
              title={modo === 'PROPOSTAS' ? 'Aceitar esta proposta' : 'Designar sem esperar o aceite'}
            >
              {e.status === 'PROPOSTA' ? 'Escolher' : 'Designar'}
            </Botao>
            <Botao tamanho="sm" variante="fantasma" carregando={carregando === 'can' + e.id} onClick={aoCancelar} title="Cancelar convite">
              <X className="h-4 w-4" />
            </Botao>
          </div>
        )}
      </div>
    </li>
  );
}

function CopiarLink({ link, rotulo = 'Link' }: { link: string; rotulo?: string }) {
  const avisar = useAviso();
  return (
    <Botao
      variante="secundario"
      tamanho="sm"
      onClick={() => navigator.clipboard.writeText(link).then(() => avisar('Link copiado'), () => avisar(link))}
      title="Copiar link do convite"
    >
      <Copy className="h-4 w-4" /> {rotulo}
    </Botao>
  );
}

function CopiarTexto({ texto }: { texto: string }) {
  const avisar = useAviso();
  return (
    <button onClick={() => navigator.clipboard.writeText(texto).then(() => avisar('Copiado'))} className="flex items-center gap-1.5 font-mono text-sm font-medium text-gray-900 hover:text-marca-600">
      {texto} <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

function ListaAnexos({ anexos, aoRemover }: { anexos: Anexo[]; aoRemover?: (a: Anexo) => void }) {
  const avisar = useAviso();
  if (!anexos.length) return null;
  return (
    <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
      {anexos.map((a) => (
        <li key={a.id} className="flex items-center gap-3 px-3 py-2">
          <Paperclip className="h-4 w-4 shrink-0 text-gray-400" />
          <button onClick={() => abrirArquivo(`/anexos/${a.id}`).catch((e) => avisar(e.message, 'erro'))} className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-medium text-marca-700 hover:underline">{a.nomeArquivo}</span>
            <span className="text-xs text-gray-500">
              {ANEXO_TIPO[a.tipo]} · {tamanho(a.tamanho)} · {dataHora(a.createdAt)}
            </span>
          </button>
          <ExternalLink className="h-4 w-4 text-gray-300" />
          {aoRemover && !a.enviadoPorCorrespondenteId && (
            <button onClick={() => aoRemover(a)} className="text-gray-400 hover:text-red-600" aria-label="Remover arquivo">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Avaliacao({ d, aoSalvar }: { d: Demanda; aoSalvar: (d: Demanda) => void }) {
  const { executar, carregando } = useAcao();
  const [nota, setNota] = useState(d.avaliacao?.nota ?? 0);
  const [noPrazo, setNoPrazo] = useState(d.avaliacao?.noPrazo ?? true);
  const [comentario, setComentario] = useState(d.avaliacao?.comentario ?? '');
  const [editando, setEditando] = useState(!d.avaliacao);
  if (!editando && d.avaliacao) {
    return (
      <Cartao titulo="Avaliação do correspondente" acao={<Botao variante="fantasma" tamanho="sm" onClick={() => setEditando(true)}>Alterar</Botao>}>
        <Estrelas nota={d.avaliacao.nota} />
        <p className="mt-1 text-sm text-gray-600">
          {d.avaliacao.noPrazo ? 'Entregou no prazo' : 'Entregou fora do prazo'}
          {d.avaliacao.comentario && ` · ${d.avaliacao.comentario}`}
        </p>
      </Cartao>
    );
  }
  return (
    <Cartao titulo={`Como foi o trabalho de ${d.correspondente?.nome.split(' ')[0]}?`}>
      <Estrelas nota={nota} aoMudar={setNota} />
      <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={noPrazo} onChange={(e) => setNoPrazo(e.target.checked)} className="rounded" /> Entregou no prazo
      </label>
      <Entrada className="mt-3" placeholder="Comentário (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} />
      <Botao
        className="mt-3"
        tamanho="sm"
        disabled={!nota}
        carregando={carregando === 'avaliar'}
        onClick={() =>
          executar('avaliar', () => api<Demanda>(`/demandas/${d.id}/avaliar`, { body: { nota, noPrazo, comentario: comentario || undefined } }), 'Avaliação salva').then((r) => {
            if (r) {
              aoSalvar(r);
              setEditando(false);
            }
          })
        }
      >
        Salvar avaliação
      </Botao>
    </Cartao>
  );
}

function Estrelas({ nota, aoMudar }: { nota: number; aoMudar?: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!aoMudar} onClick={() => aoMudar?.(n)} aria-label={`${n} estrela(s)`}>
          <Star className={cx('h-6 w-6', n <= nota ? 'fill-ouro-500 text-ouro-500' : 'text-gray-300')} />
        </button>
      ))}
    </div>
  );
}

function ModalMotivo({
  aberto,
  titulo,
  rotulo,
  botao,
  perigo,
  carregando,
  aoFechar,
  aoConfirmar,
}: {
  aberto: boolean;
  titulo: string;
  rotulo: string;
  botao: string;
  perigo?: boolean;
  carregando: boolean;
  aoFechar: () => void;
  aoConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  useEffect(() => setMotivo(''), [aberto]);
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={titulo}>
      <Campo rotulo={rotulo}>
        <Area autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Campo>
      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>
          Voltar
        </Botao>
        <Botao variante={perigo ? 'perigo' : 'primario'} disabled={!motivo.trim()} carregando={carregando} onClick={() => aoConfirmar(motivo.trim())}>
          {botao}
        </Botao>
      </div>
    </Modal>
  );
}

function ModalEnviar({ aberto, d, aoFechar, aoEnviar }: { aberto: boolean; d: Demanda; aoFechar: () => void; aoEnviar: (d: Demanda) => void }) {
  const { executar, carregando } = useAcao();
  const [lista, setLista] = useState<Correspondente[] | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => {
    if (!aberto) return;
    setSel([]);
    const q = new URLSearchParams({ cidadeId: String(d.cidade.id) });
    if (d.servico) q.set('servicoId', String(d.servico.id));
    if (d.tipoCorrespondente === 'APENAS_ADVOGADOS') q.set('apenasAdvogados', 'true');
    api<Correspondente[]>(`/correspondentes/sugestoes?${q}`).then(setLista).catch(() => setLista([]));
  }, [aberto, d]);
  const jaEnviados = new Set(d.envios.filter((e) => e.status !== 'CANCELADO').map((e) => e.correspondenteId));
  const disponiveis = (lista ?? []).filter((c) => !jaEnviados.has(c.id));
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={`Enviar para correspondentes de ${d.cidade.nome}`}>
      {!lista ? (
        <Carregando />
      ) : disponiveis.length === 0 ? (
        <p className="text-sm text-gray-600">
          Nenhum outro correspondente seu atende esta cidade.{' '}
          <Link href="/correspondentes?novo=1" className="font-medium text-marca-600 underline">
            Cadastrar correspondente
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {disponiveis.map((c) => {
            const on = sel.includes(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSel(on ? sel.filter((i) => i !== c.id) : [...sel, c.id])}
                  className={cx('flex w-full items-center gap-3 px-3 py-2.5 text-left', on ? 'bg-marca-50' : 'hover:bg-gray-50')}
                >
                  <span className={cx('flex h-5 w-5 items-center justify-center rounded border', on ? 'border-marca-700 bg-marca-700 text-white' : 'border-gray-300')}>
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="flex-1 text-sm">
                    <span className="font-medium">{c.nome}</span>
                    {c.favorito && <Star className="ml-1 inline h-3.5 w-3.5 fill-ouro-500 text-ouro-500" />}
                    <span className="block text-xs text-gray-500">
                      {c.demandasConcluidas} concluída(s){c.notaMedia ? ` · ★ ${c.notaMedia.toFixed(1)}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>
          Voltar
        </Botao>
        <Botao
          disabled={!sel.length}
          carregando={carregando === 'enviar'}
          onClick={() => executar('enviar', () => api<Demanda>(`/demandas/${d.id}/enviar`, { body: { correspondenteIds: sel } })).then((r) => r && aoEnviar(r))}
        >
          <Send className="h-4 w-4" /> Enviar ({sel.length})
        </Botao>
      </div>
    </Modal>
  );
}

function ModalPagar({ aberto, d, aoFechar, aoPagar }: { aberto: boolean; d: Demanda; aoFechar: () => void; aoPagar: (d: Demanda) => void }) {
  const { executar, carregando } = useAcao();
  const [metodo, setMetodo] = useState('PIX');
  const [pagoEm, setPagoEm] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  useEffect(() => {
    if (aberto) {
      setPagoEm(isoParaLocal(new Date().toISOString()));
      setArquivo(null);
    }
  }, [aberto]);
  if (!d.pagamento) return null;
  const pagar = () => {
    const fd = new FormData();
    fd.append('metodo', metodo);
    if (pagoEm) fd.append('pagoEm', localParaIso(pagoEm)!);
    if (arquivo) fd.append('comprovante', arquivo);
    executar('pagar', () => api<Demanda>(`/pagamentos/${d.pagamento!.id}/pagar`, { form: fd }), 'Pagamento registrado').then((r) => r && aoPagar(r));
  };
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={`Registrar pagamento de ${moeda(d.pagamento.valor)}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo rotulo="Forma">
            <Selecao value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              <option value="PIX">Pix</option>
              <option value="TED">TED</option>
              <option value="BOLETO">Boleto</option>
              <option value="DINHEIRO">Dinheiro</option>
            </Selecao>
          </Campo>
          <Campo rotulo="Data">
            <Entrada type="datetime-local" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="Comprovante (opcional)" dica="O correspondente poderá ver o comprovante pelo link dele.">
          <Entrada type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.heic" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        </Campo>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>
          Voltar
        </Botao>
        <Botao variante="sucesso" carregando={carregando === 'pagar'} onClick={pagar}>
          Confirmar pagamento
        </Botao>
      </div>
    </Modal>
  );
}

function ModalAnexar({ aberto, d, aoFechar, aoSalvar }: { aberto: boolean; d: Demanda; aoFechar: () => void; aoSalvar: (d: Demanda) => void }) {
  const { executar, carregando } = useAcao();
  const [tipo, setTipo] = useState('PROCURACAO');
  const [arquivos, setArquivos] = useState<File[]>([]);
  useEffect(() => setArquivos([]), [aberto]);
  const enviar = () =>
    executar(
      'anexar',
      async () => {
        let r: Demanda | undefined;
        for (const a of arquivos) {
          const fd = new FormData();
          fd.append('tipo', tipo);
          fd.append('arquivo', a);
          r = await api<Demanda>(`/demandas/${d.id}/anexos`, { form: fd });
        }
        return r;
      },
      'Arquivo(s) anexado(s)',
    ).then((r) => r && aoSalvar(r));
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Anexar arquivos">
      <div className="space-y-4">
        <Campo rotulo="Tipo">
          <Selecao value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {['PROCURACAO', 'SUBSTABELECIMENTO', 'DOCUMENTO_PROCESSO', 'OUTRO'].map((t) => (
              <option key={t} value={t}>
                {ANEXO_TIPO[t]}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Arquivos" dica="PDF, imagens, Word ou Excel — até 20 MB cada.">
          <Entrada type="file" multiple onChange={(e) => setArquivos(Array.from(e.target.files ?? []))} />
        </Campo>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>
          Voltar
        </Botao>
        <Botao disabled={!arquivos.length} carregando={carregando === 'anexar'} onClick={enviar}>
          <Upload className="h-4 w-4" /> Anexar
        </Botao>
      </div>
    </Modal>
  );
}

function ModalEditar({ aberto, d, aoFechar, aoSalvar }: { aberto: boolean; d: Demanda; aoFechar: () => void; aoSalvar: (d: Demanda) => void }) {
  const { executar, carregando } = useAcao();
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => {
    if (aberto)
      setF({
        processoNumero: d.processoNumero ?? '',
        partes: d.partes ?? '',
        orgao: d.orgao ?? '',
        local: d.local ?? '',
        prazo: isoParaLocal(d.prazo),
        valor: d.valor ? String(Number(d.valor)).replace('.', ',') : '',
        descricao: d.descricao,
        instrucoes: d.instrucoes ?? '',
      });
  }, [aberto, d]);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const salvar = () =>
    executar(
      'editar',
      () =>
        api<Demanda>(`/demandas/${d.id}`, {
          method: 'PATCH',
          body: {
            cidadeId: d.cidade.id,
            servicoId: d.servico?.id,
            servicoTexto: d.servicoTexto ?? undefined,
            modo: d.modo,
            tipoCorrespondente: d.tipoCorrespondente,
            processoNumero: f.processoNumero || undefined,
            partes: f.partes || undefined,
            orgao: f.orgao || undefined,
            local: f.local || undefined,
            prazo: localParaIso(f.prazo),
            valor: f.valor ? Number(f.valor.replace(/\./g, '').replace(',', '.')) : undefined,
            descricao: f.descricao,
            instrucoes: f.instrucoes || undefined,
          },
        }),
      'Demanda atualizada',
    ).then((r) => r && aoSalvar(r));
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Editar demanda" largura="max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Prazo">
          <Entrada type="datetime-local" value={f.prazo ?? ''} onChange={(e) => set('prazo', e.target.value)} />
        </Campo>
        <Campo rotulo="Valor oferecido (R$)">
          <Entrada inputMode="decimal" value={f.valor ?? ''} onChange={(e) => set('valor', e.target.value)} />
        </Campo>
        <Campo rotulo="Nº do processo">
          <Entrada value={f.processoNumero ?? ''} onChange={(e) => set('processoNumero', e.target.value)} />
        </Campo>
        <Campo rotulo="Partes">
          <Entrada value={f.partes ?? ''} onChange={(e) => set('partes', e.target.value)} />
        </Campo>
        <Campo rotulo="Órgão / vara">
          <Entrada value={f.orgao ?? ''} onChange={(e) => set('orgao', e.target.value)} />
        </Campo>
        <Campo rotulo="Local">
          <Entrada value={f.local ?? ''} onChange={(e) => set('local', e.target.value)} />
        </Campo>
        <Campo rotulo="Descrição" className="sm:col-span-2">
          <Area rows={4} value={f.descricao ?? ''} onChange={(e) => set('descricao', e.target.value)} />
        </Campo>
        <Campo rotulo="O que deve ser entregue" className="sm:col-span-2">
          <Area value={f.instrucoes ?? ''} onChange={(e) => set('instrucoes', e.target.value)} />
        </Campo>
      </div>
      {d.valorAcordado && <p className="mt-3 text-xs text-gray-500">O valor acordado com o correspondente ({moeda(d.valorAcordado)}) não muda ao editar o valor oferecido.</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>
          Voltar
        </Botao>
        <Botao disabled={!f.descricao?.trim()} carregando={carregando === 'editar'} onClick={salvar}>
          Salvar
        </Botao>
      </div>
    </Modal>
  );
}
