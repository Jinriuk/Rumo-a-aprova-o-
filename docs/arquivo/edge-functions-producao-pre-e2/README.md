# Edge Functions de produção antes da Etapa 2 (arquivo de reversão)

Código das 7 Edge Functions de produção (`zckyhihxjjbnqjqilymn`), lido com
`get_edge_function` em 2026-09-24, antes da publicação da Etapa 2. Os arquivos
foram gravados a partir do retorno bruto da ferramenta, sem transcrição manual.

**É a reversão verificada dos dois ambientes.** Os 7 `ezbr_sha256` abaixo são
idênticos aos que o demo (`bdjkgrzfzoamchdpobbl`) tinha antes do redeploy de
2026-09-24 20:48 a 20:55 UTC. Os valores do demo estão em
`docs/operacao/aplicacao-e2-0055-0058.md`.

## Funções

Todas estavam ACTIVE e com `verify_jwt` false. O `entrypoint_path` era
`source/index.ts`.

| Função | Versão | Publicada em (UTC) | ezbr_sha256 |
|---|---|---|---|
| `backoffice-coordenador` | 4 | 2026-09-13 08:12 | `f1cd2e67c9b278c063031b87f7f7292d5a96ea4ffd3b420145a4b4c239c28dff` |
| `gerar-meta` | 4 | 2026-09-13 08:45 | `28e7a1cd9e29acc49c9162fe3347a0740a045f0da90998a655beff595763e40e` |
| `lgpd-titular` | 3 | 2026-09-13 07:48 | `79cfb079897b101e98184f70ea2823bc3ff246b8486676a94e7aafd94c375be2` |
| `provisionar-aluno` | 4 | 2026-09-13 08:16 | `402c5f3c5b862db0415ae99c3cfeec56e33e29b28b5781ba706111bf20134897` |
| `revogar-responsavel` | 3 | 2026-09-13 08:09 | `6e90f89925187d23e79cd65beb4233dc34076a3ef43be5e3a59f9b3f36231b9c` |
| `trocar-senha` | 2 | 2026-09-13 08:07 | `d43138424b17e39817974823f8b3a9d11097628ea739df3064bb1cd66790731b` |
| `virar-semana` | 3 | 2026-09-13 07:46 | `deef4ac7b570e3499f2e3158578253e749a1a4b433af58a8919b907044e19de1` |

## Arquivos

| Arquivo | Bytes | sha256 |
|---|---|---|
| `backoffice-coordenador/source/index.ts` | 14721 | `d1624dc910dd8c3459a3624a60218c32b4024b35ceed779a16df5283e2fee3bf` |
| `backoffice-coordenador/_shared/cors.ts` | 4434 | `a6b8c55163cf4f31e418b3275de61f38d4f7859022356a8c92b56d513a32bbe6` |
| `gerar-meta/source/index.ts` | 4537 | `39b31c427100a0eca77d868661c2aa65a9db7a3acb288a5594fedb885c613f6e` |
| `gerar-meta/_shared/contexto.ts` | 2154 | `5b0ff9582aba9d88e51d42cd1a1dc9054a32ec0b40a2bb18e3a7856026161584` |
| `gerar-meta/_shared/cors.ts` | 4434 | `a6b8c55163cf4f31e418b3275de61f38d4f7859022356a8c92b56d513a32bbe6` |
| `lgpd-titular/source/index.ts` | 5204 | `4ab8a64ab7bef3f9b3c99be965bd35f5719a69ad2553c554d2e616602e5bb1a9` |
| `lgpd-titular/_shared/contexto.ts` | 2154 | `5b0ff9582aba9d88e51d42cd1a1dc9054a32ec0b40a2bb18e3a7856026161584` |
| `lgpd-titular/_shared/cors.ts` | 4434 | `a6b8c55163cf4f31e418b3275de61f38d4f7859022356a8c92b56d513a32bbe6` |
| `provisionar-aluno/source/index.ts` | 17896 | `ba1bbc7dc5e4d8a4cfe1792072b2ad801fed1eae0f7def193d2fbbf37956e46f` |
| `provisionar-aluno/_shared/cors.ts` | 4434 | `a6b8c55163cf4f31e418b3275de61f38d4f7859022356a8c92b56d513a32bbe6` |
| `revogar-responsavel/source/index.ts` | 5381 | `898b8aa65dfbb1aad0ab81eaefbde8b88ce2a2f7a65da97cf281d189b292399d` |
| `revogar-responsavel/_shared/cors.ts` | 4434 | `a6b8c55163cf4f31e418b3275de61f38d4f7859022356a8c92b56d513a32bbe6` |
| `trocar-senha/source/index.ts` | 6882 | `a8e03bb5053050c0f46b223fb159d441fb1fd0a1ecc0741647adcc5251687e15` |
| `trocar-senha/_shared/cors.ts` | 4434 | `a6b8c55163cf4f31e418b3275de61f38d4f7859022356a8c92b56d513a32bbe6` |
| `virar-semana/source/index.ts` | 3265 | `a3d93803b72a7b5103dc1a24bf530a00c369e798a35edf1cd87f0980de6c6251` |
| `virar-semana/_shared/contexto.ts` | 2154 | `5b0ff9582aba9d88e51d42cd1a1dc9054a32ec0b40a2bb18e3a7856026161584` |
| `virar-semana/_shared/cors.ts` | 4434 | `a6b8c55163cf4f31e418b3275de61f38d4f7859022356a8c92b56d513a32bbe6` |

## Relação com o git

16 dos 17 arquivos são idênticos, byte a byte, ao `main` em `48ff020`, que é o
commit anterior ao #142. A exceção é `provisionar-aluno/source/index.ts`, que
difere em uma linha de comentário (linha 293, `// ── Gerar credencial de aluno ──…`):
o traço decorativo tem 37 caracteres `─` aqui e 46 no git. O código é o mesmo.
Por isso a reversão é este arquivo, e não o git.

Este `_shared/cors.ts` ainda tem `http://localhost:5173` e `http://localhost:3000`
no default. Republicar este arquivo reabre a C-S02.

## Como republicar

Para cada função, a chamada de deploy (MCP `deploy_edge_function` ou equivalente)
leva:

- `name` igual ao nome da pasta;
- `entrypoint_path` igual a `source/index.ts`;
- `verify_jwt` false;
- os arquivos da pasta, com o caminho relativo dela como `name`
  (`source/index.ts`, `_shared/cors.ts` e, quando existir, `_shared/contexto.ts`).

Depois, `list_edge_functions` precisa mostrar o mesmo `ezbr_sha256` da tabela.
Se o hash vier diferente, o conteúdo publicado não é o do arquivo.
