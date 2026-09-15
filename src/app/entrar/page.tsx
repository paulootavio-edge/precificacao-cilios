"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function Entrar() {
  const router = useRouter();

  /* já logada? direto para o app */
  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) router.replace("/");
      });
  }, [router]);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setCarregando(true);
    const { error } = await getSupabase().auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      const m = (error.message || "").toLowerCase();
      setMsg({
        tipo: "err",
        texto: m.includes("banned")
          ? "Este acesso está suspenso. Fale com o suporte."
          : m.includes("invalid login")
            ? "E-mail ou senha incorretos. Use o e-mail da compra e a senha informada na sua página de acesso."
            : "Não foi possível entrar: " + error.message,
      });
      return;
    }
    router.push("/");
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mark.svg" alt="INTERLASH" className="mark" />
        <h1>Entrar</h1>
        <p className="sub">Entre para acessar o financeiro do seu estúdio.</p>
        <form onSubmit={enviar}>
          <div className="field">
            <label>E-mail</label>
            <div className="in">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="o e-mail usado na compra"
              />
            </div>
          </div>
          <div className="field">
            <label>Senha</label>
            <div className="in">
              <input
                type="password"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="sua senha de acesso"
              />
            </div>
          </div>
          <button className="btn gold" type="submit" disabled={carregando}>
            {carregando ? "Aguarde..." : "Entrar"}
          </button>
        </form>
        {msg && <div className={`auth-msg ${msg.tipo}`}>{msg.texto}</div>}
        <div className="auth-alt">
          Seu acesso é liberado automaticamente na compra: use o e-mail da compra e a senha
          informada na página de acesso.
        </div>
      </div>
    </div>
  );
}
