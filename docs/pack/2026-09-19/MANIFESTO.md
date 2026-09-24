# MANIFESTO — Pack de prints Triliva

**Data da produção:** 19/09/2026  
**Código capturado:** `1ac7c6429968ef6ebafea34d7c539ef772e67a8a` (`main`)  
**Ambiente de demonstração:** projeto Supabase `bdjkgrzfzoamchdpobbl`  
**Escola fictícia da narrativa:** Instituto Meridiano  
**Aluno principal:** Helena Vasconcelos  
**Origem das imagens:** interface real do produto; nenhuma tela interna foi redesenhada ou reconstruída.

## Convenção aplicada

- Desktop: viewport real `1440 × 900`, captura em DPR 2 → arquivos integrais `2880 × 1800`.
- Celular: layout real `390 × 844`, captura em DPR 3 → arquivos integrais `1170 × 2532`.
- Arquivos `*-recorte.png`: cortes focados a partir da própria captura integral, sem alterar textos, números, cores ou componentes.
- Estados 04, 05, 24 e 25 foram preparados temporariamente no tenant fictício para captura e tiveram verificação adicional em largura de 360 px.
- As alterações temporárias da Helena foram restauradas ao fim: `trilha_id` original, onboarding concluído e `must_change_password=false`.
- O helper temporário de GitHub Actions usado para captura foi removido da branch temporária após a execução.
- A branch `main` não foi alterada para produzir este pack.

## Cobertura

**23 das 25 telas/estados do plano editorial estão representados.**  
Existem **39 capturas integrais** e **26 recortes focados**.

| Nº | Tela | Status | Arquivos / observação |
|---:|---|---|---|
| 01 | Portal público | CAPTURADA | 01-portal-desktop.png, 01-portal-mobile.png |
| 02 | Login da coordenação | CAPTURADA | 02-login-coordenacao-desktop.png, 02-login-coordenacao-mobile.png |
| 03 | Recuperação de acesso | CAPTURADA | 03-recuperacao-acesso-mobile.png |
| 04 | Redefinição/troca de senha | CAPTURADA | 04-troca-senha-obrigatoria-mobile.png |
| 05 | Hoje | CAPTURADA | 05-hoje-desktop.png, 05-hoje-mobile.png |
| 06 | Trilha | NÃO INCLUÍDA | Tela retorna “Trilha temporariamente indisponível” no SHA capturado; não foi mascarado nem reconstruído. |
| 07 | Registrar | CAPTURADA | 07-registrar-mobile.png |
| 08 | Desempenho | CAPTURADA | 08-desempenho-desktop.png, 08-desempenho-mobile.png |
| 09 | Simulados | CAPTURADA | 09-simulados-desktop.png, 09-simulados-mobile.png |
| 10 | Conquistas | CAPTURADA | 10-conquistas-mobile.png |
| 11 | Histórico | CAPTURADA | 11-historico-desktop.png, 11-historico-mobile.png |
| 12 | Plano | CAPTURADA | 12-plano-desktop.png, 12-plano-mobile.png |
| 13 | Resumo do responsável | CAPTURADA | 13-responsavel-desktop.png, 13-responsavel-mobile.png |
| 14 | Painel da coordenação | CAPTURADA | 14-painel-desktop.png, 14-painel-mobile.png |
| 15 | Alunos | CAPTURADA | 15-alunos-desktop.png, 15-alunos-mobile.png |
| 16 | Ranking | CAPTURADA | 16-ranking-desktop.png |
| 17 | Turmas | CAPTURADA | 17-turmas-desktop.png, 17-turmas-mobile.png |
| 18 | Painel LGPD | CAPTURADA | 18-lgpd-desktop.png |
| 19 | Marca | CAPTURADA | 19-marca-desktop.png, 19-marca-mobile.png |
| 20 | Ficha do aluno | CAPTURADA | 20-ficha-desktop.png, 20-ficha-mobile.png |
| 21 | Credenciais | CAPTURADA | 21-credenciais-desktop.png, 21-credenciais-mobile.png |
| 22 | Vínculos de responsáveis | CAPTURADA | 22-vinculos-responsaveis-desktop.png, 22-vinculos-responsaveis-mobile.png |
| 23 | Administração interna | NÃO INCLUÍDA | Revisão interna do fornecedor; o próprio plano determina exclusão do vídeo comercial. |
| 24 | Onboarding | CAPTURADA | 24-onboarding-mobile.png |
| 25 | Trilha não configurada | CAPTURADA | 25-trilha-nao-configurada-desktop.png, 25-trilha-nao-configurada-mobile.png |

## Duas exclusões deliberadas

### 06. Trilha
O produto, no SHA capturado contra o banco atual, apresentou o estado real **“Trilha temporariamente indisponível”**. O pack comercial não inclui essa imagem. Não foi feita edição de banco, montagem de interface ou substituição por uma tela fictícia para esconder o defeito.

### 23. Administração interna
O plano de produção classifica essa tela como operação do fornecedor e determina que seja excluída do vídeo comercial. Por isso ela não integra o pack.

## Uso recomendado

Para a apresentação e o vídeo curto, priorizar:
`05-hoje-mobile`, `07-registrar-mobile`, `08-desempenho-desktop`, `14-painel-desktop`, `20-ficha-desktop`, `13-responsavel-mobile` e `09-simulados-mobile`.

Os arquivos integrais preservam o contexto da tela. Os `-recorte` devem ser usados quando a montagem precisar aproximar o elemento narrado sem ampliar artificialmente uma captura pequena.
