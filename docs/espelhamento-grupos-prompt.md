# Espelhamento de Grupos — especificação alinhada ao Afiliado Analytics + prompt para implementação

Este documento **corrige** os passos 1–6 que estavam genéricos (rotas da Evolution API direta, etc.) e os alinha ao que o app **já faz hoje**. Serve para você estudar o desenho da feature e para colar o prompt final na hora de implementar com o assistente.

---

## O que é (visão de produto)

Com uma **instância Evolution** já conectada (mesmo número no WhatsApp), o usuário escolhe:

- **Grupo fonte** (ex.: “Ofertas do Daniel”): de onde copiar mensagens de oferta.
- **Grupo destino** (ex.: “Ofertas do José”): onde republicar.

O sistema **monitora** mensagens no fonte (via Evolution → webhook, tipicamente n8n), **extrai** texto/links, **substitui** links de afiliado Shopee pelos **subIds / API do próprio usuário** (mesma ideia do gerador de links e de Grupos de Venda), e **dispara** no grupo destino com a mesma “automação” conceitual — ou seja, conta para **limites de uso de automações em grupos**, como você descreveu.

---

## Correção dos passos (alinhado ao app atual)

### 1. Instância WhatsApp (onboarding)

**Não é** o frontend chamando `GET /instance/fetchInstances` da Evolution diretamente.

No app hoje:

- Listagem: **`GET /api/evolution/instances`** — lê a tabela Supabase **`evolution_instances`** (`nome_instancia`, `numero_whatsapp`, `hash`, etc.) do usuário autenticado.
- Criar linha no banco: **`POST /api/evolution/instances`** — respeita limite de instâncias por plano (`plan-entitlements` → `evolutionInstances`).
- Ações reais na Evolution passam pelo proxy **`POST /api/evolution/n8n-action`** com JSON contendo pelo menos `tipoAcao` e `nomeInstancia`.

`tipoAcao` **suportados hoje** (ver `src/app/api/evolution/n8n-action/route.ts`):

- `verificar_status`
- `criar_instancia` (exige `numeroWhatsApp`)
- `excluir_instancia`
- `reconectar` (exige `hash`)
- `testar_conexao`
- `buscar_grupo`

O webhook do servidor é lido de **`EVOLUTION_N8N_WEBHOOK_URL`** no `.env` (não é rota Evolution crua no browser).

**Identificador:** o app usa o **`nome_instancia`** (string) como chave operacional com o n8n/Evolution, e o **`id` UUID** da linha em `evolution_instances` nas relações com outras features.

---

### 2. Selecionar grupos fonte e destino

**Não é** `GET /group/fetchAllInstances/{instance_name}` chamado pelo SaaS.

No app, a listagem de grupos para uma instância vem de:

- **`POST /api/evolution/n8n-action`** com `tipoAcao: "buscar_grupo"` e `nomeInstancia` igual ao da instância selecionada.

Isso é o mesmo padrão usido em **Calculadora GPL** (`BuscarGruposModal`) e fluxos relacionados: o **n8n** é quem fala com a Evolution e devolve os grupos.

**Grupos de Venda** persistem escolhas em:

- **`listas_grupos_venda`** (listas por instância),
- **`grupos_venda`** (`group_id`, `lista_id`, `instance_id`, `user_id`, …).

Para **Espelhamento**, ainda **não existem** tabelas no repositório; o desenho sugerido (`configuracoes_espelhamento`, `payloads_recebidos`) seria **nova migration** + RLS, com `user_id` e referência a `evolution_instances.id` (e JIDs dos grupos).

---

### 3. Monitorar mensagens (Evolution → webhook global → n8n)

Conceito: a Evolution envia eventos (mensagens) para um **webhook** (fluxo global). O n8n recebe o payload (campos como instância, `remoteJid` do grupo, corpo da mensagem, etc. — o formato exato depende da sua configuração Evolution).

Validação multi-tenant sugerida (igual à sua ideia):

- Lookup no Supabase: “esta **instância** (nome ou `instance_id` resolvido) está autorizada a **monitorar** este **grupo origem** (JID)?”

**No código atual não há** esse webhook de espelhamento; será um **novo** endpoint ou um **novo workflow n8n** apontando para URL placeholder abaixo.

---

### 4. Log de payload no Supabase

Fluxo desejado: após validar origem, o n8n (ou Edge Function) faz **`INSERT`** em uma tabela tipo **`payloads_recebidos`**: `id_mensagem`, instância, grupo_origem, `texto_bruto`, `status` (`pendente`), timestamp, `user_id`.

Isso **ainda não existe** — apenas especificação.

---

### 5. Regras e conversão de link (lógica antes do envio)

- Resolver **grupo destino** a partir da config do usuário (mapeamento origem → destino na tabela de espelhamento).
- **Converter links** no texto: reutilizar a mesma ideia de **`/api/shopee/generate-link`** (e subIds do usuário) usada em **`/api/grupos-venda/disparar`**, adaptada para texto livre (extrair URLs Shopee do concorrente e gerar o link afiliado do usuário).

Pode ser um **novo endpoint** interno, ex.: “recebe texto + `user_id` / cookie, devolve texto com links substituídos”, para o n8n chamar antes do passo 6.

---

### 6. Envio ao grupo destino

**Não assuma** que o app chama `POST /message/sendText/{instance}` da Evolution diretamente do Next.js.

No **Grupos de Venda**, o disparo monta um payload e envia para webhook n8n — hoje em **`/api/grupos-venda/disparar`** o destino é o webhook fixo `https://n8n.iacodenxt.online/webhook/achadinhoN1` (ver arquivo da rota), com campos como `instanceName`, `hash`, `groupIds`, `descricao`, `imagem`, `linkAfiliado`, etc.

