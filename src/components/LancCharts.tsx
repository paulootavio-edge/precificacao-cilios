"use client";

import { money0, type Atendimento, type Gasto } from "@/lib/calc";

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function diasDoMes(mes: string): number {
  const [ano, m] = mes.split("-").map(Number);
  return new Date(ano, m, 0).getDate();
}

/* barras = receita de cada dia (escala própria); linha = receita acumulada do mês */
export function MesChart({ mes, atendimentos }: { mes: string; atendimentos: Atendimento[] }) {
  const nDias = diasDoMes(mes);
  const porDia = new Array<number>(nDias).fill(0);
  atendimentos.forEach((a) => {
    const d = parseInt(a.data.slice(8, 10), 10);
    if (d >= 1 && d <= nDias) porDia[d - 1] += a.valor;
  });
  const acum: number[] = [];
  porDia.reduce((s, v, i) => {
    acum[i] = s + v;
    return s + v;
  }, 0);
  const total = acum[nDias - 1] ?? 0;

  const W = 760;
  const Hc = 270;
  const padL = 78;
  const padR = 14;
  const padT = 16;
  const padB = 30;
  const iw = W - padL - padR;
  const ih = Hc - padT - padB;
  const maxAcum = Math.max(total, 1);
  const maxDia = Math.max(...porDia, 1);
  const X = (i: number) => padL + ((i + 0.5) / nDias) * iw;
  const Y = (v: number) => padT + (1 - v / (maxAcum * 1.06)) * ih;
  /* barras ocupam no máximo 45% da altura, em escala própria */
  const alturaBarra = (v: number) => (v / maxDia) * ih * 0.45;
  const bw = Math.max(3, (iw / nDias) * 0.55);

  let linha = "";
  acum.forEach((v, i) => {
    linha += `${i === 0 ? "M" : "L"}${X(i).toFixed(1)} ${Y(v).toFixed(1)} `;
  });

  const grid = [1, 2, 3, 4].map((g) => (maxAcum * g) / 4);
  const passoDia = nDias > 20 ? 4 : 2;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${Hc}`} role="img" aria-label="Receita diária e acumulada do mês">
      {grid.map((gv, i) => (
        <g key={i}>
          <line x1={padL} y1={Y(gv)} x2={padL + iw} y2={Y(gv)} stroke="#efeeea" />
          <text x={padL - 8} y={Y(gv) + 3} textAnchor="end" fontSize="10" fill="#98978f" fontFamily="var(--font-mono)">
            {money0(gv)}
          </text>
        </g>
      ))}
      {porDia.map((v, i) =>
        v > 0 ? (
          <rect
            key={i}
            x={X(i) - bw / 2}
            y={padT + ih - alturaBarra(v)}
            width={bw}
            height={alturaBarra(v)}
            fill="#157347"
            opacity="0.3"
            rx="1.5"
          />
        ) : null
      )}
      <path d={linha} fill="none" stroke="#157347" strokeWidth="2.4" strokeLinejoin="round" />
      {Array.from({ length: nDias }, (_, i) => i + 1)
        .filter((d) => d === 1 || d % passoDia === 0)
        .map((d) => (
          <text key={d} x={X(d - 1)} y={padT + ih + 18} textAnchor="middle" fontSize="9" fill="#98978f" fontFamily="var(--font-mono)">
            {d}
          </text>
        ))}
      <text x={padL + iw / 2} y={Hc - 2} textAnchor="middle" fontSize="10" fill="#98978f" fontFamily="var(--font-body)">
        dias do mês
      </text>
    </svg>
  );
}

/* barras do resultado (receita − gastos) de cada mês do ano */
export function AnoChart({ ano, atendimentos, gastos, mesSel }: { ano: string; atendimentos: Atendimento[]; gastos: Gasto[]; mesSel: string }) {
  const receita = new Array<number>(12).fill(0);
  const gasto = new Array<number>(12).fill(0);
  atendimentos.forEach((a) => {
    if (a.data.slice(0, 4) === ano) receita[parseInt(a.data.slice(5, 7), 10) - 1] += a.valor;
  });
  gastos.forEach((g) => {
    if (g.data.slice(0, 4) === ano) gasto[parseInt(g.data.slice(5, 7), 10) - 1] += g.valor;
  });
  const resultado = receita.map((r, i) => r - gasto[i]);

  const W = 760;
  const Hc = 250;
  const padL = 78;
  const padR = 14;
  const padT = 16;
  const padB = 30;
  const iw = W - padL - padR;
  const ih = Hc - padT - padB;
  let maxV = Math.max(...resultado, 1);
  let minV = Math.min(...resultado, 0);
  const span = maxV - minV || 1;
  maxV += span * 0.08;
  if (minV < 0) minV -= span * 0.08;
  const X = (i: number) => padL + ((i + 0.5) / 12) * iw;
  const Y = (v: number) => padT + (1 - (v - minV) / (maxV - minV)) * ih;
  const y0 = Y(0);
  const bw = (iw / 12) * 0.56;

  const grid = [0, 1, 2, 3, 4].map((g) => minV + ((maxV - minV) * g) / 4);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${Hc}`} role="img" aria-label="Resultado mês a mês do ano">
      {grid.map((gv, i) => (
        <g key={i}>
          <line x1={padL} y1={Y(gv)} x2={padL + iw} y2={Y(gv)} stroke="#efeeea" />
          <text x={padL - 8} y={Y(gv) + 3} textAnchor="end" fontSize="10" fill="#98978f" fontFamily="var(--font-mono)">
            {money0(gv)}
          </text>
        </g>
      ))}
      {minV < 0 && <line x1={padL} y1={y0} x2={padL + iw} y2={y0} stroke="#141414" strokeWidth="1" strokeDasharray="4 3" />}
      {resultado.map((v, i) => {
        if (receita[i] === 0 && gasto[i] === 0) return null;
        const mesStr = `${ano}-${String(i + 1).padStart(2, "0")}`;
        const h = Math.abs(Y(v) - y0);
        return (
          <rect
            key={i}
            x={X(i) - bw / 2}
            y={v >= 0 ? Y(v) : y0}
            width={bw}
            height={Math.max(h, 1.5)}
            fill={v >= 0 ? "#157347" : "#bb4237"}
            opacity={mesStr === mesSel ? 1 : 0.55}
            rx="2"
          />
        );
      })}
      {MESES_ABREV.map((m, i) => (
        <text key={m} x={X(i)} y={padT + ih + 18} textAnchor="middle" fontSize="9.5" fill="#98978f" fontFamily="var(--font-mono)">
          {m}
        </text>
      ))}
    </svg>
  );
}
