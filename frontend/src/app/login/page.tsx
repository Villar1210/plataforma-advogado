'use client';

import { Scale } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, setToken } from '@/lib/api';
import { Botao, Campo, Entrada } from '@/components/ui';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const r = await api<{ token: string }>('/auth/login', { body: { email, senha }, publico: true });
      setToken(r.token);
      router.replace('/demandas');
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-marca-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center text-white">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-ouro-500">
            <Scale className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold">Correspondentes</h1>
          <p className="mt-1 text-sm text-marca-200">Diligências do escritório, do envio ao pagamento</p>
        </div>
        <form onSubmit={entrar} className="space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          <Campo rotulo="E-mail">
            <Entrada type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
          <Campo rotulo="Senha">
            <Entrada type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
          </Campo>
          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          <Botao type="submit" carregando={carregando} className="w-full">
            Entrar
          </Botao>
        </form>
      </div>
    </main>
  );
}
