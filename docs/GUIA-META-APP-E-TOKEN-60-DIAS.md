# Guia: criar app no Meta (Facebook) e obter token de ~60 dias

Este documento explica **onde clicar** no site do Meta for Developers para criar um **aplicativo**, pedir as **permissões** compatíveis com o [roadmap Meta Ads](./ROADMAP-META-ADS-REPLICA.md) e gerar um **token de acesso longo** (cerca de **60 dias**), para colar no **Afiliado Analytics → Configurações → Meta Ads**.

> **Importante:** O Meta muda o layout do painel com frequência. Se algum nome de botão estiver ligeiramente diferente, use a busca do próprio site ou o menu lateral; a **ordem lógica** (Criar app → Permissões → Ferramenta de token → Estender) continua válida.

---

## O que você precisa antes de começar

| Requisito | Por quê |
|-----------|--------|
| Conta no Facebook pessoal | Para entrar no [Meta for Developers](https://developers.facebook.com/) |
| [Meta Business Suite](https://business.facebook.com/) / Portfólio de Negócios | Campanhas, contas de anúncios e faturas ficam ligadas ao negócio |
| Ser **admin** (ou permissão alta) na **conta de anúncios** e no **negócio** | Sem isso a API pode retornar vazio ou erro de permissão |

---

## Permissões que o app deve solicitar (alinhado ao roadmap)

Conforme o [ROADMAP-META-ADS-REPLICA.md](./ROADMAP-META-ADS-REPLICA.md), a base é:

| Permissão (nome na API) | Uso típico no app / roadmap |
|-------------------------|------------------------------|
| **`ads_management`** | Criar/editar/pausar campanhas, conjuntos, anúncios, criativos, públicos, muitas operações da Marketing API |
| **`ads_read`** | Ler contas, insights, métricas (ATI, relatórios) — leitura de anúncios e performance |
| **`business_management`** | Listar/gerir negócios, portfólios, recursos ligados ao Business Manager (roadmap: contas, billing leitura em alguns casos) |

**Recomendado para fluxos que usam Página / Instagram no painel de anúncios** (o Afiliado Analytics tem rotas como páginas e Instagram):

| Permissão | Uso típico |
|-----------|------------|
| **`pages_show_list`** | Listar páginas do Facebook que você administra |
| **`pages_read_engagement`** | Ler dados de engajamento da página (necessário em vários fluxos de anúncio com página) |

**Opcional** (só se você for usar recursos específicos e o Meta pedir na revisão):

| Permissão | Quando considerar |
|-----------|-------------------|
| **`instagram_basic`** / **`instagram_manage_insights`** | Anúncios ou insights ligados a conta Instagram profissional (depende do caso) |

> **Resumo para colar na ferramenta de token:** comece com  
> `ads_management`, `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement`  
> (separadas por vírgula na hora de gerar o token — veja a seção “Graph API Explorer” abaixo).

> **Produção com usuários que não são administradores do app:** várias permissões exigem **Análise do aplicativo (App Review)** no Meta. Em modo **Desenvolvimento**, em geral só funcionam bem o **dono do app** e **usuários de teste** adicionados no painel.

---

## Parte 1 — Criar o aplicativo no Meta for Developers

1. Abra no navegador: **[https://developers.facebook.com/](https://developers.facebook.com/)**
2. Faça login com sua conta Facebook.
3. No canto superior direito, clique em **“Meus apps”** (ou **“My Apps”**).
4. Clique em **“Criar app”** / **“Create App”**.
5. O Meta pode pedir o **tipo de app** ou **caso de uso**:
   - Escolha algo como **“Negócios”** / **“Business”** ou **“Outro”** / **“Other”**, conforme as opções exibidas na tela.
   - Se aparecer **“Conectar com o Facebook (Facebook Login)”** ou **“Marketing API”** como recurso, você pode marcar; o importante é ter um **ID de aplicativo (App ID)** criado.
6. Preencha **nome do app** (ex.: `Afiliado Analytics – integração`) e um **email de contato** se pedir.
7. Confirme e finalize a criação até aparecer o **Painel do aplicativo (App Dashboard)**.

Anote:

- **ID do aplicativo (App ID)** — visível no painel.
- **Chave secreta do aplicativo (App Secret)** — em **Configurações → Básico** (às vezes precisa clicar em “Mostrar” e digitar a senha do Facebook). Guarde em local segredo; você precisará para **estender o token para 60 dias**.

---

## Parte 2 — Configurações básicas do app

1. No menu lateral do app, abra **“Configurações”** → **“Básico”** (**Settings** → **Basic**).
2. Confira se o **nome do app** e o **email de contato** estão preenchidos (o Meta exige para alguns fluxos).
3. Se existir campo **“Domínios do aplicativo”** / **App Domains**, você pode colocar o domínio do seu site (ex.: `afiliadoanalytics.com.br`) quando for usar login OAuth no seu domínio; **para só gerar token manual e colar no Afiliado Analytics**, muitas vezes não é obrigatório no primeiro momento.
4. Em **“Configurações” → “Avançado”** (se existir), verifique se o app não está bloqueado por políticas pendentes.

---

## Parte 3 — Adicionar o produto “Login do Facebook” (se ainda não existir)

1. No menu lateral, procure **“Produtos”** / **“Add Product”** ou **“Adicionar produto”**.
2. Localize **“Facebook Login for Business”** ou **“Login do Facebook”** / **“Facebook Login”**.
3. Clique em **“Configurar”** / **“Set Up”** e siga o assistente (às vezes basta adicionar o produto ao app).
4. Em **Facebook Login → Configurações**:
   - Em **“URIs de redirecionamento OAuth válidos”** / **Valid OAuth Redirect URIs**, se você for usar login no seu site no futuro, adicione a URL de callback do seu app (ex.: `https://seu-dominio.com/api/auth/callback-meta`).  
   - **Só para token via Graph API Explorer**, isso pode ficar para depois.

---

## Parte 4 — Pedir permissões no painel do app

1. No menu lateral, procure **“Casos de uso”** / **Use cases**, **“Permissões e recursos”** / **App permissions**, ou **“Análise do aplicativo”** / **App Review** → **“Permissões e recursos”**.
2. Adicione as permissões listadas na tabela do início deste guia (no mínimo **`ads_management`**, **`ads_read`**, **`business_management`**).
3. Para **`pages_show_list`** e **`pages_read_engagement`**, adicione também se aparecerem na lista.
4. Salve as alterações.

> Em **modo Desenvolvimento**, o Meta costuma permitir que **você** (admin do app) autorize essas permissões ao gerar o token. Para **outros usuários** em produção, será necessário **App Review** e app em modo **Ao vivo** / **Live**.

---

## Parte 5 — Gerar token curto com o Graph API Explorer

O token que o Explorer gera primeiro costuma durar **poucas horas** (token de usuário de curta duração). O próximo passo troca por um de **~60 dias**.

1. Abra: **[https://developers.facebook.com/tools/explorer/](https://developers.facebook.com/tools/explorer/)**  
   (no código do projeto isso aparece como link útil em **Configurações → Meta**.)
2. No topo da página:
   - Em **“Meta App”** / **“Aplicativo”**, selecione o **app que você criou** (o nome que você deu na Parte 1).
3. Ao lado, em **“User or Page”** / **“Token de acesso”**, clique em **“Gerar token de acesso”** / **“Generate Access Token”**.
4. Uma janela lista as **permissões**. Marque pelo menos:
   - `ads_management`
   - `ads_read`
   - `business_management`
   - `pages_show_list`
   - `pages_read_engagement`
5. Confirme com **“Salvar”** / **“Done”** e faça login/autorize com a conta Facebook que administra o negócio e as contas de anúncios.
6. Copie o **token** que aparece no campo (string longa começando com `EAAG...` ou similar).

Esse é o **token de curta duração**.

---

## Parte 6 — Trocar pelo token longo (~60 dias)

Você precisa do **App ID**, do **App Secret** e do **token curto** que acabou de copiar.

### Opção A — Navegador (rápido para testar)

Monte esta URL (substitua os valores **sem colchetes**):

```
https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=SEU_APP_ID&client_secret=SEU_APP_SECRET&fb_exchange_token=TOKEN_CURTO_COPIADO
```

1. Cole a URL na barra do navegador e pressione Enter.
2. A resposta será um JSON parecido com:
   ```json
   { "access_token": "...", "token_type": "bearer", "expires_in": 5184000 }
   ```
   `5184000` segundos ≈ **60 dias**.
3. Copie o valor de **`access_token`** — esse é o token **longo** para usar no Afiliado Analytics.

### Opção B — Documentação oficial

- Leia também: [Tokens de longa duração](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived) (Meta pode atualizar detalhes e versão da API `v21.0`).

---

## Parte 7 — Usar no Afiliado Analytics

1. Entre no app **Afiliado Analytics**.
2. Vá em **Configurações** (menu do dashboard / área logada).
3. Na seção **Meta Ads (Facebook / Instagram)****, cole o **token longo** no campo **Token de Acesso**.
4. Salve.

O app grava o token de forma segura e usa nas rotas `/api/meta/...` (campanhas, insights, contas, etc.).

---

## Renovar depois de ~60 dias

Tokens de usuário de longa duração **expiram**. Antes do fim dos 60 dias:

- Gere um **novo token curto** no Graph API Explorer (mesmo fluxo da Parte 5).
- Troque de novo pela URL da Parte 6 (ou script equivalente).
- Atualize nas **Configurações** do Afiliado Analytics.

(No futuro, dá para automatizar com OAuth no seu domínio e refresh; este guia cobre o fluxo **manual** alinhado ao que a tela de configurações espera hoje.)

---

## Problemas comuns

| Sintoma | O que verificar |
|---------|-----------------|
| “Invalid OAuth access token” | Token expirado ou revogado; gere outro. |
| Dados vazios (contas, campanhas) | Conta do Facebook usada no login não é admin da conta de anúncios; ou falta permissão (`ads_read` / `business_management`). |
| Só funciona para você, não para clientes | App em modo **Desenvolvimento**; falta **App Review** e modo **Ao vivo**. |
| Permissão negada na janela do Explorer | Adicione a permissão no painel do app (Parte 3) e tente gerar o token de novo. |

---

## Referência cruzada com o roadmap

- **Marketing API (campanhas, conjuntos, anúncios, insights):** `ads_management` + `ads_read`.
- **Business / portfólio / parte de faturas em leitura:** `business_management` (detalhes dependem do endpoint e do negócio).
- **Páginas / Instagram em fluxos de anúncio:** `pages_show_list`, `pages_read_engagement` (e Instagram conforme necessidade).

Documento de produto: [ROADMAP-META-ADS-REPLICA.md](./ROADMAP-META-ADS-REPLICA.md).

---

**Última dica:** guarde **App ID** e **App Secret** em um gerenciador de senhas; nunca commite o **App Secret** em repositório público.
