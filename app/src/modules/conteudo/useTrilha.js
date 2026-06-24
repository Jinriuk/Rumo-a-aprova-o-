/* Consumo da trilha (conteúdo global, SÓ leitura no front — o
   método é do operador; a escola e o aluno consomem). */
import { useEffect, useState } from "react";
import * as db from "../../shared/data/index.js";
import { mensagemAmigavel } from "../../shared/lib/erros.js";

export function useTrilha(trilhaId) {
  const [estado, setEstado] = useState({ carregando: true, erro: null, trilha: null });

  useEffect(() => {
    if (!trilhaId) { setEstado({ carregando: false, erro: null, trilha: null }); return; }
    let vivo = true;
    db.carregarTrilha(trilhaId)
      .then((dados) => {
        if (!vivo) return;
        const porCodigo = Object.fromEntries(dados.disciplinas.map((d) => [d.codigo, d]));
        const atividadesPorId = Object.fromEntries(dados.atividades.map((a) => [a.id, a]));
        const atividadesPorSemana = {};
        for (const a of dados.atividades) {
          (atividadesPorSemana[a.semana_numero] ??= []).push(a);
        }
        setEstado({
          carregando: false, erro: null,
          trilha: { ...dados, porCodigo, atividadesPorId, atividadesPorSemana },
        });
      })
      .catch((e) => vivo && setEstado({ carregando: false, erro: mensagemAmigavel(e, "carregar"), trilha: null }));
    return () => { vivo = false; };
  }, [trilhaId]);

  return estado;
}
