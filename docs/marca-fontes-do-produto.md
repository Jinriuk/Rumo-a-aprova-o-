# Fontes do produto (A20)

**Data:** 24/09/2026 · **Origem:** Bloco 4 do documento de correções de 23/09/2026.
**Escopo:** só levantamento. Nada foi mudado.

As apresentações comerciais usam Cambria e Calibri (nos PDFs, Caladea e Carlito) porque as famílias
do produto não estavam documentadas em lugar nenhum fora do código. Estas são as famílias que o
produto realmente usa.

## As famílias

| Uso | Família | Pesos carregados | Reserva (fallback) |
|---|---|---|---|
| **Títulos**: nomes de seção, títulos de modal, números grandes dos cards (classe `.disp`), marca na tela de entrada | **Fraunces** (serifada, eixo óptico `opsz` 9–144) | 400, 600, 700 | Georgia, serif |
| **Texto**: corpo, rótulos, botões, campos de formulário | **Archivo** (sem serifa) | 400, 500, 600, 700 | system-ui, sans-serif |
| **Números** em tabelas e cards | Sem família própria: a classe `.num` só liga `font-variant-numeric: tabular-nums` (algarismos de largura fixa) sobre a família do elemento, Archivo ou Fraunces quando combinada com `.disp` | · | · |
| **Códigos de acesso** e hexadecimais de cor (credencial, tela Marca) | `monospace` do sistema | · | · |

## Onde estão definidas

- **Carregamento:** `app/index.html`, via `<link>` do Google Fonts:
  `Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700` e `Archivo:wght@400;500;600;700`, com
  `display=swap`. A CSP em `vercel.json` libera `fonts.googleapis.com` (`style-src`) e
  `fonts.gstatic.com` (`font-src`).
- **Regra global:** `app/src/shared/ui/tema.js`, no bloco de CSS global:
  - `.disp { font-family: 'Fraunces', Georgia, serif; }`
  - `input, select, textarea { font-family: Archivo, sans-serif; }`
  - `body { font-family: Archivo, … }`, acrescentado no Bloco 4 (D08) para os modais que saem
    por portal.
- **Raiz do app:** `app/src/App.jsx`, `fontFamily: "Archivo, system-ui, sans-serif"`.
- **Tela de entrada e experiência:** `app/src/shared/ui/experiencia.css` (`.login-shell` em
  Archivo; títulos e números de missão em Fraunces).
- **Decisão de origem:** "design fixo navy `#0A1622` / dourado `#CDA349` / Fraunces / Archivo",
  herdado da versão anterior (`docs/fundacao/02-premissas-decisoes.md`,
  `docs/fundacao/06-arquitetura-fechada.md`). O white-label troca logo, nome e cor de acento,
  nunca a tipografia.

## Licenças

| Família | Licença | Autoria | Uso em material comercial |
|---|---|---|---|
| Fraunces | SIL Open Font License 1.1 | Undercase Type (Phaedra Charles e Flavia Zimbardi) | Livre, inclusive para embutir em PDF e PPTX e para uso comercial. A OFL proíbe só vender a fonte isolada e reusar o nome reservado numa versão modificada. |
| Archivo | SIL Open Font License 1.1 | Omnibus-Type (Héctor Gatti) | Idem |

As duas estão no Google Fonts e podem ser baixadas de lá para instalar na máquina que monta as
apresentações. Com elas instaladas, os slides e os PDFs deixam de precisar de Cambria/Calibri e
ficam iguais ao produto.

> A atribuição e a licença acima vêm dos metadados públicos das famílias no Google Fonts. Não
> há cópia do arquivo `OFL.txt` no repositório, porque as fontes são servidas pelo Google e não
> vêm empacotadas no app. Se algum dia forem auto-hospedadas (em `app/public`), o `OFL.txt` de
> cada família precisa ir junto.
