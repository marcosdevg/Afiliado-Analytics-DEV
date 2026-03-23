# Guia de Deploy - Sistema de Planos (Padrão / Pro)

Este guia explica passo a passo como subir o sistema de planos em produção **sem derrubar nenhum acesso existente**.

---

## Resumo do que foi feito

| O que | Onde |
|-------|------|
| Coluna `plan_tier` em profiles (default `padrao`) | Migration SQL |
| Coluna `checkout_url` em subscriptions | Migration SQL |
| Tabela `video_export_usage` (controle diário) | Migration SQL |
| Catálogo de checkout links / plan IDs | `src/lib/kiwify-plan-catalog.ts` |
| Webhook atualizado (resolve tier, salva checkout_url) | `src/app/api/kiwify-webhooks/route.ts` |
| Limites por plano (entitlements) | `src/lib/plan-entitlements.ts` |
| Helpers de servidor | `src/lib/plan-server.ts` |
| Guards de API (ATI, Meta, Vídeo, Evolution, etc.) | Várias rotas em `src/app/api/` |
| Frontend: sidebar com cadeado, gating de páginas Pro | Layout + ProFeatureGate |
| API para o frontend consultar plano | `/api/me/entitlements` |

---

## Passo 1: Rodar a Migration SQL no Supabase

> **IMPORTANTE**: Este passo deve ser feito ANTES de fazer o deploy do código na Vercel.

1. Abra o **Supabase Dashboard** do seu projeto
2. Vá em **SQL Editor** (menu lateral esquerdo)
3. Clique em **New Query**
4. Copie e cole **TODO** o conteúdo do arquivo:
   ```
   supabase/migrations/20250317_plan_tier_checkout_url_video_usage.sql
   ```
5. Clique em **Run** (botão verde no canto superior direito)
6. Aguarde aparecer **"Success. No rows returned"** — isso é normal, são comandos DDL

### O que essa migration faz:

- Adiciona a coluna `plan_tier` na tabela `profiles` com valor padrão `'padrao'`
  - **Todos os 130 usuários existentes receberão automaticamente `plan_tier = 'padrao'`**
  - Nenhum acesso será perdido
- Adiciona a coluna `checkout_url` na tabela `subscriptions`
- Cria a tabela `video_export_usage` para controlar o limite diário de exports de vídeo
- Configura RLS (segurança) na nova tabela

### Como verificar se deu certo:

1. Vá em **Table Editor** no Supabase
2. Abra a tabela `profiles`
3. Verifique que apareceu a coluna `plan_tier` e todos os registros mostram `padrao`
4. Abra a tabela `subscriptions`
5. Verifique que apareceu a coluna `checkout_url` (estará vazia nos registros antigos, e isso é normal)
6. Verifique que a tabela `video_export_usage` foi criada (estará vazia)

---

## Passo 2: Configurar Variáveis de Ambiente (Opcional)

Se no futuro você criar novos planos na Kiwify com IDs diferentes, pode configurar estas variáveis de ambiente na Vercel:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `KIWIFY_PRO_PLAN_IDS` | IDs de planos Kiwify que são Pro (separados por vírgula) | `uuid1,uuid2` |
| `KIWIFY_PADRAO_PLAN_IDS` | IDs de planos Kiwify que são Padrão (separados por vírgula) | `uuid3,uuid4` |

> **Para o momento atual, NÃO é obrigatório configurar estas variáveis.** O sistema já reconhece os checkout links dos novos planos que você forneceu:

**Checkout links já cadastrados no código:**

| Plano | Checkout Link | Tier |
|-------|--------------|------|
| Padrão Mensal (Principal) | `Q1eE7t8` | padrao |
| Padrão Trimestral (Principal) | `jGMeK6e` | padrao |
| Pro Mensal (Principal) | `4fAAtkD` | pro |
| Pro Trimestral (Principal) | `TndnsLB` | pro |
| Padrão Mensal (Secundário) | `M2qUkd9` | padrao |
| Padrão Trimestral (Secundário) | `HijcSN1` | padrao |
| Pro Mensal (Secundário) | `0mRaPls` | pro |
| Pro Trimestral (Secundário) | `xaX0Ryx` | pro |

Além disso, todos os IDs de planos/produtos antigos (legados) são automaticamente tratados como `padrao`.

---

## Passo 3: Fazer o Deploy na Vercel

1. Faça commit das alterações:
   ```
   git add .
   git commit -m "feat: sistema de planos Padrao/Pro com limites e gates"
   ```
2. Faça push para o repositório:
   ```
   git push
   ```
3. A Vercel fará o deploy automaticamente
4. Aguarde o deploy terminar (normalmente 2-3 minutos)

