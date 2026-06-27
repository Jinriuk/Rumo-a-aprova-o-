# Relatório Visual & Prontidão para Demo — QA0 pós-D0

## Estética geral

Navy #0A1622 + dourado #CDA349, tipografia Fraunces/Archivo. Identidade militar madura e premium, não infantil. Patentes e conquistas reforçam o tema sem exagero. Desktop com bom acabamento; mobile não verificado visualmente nesta sessão.

## 3 melhores telas para print/vídeo

1. Plano / Sua jornada (aluno) — timeline de missões com preview de desbloqueio.
2. Conquistas / Patentes (aluno) — narrativa militar, Ver carreira completa.
3. Marca / white-label (coordenação) — preview ao vivo com logo/cor da escola.

## 3 melhores alunos demo para print

1. Lucas Demo — perfil forte e completo (mas suavizar, COO-2).
2. Um aluno mediano com progresso realista (~60-70% acerto).
3. Um aluno com boa adesão recente para a aba Histórico.

## 3 piores pontos (corrigir antes de gravar)

1. Meta atrasada 59/60 no Painel (COO-1) — passa imagem de sistema atrasado.
2. Ranking com Lucas artificial (COO-2) — parece dado de teste.
3. Aluno EsPCEx com conteúdo de Colégio Naval (COO-4) — quebra credibilidade pedagógica.

Além disso: resíduo Turma CN 2026 com 2 alunos (COO-3); URL vercel.app (VER-1).

## Ajustes antes do vídeo de demo

- Suavizar dados demo (metas, ranking), remover turma-resíduo, corrigir trilha x concurso.
- Usar domínio próprio e navegar só pelas 3 telas-vitrine.
- Não verificar mobile ao vivo sem antes validar Simulados/Desempenho em 430px.

## Achados visuais

| ID | Achado | Prio | Fase |
|----|--------|------|------|
| VIS-1 | Mobile não validado (Simulados/Desempenho podem ter overflow) | P2 | C1 |
| VIS-2 | URL vercel.app reduz percepção de produto | P2 | patch |
| VIS-3 | Dissonância meta concluída vs poucos dias (responsável) | P3 | patch |
