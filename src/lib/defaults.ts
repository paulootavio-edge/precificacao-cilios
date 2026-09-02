import type { Atendimento, Dados, Gasto, LancData, Produto, Servico } from "./calc";

/*
 * consumo: quantas "aplicações" de cada produto o procedimento gasta.
 * Ex.: mega volume gasta 2,2 cartelas-equivalentes de fio; manutenção, 0,5.
 * 0 = o procedimento não usa aquele produto.
 */
const C = {
  fios: "fios",
  cola: "cola",
  primer: "primer",
  removedor: "removedor",
  pads: "pads",
  micropinceis: "micropinceis",
  escovinhas: "escovinhas",
  micropore: "micropore",
  aneis: "aneis",
  luvas: "luvas",
  higiene: "higiene",
};

export const DADOS_PADRAO: Dados = {
  regime: "mei",
  dasMei: 87,
  contador: 250,
  cargaAutonomo: 16,
  taxaCartao: 4,
  pctCartao: 70,
  diasSemana: 5,
  horasDia: 8,
  ocupacao: 70,
  faltas: 8,
  ocupIni: 30,
  rampaMeses: 6,
  margemAlvo: 30,
  proLabore: 3000,
  produtos: [
    { id: C.fios, n: "Cartela de fios", v: 35, r: 10 },
    { id: C.cola, n: "Cola / adesivo 5ml", v: 120, r: 50 },
    { id: C.primer, n: "Primer", v: 35, r: 60 },
    { id: C.removedor, n: "Removedor", v: 30, r: 40 },
    { id: C.pads, n: "Pads de hidrogel (par)", v: 60, r: 50 },
    { id: C.micropinceis, n: "Micropincéis (pct 100)", v: 12, r: 50 },
    { id: C.escovinhas, n: "Escovinhas (pct 50)", v: 15, r: 50 },
    { id: C.micropore, n: "Fita micropore", v: 8, r: 30 },
    { id: C.aneis, n: "Anéis de cola (pct 100)", v: 15, r: 100 },
    { id: C.luvas, n: "Luvas (caixa 50 pares)", v: 40, r: 50 },
    { id: C.higiene, n: "Higienização (álcool, algodão)", v: 20, r: 100 },
  ],
  servicos: [
    {
      n: "Fio a fio / clássico", p: 130, d: 2, m: 25,
      consumo: { fios: 1, cola: 1, primer: 1, removedor: 0.5, pads: 1, micropinceis: 1, escovinhas: 1, micropore: 1, aneis: 1, luvas: 1, higiene: 1 },
    },
    {
      n: "Híbrido", p: 150, d: 2.25, m: 20,
      consumo: { fios: 1.2, cola: 1.1, primer: 1, removedor: 0.5, pads: 1, micropinceis: 1, escovinhas: 1, micropore: 1, aneis: 1, luvas: 1, higiene: 1 },
    },
    {
      n: "Volume brasileiro", p: 160, d: 2.5, m: 20,
      consumo: { fios: 1.4, cola: 1.2, primer: 1, removedor: 0.5, pads: 1, micropinceis: 1, escovinhas: 1, micropore: 1, aneis: 1, luvas: 1, higiene: 1 },
    },
    {
      n: "Volume russo", p: 180, d: 3, m: 10,
      consumo: { fios: 1.7, cola: 1.4, primer: 1, removedor: 0.5, pads: 1, micropinceis: 1, escovinhas: 1, micropore: 1, aneis: 1, luvas: 1, higiene: 1 },
    },
    {
      n: "Mega volume", p: 220, d: 3.5, m: 5,
      consumo: { fios: 2.2, cola: 1.6, primer: 1, removedor: 0.5, pads: 1, micropinceis: 1, escovinhas: 1, micropore: 1, aneis: 1, luvas: 1, higiene: 1 },
    },
    {
      n: "Manutenção", p: 90, d: 1.5, m: 20,
      consumo: { fios: 0.5, cola: 0.6, primer: 0.5, removedor: 1, pads: 1, micropinceis: 1, escovinhas: 1, micropore: 0.5, aneis: 0.5, luvas: 1, higiene: 1 },
    },
  ],
  fixos: [
    { n: "Aluguel / sala", v: 800 },
    { n: "Energia + água", v: 150 },
    { n: "Internet + telefone", v: 100 },
    { n: "Marketing / tráfego pago", v: 300 },
    { n: "Sistema de agenda", v: 60 },
    { n: "Limpeza e descartáveis gerais", v: 80 },
    { n: "Outros", v: 100 },
  ],
  capex: [
    { n: "Curso / formação", v: 1500 },
    { n: "Maca + escadinha", v: 700 },
    { n: "Kit de pinças", v: 300 },
    { n: "Luminária / ring light", v: 250 },
    { n: "Estoque inicial de insumos", v: 600 },
    { n: "Decoração e recepção", v: 400 },
  ],
};

export const STORAGE_KEY = "lashfinance:dados:v1";
export const LANC_KEY = "lashfinance:lanc:v1";

