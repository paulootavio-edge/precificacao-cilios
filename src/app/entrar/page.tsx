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
  const [modo, setModo] = useState<"entrar" | "cadastro">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setCarregando(true);
    const supabase = getSupabase();
    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      setCarregando(false);
      if (error) {
        setMsg({
          tipo: "err",
          texto:
            error.message === "Invalid login credentials"
              ? "E-mail ou senha incorretos. Se acabou de criar a conta, confirme o e-mail primeiro."
              : "Não foi possível entrar: " + error.message,
        });
        return;
      }
      router.push("/");
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password: senha });
      setCarregando(false);
      if (error) {
        setMsg({ tipo: "err", texto: "Não foi possível cadastrar: " + error.message });
        return;
      }
      if (data.session) {
        router.push("/");
      } else {
        setMsg({
          tipo: "ok",
          texto:
            "Conta criada! Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, volte aqui e entre.",
        });
        setModo("entrar");
      }
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mark.svg" alt="INTERLASH" className="mark" />
        <h1>{modo === "entrar" ? "Entrar" : "Criar conta"}</h1>
        <p className="sub">
          {modo === "entrar"
            ? "Entre para acessar o financeiro do seu estúdio."
            : "Crie sua conta gratuita e comece a precificar como gente grande."}
        </p>
        <form onSubmit={enviar}>
          <div className="field">
            <label>E-mail</label>
            <div className="in">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
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
                placeholder="mínimo 6 caracteres"
              />
            </div>
          </div>
          <button className="btn gold" type="submit" disabled={carregando}>
            {carregando ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        </form>
        {msg && <div className={`auth-msg ${msg.tipo}`}>{msg.texto}</div>}
        <div className="auth-alt">
          {modo === "entrar" ? (
            <>
              Ainda não tem conta?{" "}
              <button onClick={() => { setModo("cadastro"); setMsg(null); }}>Criar conta</button>
            </>
          ) : (
            <>
              Já tem conta?{" "}
              <button onClick={() => { setModo("entrar"); setMsg(null); }}>Entrar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
