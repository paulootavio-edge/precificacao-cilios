"use client";

import { money0, type MesProj } from "@/lib/calc";

export default function PayChart({ serie, payback }: { serie: MesProj[]; payback: number | null }) {
  const W = 760;
  const Hc = 320;
  const padL = 86;
  const padR = 16;
  const padT = 18;
  const padB = 34;
  const iw = W - padL - padR;
  const ih = Hc - padT - padB;
  const H = serie.length - 1;
  const vals = serie.map((x) => x.acum);
  let minV = Math.min(...vals);
  let maxV = Math.max(...vals);
  if (minV === maxV) {
    minV--;
    maxV++;
  }
  const span = maxV - minV;
  minV -= span * 0.06;
  maxV += span * 0.06;
  const X = (m: number) => padL + (m / H) * iw;
  const Y = (v: number) => padT + (1 - (v - minV) / (maxV - minV)) * ih;

  const grid = [0, 1, 2, 3, 4].map((g) => minV + ((maxV - minV) * g) / 4);
  const meses: number[] = [];
  for (let m = 0; m <= H; m += 3) meses.push(m);

  let area = `M${X(0).toFixed(1)} ${Y(0).toFixed(1)} `;
  serie.forEach((p) => {
    area += `L${X(p.m).toFixed(1)} ${Y(p.acum).toFixed(1)} `;
  });
  area += `L${X(H).toFixed(1)} ${Y(0).toFixed(1)} Z`;

  let line = "";
  serie.forEach((p, i) => {
    line += `${i === 0 ? "M" : "L"}${X(p.m).toFixed(1)} ${Y(p.acum).toFixed(1)} `;
  });

  const y0 = Math.min(Math.max(Y(0), padT), padT + ih);
  const bx = payback !== null && payback <= H ? X(payback) : null;
  const anchorEnd = bx !== null && bx > padL + iw - 160;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${Hc}`} role="img" aria-label="Caixa acumulado mês a mês e ponto de payback">
      {minV < 0 && (
        <rect x={padL} y={y0} width={iw} height={padT + ih - y0} fill="#bb4237" opacity="0.05" />
      )}
      {grid.map((gv, i) => (
        <g key={i}>
          <line x1={padL} y1={Y(gv)} x2={padL + iw} y2={Y(gv)} stroke="#efeeea" />
          <text x={padL - 8} y={Y(gv) + 3} textAnchor="end" fontSize="10" fill="#98978f" fontFamily="var(--font-mono)">
            {money0(gv)}
          </text>
        </g>
      ))}
      {minV < 0 && maxV > 0 && (
        <line x1={padL} y1={Y(0)} x2={padL + iw} y2={Y(0)} stroke="#141414" strokeWidth="1.2" strokeDasharray="4 3" />
      )}
      {meses.map((m) => (
        <text key={m} x={X(m)} y={padT + ih + 22} textAnchor="middle" fontSize="10" fill="#98978f" fontFamily="var(--font-mono)">
          {m}
        </text>
      ))}
      <text x={padL + iw / 2} y={Hc - 2} textAnchor="middle" fontSize="10" fill="#98978f" fontFamily="var(--font-body)">
        meses
      </text>
      <path d={area} fill="#157347" opacity="0.08" />
      <path d={line} fill="none" stroke="#157347" strokeWidth="2.6" strokeLinejoin="round" />
      {bx !== null && payback !== null && (
        <g>
          <line x1={bx} y1={padT} x2={bx} y2={padT + ih} stroke="#0d5c38" strokeDasharray="3 3" />
          <circle cx={bx} cy={Y(serie[payback].acum)} r="5.5" fill="#0d5c38" stroke="#ffffff" strokeWidth="2" />
          <text
            x={anchorEnd ? bx - 8 : bx + 8}
            y={padT + 14}
            textAnchor={anchorEnd ? "end" : "start"}
            fontSize="11"
            fontWeight="600"
            fill="#0d5c38"
            fontFamily="var(--font-display)"
          >
            investimento pago no mês {payback}
          </text>
        </g>
      )}
    </svg>
  );
}
