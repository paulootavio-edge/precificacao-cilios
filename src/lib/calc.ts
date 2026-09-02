export type Produto = { id: string; n: string; v: number; r: number };
/* consumo: quantidade de "aplicações" de cada produto (por id) que o procedimento gasta; 0 = não usa */
export type Servico = { n: string; p: number; d: number; m: number; consumo: Record<string, number> };
export type ItemValor = { n: string; v: number };
export type Regime = "mei" | "simples" | "autonomo";

/* CRM de lançamentos: cada atendimento e cada gasto registrados individualmente.
   São a realidade única da conta, independentes de cenário; o mês é agregado deles. */
export type Atendimento = {
  id: string;
  data: string; // "2026-09-02"
  servico: string; // nome do procedimento no momento do lançamento
  valor: number; // valor cobrado
  cliente: string; // opcional
};
export type Gasto = {
  id: string;
  data: string;
  tipo: "insumos" | "fixo" | "outro";
  desc: string;
  valor: number;
};
export type LancData = { atendimentos: Atendimento[]; gastos: Gasto[] };

export type Dados = {
  regime: Regime;
  dasMei: number;
  contador: number;
  cargaAutonomo: number;
  taxaCartao: number;
  pctCartao: number;
  diasSemana: number;
  horasDia: number;
  ocupacao: number;
  faltas: number;
  ocupIni: number;
  rampaMeses: number;
  margemAlvo: number;
  proLabore: number;
  produtos: Produto[];
  servicos: Servico[];
  fixos: ItemValor[];
  capex: ItemValor[];
};

export type LinhaServico = {
  n: string;
  preco: number;
  mat: number;
  tempo: number;
  imposto: number;
  cartao: number;
  lucro: number;
  margem: number;
  minimo: number | null;
};

export type MesProj = {
  m: number;
  ocup: number;
  at: number;
  receita: number;
  mat: number;
  imp: number;
  card: number;
  fixos: number;
  lucro: number;
  acum: number;
};

export type RegimeComp = {
  id: Regime;
  nome: string;
  custo: number;
  det: string;
  alerta: string | null;
  elegivel: boolean;
};

export type Resultado = {
  kitBase: number;
  invest: number;
  fixosTotais: number;
  dasFixo: number;
  contadorMes: number;
  aliqEf: number;
  taxaCartaoEf: number;
  horasProd: number;
  custoHora: number;
  durMedia: number;
  atendPlena: number;
  ticket: number;
  matMedio: number;
  contrib: number;
  be: number;
  bePL: number;
  receitaPlena: number;
  matPlena: number;
  impPlena: number;
  cardPlena: number;
  lucroPlena: number;
  margemLiq: number;
  matPct: number;
  horasAtendidas: number;
  lucroHora: number;
  linhas: LinhaServico[];
  serie: MesProj[];
  payback: number | null;
  roi12: number | null;
  lucro12: number;
  comparador: RegimeComp[];
  melhorRegime: number;
  meiEstourado: boolean;
  receitaAnual: number;
  mixSoma: number;
};

export const HORIZONTE = 24;
export const TETO_MEI = 81000;

const FAIXAS_III = [
  { ate: 180000, aliq: 0.06, pd: 0 },
  { ate: 360000, aliq: 0.112, pd: 9360 },
  { ate: 720000, aliq: 0.135, pd: 17640 },
  { ate: 1800000, aliq: 0.16, pd: 35640 },
  { ate: 3600000, aliq: 0.21, pd: 125640 },
  { ate: 4800000, aliq: 0.33, pd: 648000 },
];

export function aliqSimples(receitaMes: number): number {
  const rbt12 = Math.max(receitaMes * 12, 1);
  let fx = FAIXAS_III[FAIXAS_III.length - 1];
  for (const f of FAIXAS_III) {
    if (rbt12 <= f.ate) {
      fx = f;
      break;
    }
  }
  return Math.max(0, (rbt12 * fx.aliq - fx.pd) / rbt12);
}

export function custoAplicacao(p: Produto): number {
  return p.r > 0 ? (p.v || 0) / p.r : 0;
}

