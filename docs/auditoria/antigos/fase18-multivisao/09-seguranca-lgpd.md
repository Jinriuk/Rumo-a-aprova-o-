# Auditoria — Persona 9: SEGURANÇA / LGPD

> Auditoria por engenheiro de segurança e privacidade, foco em SaaS educacional, dados de
> menores e LGPD. Base: `supabase/migrations/0001–0006`, `supabase/functions/*`,
> `config.toml`, `.env*`, e o seam de dados. Riscos classificados crítico/alto/médio/baixo.

---

## 1. Nota geral de maturidade da área: **82/100**

A postura de segurança é levada a sério e está bem acima da média para o estágio: isolamento
por RLS provado por teste, `service_role` fora do front por design, signup desabilitado
(menor não cria conta), minimização de dados (só nome do aluno), região Brasil pretendida
(LGPD) e LGPD funcional (export/exclusão). Os riscos remanescentes são de endurecimento e de
robustez operacional, não furos abertos de isolamento.

## 2. O que está forte

- **Isolamento entre escolas é regra de banco e está provado.** RLS "negar por padrão" em
  todas as tabelas; o teste `isolamento.test.mjs` assume a identidade real (papel
  `authenticated` + claims JWT, igual ao Supabase) e prova que a escola A não lê nem escreve
  nada da escola B, incluindo tentativa de forja de tenant.
- **`service_role` nunca no front/repo.** Vive só nas Edge Functions (`_shared/contexto.ts`,
  via env do Supabase). O front usa apenas a `anon key` pública — e a segurança está na RLS.
- **Aluno não falsifica o próprio progresso/gamificação.** Não há policy de escrita de `metas`
  por ninguém via API (só o motor); o aluno não escreve `aluno_niveis` nem `aluno_xp_eventos`
  (só coordenação/servidor). Gamificação não é auto-pontuável.
- **Dados de menores tratados com cuidado.** Minimização (só nome, sem CPF/documento); menor
  não cria conta — credencial provisionada pela escola; `enable_signup = false`.
- **Funções sensíveis fechadas.** Motor e LGPD são `SECURITY DEFINER` com `search_path`
  fixado e executáveis só pelo `service_role`; os wrappers `public.*` (`0005`) revogam de
  `authenticated`/`anon` e concedem só ao `service_role`.
- **Edge Functions com porteiro.** `chamador()` identifica pelo token verificado (não por
  campo de formulário); `provisionar-aluno`, `gerar-meta` e `lgpd-titular` exigem papel
  `coordenacao` e validam que o aluno pertence à escola do chamador (`alunoDaEscola`).
- **LGPD operacional.** Export de dossiê completo e exclusão em cascata com remoção das contas
  de Auth; log de acesso preservado como auditoria. Há `logs_acesso` (quem leu dado de aluno).
- **Auditoria de níveis** append-only por gatilho `SECURITY DEFINER` (quem mudou, de quê para
  quê).

## 3. O que está fraco / riscos

### Crítico
- Nenhum risco **crítico** de isolamento aberto. (O isolamento é o eixo do sistema e está
  provado.)

### Alto
- **A1 — Email/credencial de aluno derivada deterministicamente do código.** O login por
  código vira `email = codigo@codigo.acesso.local` e `senha = codigo`. Quem descobrir/adivinhar
  um código autentica. A entropia do código (geração aleatória) mitiga, mas o acoplamento
  código→credencial é frágil. Recomenda-se desacoplar (email opaco/UUID) e/ou rate limiting +
  rotação fácil. *(`shared/data/index.js: entrarComCodigo`, `provisionar-aluno`)*
- **A2 — Sem rate limiting explícito no login por código.** Sem limite, um atacante pode
  tentar códigos em volume. Depende de proteção do GoTrue/infra — precisa ser confirmado e
  configurado.

### Médio
- **M1 — Comparação de chave de serviço na `virar-semana` por `!==`** (string) em vez de
  comparação tempo-constante (`timingSafeEqual`). Vetor estreito (a chave é o segredo), mas é
  endurecimento barato. *(`functions/virar-semana/index.ts`)*
