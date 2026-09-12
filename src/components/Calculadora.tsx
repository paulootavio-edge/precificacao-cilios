"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { calc, custoAplicacao, money, money0, nBR, pctBR, type Atendimento, type Dados, type Gasto, type LancData, type Regime, HORIZONTE } from "@/lib/calc";
import { clonePadrao, migrarDados, novoId, STORAGE_KEY } from "@/lib/defaults";
import { AnoChart, MesChart } from "./LancCharts";
import { getSupabase } from "@/lib/supabase";
import PayChart from "./PayChart";

type CenarioMeta = { id: string; nome: string; updated_at: string };
type Aba = "visao" | "negocio" | "precos" | "insumos" | "projecao" | "lancamentos";

const ABAS: { id: Aba; label: string; titulo: string; sub: string }[] = [
  { id: "visao", label: "Visão geral", titulo: "Visão geral", sub: "Diagnóstico e indicadores do seu estúdio em agenda plena" },
  { id: "negocio", label: "Meu negócio", titulo: "Meu negócio", sub: "Regime tributário, agenda, custos fixos, investimento e metas" },
  { id: "precos", label: "Precificação", titulo: "Precificação por procedimento", sub: "Preços, duração, mix de agenda e a receita de insumos de cada procedimento" },
  { id: "insumos", label: "Insumos", titulo: "Catálogo de insumos", sub: "Os produtos que você compra: preço e rendimento viram custo por aplicação" },
  { id: "projecao", label: "Projeção", titulo: "Projeção e retorno", sub: "Caixa acumulado, payback do investimento e a evolução mês a mês" },
  { id: "lancamentos", label: "Lançamentos", titulo: "Lançamentos mensais", sub: "Registre a realidade de cada mês e compare com o que foi planejado" },
];

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ROTULO_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function rotuloMes(m: string): string {
  const [ano, mm] = m.split("-");
  return `${ROTULO_MES[+mm - 1] ?? mm}/${ano}`;
}

function Icone({ n }: { n: Aba | "sair" | "entrar" | "recolher" | "expandir" }) {
  const p = {
    visao: <><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></>,
    negocio: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></>,
    precos: <><path d="M20.59 13.41 12 22 2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.5" /></>,
    insumos: <><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" /><path d="M3.3 7 12 12l8.7-5" /><path d="M12 22V12" /></>,
    projecao: <><path d="M23 6 13.5 15.5 8.5 10.5 1 18" /><path d="M17 6h6v6" /></>,
    lancamentos: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6" /><path d="M9 16h6" /></>,
    sair: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
    entrar: <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></>,
    recolher: <><path d="M11 17l-5-5 5-5" /><path d="M18 17l-5-5 5-5" /></>,
    expandir: <><path d="M13 17l5-5-5-5" /><path d="M6 17l5-5-5-5" /></>,
  }[n];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {p}
    </svg>
  );
}

function parseNum(v: string): number {
  const x = parseFloat(v.replace(",", "."));
  return isFinite(x) ? x : 0;
}