Para **Espelhamento**, o padrão natural é **reutilizar o mesmo tipo de integração** (novo webhook ou novo branch no n8n) que recebe texto já convertido e envia pela Evolution — alinhado ao que vocês já operam, não à documentação REST genérica da Evolution.

Após sucesso, atualizar **`payloads_recebidos.status`** para algo como `enviado` (e tratar erro).

---

## Webhook “falso” para desenvolvimento (espelhamento)

Até existir o workflow real no n8n, use como placeholder:

**`https://falsewebhook.espelhamento.n8n.codenxt`**

(Tratar como URL de teste; o backend pode espelhar o padrão de `EVOLUTION_N8N_WEBHOOK_URL` com algo como `ESPELHAMENTO_N8N_WEBHOOK_URL` quando implementarem.)

---

## Limites de plano (números do código — `src/lib/plan-entitlements.ts`)

Estes são os limites **atuais** de **Grupos de Venda**; a feature Espelhamento deve **alinhar** a ela para não permitir “10 + 10” automações implícitas.

| Plano   | `maxActiveCampaigns` | `maxGroupsTotal` | `maxLists` | `evolutionInstances` |
|--------|----------------------|------------------|------------|------------------------|
| padrão/legacy | 1 | 1 | 1 | 1 |
| pro    | 10 | 10 | ∞ (`null`) | 2 |
| staff  | 20 | 20 | ∞ | 10 |

- **Campanhas ativas** contam linhas em **`grupos_venda_continuo`** com `ativo = true` (ver `getUsageSnapshot` em `plan-server.ts`).
- **Uso de grupos** conta linhas em **`grupos_venda`**.

**Regra de negócio que você pediu (resumo):** se o espelhamento **envia para um grupo destino**, isso deve consumir o mesmo “orçamento” que uma automação em grupo (campanha ativa + grupo já usado), e **não** permitir destino que já está coberto por outra automação, para não estourar o teto de grupos/campanhas.

Detalhes exatos (uma linha na tabela de espelhamento conta como campanha ativa ou só grupo?) ficam para a implementação, mas o prompt abaixo já pede coerência com `getEntitlementsForUser` + `getUsageSnapshot`.

---

## Onde entraria a aba no app

- Sidebar: **`src/app/(main)/dashboard/layout.tsx`** — array `sidebarNavItems` (hoje inclui “Grupos de Venda” → `/dashboard/grupos-venda`).
- Nova rota sugerida: **`/dashboard/espelhamento-grupos`** (página client + APIs sob `/api/...`).

---

## Prompt pronto para colar no Cursor (implementação futura)

Use o bloco abaixo numa nova conversa quando for codar a feature.

```markdown
## Contexto

Projeto: Afiliado Analytics (Next.js App Router, Supabase Auth, tabelas `evolution_instances`, `listas_grupos_venda`, `grupos_venda`, `grupos_venda_continuo`). Evolution não é chamada direto do browser: usar `GET/POST /api/evolution/instances` e `POST /api/evolution/n8n-action` com `tipoAcao` em: verificar_status, criar_instancia, excluir_instancia, reconectar, testar_conexao, buscar_grupo. Listar grupos = `buscar_grupo` + `nomeInstancia`.

Limites de plano estão em `src/lib/plan-entitlements.ts` e uso em `src/lib/plan-server.ts` (campanhas ativas, total de grupos, listas, instâncias).

Disparo atual de ofertas: `POST /api/grupos-venda/disparar` chama webhook n8n com payload (instanceName, hash, groupIds, descricao, …).

## Objetivo

Implementar a feature **Espelhamento de Grupos**:

1. UI: nova aba na sidebar do dashboard, rota `/dashboard/espelhamento-grupos`.
2. O usuário com instância conectada escolhe grupo **fonte** (monitorar) e grupo **destino** (republicar), ambos da mesma lógica de grupos que já usamos (`buscar_grupo`).
3. Persistir config em Supabase (novas tabelas, ex.: `configuracoes_espelhamento`, `payloads_recebidos` — com RLS por `user_id`).
4. Pipeline externo: Evolution → webhook → n8n valida instância+grupo origem no Supabase; se ok, insere payload pendente; chama endpoint do app para **substituir links Shopee** no texto pelo link afiliado do usuário (reutilizar lógica de `/api/shopee/generate-link`); envia ao destino via mesmo padrão de webhook que Grupos de Venda (novo URL ou variável de ambiente). Placeholder até o n8n existir: `https://falsewebhook.espelhamento.n8n.codenxt`.
5. **Limites:** espelhamento deve respeitar os mesmos tetos que Grupos de Venda (`maxActiveCampaigns`, `maxGroupsTotal`, etc.): não permitir destino que já tem automação/campanha conflitante de forma a ultrapassar o plano; documentar a regra na UI.

## Restrições

- Não quebrar fluxos existentes de `n8n-action` e `grupos-venda`.
- Seguir padrões do projeto (rotas em `src/app/api/`, componentes do dashboard).
- Entregar migrations Supabase e políticas RLS.

## Entregáveis

- Migrations + tipos
- APIs CRUD da configuração de espelhamento + endpoint de “processar texto” para o n8n
- Página da aba com UX alinhada às telas Grupos de Venda / GPL
- Testes manuais descritos no PR
```

---

## Notas finais

- Os nomes **`configuracoes_espelhamento`** e **`payloads_recebidos`** são coerentes com o desenho; confirme nomes em snake_case igual ao restante do schema.
- O **Pro** no código tem **2 instâncias** Evolution no máximo, não 10 — se o produto mudar, ajuste `plan-entitlements.ts` primeiro e depois a feature.

---

*Gerado para estudo e reuso de prompt; ajuste URLs e nomes de tabela quando fechar o schema com o time.*
