import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Acesso ao Interlash Finance",
  description: "Seu bônus do Lucro em Dobro: como acessar o Interlash Finance.",
};

export default function Acesso() {
  return (
    <div className="auth-wrap acesso">
      <div className="auth-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mark.svg" alt="INTERLASH" className="mark" />
        <h1>Seu bônus está liberado!</h1>
        <p className="sub">
          Interlash Finance: o aplicativo que calcula o preço certo dos seus procedimentos e mostra
          o seu lucro real.
        </p>
        <ol className="passos">
          <li>
            <strong>Seu login</strong> é o e-mail que você usou na compra.
          </li>
          <li>
            <strong>Sua senha</strong> é o seu CPF, somente números (os 11 dígitos, sem pontos e
            sem traço).
          </li>
          <li>
            Toque no botão abaixo e entre. Pode usar no celular ou no computador; seus dados ficam
            salvos na sua conta.
          </li>
        </ol>
        <Link href="/entrar" className="btn gold">
          Acessar o Interlash Finance
        </Link>
        <p className="acesso-dica">
          Dica: no celular, use "Adicionar à Tela de Início" do navegador para ter o app a um
          toque. O acesso é liberado em até 1 minuto após a aprovação da compra.
        </p>
      </div>
    </div>
  );
}
