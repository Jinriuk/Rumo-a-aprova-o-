/* Fronteira de erro (Fase A.4): qualquer exceção não tratada no render
   cai aqui em vez de estourar a tela em branco. Mensagem humana,
   detalhe técnico só no console/observabilidade — nunca na tela.
   Etapa 4: a tela mostra um código curto (início do correlation_id do
   relato). Quem liga para o suporte lê o código, e o dono acha a linha
   em app.erros_ocorrencias sem pedir print nem dado da pessoa. */
import React from "react";
import { capturarErro } from "../lib/observabilidade.js";

export class ErroFronteira extends React.Component {
  constructor(props) {
    super(props);
    this.state = { quebrou: false, codigo: null };
  }

  static getDerivedStateFromError() {
    return { quebrou: true };
  }

  componentDidCatch(erro, info) {
    const id = capturarErro(erro, { origem: "react-error-boundary", componente: info?.componentStack ?? null });
    if (id) this.setState({ codigo: String(id).slice(0, 8) });
  }

  render() {
    if (!this.state.quebrou) return this.props.children;
    return (
      <div style={{ background: "#0A1622", color: "#8AA4BC", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" }}>
        <div style={{ marginBottom: 14, fontSize: 15 }}>Algo deu errado nesta tela.</div>
        <div style={{ marginBottom: 18, fontSize: 13, opacity: 0.8 }}>Atualize a página — se o problema continuar, avise a coordenação ou o suporte.</div>
        {this.state.codigo && (
          <div style={{ marginBottom: 18, fontSize: 12, opacity: 0.7 }}>Código do erro: <code>{this.state.codigo}</code></div>
        )}
        <button type="button" onClick={() => window.location.reload()}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", fontWeight: 700, background: "#CDA349", color: "#0A1622" }}>
          Atualizar página
        </button>
      </div>
    );
  }
}
