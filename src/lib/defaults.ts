import type { Dados, Produto, Servico } from "./calc";

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
