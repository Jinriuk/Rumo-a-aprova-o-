/* Fronteira de erro (Fase A.4): qualquer exceção não tratada no render
   cai aqui em vez de estourar a tela em branco. Mensagem humana,
   detalhe técnico só no console/observabilidade — nunca na tela. */
import React from "react";
import { capturarErro } from "../lib/observabilidade.js";

export class ErroFronteira extends React.Component {
  constructor(props) {
    super(props);
    this.state = { quebrou: false };
  }

  static getDerivedStateFromError() {
    return { quebrou: true };
  }

  componentDidCatch(erro, info) {
    capturarErro(erro, { origem: "react-error-boundary", componente: info?.componentStack ?? null });
  }

  render() {
    if (!this.state.quebrou) return this.props.children;
    return (
      <div style={{ background: "#0A1622", color: "#8AA4BC", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" }}>
        <div style={{ marginBottom: 14, fontSize: 15 }}>Algo deu errado nesta tela.</div>
        <div style={{ marginBottom: 18, fontSize: 13, opacity: 0.8 }}>Atualize a página — se o problema continuar, avise a coordenação ou o suporte.</div>
        <button onClick={() => window.location.reload()}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", fontWeight: 700, background: "#CDA349", color: "#0A1622" }}>
          Atualizar página
        </button>
      </div>
    );
  }
}
