# ADR-0001: Ambiente Supabase de produção

**Data:** 02/09/2026 (atualizado)
**Etapa:** 2

## Contexto
Existem dois espaços Supabase hoje: `bdjkgrzfzoamchdpobbl` ("Teste e Vitrine", populado, `us-east-1`) e a organização `eerbpzacxolwlwsltynb` (nova, criada por Gabriel). Confirmado em 02/09: a organização nova ainda **não tem nenhum projeto Supabase criado dentro dela**, é uma organização vazia reservada, não um segundo banco pronto.

## Decisão
`bdjkgrzfzoamchdpobbl` permanece como ambiente de teste/demo, sem dado real. A produção dedicada só será criada dentro da organização `eerbpzacxolwlwsltynb`, em `sa-east-1`, Supabase Pro, e só depois do Gate G2 (entrada recebida).

Quando a produção nova existir, `bdjkgrzfzoamchdpobbl` pode ser reaproveitado como ambiente de staging/testes em vez de ser desativado. Isso está alinhado com o próprio plano mestre (§6.2, "não contratar staging pago sem necessidade comprovada"): reaproveitar um ambiente Free já existente é mais barato do que criar um staging pago novo. Condição: a partir do momento em que a produção nova existir, nenhum tráfego real ou aluno real pode voltar a passar por esse projeto.

## Consequência
Nenhum gasto de produção antes de receita contratada. Nenhuma migração de dado real necessária até lá, porque não há dado real hoje em nenhum dos dois ambientes. Rota de staging já definida com antecedência, sem custo adicional.