function Num({
  label,
  hint,
  pfx,
  sfx,
  value,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  pfx?: string;
  sfx?: string;
  value: number;
  step?: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="in">
        {pfx && <span className="pfx">{pfx}</span>}
        <input
          type="number"
          step={step ?? "1"}
          defaultValue={value}
          onChange={(e) => onChange(parseNum(e.target.value))}
        />
        {sfx && <span className="sfx">{sfx}</span>}
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export default function Calculadora() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("visao");
  const [dados, setDados] = useState<Dados>(() => clonePadrao());
  const [versao, setVersao] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [authPronto, setAuthPronto] = useState(false);
  const [cenarios, setCenarios] = useState<CenarioMeta[]>([]);
  const [cenarioAtual, setCenarioAtual] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [nomeNovo, setNomeNovo] = useState<string>("");
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [sideMin, setSideMin] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [novoInsumoSel, setNovoInsumoSel] = useState("");
  const [lanc, setLanc] = useState<LancData>({ atendimentos: [], gastos: [] });
  const [lancStatus, setLancStatus] = useState("");
  const [negocioSync, setNegocioSync] = useState<"init" | "pronto">("init");
  const baseSyncRef = useRef<string>("");
  const [mesSel, setMesSel] = useState<string>(() => hojeISO().slice(0, 7));
  const [fa, setFa] = useState({
    data: hojeISO(),
    servico: "",
    valor: 0,
    cliente: "",
    itens: [] as { servico: string; valor: number }[],
  });
  const [fg, setFg] = useState<{ data: string; tipo: Gasto["tipo"]; desc: string; valor: number }>({
    data: hojeISO(),
    tipo: "insumos",
    desc: "",
    valor: 0,
  });
  const dadosRef = useRef(dados);
  dadosRef.current = dados;

  /* preferência da sidebar recolhida */
  useEffect(() => {
    try {
      setSideMin(localStorage.getItem("lashfinance:sidemin") === "1");
    } catch {}
  }, []);
  function alternarSide() {
    setSideMin((v) => {
      try {
        localStorage.setItem("lashfinance:sidemin", v ? "0" : "1");
      } catch {}
      return !v;
    });
  }

  /* localStorage: carrega no mount, salva com debounce */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setDados(migrarDados(JSON.parse(raw)));
        setVersao((v) => v + 1);
      }
    } catch {}
  }, []);

  /* lançamentos: cada registro é uma linha nas tabelas atendimentos/gastos do banco */
  useEffect(() => {
    if (!user) return;
    let ativo = true;
    (async () => {
      const supabase = getSupabase();
      const [at, ga] = await Promise.all([
        supabase.from("atendimentos").select("id, data, servico, valor, cliente").order("data"),
        supabase.from("gastos").select("id, data, tipo, descricao, valor").order("data"),
      ]);
      if (!ativo) return;
      if (at.error || ga.error) {
        setLancStatus("erro ao carregar lançamentos");
        return;
      }
      setLanc({
        atendimentos: (at.data ?? []).map((a) => ({
          id: a.id,
          data: a.data,
          servico: a.servico ?? "",
          valor: Number(a.valor) || 0,
          cliente: a.cliente ?? "",
        })),
        gastos: (ga.data ?? []).map((g) => ({
          id: g.id,
          data: g.data,
          tipo: g.tipo === "fixo" || g.tipo === "outro" ? g.tipo : "insumos",
          desc: g.descricao ?? "",
          valor: Number(g.valor) || 0,
        })),
      });
      setLancStatus("");
    })();
    return () => {
      ativo = false;
    };
  }, [user]);

  async function inserirAtendimentos(regs: Atendimento[]) {
    if (!user || regs.length === 0) return;
    setLanc((l) => ({ ...l, atendimentos: [...l.atendimentos, ...regs] }));
    setLancStatus("salvando...");
    const { error } = await getSupabase().from("atendimentos").insert(
      regs.map((a) => ({ id: a.id, user_id: user.id, data: a.data, servico: a.servico, valor: a.valor, cliente: a.cliente }))
    );
    if (error) {
      setLanc((l) => ({ ...l, atendimentos: l.atendimentos.filter((x) => !regs.some((r) => r.id === x.id)) }));
      setLancStatus("erro ao salvar");
    } else {
      setLancStatus("salvo na sua conta");
    }
  }

  async function inserirGasto(g: Gasto) {
    if (!user) return;
    setLanc((l) => ({ ...l, gastos: [...l.gastos, g] }));
    setLancStatus("salvando...");
    const { error } = await getSupabase()
      .from("gastos")
      .insert({ id: g.id, user_id: user.id, data: g.data, tipo: g.tipo, descricao: g.desc, valor: g.valor });
    if (error) {
      setLanc((l) => ({ ...l, gastos: l.gastos.filter((x) => x.id !== g.id) }));
      setLancStatus("erro ao salvar");
    } else {
      setLancStatus("salvo na sua conta");
    }
  }

  async function removerAtendimento(id: string) {
    setLancStatus("salvando...");
    const { error } = await getSupabase().from("atendimentos").delete().eq("id", id);
    if (!error) {
      setLanc((l) => ({ ...l, atendimentos: l.atendimentos.filter((x) => x.id !== id) }));
      setLancStatus("salvo na sua conta");
    } else {
      setLancStatus("erro ao excluir");
    }
  }

  async function removerGasto(id: string) {
    setLancStatus("salvando...");
    const { error } = await getSupabase().from("gastos").delete().eq("id", id);
    if (!error) {
      setLanc((l) => ({ ...l, gastos: l.gastos.filter((x) => x.id !== id) }));
      setLancStatus("salvo na sua conta");
    } else {
      setLancStatus("erro ao excluir");
    }
  }

  /* o formulário de atendimento nasce com o primeiro procedimento e o preço dele */
  useEffect(() => {
    if (!fa.servico && dados.servicos.length > 0) {
      setFa((f) => ({ ...f, servico: dados.servicos[0].n, valor: dados.servicos[0].p }));
    }
  }, [dados.servicos, fa.servico]);
  /* o negócio vivo da conta: carrega da nuvem ao entrar e salva sozinho a cada mudança */
  useEffect(() => {
    if (!user) {
      setNegocioSync("init");
      return;
    }
    let ativo = true;
    (async () => {
      const { data, error } = await getSupabase().from("negocio").select("dados").maybeSingle();
      if (!ativo) return;
      if (!error && data?.dados) {
        const migrado = migrarDados(data.dados);
        baseSyncRef.current = JSON.stringify(migrado);
        setDados(migrado);
        setVersao((v) => v + 1);
      }
      setNegocioSync("pronto");
    })();
    return () => {
      ativo = false;
    };
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
      } catch {}
      const atual = JSON.stringify(dados);
      if (user && negocioSync === "pronto" && atual !== baseSyncRef.current) {
        void getSupabase()
          .from("negocio")
          .upsert({ user_id: user.id, dados: { ...dados, sv: 4 } })
          .then(({ error }) => {
            if (!error) baseSyncRef.current = atual;
            setStatus(error ? "erro ao salvar" : "salvo automaticamente");
          });
      }
    }, 800);
    return () => clearTimeout(t);
  }, [dados, user, negocioSync]);

  /* sessão + cenários */
  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthPronto(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  /* app exige login: sem sessão, vai para /entrar */
  useEffect(() => {
    if (authPronto && !user) router.replace("/entrar");
  }, [authPronto, user, router]);

  useEffect(() => {
    if (!user) {
      setCenarios([]);
      setCenarioAtual("");
      return;
    }
    void carregarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function carregarLista() {
    const { data, error } = await getSupabase()
      .from("cenarios")
      .select("id, nome, updated_at")
      .order("updated_at", { ascending: false });
    if (!error && data) setCenarios(data as CenarioMeta[]);
  }

  async function salvarNovo() {
    if (!user) return;
    const nome = nomeNovo.trim() || "Meu estúdio";
    setStatus("salvando...");
    const { data, error } = await getSupabase()
      .from("cenarios")
      .insert({ user_id: user.id, nome, dados: dadosRef.current })
      .select("id")
      .single();
    if (error) {
      setStatus("erro ao salvar");
      return;
    }
    setCenarioAtual(data.id);
    setNomeNovo("");
    setStatus("salvo agora");
    void carregarLista();
  }

  async function sobrescrever() {
    if (!user || !cenarioAtual) return;
    setStatus("salvando...");
    const { error } = await getSupabase()
      .from("cenarios")
      .update({ dados: dadosRef.current })
      .eq("id", cenarioAtual);
    setStatus(error ? "erro ao salvar" : "salvo agora");
    if (!error) void carregarLista();
  }

  async function carregarCenario(id: string) {
    setCenarioAtual(id);
    setConfirmDelId(null);
    if (!id) return;
    const { data, error } = await getSupabase()
      .from("cenarios")
      .select("dados")
      .eq("id", id)
      .single();
    if (!error && data?.dados) {
      setDados(migrarDados(data.dados));
      setVersao((v) => v + 1);
      setStatus("cenário carregado");
    }
  }

  async function excluirCenario(id: string) {
    if (confirmDelId !== id) {
      setConfirmDelId(id);
      return;
    }
    setConfirmDelId(null);
    await getSupabase().from("cenarios").delete().eq("id", id);
    if (cenarioAtual === id) setCenarioAtual("");
    setStatus("cenário excluído");
    void carregarLista();
  }

  function restaurarPadrao() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    setDados(clonePadrao());
    setVersao((v) => v + 1);
    setStatus("");
  }

  async function sair() {
    await getSupabase().auth.signOut();
  }

  /* mutadores */
  const set = <K extends keyof Dados>(k: K, v: Dados[K]) =>
    setDados((d) => ({ ...d, [k]: v }));
  const remonta = () => setVersao((v) => v + 1);

  const r = useMemo(() => calc(dados), [dados]);
  const mixOk = Math.abs(r.mixSoma - 100) < 0.5;
  const infoAba = ABAS.find((a) => a.id === aba)!;

  /* diagnóstico */
  const sobra = r.lucroPlena - dados.proLabore;
  let verdictClass = "";
  let verdictBig: React.ReactNode;
  let verdictSub: string;
  if (r.lucroPlena <= 0) {
    verdictClass = "bad";
    verdictBig = (
      <>
        O estúdio <em>não se sustenta</em> nesses números
      </>
    );
    verdictSub = `Mesmo com agenda plena, o mês fecha em ${money(r.lucroPlena)}. Revise preços (coluna "Mínimo p/ meta" na Precificação), reduza custos fixos ou aumente a ocupação.`;
  } else if (sobra < 0) {
    verdictClass = "mid";
    verdictBig = (
      <>
        Lucra <em>{money0(r.lucroPlena)}</em>/mês, abaixo do seu pró-labore
      </>
    );
    verdictSub = `O estúdio se paga, mas sobra menos que os ${money0(dados.proLabore)} que você definiu como meta. Faltam ${money0(-sobra)}/mês: são ${r.contrib > 0 ? nBR(-sobra / r.contrib, 1) : "n/d"} atendimentos a mais, ou um reajuste médio de ${r.receitaPlena > 0 ? pctBR(-sobra / r.receitaPlena, 1) : "n/d"} nos preços.`;
  } else {
    verdictBig = (
      <>
        Lucra <em>{money0(r.lucroPlena)}</em> por mês em agenda plena
      </>
    );
    verdictSub = `Depois de pagar seu pró-labore de ${money0(dados.proLabore)}, ainda sobram ${money0(sobra)}/mês para reinvestir ou formar reserva. Margem líquida de ${pctBR(r.margemLiq, 1)}.`;
  }

  /* gate: nada renderiza antes da sessão ser resolvida */
  if (!authPronto || !user) {
    return (
      <div className="gate">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mark.svg" alt="INTERLASH" />
        <span>Lash Finance</span>
      </div>
    );
  }

  return (
    <div className="app">
      {/* ================= SIDEBAR ================= */}
      <aside className={`side${sideMin ? " min" : ""}`}>
        <div className="side-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark-mono.svg" alt="INTERLASH" />
          <span>Lash Finance</span>
          <button
            className="side-toggle"
            title={sideMin ? "Expandir menu" : "Recolher menu"}
            onClick={alternarSide}
          >
            <Icone n={sideMin ? "expandir" : "recolher"} />
          </button>
        </div>
        <nav>
          {ABAS.map((a) => (
            <button
              key={a.id}
              className={`side-item ${aba === a.id ? "on" : ""}`}
              title={a.label}
              onClick={() => setAba(a.id)}
            >
              <Icone n={a.id} />
              <span className="lbl">{a.label}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          {user ? (
            <>
              <span className="mail">{user.email}</span>
              <button onClick={() => void sair()} title="Sair">
                <Icone n="sair" />
                <span className="lbl">Sair</span>
              </button>
            </>
          ) : (
            <Link href="/entrar" title="Entrar">
              <Icone n="entrar" />
              <span className="lbl">Entrar / criar conta</span>
            </Link>
          )}
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <div className="main">
        <div className="mtop">
          <div>
            <h1>{infoAba.titulo}</h1>
            <div className="sub">{infoAba.sub}</div>
          </div>
          <div className="mtop-actions scenarios">
            {aba === "lancamentos" ? (
              <span className="sc-status">
                {lancStatus || "lançamentos salvos automaticamente na sua conta"}
              </span>
            ) : (
              <>
            <span className="sc-label">Cenário</span>
            {user ? (
              <>
                <div className="sc-dd">
                  <button
                    className="btn ghost mini"
                    onClick={() => {
                      setMenuAberto((v) => !v);
                      setConfirmDelId(null);
                    }}
                  >
                    {cenarios.find((c) => c.id === cenarioAtual)?.nome ?? "meu negócio (atual)"}
                    <span style={{ fontSize: ".55rem" }}>▾</span>
                  </button>
                  {menuAberto && (
                    <>
                      <div
                        className="sc-overlay"
                        onClick={() => {
                          setMenuAberto(false);
                          setConfirmDelId(null);
                        }}
                      />
                      <div className="sc-menu">
                        <button
                          className="sc-nome"
                          onClick={() => {
                            setCenarioAtual("");
                            setMenuAberto(false);
                          }}
                        >
                          meu negócio (atual)
                        </button>
                        {cenarios.map((c) => (
                          <div className={`sc-row${c.id === cenarioAtual ? " atual" : ""}`} key={c.id}>
                            <button
                              className="sc-nome"
                              onClick={() => {
                                void carregarCenario(c.id);
                                setMenuAberto(false);
                              }}
                            >
                              {c.nome}
                            </button>
                            <button
                              className={`sc-del${confirmDelId === c.id ? " on" : ""}`}
                              title="Excluir cenário"
                              onClick={() => void excluirCenario(c.id)}
                            >
                              {confirmDelId === c.id ? "confirmar?" : "excluir"}
                            </button>
                          </div>
                        ))}
                        {cenarios.length === 0 && (
                          <div className="sc-vazio">nenhum cenário salvo ainda</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                {cenarioAtual && (
                  <button className="btn mini" onClick={() => void sobrescrever()}>
                    Salvar
                  </button>
                )}
                <input
                  type="text"
                  placeholder="nome do novo cenário"
                  value={nomeNovo}
                  onChange={(e) => setNomeNovo(e.target.value)}
                />
                <button className="btn gold mini" onClick={() => void salvarNovo()}>
                  Salvar como novo
                </button>
              </>
            ) : (
              <span className="sc-status">salvo neste navegador</span>
            )}
            <button
              className="btn ghost mini"
              style={confirmReset ? { borderColor: "var(--amber)", color: "var(--amber)" } : undefined}
              onClick={restaurarPadrao}
            >
              {confirmReset ? "Confirmar? Apaga a tela" : "Restaurar exemplo"}
            </button>
            {status && <span className="sc-status">{status}</span>}
              </>
            )}
          </div>
        </div>

        <div className="content stack">
          {/* ================= VISÃO GERAL ================= */}
          {aba === "visao" && (
            <>
              {dados.regime === "mei" && r.meiEstourado && (
                <div className="banner warn">
                  Atenção: com agenda plena você fatura {money0(r.receitaAnual)}/ano, acima do teto
                  do MEI (R$ 81.000). Nesse ritmo será preciso migrar para o Simples Nacional; veja o
                  comparador de regimes abaixo.
                </div>
              )}
              {r.mixSoma <= 0 && (
                <div className="banner err">
                  Nenhum procedimento com fatia de agenda (Mix %). Defina o mix na aba Precificação
                  para o cálculo mensal funcionar.
                </div>
              )}

              <div className="panel">
                <div className={`verdict ${verdictClass}`}>
                  <div className="label">Diagnóstico do mês em agenda plena</div>
                  <div className="big">{verdictBig}</div>
                  <div className="sub">{verdictSub}</div>
                </div>
              </div>

              <div className="cards4">
                <div className="scard">
                  <div className="sc-k">Lucro líquido / mês</div>
                  <div className={`sc-v hero${r.lucroPlena < 0 ? " neg" : " gain"}`}>{money0(r.lucroPlena)}</div>
                  <div className="sc-n">após insumos, impostos, cartão e fixos</div>
                </div>
                <div className="scard">
                  <div className="sc-k">Faturamento / mês</div>
                  <div className="sc-v hero">{money0(r.receitaPlena)}</div>
                  <div className="sc-n">
                    {nBR(r.atendPlena, 0)} atendimentos · {nBR(r.horasProd, 0)}h produtivas
                  </div>
                </div>
                <div className="scard">
                  <div className="sc-k">Payback do investimento</div>
                  {r.invest <= 0 ? (
                    <>
                      <div className="sc-v hero">···</div>
                      <div className="sc-n">nenhum valor em investimento inicial</div>
                    </>
                  ) : r.payback !== null ? (
                    <>
                      <div className="sc-v hero">
                        {r.payback} {r.payback === 1 ? "mês" : "meses"}
                      </div>
                      <div className="sc-n">recupera os {money0(r.invest)} investidos</div>
                    </>
                  ) : (
                    <>
                      <div className="sc-v neg">&gt; {HORIZONTE} meses</div>
                      <div className="sc-n">o caixa não cobre {money0(r.invest)}</div>
                    </>
                  )}
                </div>
                <div className="scard">
                  <div className="sc-k">ROI em 12 meses</div>
                  <div className={`sc-v hero${r.roi12 !== null && r.roi12 < 0 ? " neg" : " gain"}`}>
                    {r.roi12 === null ? "···" : pctBR(r.roi12, 0)}
                  </div>
                  <div className="sc-n">lucro acumulado ÷ investimento inicial</div>
                </div>
              </div>

              <div className="cards4">
                <div className="scard">
                  <div className="sc-k">Ponto de equilíbrio</div>
                  <div className={`sc-v mono${isFinite(r.be) ? (r.atendPlena >= r.be ? "" : " neg") : " neg"}`}>
                    {isFinite(r.be) ? `${nBR(Math.ceil(r.be), 0)} atend./mês` : "inatingível"}
                  </div>
                  <div className="sc-n">
                    {isFinite(r.be)
                      ? `você comporta ${nBR(r.atendPlena, 0)} em agenda plena`
                      : "a margem por atendimento é negativa"}
                  </div>
                </div>
                <div className="scard">
                  <div className="sc-k">Equilíbrio + pró-labore</div>
                  <div className={`sc-v mono${isFinite(r.bePL) ? (r.atendPlena >= r.bePL ? "" : " warn") : " neg"}`}>
                    {isFinite(r.bePL) ? `${nBR(Math.ceil(r.bePL), 0)} atend./mês` : "inatingível"}
                  </div>
                  <div className="sc-n">para pagar os custos e o seu pró-labore</div>
                </div>
                <div className="scard">
                  <div className="sc-k">Valor da sua hora</div>
                  <div className={`sc-v mono${r.lucroPlena < 0 ? " neg" : " gain"}`}>
                    {r.horasAtendidas > 0 ? `${money(r.lucroHora)}/h` : "···"}
                  </div>
                  <div className="sc-n">lucro mensal ÷ horas atendidas</div>
                </div>
                <div className="scard">
                  <div className="sc-k">Ticket médio</div>
                  <div className="sc-v mono">{money(r.ticket)}</div>
                  <div className="sc-n">duração média de {nBR(r.durMedia, 1)}h por atendimento</div>
                </div>
                <div className="scard">
                  <div className="sc-k">Custo do estúdio por hora</div>
                  <div className="sc-v mono">{money(r.custoHora)}/h</div>
                  <div className="sc-n">fixos ÷ horas produtivas do mês</div>
                </div>
                <div className="scard">
                  <div className="sc-k">Insumos / receita</div>
                  <div className={`sc-v mono${r.matPct > 0.15 ? " warn" : ""}`}>{pctBR(r.matPct, 1)}</div>
                  <div className="sc-n">{money0(r.matPlena)}/mês · saudável até ~15%</div>
                </div>
                <div className="scard">
                  <div className="sc-k">Impostos / mês</div>
                  <div className="sc-v mono">{money0(r.impPlena + r.dasFixo)}</div>
                  <div className="sc-n">
                    {dados.regime === "mei"
                      ? `DAS fixo de ${money0(r.dasFixo)}`
                      : dados.regime === "simples"
                        ? `alíquota efetiva de ${pctBR(r.aliqEf, 2)}`
                        : `carga estimada de ${pctBR(r.aliqEf, 1)}`}
                  </div>
                </div>
                <div className="scard">
                  <div className="sc-k">Margem líquida</div>
                  <div className={`sc-v mono${r.margemLiq < 0 ? " neg" : " gain"}`}>{pctBR(r.margemLiq, 1)}</div>
                  <div className="sc-n">lucro ÷ faturamento, agenda plena</div>
                </div>
              </div>

              <div className="panel">
                <h2>Comparador de regimes com a sua receita</h2>
                <div className="p-desc">
                  Imposto mensal estimado em cada regime, com a receita projetada em agenda plena.
                  Estimativa para orientar a conversa com o contador, não substitui a apuração
                  oficial.
                </div>
                <div className="regimes">
                  {r.comparador.map((c, i) => (
                    <div className={`regime ${i === r.melhorRegime ? "best" : ""}`} key={c.id}>
                      {i === r.melhorRegime && <span className="tag">MENOR CUSTO</span>}
                      <h3>
                        {c.nome} {c.id === dados.regime && <small>(atual)</small>}
                      </h3>
                      <div className="rv">{money0(c.custo)}/mês</div>
                      <div className="rd">{c.det}</div>
                      {c.alerta && <div className="alert">{c.alerta}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ================= MEU NEGÓCIO ================= */}
          {aba === "negocio" && (
            <div className="cols2">
              <div className="stack">
                <div className="panel">
                  <h2>Regime tributário</h2>
                  <div className="p-desc">Como o seu negócio é formalizado define quanto imposto sai de cada atendimento.</div>
                  <div className="seg">
                    {(
                      [
                        ["mei", "MEI"],
                        ["simples", "Simples Nacional"],
                        ["autonomo", "Autônoma s/ CNPJ"],
                      ] as [Regime, string][]
                    ).map(([id, nome]) => (
                      <button
                        key={id}
                        type="button"
                        className={dados.regime === id ? "on" : ""}
                        onClick={() => set("regime", id)}
                      >
                        {nome}
                      </button>
                    ))}
                  </div>
                  {dados.regime === "mei" && (
                    <Num
                      label="DAS mensal (valor fixo do MEI)"
                      pfx="R$"
                      value={dados.dasMei}
                      onChange={(n) => set("dasMei", n)}
                      hint="5% do salário mínimo + R$ 5 de ISS. Limite: R$ 81.000/ano (~R$ 6.750/mês). O DAS entra como custo fixo: no MEI o imposto não cresce com a receita."
                    />
                  )}
                  {dados.regime === "simples" && (
                    <>
                      <div className="field">
                        <label>Alíquota efetiva (Anexo III, calculada pela receita)</label>
                        <div className="in">
                          <input type="text" readOnly value={(r.aliqEf * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} />
                          <span className="sfx">% da receita</span>
                        </div>
                        <div className="hint">
                          Calculada pela receita projetada (RBT12 = receita mensal × 12). 1ª faixa:
                          6% até R$ 180 mil/ano. Confirme o anexo com o seu contador.
                        </div>
                      </div>
                      <Num
                        label="Honorários do contador"
                        pfx="R$"
                        sfx="/mês"
                        step="50"
                        value={dados.contador}
                        onChange={(n) => set("contador", n)}
                        hint="Fora do MEI, contabilidade é praticamente obrigatória. Entra nos custos fixos."
                      />
                    </>
                  )}
                  {dados.regime === "autonomo" && (
                    <Num
                      label="Carga total estimada (ISS + INSS + IRPF)"
                      sfx="% da receita"
                      step="0.5"
                      value={dados.cargaAutonomo}
                      onChange={(n) => set("cargaAutonomo", n)}
                      hint="Sem CNPJ: ISS municipal (2 a 5%), INSS de contribuinte individual e carnê-leão. 16% é uma estimativa conservadora; valide com um contador."
                    />
                  )}
                  <div className="row2">
                    <Num label="Taxa média do cartão/Pix" sfx="%" step="0.1" value={dados.taxaCartao} onChange={(n) => set("taxaCartao", n)} hint="Média entre débito, crédito e parcelado." />
                    <Num label="Receita paga em cartão" sfx="%" step="5" value={dados.pctCartao} onChange={(n) => set("pctCartao", n)} hint="O resto (Pix/dinheiro) não paga taxa." />
                  </div>
                </div>

                <div className="panel">
                  <h2>Agenda e capacidade</h2>
                  <div className="p-desc">Quanto tempo de atendimento realmente existe no seu mês.</div>
                  <div className="row2">
                    <Num label="Dias de atendimento" sfx="/semana" value={dados.diasSemana} onChange={(n) => set("diasSemana", n)} />
                    <Num label="Horas disponíveis" sfx="h/dia" step="0.5" value={dados.horasDia} onChange={(n) => set("horasDia", n)} />
                  </div>
                  <div className="row2">
                    <Num label="Ocupação da agenda (plena)" sfx="%" step="5" value={dados.ocupacao} onChange={(n) => set("ocupacao", n)} hint="Ninguém fecha 100%: buracos, faltas, intervalos." />
                    <Num label="Faltas e cancelamentos" sfx="%" value={dados.faltas} onChange={(n) => set("faltas", n)} hint="Horário perdido que não gera receita." />
                  </div>
                  <div className="row2">
                    <Num label="Ocupação no 1º mês" sfx="%" step="5" value={dados.ocupIni} onChange={(n) => set("ocupIni", n)} hint="Começo de carteira: agenda ainda vazia." />
                    <Num label="Meses até agenda plena" sfx="meses" value={dados.rampaMeses} onChange={(n) => set("rampaMeses", n)} hint="Crescimento linear até a ocupação plena." />
                  </div>
                </div>

                <div className="panel">
                  <h2>Metas</h2>
                  <div className="p-desc">Referências que o sistema usa para avaliar o resultado.</div>
                  <div className="row2">
                    <Num label="Margem líquida alvo por procedimento" sfx="%" value={dados.margemAlvo} onChange={(n) => set("margemAlvo", n)} hint="Usada no preço mínimo sugerido." />
                    <Num label="Pró-labore desejado" pfx="R$" sfx="/mês" step="100" value={dados.proLabore} onChange={(n) => set("proLabore", n)} hint="Quanto você quer tirar para viver." />
                  </div>
                </div>
              </div>

              <div className="stack">
                <div className="panel">
                  <h2>Custos fixos do estúdio</h2>
                  <div className="p-desc">O que você paga todo mês mesmo sem nenhum atendimento.</div>
                  <div className="list-head cols2">
                    <span>Item</span>
                    <span style={{ textAlign: "right" }}>R$/mês</span>
                    <span />
                  </div>
                  {dados.fixos.map((f, i) => (
                    <div className="list-item cols2" key={`f-${versao}-${i}`}>
                      <input
                        type="text"
                        defaultValue={f.n}
                        aria-label="Nome do custo"
                        onChange={(e) =>
                          setDados((d) => {
                            const fixos = [...d.fixos];
                            fixos[i] = { ...fixos[i], n: e.target.value };
                            return { ...d, fixos };
                          })
                        }
                      />
                      <div className="in">
                        <span className="pfx">R$</span>
                        <input
                          type="number"
                          step="10"
                          defaultValue={f.v}
                          onChange={(e) =>
                            setDados((d) => {
                              const fixos = [...d.fixos];
                              fixos[i] = { ...fixos[i], v: parseNum(e.target.value) };
                              return { ...d, fixos };
                            })
                          }
                        />
                      </div>
                      <button
                        className="del-btn"
                        title="Remover"
                        onClick={() => {
                          setDados((d) => ({ ...d, fixos: d.fixos.filter((_, j) => j !== i) }));
                          remonta();
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    className="add-btn"
                    onClick={() => {
                      setDados((d) => ({ ...d, fixos: [...d.fixos, { n: "Novo custo", v: 0 }] }));
                      remonta();
                    }}
                  >
                    + adicionar custo fixo
                  </button>
                  <div className="list-total">
                    <span>
                      Total de custos fixos{" "}
                      {r.dasFixo > 0
                        ? `(inclui DAS de ${money0(r.dasFixo)})`
                        : r.contadorMes > 0
                          ? `(inclui contador de ${money0(r.contadorMes)})`
                          : ""}
                    </span>
                    <strong>{money(r.fixosTotais)}</strong>
                  </div>
                </div>

                <div className="panel">
                  <h2>Investimento inicial</h2>
                  <div className="p-desc">Tudo que você gastou (ou vai gastar) para montar o estúdio. É o valor que o payback recupera.</div>
                  <div className="list-head cols2">
                    <span>Item</span>
                    <span style={{ textAlign: "right" }}>Valor</span>
                    <span />
                  </div>
                  {dados.capex.map((c, i) => (
                    <div className="list-item cols2" key={`c-${versao}-${i}`}>
                      <input
                        type="text"
                        defaultValue={c.n}
                        aria-label="Nome do item"
                        onChange={(e) =>
                          setDados((d) => {
                            const capex = [...d.capex];
                            capex[i] = { ...capex[i], n: e.target.value };
                            return { ...d, capex };
                          })
                        }
                      />
                      <div className="in">
                        <span className="pfx">R$</span>
                        <input
                          type="number"
                          step="50"
                          defaultValue={c.v}
                          onChange={(e) =>
                            setDados((d) => {
                              const capex = [...d.capex];
                              capex[i] = { ...capex[i], v: parseNum(e.target.value) };
                              return { ...d, capex };
                            })
                          }
                        />
                      </div>
                      <button
                        className="del-btn"
                        title="Remover"
                        onClick={() => {
                          setDados((d) => ({ ...d, capex: d.capex.filter((_, j) => j !== i) }));
                          remonta();
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    className="add-btn"
                    onClick={() => {
                      setDados((d) => ({ ...d, capex: [...d.capex, { n: "Novo item", v: 0 }] }));
                      remonta();
                    }}
                  >
                    + adicionar item
                  </button>
                  <div className="list-total">
                    <span>Total investido</span>
                    <strong>{money(r.invest)}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= PRECIFICAÇÃO ================= */}
          {aba === "precos" && (
            <div className="panel">
              <h2>Procedimentos e preços</h2>
              <div className="p-desc">
                As colunas com fundo claro são suas: edite nome, preço, duração e fatia da agenda, e
                adicione ou remova procedimentos. Clique no valor de Insumos para abrir a receita do
                procedimento e dizer quanto de cada produto ele gasta.
              </div>
              <div className="tbl-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Procedimento</th>
                      <th>Preço (R$)</th>
                      <th>Duração (h)</th>
                      <th>Mix (%)</th>
                      <th>Insumos</th>
                      <th>Custo hora</th>
                      <th>Imposto</th>
                      <th>Cartão</th>
                      <th>Lucro</th>
                      <th>Margem</th>
                      <th>Mínimo p/ meta</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {dados.servicos.map((s, i) => {
                      const l = r.linhas[i];
                      const editaSvc = (campo: "n" | "p" | "d" | "m", valor: string) =>
                        setDados((d) => {
                          const servicos = [...d.servicos];
                          servicos[i] = {
                            ...servicos[i],
                            [campo]: campo === "n" ? valor : parseNum(valor),
                          };
                          return { ...d, servicos };
                        });
                      const aberto = expandido === i;
                      return (
                        <React.Fragment key={`s-${versao}-${i}`}>
                          <tr>
                            <td className="edit">
                              <input
                                className="tin name"
                                type="text"
                                defaultValue={s.n}
                                aria-label="Nome do procedimento"
                                onChange={(e) => editaSvc("n", e.target.value)}
                              />
                            </td>
                            <td className="edit">
                              <input className="tin" type="number" step="5" defaultValue={s.p} aria-label="Preço" onChange={(e) => editaSvc("p", e.target.value)} />
                            </td>
                            <td className="edit">
                              <input className="tin" type="number" step="0.25" defaultValue={s.d} aria-label="Duração em horas" onChange={(e) => editaSvc("d", e.target.value)} />
                            </td>
                            <td className="edit">
                              <input className="tin" type="number" step="1" defaultValue={s.m} aria-label="Fatia da agenda em porcento" onChange={(e) => editaSvc("m", e.target.value)} />
                            </td>
                            <td className="edit">
                              <button
                                className={`insumos-btn ${aberto ? "open" : ""}`}
                                title="Personalizar os insumos deste procedimento"
                                onClick={() => {
                                  setExpandido(aberto ? null : i);
                                  setNovoInsumoSel("");
                                }}
                              >
                                {Object.keys(s.consumo ?? {}).length === 0 ? "+ incluir insumos" : money(l.mat)}{" "}
                                <span className="chev">▾</span>
                              </button>
                            </td>
                            <td>{money(l.tempo)}</td>
                            <td>{money(l.imposto)}</td>
                            <td>{money(l.cartao)}</td>
                            <td className={l.lucro >= 0 ? "pos" : "neg"}>{money(l.lucro)}</td>
                            <td className={l.margem >= dados.margemAlvo / 100 ? "pos" : l.margem >= 0 ? "warn" : "neg"}>
                              {pctBR(l.margem, 0)}
                            </td>
                            <td className="sug">{l.minimo !== null ? money0(l.minimo) : "n/d"}</td>
                            <td>
                              <button
                                className="del-btn"
                                title="Remover procedimento"
                                onClick={() => {
                                  setExpandido(null);
                                  setDados((d) => ({ ...d, servicos: d.servicos.filter((_, j) => j !== i) }));
                                  remonta();
                                }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                          {aberto && (
                            <tr className="consumo-tr">
                              <td colSpan={12}>
                                <div className="cp-title">
                                  Receita de insumos de <strong>{s.n}</strong>: só o que esta técnica
                                  usa. Ajuste a quantidade de cada item (frações valem: 0,5 = metade
                                  de uma aplicação), remova com o × e inclua outros insumos do seu
                                  catálogo quando quiser.
                                </div>
                                {(() => {
                                  const consumo = s.consumo ?? {};
                                  const naReceita = dados.produtos.filter((p) => p.id in consumo);
                                  const foraDaReceita = dados.produtos.filter((p) => !(p.id in consumo));
                                  const selecionado = novoInsumoSel && foraDaReceita.some((p) => p.id === novoInsumoSel)
                                    ? novoInsumoSel
                                    : foraDaReceita[0]?.id ?? "";
                                  return (
                                    <>
                                      {naReceita.length > 0 ? (
                                        <div className="cp-grid">
                                          <div className="cp-head">
                                            <span>Insumo</span>
                                            <span>Qtd/aplicação</span>
                                            <span>Custo</span>
                                            <span />
                                          </div>
                                          {naReceita.map((p) => {
                                            const custoApl = custoAplicacao(p);
                                            const qtd = consumo[p.id] ?? 0;
                                            return (
                                              <div className="cp-item" key={`${p.id}-${versao}`}>
                                                <span className="cp-nome">{p.n}</span>
                                                <input
                                                  className="tin"
                                                  type="number"
                                                  step="0.1"
                                                  min="0"
                                                  defaultValue={qtd}
                                                  aria-label={`Quantidade de ${p.n}`}
                                                  onChange={(e) => {
                                                    const v = parseNum(e.target.value);
                                                    setDados((d) => {
                                                      const servicos = [...d.servicos];
                                                      servicos[i] = {
                                                        ...servicos[i],
                                                        consumo: { ...servicos[i].consumo, [p.id]: v },
                                                      };
                                                      return { ...d, servicos };
                                                    });
                                                  }}
                                                />
                                                <span className="cp-sub">{money(qtd * custoApl)}</span>
                                                <button
                                                  className="del-btn"
                                                  title={`Tirar ${p.n} desta técnica`}
                                                  onClick={() =>
                                                    setDados((d) => {
                                                      const servicos = [...d.servicos];
                                                      const novoConsumo = { ...servicos[i].consumo };
                                                      delete novoConsumo[p.id];
                                                      servicos[i] = { ...servicos[i], consumo: novoConsumo };
                                                      return { ...d, servicos };
                                                    })
                                                  }
                                                >
                                                  ×
                                                </button>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="sc-status">
                                          esta técnica ainda não tem insumos: inclua abaixo os que ela usa
                                        </div>
                                      )}
                                      <div className="cp-add">
                                        {foraDaReceita.length > 0 && (
                                          <div className="cp-add-row">
                                            <select
                                              className="fsel"
                                              value={selecionado}
                                              aria-label="Insumo do catálogo para incluir"
                                              onChange={(e) => setNovoInsumoSel(e.target.value)}
                                            >
                                              {foraDaReceita.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                  {p.n} ({money(custoAplicacao(p))}/aplicação)
                                                </option>
                                              ))}
                                            </select>
                                            <button
                                              className="add-btn"
                                              onClick={() => {
                                                if (!selecionado) return;
                                                setDados((d) => {
                                                  const servicos = [...d.servicos];
                                                  servicos[i] = {
                                                    ...servicos[i],
                                                    consumo: { ...servicos[i].consumo, [selecionado]: 1 },
                                                  };
                                                  return { ...d, servicos };
                                                });
                                                setNovoInsumoSel("");
                                              }}
                                            >
                                              + incluir nesta técnica
                                            </button>
                                          </div>
                                        )}
                                        {foraDaReceita.length === 0 && (
                                          <div className="cp-add-row">
                                            <span className="cp-add-hint">
                                              Todos os insumos do seu catálogo já estão nesta técnica.
                                            </span>
                                          </div>
                                        )}
                                        <div className="cp-add-hint">
                                          Falta algum produto? O cadastro é feito no{" "}
                                          <button className="cp-link" onClick={() => setAba("insumos")}>
                                            catálogo de insumos
                                          </button>
                                          ; depois é só voltar aqui e incluir na técnica.
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}
                                <div className="cp-total">
                                  <span>Custo de insumos por aplicação de {s.n}</span>
                                  <strong>{money(l.mat)}</strong>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="tbl-actions">
                <button
                  className="add-btn"
                  onClick={() => {
                    setExpandido(null);
                    setDados((d) => ({
                      ...d,
                      servicos: [
                        ...d.servicos,
                        { n: "Novo procedimento", p: 100, d: 2, m: 0, consumo: {} },
                      ],
                    }));
                    remonta();
                  }}
                >
                  + adicionar procedimento
                </button>
                <div className={`mix-note ${mixOk ? "ok" : "bad"}`}>
                  {mixOk
                    ? "Mix soma 100%. Perfeito."
                    : `Mix soma ${nBR(r.mixSoma, 0)}%. O cálculo normaliza as fatias proporcionalmente.`}
                </div>
              </div>
              <div className="hint" style={{ fontSize: ".68rem", color: "var(--faint)", marginTop: 12 }}>
                Duração inclui recepção e limpeza da maca. Mix = fatia da sua agenda. Insumos = soma
                de quantidade × custo por aplicação de cada produto da receita do procedimento.
                Custo hora = duração × custo do estúdio por hora produtiva. No MEI o imposto por
                procedimento é R$ 0 porque o DAS é fixo e já está nos custos. Mínimo p/ meta = menor
                preço que ainda entrega a margem alvo depois de todos os custos.
              </div>
            </div>
          )}

          {/* ================= INSUMOS ================= */}
          {aba === "insumos" && (
            <div className="panel">
              <h2>Catálogo de insumos</h2>
              <div className="p-desc">
                Cadastre os produtos que você compra: o preço da unidade e quantas aplicações ela
                rende. O custo por aplicação sai sozinho. A quantidade que cada procedimento usa
                fica na aba Precificação, na receita de cada procedimento.
              </div>
              <div className="tbl-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Preço (R$)</th>
                      <th>Rende (aplicações)</th>
                      <th>Custo por aplicação</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {dados.produtos.map((p, i) => (
                      <tr key={`p-${versao}-${i}`}>
                        <td className="edit">
                          <input
                            className="tin name"
                            type="text"
                            defaultValue={p.n}
                            aria-label="Nome do produto"
                            style={{ width: 220 }}
                            onChange={(e) =>
                              setDados((d) => {
                                const produtos = [...d.produtos];
                                produtos[i] = { ...produtos[i], n: e.target.value };
                                return { ...d, produtos };
                              })
                            }
                          />
                        </td>
                        <td className="edit">
                          <input
                            className="tin"
                            type="number"
                            step="1"
                            defaultValue={p.v}
                            aria-label="Preço do produto"
                            onChange={(e) =>
                              setDados((d) => {
                                const produtos = [...d.produtos];
                                produtos[i] = { ...produtos[i], v: parseNum(e.target.value) };
                                return { ...d, produtos };
                              })
                            }
                          />
                        </td>
                        <td className="edit">
                          <input
                            className="tin"
                            type="number"
                            step="1"
                            defaultValue={p.r}
                            aria-label="Rendimento em aplicações"
                            onChange={(e) =>
                              setDados((d) => {
                                const produtos = [...d.produtos];
                                produtos[i] = { ...produtos[i], r: parseNum(e.target.value) };
                                return { ...d, produtos };
                              })
                            }
                          />
                        </td>
                        <td>{money(custoAplicacao(p))}</td>
                        <td>
                          <button
                            className="del-btn"
                            title="Remover produto de todas as receitas"
                            onClick={() => {
                              setDados((d) => ({
                                ...d,
                                produtos: d.produtos.filter((_, j) => j !== i),
                                servicos: d.servicos.map((s) => {
                                  const consumo = { ...s.consumo };
                                  delete consumo[p.id];
                                  return { ...s, consumo };
                                }),
                              }));
                              remonta();
                            }}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="tbl-actions">
                <button
                  className="add-btn"
                  onClick={() => {
                    setDados((d) => ({
                      ...d,
                      produtos: [...d.produtos, { id: novoId(), n: "Novo insumo", v: 0, r: 1 }],
                    }));
                    remonta();
                  }}
                >
                  + adicionar insumo
                </button>
                <span className="sc-status">
                  Somando 1 aplicação de cada insumo: {money(r.kitBase)} (referência)
                </span>
              </div>
            </div>
          )}

          {/* ================= PROJEÇÃO ================= */}
          {aba === "projecao" && (
            <>
              <div className="panel">
                <h2>Caixa acumulado e payback</h2>
                <div className="p-desc">
                  A linha parte do investimento inicial negativo e sobe conforme o lucro entra,
                  respeitando a rampa de ocupação da agenda.
                </div>
                <PayChart serie={r.serie} payback={r.payback} />
                <div className="legend">
                  <span>
                    <i style={{ background: "#157347" }} />
                    Caixa acumulado (após investimento)
                  </span>
                  <span>
                    <i style={{ background: "#141414", height: 2 }} />
                    Zero
                  </span>
                  <span>
                    <i style={{ background: "#0d5c38", height: 10, width: 10, borderRadius: "50%" }} />
                    Payback
                  </span>
                </div>
              </div>

              <div className="panel">
                <h2>Projeção mês a mês (24 meses)</h2>
                <div className="p-desc">Linha destacada = mês em que o investimento se paga.</div>
                <div className="tbl-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th>Ocupação</th>
                        <th>Atend.</th>
                        <th>Receita</th>
                        <th>Insumos</th>
                        <th>Impostos</th>
                        <th>Cartão</th>
                        <th>Fixos</th>
                        <th>Lucro</th>
                        <th>Acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.serie.map((row) => (
                        <tr key={row.m} className={row.m === r.payback ? "brk" : ""}>
                          {row.m === 0 ? (
                            <>
                              <td>0</td>
                              <td>···</td>
                              <td>···</td>
                              <td>···</td>
                              <td>···</td>
                              <td>···</td>
                              <td>···</td>
                              <td>···</td>
                              <td className="neg">{money(-r.invest)}</td>
                              <td className="neg">{money(-r.invest)}</td>
                            </>
                          ) : (
                            <>
                              <td>{row.m}</td>
                              <td>{pctBR(row.ocup, 0)}</td>
                              <td>{nBR(row.at, 0)}</td>
                              <td>{money(row.receita)}</td>
                              <td>{money(row.mat > 0 ? -row.mat : 0)}</td>
                              <td>{money(row.imp > 0 ? -row.imp : 0)}</td>
                              <td>{money(row.card > 0 ? -row.card : 0)}</td>
                              <td>{money(row.fixos > 0 ? -row.fixos : 0)}</td>
                              <td className={row.lucro >= 0 ? "pos" : "neg"}>{money(row.lucro)}</td>
                              <td className={row.acum >= 0 ? "pos" : "neg"}>{money(row.acum)}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <footer className="metodo">
                <strong>Como o cálculo funciona:</strong> horas produtivas = dias × horas × 4,33
                semanas × ocupação × (1 − faltas). O mix define quantos atendimentos de cada
                procedimento cabem nessas horas. Insumos = a receita de cada procedimento:
                quantidade de cada produto × custo por aplicação (preço ÷ rendimento). Impostos: MEI
                entra como valor fixo nos custos; Simples usa a alíquota efetiva do Anexo III
                calculada sobre a receita anualizada (RBT12); autônoma usa a carga estimada
                informada. O payback considera a rampa de ocupação: nos primeiros meses a agenda
                está mais vazia e o lucro é menor. <strong>Importante:</strong> valores de impostos
                são estimativas para planejamento; a apuração oficial depende do seu município,
                anexo e faturamento acumulado. Confirme com um contador antes de formalizar ou
                migrar de regime.
              </footer>
            </>
          )}

          {/* ================= LANÇAMENTOS (CRM) ================= */}
          {aba === "lancamentos" && (() => {
            const mesDe = (d: string) => d.slice(0, 7);
            const atMes = lanc.atendimentos
              .filter((a) => mesDe(a.data) === mesSel)
              .sort((a, b) => a.data.localeCompare(b.data));
            const gaMes = lanc.gastos
              .filter((g) => mesDe(g.data) === mesSel)
              .sort((a, b) => a.data.localeCompare(b.data));
            const recMes = atMes.reduce((sum, a) => sum + a.valor, 0);
            const gasMes = gaMes.reduce((sum, g) => sum + g.valor, 0);
            const resMes = recMes - gasMes;
            const mesesSet = new Set<string>([mesSel, hojeISO().slice(0, 7)]);
            lanc.atendimentos.forEach((a) => mesesSet.add(mesDe(a.data)));
            lanc.gastos.forEach((g) => mesesSet.add(mesDe(g.data)));
            const meses = Array.from(mesesSet).sort().reverse();
            const precoDe = (nome: string) => dados.servicos.find((sv) => sv.n === nome)?.p ?? 0;
            const tipoRotulo: Record<Gasto["tipo"], string> = { insumos: "Insumos", fixo: "Custo fixo", outro: "Outro" };
            const itensDoLancamento =
              fa.itens.length > 0 ? fa.itens : fa.servico ? [{ servico: fa.servico, valor: fa.valor }] : [];
            const totalLancamento = itensDoLancamento.reduce((sum, it) => sum + it.valor, 0);
            const addAtendimento = () => {
              if (!fa.data || itensDoLancamento.length === 0) return;
              void inserirAtendimentos(
                itensDoLancamento.map((it) => ({
                  id: crypto.randomUUID(),
                  data: fa.data,
                  servico: it.servico,
                  valor: it.valor,
                  cliente: fa.cliente.trim(),
                }))
              );
              setMesSel(mesDe(fa.data));
              setFa((f) => ({ ...f, cliente: "", itens: [] }));
            };
            const addItem = () =>
              setFa((f) =>
                f.servico ? { ...f, itens: [...f.itens, { servico: f.servico, valor: f.valor }] } : f
              );
            const addGasto = () => {
              if (!fg.data || fg.valor <= 0) return;
              void inserirGasto({
                id: crypto.randomUUID(),
                data: fg.data,
                tipo: fg.tipo,
                desc: fg.desc.trim() || tipoRotulo[fg.tipo],
                valor: fg.valor,
              });
              setMesSel(mesDe(fg.data));
              setFg((f) => ({ ...f, desc: "", valor: 0 }));
            };
            return (
              <>
                <div className="cols2">
                  <div className="panel">
                    <h2>Lançar atendimento</h2>
                    <div className="p-desc">
                      Terminou um atendimento? Registre aqui. A cliente fez mais de um procedimento
                      no dia? Use o "+ adicionar" e lance todos de uma vez: é o seu CRM nascendo.
                    </div>
                    <div className="lanc-form">
                      <div className="lf">
                        <label>Data</label>
                        <input className="fsel" type="date" value={fa.data} onChange={(e) => setFa({ ...fa, data: e.target.value })} />
                      </div>
                      <div className="lf">
                        <label>Procedimento</label>
                        <select
                          className="fsel"
                          value={fa.servico}
                          onChange={(e) => setFa({ ...fa, servico: e.target.value, valor: precoDe(e.target.value) })}
                        >
                          {dados.servicos.map((sv) => (
                            <option key={sv.n} value={sv.n}>
                              {sv.n}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="lf">
                        <label>Valor (R$)</label>
                        <input className="fsel num" type="number" step="5" value={fa.valor} onChange={(e) => setFa({ ...fa, valor: parseNum(e.target.value) })} />
                      </div>
                      <div className="lf lf-add">
                        <button className="btn ghost" onClick={addItem} title="Adicionar este procedimento ao atendimento">
                          + adicionar procedimento
                        </button>
                      </div>
                      {fa.itens.length > 0 && (
                        <div className="lf grande itens-list">
                          {fa.itens.map((it, i) => (
                            <span className="item-chip" key={`${it.servico}-${i}`}>
                              {it.servico} · {money0(it.valor)}
                              <button
                                title="Remover do atendimento"
                                onClick={() => setFa((f) => ({ ...f, itens: f.itens.filter((_, j) => j !== i) }))}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="lf grande">
                        <label>Cliente (opcional)</label>
                        <input className="fsel" type="text" placeholder="nome da cliente" value={fa.cliente} onChange={(e) => setFa({ ...fa, cliente: e.target.value })} />
                      </div>
                      <button className="btn" onClick={addAtendimento}>
                        {fa.itens.length > 1
                          ? `Lançar ${fa.itens.length} procedimentos · ${money0(totalLancamento)}`
                          : "Lançar"}
                      </button>
                    </div>
                  </div>
                  <div className="panel">
                    <h2>Lançar gasto</h2>
                    <div className="p-desc">
                      Pedido de insumos, custo fixo pago, taxa de cartão, imprevisto: tudo que saiu.
                    </div>
                    <div className="lanc-form">
                      <div className="lf">
                        <label>Data</label>
                        <input className="fsel" type="date" value={fg.data} onChange={(e) => setFg({ ...fg, data: e.target.value })} />
                      </div>
                      <div className="lf">
                        <label>Tipo</label>
                        <select className="fsel" value={fg.tipo} onChange={(e) => setFg({ ...fg, tipo: e.target.value as Gasto["tipo"] })}>
                          <option value="insumos">Compra de insumos</option>
                          <option value="fixo">Custo fixo</option>
                          <option value="outro">Outro gasto</option>
                        </select>
                      </div>
                      <div className="lf">
                        <label>Valor (R$)</label>
                        <input className="fsel num" type="number" step="10" value={fg.valor === 0 ? "" : fg.valor} onChange={(e) => setFg({ ...fg, valor: parseNum(e.target.value) })} />
                      </div>
                      <div className="lf grande">
                        <label>Descrição</label>
                        <input className="fsel" type="text" placeholder="ex.: pedido de cola e fios" value={fg.desc} onChange={(e) => setFg({ ...fg, desc: e.target.value })} />
                      </div>
                      <button className="btn ghost" onClick={addGasto}>
                        Lançar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mes-nav">
                  <span className="sc-label">Vendo o mês</span>
                  <select className="fsel" value={mesSel} onChange={(e) => setMesSel(e.target.value)}>
                    {meses.map((m) => (
                      <option key={m} value={m}>
                        {rotuloMes(m)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="cards4">
                  <div className="scard">
                    <div className="sc-k">Receita de {rotuloMes(mesSel)}</div>
                    <div className={`sc-v${recMes > 0 ? " gain" : ""}`}>{money0(recMes)}</div>
                    <div className="sc-n">{atMes.length} {atMes.length === 1 ? "atendimento lançado" : "atendimentos lançados"}</div>
                  </div>
                  <div className="scard">
                    <div className="sc-k">Gastos de {rotuloMes(mesSel)}</div>
                    <div className="sc-v">{money0(gasMes)}</div>
                    <div className="sc-n">{gaMes.length} {gaMes.length === 1 ? "lançamento" : "lançamentos"} de saída</div>
                  </div>
                  <div className="scard">
                    <div className="sc-k">Resultado do mês</div>
                    <div className={`sc-v${resMes < 0 ? " neg" : " gain"}`}>{money0(resMes)}</div>
                    <div className="sc-n">receita menos gastos lançados</div>
                  </div>
                  <div className="scard">
                    <div className="sc-k">Ticket médio do mês</div>
                    <div className="sc-v">{atMes.length > 0 ? money0(recMes / atMes.length) : "···"}</div>
                    <div className="sc-n">
                      plano prevê {money0(r.ticket)} por atendimento
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <h2>Crescimento de {rotuloMes(mesSel)}</h2>
                  <div className="p-desc">
                    Barras = receita de cada dia (os picos e os vales); linha = receita acumulada ao
                    longo do mês.
                  </div>
                  {atMes.length > 0 ? (
                    <MesChart mes={mesSel} atendimentos={atMes} />
                  ) : (
                    <div className="sc-status">nenhum atendimento lançado em {rotuloMes(mesSel)} ainda</div>
                  )}
                </div>

                <div className="panel">
                  <h2>Resultado de {mesSel.slice(0, 4)}, mês a mês</h2>
                  <div className="p-desc">
                    Receita menos gastos de cada mês do ano. O mês que você está vendo fica em
                    destaque.
                  </div>
                  <AnoChart ano={mesSel.slice(0, 4)} atendimentos={lanc.atendimentos} gastos={lanc.gastos} mesSel={mesSel} />
                </div>

                <div className="cols2">
                  <div className="panel">
                    <h2>Atendimentos de {rotuloMes(mesSel)}</h2>
                    {atMes.length > 0 ? (
                      <div className="tbl-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Dia</th>
                              <th>Cliente</th>
                              <th>Procedimento</th>
                              <th>Valor</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {atMes.map((a) => (
                              <tr key={a.id}>
                                <td>{a.data.slice(8, 10)}</td>
                                <td style={{ textAlign: "left" }}>
                                  <span className="svcname">{a.cliente || "· · ·"}</span>
                                </td>
                                <td style={{ textAlign: "left" }}>{a.servico}</td>
                                <td className="pos">{money(a.valor)}</td>
                                <td>
                                  <button
                                    className="del-btn"
                                    title="Remover lançamento"
                                    onClick={() => void removerAtendimento(a.id)}
                                  >
                                    ×
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="sc-status">nenhum atendimento neste mês</div>
                    )}
                  </div>
                  <div className="panel">
                    <h2>Gastos de {rotuloMes(mesSel)}</h2>
                    {gaMes.length > 0 ? (
                      <div className="tbl-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Dia</th>
                              <th>Tipo</th>
                              <th>Descrição</th>
                              <th>Valor</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {gaMes.map((g) => (
                              <tr key={g.id}>
                                <td>{g.data.slice(8, 10)}</td>
                                <td style={{ textAlign: "left" }}>{tipoRotulo[g.tipo]}</td>
                                <td style={{ textAlign: "left" }}>{g.desc}</td>
                                <td className="neg">{money(-g.valor)}</td>
                                <td>
                                  <button
                                    className="del-btn"
                                    title="Remover lançamento"
                                    onClick={() => void removerGasto(g.id)}
                                  >
                                    ×
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="sc-status">nenhum gasto neste mês</div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