---

## Passo 4: Testar

### Teste rápido (usuário existente - Plano Padrão):

1. Faça login com um usuário existente
2. Na sidebar, os itens **ATI**, **Criar Campanha Meta** e **Gerador de Criativos** devem aparecer com um cadeado
3. Ao clicar neles, deve aparecer uma mensagem "Recurso exclusivo do Plano Pro"
4. Na **Calculadora GPL**, os cards de resumo e o painel de grupos/campanhas devem mostrar "disponível no Plano Pro"
5. Em **Site de Captura**, o usuário deve poder criar apenas 1 site
6. Em **Integração WhatsApp**, o usuário deve poder conectar apenas 1 instância
7. Em **Grupos de Venda**, o usuário deve poder ter apenas 1 campanha ativa, 1 lista e 1 grupo

### Teste com novo checkout (Plano Pro):

1. Faça uma compra de teste usando o checkout Pro Mensal
2. O webhook da Kiwify enviará o `checkout_link` = `4fAAtkD`
3. O sistema vai reconhecer como `pro` e definir o `plan_tier` do profile como `pro`
4. O usuário terá acesso completo a ATI, Meta Ads, Gerador de Criativos, etc.

---

## Passo 5: Promover um usuário existente para Pro (manual)

Se precisar promover um usuário existente para Pro manualmente (por exemplo, para testar):

1. Abra o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Execute:
   ```sql
   UPDATE public.profiles
   SET plan_tier = 'pro'
   WHERE email = 'email-do-usuario@exemplo.com';
   ```
4. O usuário verá as mudanças ao recarregar a página

Para voltar ao Padrão:
```sql
UPDATE public.profiles
SET plan_tier = 'padrao'
WHERE email = 'email-do-usuario@exemplo.com';
```

---

## Perguntas Frequentes

### Os usuários existentes vão perder o acesso?
**NÃO.** A migration define `plan_tier = 'padrao'` como padrão, então todos os 130 usuários receberão automaticamente o Plano Padrão sem nenhuma interrupção.

### O que acontece se alguém comprar pelo checkout antigo?
O sistema reconhece todos os IDs de planos/produtos antigos como `padrao`. Nenhum acesso será perdido.

### O que acontece se o webhook da Kiwify não enviar o `checkout_link`?
O sistema faz fallback para os IDs do plano (`plan_id`) e do produto (`product_id`). Se nenhum for reconhecido, o default é `padrao`.

### Preciso alterar algo na Kiwify?
**NÃO.** Os webhooks já enviam o campo `checkout_link` automaticamente. O sistema agora lê esse campo para determinar o plano.

### Posso adicionar novos checkouts no futuro?
Sim! Basta editar o arquivo `src/lib/kiwify-plan-catalog.ts` e adicionar os novos checkout links nos arrays correspondentes.

### E se eu quiser mudar os limites de um plano?
Edite o arquivo `src/lib/plan-entitlements.ts`. Os limites estão claramente definidos nos objetos `PADRAO_LIMITS` e `PRO_LIMITS`.

---

## Limites por Plano (Referência Rápida)

| Recurso | Padrão | Pro |
|---------|--------|-----|
| Análise de Comissões | Ativo | Ativo |
| Análise de Cliques | Ativo | Ativo |
| Meus Links | Ativo | Ativo |
| Sites de Captura | 1 | 5 |
| Calculadora GPL | Ativo (sem resumo/grupos) | Ativo completo |
| Gerador Links Shopee | Ativo | Ativo |
| Grupos de Venda - Campanhas ativas | 1 | 10 |
| Grupos de Venda - Listas | 1 | Ilimitado |
| Grupos de Venda - Grupos total | 1 | 10 |
| Instâncias WhatsApp | 1 | 2 |
| Tráfego Inteligente (ATI) | Inativo | Ativo |
| Criar Campanha Meta | Inativo | Ativo |
| Gerador de Criativos | Inativo | Ativo |
| Exports de vídeo por dia | — | 2 |

---

## Ordem de Execução (Checklist)

- [ ] 1. Rodar a migration SQL no Supabase (Passo 1)
- [ ] 2. Verificar se as colunas/tabela foram criadas (Passo 1 - verificação)
- [ ] 3. (Opcional) Configurar variáveis de ambiente na Vercel (Passo 2)
- [ ] 4. Fazer commit e push (Passo 3)
- [ ] 5. Aguardar deploy da Vercel
- [ ] 6. Testar com usuário existente (Passo 4)
- [ ] 7. Testar novo checkout se possível (Passo 4)

**PRONTO!** O sistema de planos está funcionando.