export function custoMaterial(s: Servico, produtos: Produto[]): number {
  return produtos.reduce((sum, p) => sum + (s.consumo?.[p.id] ?? 0) * custoAplicacao(p), 0);
}

export function calc(d: Dados): Resultado {
  const kitBase = d.produtos.reduce((s, p) => s + custoAplicacao(p), 0);
  const matCusto = (s: Servico) => custoMaterial(s, d.produtos);
  const invest = d.capex.reduce((s, c) => s + (c.v || 0), 0);
  const fixosBase = d.fixos.reduce((s, f) => s + (f.v || 0), 0);

  const taxaCartaoEf = (d.taxaCartao / 100) * (Math.min(d.pctCartao, 100) / 100);
  const margemAlvo = Math.min(d.margemAlvo, 80) / 100;

  const horasBrutas = Math.max(0, d.diasSemana) * Math.max(0, d.horasDia) * 4.33;
  const ocupPlena = Math.min(d.ocupacao, 100) / 100;
  const fatorFaltas = 1 - Math.min(d.faltas, 50) / 100;
  const horasProd = horasBrutas * ocupPlena * fatorFaltas;

  const mixSoma = d.servicos.reduce((s, x) => s + (x.m || 0), 0);
  const shares = d.servicos.map((s) => (mixSoma > 0 ? (s.m || 0) / mixSoma : 0));

  let durMedia = 0;
  d.servicos.forEach((s, i) => {
    durMedia += shares[i] * (s.d || 0);
  });
  const atendPlena = durMedia > 0 ? horasProd / durMedia : 0;

  const receitaFrac = (frac: number) => {
    const at = atendPlena * frac;
    let r = 0;
    d.servicos.forEach((s, i) => {
      r += at * shares[i] * (s.p || 0);
    });
    return r;
  };
  const receitaPlena = receitaFrac(1);

  let aliqEf = 0;
  let dasFixo = 0;
  let contadorMes = 0;
  if (d.regime === "mei") {
    dasFixo = d.dasMei;
  } else if (d.regime === "simples") {
    aliqEf = aliqSimples(receitaPlena);
    contadorMes = d.contador;
  } else {
    aliqEf = Math.min(d.cargaAutonomo, 45) / 100;
  }
  const fixosTotais = fixosBase + dasFixo + contadorMes;
  const custoHora = horasProd > 0 ? fixosTotais / horasProd : 0;

  const linhas: LinhaServico[] = d.servicos.map((s) => {
    const mat = matCusto(s);
    const tempo = (s.d || 0) * custoHora;
    const imposto = (s.p || 0) * aliqEf;
    const cartao = (s.p || 0) * taxaCartaoEf;
    const lucro = (s.p || 0) - mat - tempo - imposto - cartao;
    const margem = s.p > 0 ? lucro / s.p : 0;
    const denom = 1 - aliqEf - taxaCartaoEf - margemAlvo;
    const minimo = denom > 0.02 ? (mat + tempo) / denom : null;
    return { n: s.n, preco: s.p || 0, mat, tempo, imposto, cartao, lucro, margem, minimo };
  });

  const mesFrac = (frac: number) => {
    const at = atendPlena * frac;
    let receita = 0;
    let mat = 0;
    d.servicos.forEach((s, i) => {
      const a = at * shares[i];
      receita += a * (s.p || 0);
      mat += a * matCusto(s);
    });
    const imp = receita * aliqEf;
    const card = receita * taxaCartaoEf;
    const lucro = receita - mat - imp - card - fixosTotais;
    return { at, receita, mat, imp, card, lucro };
  };
  const plena = mesFrac(1);

  let ticket = 0;
  let matMedio = 0;
  d.servicos.forEach((s, i) => {
    ticket += shares[i] * (s.p || 0);
    matMedio += shares[i] * matCusto(s);
  });
  const contrib = ticket * (1 - aliqEf - taxaCartaoEf) - matMedio;
  const be = contrib > 0 ? fixosTotais / contrib : Infinity;
  const bePL = contrib > 0 ? (fixosTotais + d.proLabore) / contrib : Infinity;

  const ocupIni = Math.min(d.ocupIni, 100) / 100;
  const rampaM = Math.max(1, Math.round(d.rampaMeses));
  const serie: MesProj[] = [
    { m: 0, ocup: 0, at: 0, receita: 0, mat: 0, imp: 0, card: 0, fixos: 0, lucro: -invest, acum: -invest },
  ];
  let acum = -invest;
  let payback: number | null = null;
  for (let t = 1; t <= HORIZONTE; t++) {
    let fracOcup =
      ocupPlena <= 0
        ? 0
        : Math.min(1, (ocupIni + (ocupPlena - ocupIni) * Math.min(1, (t - 1) / Math.max(1, rampaM - 1))) / ocupPlena);
    if (rampaM === 1) fracOcup = 1;
    const mm = mesFrac(fracOcup);
    acum += mm.lucro;
    if (payback === null && acum >= 0) payback = t;
    serie.push({
      m: t,
      ocup: fracOcup * ocupPlena,
      at: mm.at,
      receita: mm.receita,
      mat: mm.mat,
      imp: mm.imp,
      card: mm.card,
      fixos: fixosTotais,
      lucro: mm.lucro,
      acum,
    });
  }
  const lucro12 = serie.slice(1, 13).reduce((s, x) => s + x.lucro, 0);
  const roi12 = invest > 0 ? lucro12 / invest : null;

  const receitaAnual = receitaPlena * 12;
  const meiEstourado = receitaAnual > TETO_MEI;
  const effS = aliqSimples(receitaPlena);
  const cargaA = Math.min(d.cargaAutonomo || 16, 45) / 100;
  const contad = d.contador || 250;
  const comparador: RegimeComp[] = [
    {
      id: "mei",
      nome: "MEI",
      custo: d.dasMei,
      det: `DAS fixo, sem contador obrigatório`,
      alerta: meiEstourado ? "Faturamento acima do teto de R$ 81 mil/ano: MEI não comporta" : null,
      elegivel: !meiEstourado,
    },
    {
      id: "simples",
      nome: "Simples Nacional",
      custo: receitaPlena * effS + contad,
      det: `${(effS * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% da receita (Anexo III) + contador`,
      alerta: null,
      elegivel: true,
    },
    {
      id: "autonomo",
      nome: "Autônoma s/ CNPJ",
      custo: receitaPlena * cargaA,
      det: `${(cargaA * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% estimados (ISS + INSS + carnê-leão)`,
      alerta: "Sem CNPJ: crédito e maquininha ficam mais caros",
      elegivel: true,
    },
  ];
  const custos = comparador.map((c) => (c.elegivel ? c.custo : Infinity));
  const melhorRegime = custos.indexOf(Math.min(...custos));

  const horasAtendidas = atendPlena * durMedia;

  return {
    kitBase,
    invest,
    fixosTotais,
    dasFixo,
    contadorMes,
    aliqEf,
    taxaCartaoEf,
    horasProd,
    custoHora,
    durMedia,
    atendPlena,
    ticket,
    matMedio,
    contrib,
    be,
    bePL,
    receitaPlena,
    matPlena: plena.mat,
    impPlena: plena.imp,
    cardPlena: plena.card,
    lucroPlena: plena.lucro,
    margemLiq: plena.receita > 0 ? plena.lucro / plena.receita : 0,
    matPct: plena.receita > 0 ? plena.mat / plena.receita : 0,
    horasAtendidas,
    lucroHora: horasAtendidas > 0 ? plena.lucro / horasAtendidas : 0,
    linhas,
    serie,
    payback,
    roi12,
    lucro12,
    comparador,
    melhorRegime,
    meiEstourado,
    receitaAnual,
    mixSoma,
  };
}

/* ---------- formatação pt-BR ---------- */
const fmtMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtMoney0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const money = (x: number) => fmtMoney.format(x);
export const money0 = (x: number) => fmtMoney0.format(x);
export const pctBR = (x: number, d = 1) =>
  (x * 100).toLocaleString("pt-BR", { maximumFractionDigits: d }) + "%";
export const nBR = (x: number, d = 1) => x.toLocaleString("pt-BR", { maximumFractionDigits: d });
