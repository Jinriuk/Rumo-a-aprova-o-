# 04 — Conquistas, Histórico e Decisões Pedagógicas
**Fase:** PED-UX1 | **Data:** 2026-06-24

---

## 1. Simulados

**Estado:** bom. Nenhum bug evidente.
**Decisão:** manter como está.

O componente `Simulados` em `Progresso.jsx` permite:
- Registrar simulados com data, nome, acertos por disciplina
- Ver histórico de simulados
- Ver nota estimada pela estrutura do concurso

---

## 2. Conquistas

**Estado:** funcional.
**Decisão nesta fase:** manter como está.

### Decisão documentada para fase futura (F2 ou I1):

**Modelo aprovado:**
> Superadmin cria modelos globais de conquistas e metas.
> Escola pode ativar/desativar por conquista.
> Customização específica por escola (nome, ícone, XP) fica para fase posterior.

**Justificativa:** as conquistas atuais são calculadas pelo front a partir de métricas locais (streak, questões, simulados). Não dependem de tabela de conquistas globais ainda. A integração com o banco (`aluno_conquistas`) existe mas é usada para desbloquear, não para listar catálogo.

**Pendência:** quando Superadmin for implementado formalmente, criar catálogo de conquistas em `conquistas` table e conectar com `aluno_conquistas` por id.

---

## 3. Histórico (aba)

**Estado:** bom. O componente `Arquivo.jsx` mostra:
- Grade de semanas anteriores (metas fechadas)
- Status de cada semana (CONCLUÍDA / PARCIAL / AGORA)
- Barra de progresso, dados da semana (questões, acerto, tempo)
- Expansão para ver detalhes da semana

**Avaliação:** suficiente para esta fase.

**O que poderia melhorar (pendência futura):**
- Filtro por tipo de atividade (plano / simulado / extra)
- Agrupamento por período (mês, semestre)
- Indicador visual de semanas com simulado

**Decisão nesta fase:** manter como está. A estrutura já responde bem "o que fiz em cada semana?"

---

## 4. Aluno terminou a semana — o que fazer?

### 4.1 Problema atual
Quando o aluno conclui todos os objetivos da semana (`feitas === consideradas`), o sistema não dá feedback especial nem sugere próximo passo.

### 4.2 Modelo de produto decidido

**Prioridade 1:** Revisar pontos fracos (matérias com acerto < 60%)
**Prioridade 2:** Exercícios extras (questões além do plano)
**Prioridade 3:** Adiantar próxima semana (liberado pela coordenação)

### 4.3 UX implementada nesta fase

No componente `MetaSemana.jsx`, quando `feitas >= consideradas` (semana 100%):

```
Card: "Semana concluída! 🎯"

Você concluiu todos os objetivos desta semana.

[Revisar assuntos com dificuldade]   [Ver desempenho]
```

O botão "Adiantar próxima semana" fica como pendência: requer lógica de servidor para gerar meta antecipada. **Documentado como P1 para fase I1.**

### 4.4 Implementação parcial desta fase
- ✅ Card de "semana concluída" no MetaSemana quando tudo feito
- ✅ Botão "Ver desempenho" (muda tab para "desempenho")
- ⏸️ Botão "Adiantar próxima semana" — pendência I1 (requer servidor)

---

## 5. Decisões documentadas

| Decisão | Fase | Responsável |
|---|---|---|
| Conquistas: superadmin cria catálogo global | Fase futura (F2) | Produto |
| Conquistas: escola ativa/desativa por item | Fase futura (F2) | Produto |
| Adiantar próxima semana: requer gerar-meta antecipado | I1 | Backend |
| Filtros no Histórico por tipo/origem | Polimento (fase posterior) | Front |
| Agrupamento de histórico por mês | Polimento (fase posterior) | Front |