/* aceita lançamentos de qualquer origem (localStorage, nuvem, versões antigas).
   O formato antigo era um array de meses agregados: vira lançamentos avulsos no dia 15. */
export function sanitizarLanc(raw: unknown): LancData {
  const vazio: LancData = { atendimentos: [], gastos: [] };
  if (!raw || typeof raw !== "object") return vazio;

  if (Array.isArray(raw)) {
    const atendimentos: Atendimento[] = [];
    const gastos: Gasto[] = [];
    for (const m of raw as Array<Record<string, unknown>>) {
      const mes = typeof m?.mes === "string" && /^\d{4}-\d{2}$/.test(m.mes) ? m.mes : null;
      if (!mes) continue;
      const num = (x: unknown) => (typeof x === "number" && isFinite(x) ? x : 0);
      if (num(m.receita) > 0)
        atendimentos.push({ id: novoId(), data: `${mes}-15`, servico: "Mês agregado (versão antiga)", valor: num(m.receita), cliente: "" });
      if (num(m.compras) > 0) gastos.push({ id: novoId(), data: `${mes}-15`, tipo: "insumos", desc: "Compras do mês", valor: num(m.compras) });
      if (num(m.fixos) > 0) gastos.push({ id: novoId(), data: `${mes}-15`, tipo: "fixo", desc: "Custos fixos do mês", valor: num(m.fixos) });
      if (num(m.outros) > 0) gastos.push({ id: novoId(), data: `${mes}-15`, tipo: "outro", desc: "Outros gastos do mês", valor: num(m.outros) });
    }
    return { atendimentos, gastos };
  }

  const o = raw as { atendimentos?: unknown; gastos?: unknown };
  const dataOk = (d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const atendimentos: Atendimento[] = Array.isArray(o.atendimentos)
    ? (o.atendimentos as Array<Record<string, unknown>>)
        .filter((a) => dataOk(a?.data))
        .map((a) => ({
          id: typeof a.id === "string" && a.id ? a.id : novoId(),
          data: a.data as string,
          servico: typeof a.servico === "string" ? a.servico : "",
          valor: typeof a.valor === "number" && isFinite(a.valor) ? a.valor : 0,
          cliente: typeof a.cliente === "string" ? a.cliente : "",
        }))
    : [];
  const gastos: Gasto[] = Array.isArray(o.gastos)
    ? (o.gastos as Array<Record<string, unknown>>)
        .filter((g) => dataOk(g?.data))
        .map((g) => ({
          id: typeof g.id === "string" && g.id ? g.id : novoId(),
          data: g.data as string,
          tipo: g.tipo === "fixo" || g.tipo === "outro" ? g.tipo : "insumos",
          desc: typeof g.desc === "string" ? g.desc : "",
          valor: typeof g.valor === "number" && isFinite(g.valor) ? g.valor : 0,
        }))
    : [];
  return { atendimentos, gastos };
}

export function clonePadrao(): Dados {
  return JSON.parse(JSON.stringify(DADOS_PADRAO));
}

export function novoId(): string {
  return "p_" + Math.random().toString(36).slice(2, 9);
}

type ProdutoLegado = Partial<Produto> & { n?: string; v?: number; r?: number };
type ServicoLegado = Partial<Servico> & { f?: number };

/*
 * Aceita dados de qualquer versão (localStorage antigo, cenário salvo na nuvem)
 * e devolve o formato atual: produtos com id e serviços com mapa de consumo.
 * Dados antigos tinham um fator único `f` por serviço: vira quantidade f em todos os produtos.
 */
export function migrarDados(raw: unknown): Dados {
  const base = clonePadrao();
  if (!raw || typeof raw !== "object") return base;
  const d = { ...base, ...(raw as Partial<Dados>) } as Dados;

  const produtosRaw = (Array.isArray(d.produtos) ? d.produtos : base.produtos) as ProdutoLegado[];
  const produtos: Produto[] = produtosRaw.map((p) => ({
    id: typeof p.id === "string" && p.id ? p.id : novoId(),
    n: p.n ?? "",
    v: p.v ?? 0,
    r: p.r ?? 1,
  }));

  const servicosRaw = (Array.isArray(d.servicos) ? d.servicos : base.servicos) as ServicoLegado[];
  const servicos: Servico[] = servicosRaw.map((s) => {
    const legado = s.consumo && typeof s.consumo === "object" ? s.consumo : null;
    const fator = typeof s.f === "number" ? s.f : 1;
    const consumo: Record<string, number> = {};
    produtos.forEach((p) => {
      consumo[p.id] = legado && p.id in legado ? legado[p.id] : fator;
    });
    return { n: s.n ?? "", p: s.p ?? 0, d: s.d ?? 0, m: s.m ?? 0, consumo };
  });

  /* cenários antigos podiam carregar `reais` dentro; hoje lançamentos vivem fora do cenário */
  const limpo = { ...d, produtos, servicos } as Dados & { reais?: unknown };
  delete limpo.reais;
  return limpo;
}