- **M2 — `virar_semana()` com escopo global** (todos os alunos, sem filtro por escola). Não é
  alcançável via API (só `service_role`), mas convém blindar como defesa em profundidade.
- **M3 — Ordem do log na exclusão LGPD:** o log é gravado antes da RPC de exclusão; se a
  exclusão falhar, fica registro de tentativa sem efetivação (auditável, mas inconsistente).
- **M4 — `.env.production` versionado** com URL + anon key de demo. São públicas por design,
  mas expõem o projeto e é melhor prática mantê-las fora do repo / em secrets.

### Baixo
- **B1 — Região `sa-east-1` é intenção documentada, não imposta por config.** Precisa ser
  garantida no provisionamento do projeto (LGPD: dado de menor no Brasil).
- **B2 — Retenção/backup não documentados** no repositório (dependem do plano Supabase).
- **B3 — `vw_recorrencia_medida` global** sem filtro de tenant (conteúdo estatístico, não
  sensível) — documentar como proposital.

## 4. O que está confuso

- **CORS `*` nas Edge Functions** — aceitável para endpoints autenticados por Bearer, mas vale
  restringir a origem do app em produção.
- **Política de senha do aluno** = o próprio código: não há fluxo de "esqueci a senha" porque
  o modelo é provisão pela escola — coerente, mas precisa estar claro no manual.

## 5. O que pode quebrar com uso real

- **Tentativa de brute force de códigos** sem rate limiting confirmado.
- **Exclusão LGPD parcial** se a remoção de conta de Auth falhar no meio do loop (sem
  transação distribuída entre banco e Auth).

## 6. Problemas críticos

- Nenhum furo crítico de isolamento. (Manter o teste de isolamento como gate de release.)

## 7. Problemas importantes

1. Desacoplar credencial do código + garantir rate limiting (A1/A2).
2. Endurecer comparação de chave e blindar a virada (M1/M2).
3. Garantir região Brasil por configuração e documentar retenção/backup (B1/B2).

## 8. Melhorias desejáveis

- `timingSafeEqual` na verificação de chave.
- Restringir CORS à origem do app.
- Política de retenção e rotina de backup documentadas e testadas (restore drill).
- Idempotência/transação na exclusão LGPD (banco + Auth).

## 9. O que não precisa mexer

- Modelo RLS e a separação de privilégio (`service_role` só no servidor).
- Minimização de dados de menores e signup desabilitado.
- LGPD export/exclusão (lógica está correta; ajustar só ordem/atomicidade).
- Logs de acesso e auditoria de níveis.

## 10. O que falta para considerar fechado (visão segurança/LGPD)

1. Credencial de aluno desacoplada do código + rate limiting confirmado.
2. Região Brasil imposta no provisionamento; retenção/backup documentados e testados.
3. Endurecimentos (timingSafeEqual, CORS restrito, atomicidade na exclusão).
4. `.env.production` fora do repo.

## 11. Lista objetiva de recomendações (por severidade)

| Sev. | Recomendação |
|------|--------------|
| Alto | Desacoplar email/senha do código; confirmar/forçar rate limiting no login |
| Médio | `timingSafeEqual` na virada; blindar `virar_semana` por escola; atomicidade na exclusão LGPD |
| Médio | Tirar `.env.production` do repo; usar secrets |
| Baixo | Garantir `sa-east-1` no provisionamento; documentar/testar backup e retenção; restringir CORS |
| Baixo | Documentar `vw_recorrencia_medida` como global proposital |

## 12. Veredito final

**Aprovado com ressalvas.** A segurança é genuína: o isolamento entre tenants — o risco número
um de um SaaS escolar com dados de menores — está correto e provado, e a `service_role` está
fora do alcance do navegador. O que impede o "aprovado pleno" são endurecimentos (credencial
por código, rate limiting, região imposta, backup documentado) que devem ser resolvidos antes
de um cliente real com dados de menores em produção. Feitos, a área vai para a faixa de 92.
