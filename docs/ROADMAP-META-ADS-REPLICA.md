# Roadmap: Replicar Meta Ads no Afiliado Analytics

## 1. O que a API do Meta permite (e o que não permite)

### ✅ Possível via Marketing API

| Funcionalidade | Via API? | Observação |
|----------------|----------|------------|
| **Listar contas de anúncios** | Sim | `GET /me/adaccounts` (já usamos no ATI) |
| **Listar/criar portfólios (Business)** | Sim | Business Management API, permissão `business_management` |
| **Criar conta de anúncios** | Sim* | Até 5 por negócio via API; admin do negócio. Campos: nome, timezone, moeda |
| **Criar campanha** | Sim | `POST /act_{id}/campaigns` — objetivo, nome, orçamento (nível campanha) |
| **Criar conjunto de anúncios** | Sim | `POST /act_{id}/adsets` — campanha, orçamento diário, targeting (público, região, idade, etc.) |
| **Criar anúncio** | Sim | `POST /act_{id}/ads` — conjunto, criativo (imagem/vídeo, texto, link), nome |
| **Definir público (targeting)** | Sim | No ad set: `targeting` (geo, idade, interesses, públicos personalizados) |
| **Públicos personalizados** | Sim | `POST /act_{id}/customaudiences` — nome, regras (ex.: pixel), retenção em dias |
| **Pixel (Meta Pixel)** | Sim | Criar/gerenciar pixel, obter ID para colocar no site; eventos (PageView, Purchase, etc.) |
| **Gerenciador de eventos** | Parcial | Configurar eventos do pixel via API; “Gerenciador de Eventos” completo é a UI do Meta |
| **Ver gastos / insights** | Sim | Insights API (já usamos no ATI) |
| **Ver faturas / cobrança** | Só leitura | `/{business-id}/business_invoices`, atividades de cobrança — **apenas consulta** |

### ❌ Não possível / limitações

| Funcionalidade | Motivo |
|----------------|--------|
| **Pagar anúncios pelo seu app** | Pagamento é sempre entre o usuário e o Meta. O app não processa cartão nem débito. O método de pagamento fica cadastrado no Meta (conta do usuário). Seu app só pode **mostrar** gastos e faturas. |
| **Criar método de pagamento no lugar do Meta** | Meta não permite que terceiros registrem ou alterem formas de pagamento da conta de anúncios. |
| **Replicar 100% da UI do Meta** | Alguns fluxos e opções avançadas podem exigir App Review (acesso avançado) ou não estarem expostos na API. |

**Resumo:** Você pode **criar e gerenciar** campanhas, conjuntos, anúncios, públicos e pixel pelo seu app (replicar a parte de “criação” do Meta Ads). **Cobrança/pagamentos** no app só como **consulta** (valores, gastos, faturas); o “pagar” continua no Meta.

---

## 2. Permissões e revisão do app (Meta)

- **Básico (desenvolvimento / teste):**  
  `ads_management`, `ads_read`, `business_management` — permitem criar campanhas, conjuntos, anúncios, listar negócios/contas e usar Insights (como no ATI).

- **Uso em produção com outros usuários:**  
  Muitas dessas ações exigem **App Review** do Meta (revisão do app para permissões avançadas). Em modo “desenvolvimento”, só contas de teste/admin do app funcionam.

- **Pixel e eventos:**  
  Criação/gestão de pixel e eventos costumam estar atrelados ao Business Manager e à conta de anúncios; a documentação oficial do Meta descreve os endpoints e permissões necessárias.

---

## 3. Proposta de fases no Afiliado Analytics

Implementar tudo de uma vez seria muito pesado. Sugestão: fazer em **fases**, cada uma entregando valor e funcionando de ponta a ponta.

### Fase 1 – Base: criar campanha + conjunto + anúncio

- **Contas e negócios:**  
  Listar contas de anúncios e (se a API permitir) negócios/portfólios; **selecionar** conta/negócio no app (como no Meta: “trocar entre contas”).

- **Campanha:**  
  Tela “Nova campanha”: objetivo (Tráfego, Conversões, etc.), nome, orçamento no nível campanha (se aplicável).

- **Conjunto:**  
  Tela “Novo conjunto”: escolher campanha, nome, orçamento diário, **targeting** (país, região, idade, gênero — campos básicos da API).

- **Anúncio:**  
  Tela “Novo anúncio”: escolher conjunto, nome, **criativo** — link de destino (ex.: link Shopee com `utm_content=ad_id`), título, texto, mídia (upload de imagem ou URL de imagem; vídeo pode vir depois).

- **Fluxo:**  
  Campanha → Conjunto → Anúncio, tudo criado via API e aparecendo no Meta Ads Manager.

### Fase 2 – Públicos e Pixel

- **Públicos personalizados:**  
  Listar públicos existentes; criar público (ex.: site) com nome, regra (URL do pixel), retenção em dias.

- **Pixel:**  
  Listar pixels da conta/negócio; criar pixel (se a API permitir); exibir **ID do pixel** e snippet para o usuário colocar no site (como já faz no Site de Captura, mas vinculado à conta Meta escolhida).

- **Eventos:**  
  Onde a API permitir, configurar eventos (ex.: PageView, Purchase) para o pixel; referência ao “Gerenciador de Eventos” como conceito (sem replicar toda a UI do Meta).

### Fase 3 – Cobrança e gastos (só leitura)

- **Gastos por período:**  
  Usar Insights (e onde houver) endpoints de billing para mostrar totais por conta/campanha no app.

- **Faturas:**  
  Se disponível para o negócio do usuário, listar faturas (`business_invoices`) — valores, datas, status; **sem** botão “pagar” (pagamento só no Meta).

- **Avisos:**  
  Deixar claro no app: “Pagamentos e métodos de pagamento são gerenciados no Meta. Aqui você só acompanha gastos e faturas.”

---

## 4. Onde isso “entra” no app

- **Menu:**  
  Por exemplo: **“Meta Ads”** ou **“Criar Campanha”** (além do ATI, que continua sendo “Tráfego Inteligente / análise”).

- **Fluxo:**  
  1) Seleção de conta (e negócio/portfólio se aplicável).  
  2) Criar campanha → criar conjunto (com público e orçamento) → criar anúncio (criativo + link).  
  3) Depois, ver performance no ATI (já existente) e, na Fase 3, ver gastos/faturas em “Cobrança”.

---

## 5. Próximo passo recomendado

- **Começar pela Fase 1:**  
  Uma tela (ou wizard) “Nova campanha” que: escolhe conta → cria campanha → cria conjunto (com targeting básico) → cria anúncio (link Shopee + criativo).  
  Assim você já “sobe campanhas no Meta Ads a partir do app” e define valores e público no nível que a API permite.

- **Pagamentos:**  
  Não implementar “pagamento” no app; apenas, na Fase 3, telas de **consulta** a gastos e faturas, com referência ao Meta para qualquer pagamento real.

Se quiser, na próxima mensagem podemos detalhar a **Fase 1** em telas e endpoints (ex.: quais campos enviar em cada `POST` para campanha, ad set e ad) para você já implementar no Afiliado Analytics.
