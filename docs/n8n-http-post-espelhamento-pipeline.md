# n8n — HTTP POST para o pipeline de Espelhamento de Grupos

Documento para **copiar/colar** no n8n. O programador só precisa ajustar **segredo**, **URL** (se mudar o domínio) e **expressões** ao payload real do webhook da Evolution (veja seção “Ajuste ao payload Evolution”).

---

## URL do endpoint (POST)

```
https://afiliado-analytics-dev.vercel.app/api/espelhamento/n8n/pipeline
```

> Se o projeto for publicado em outro domínio, troque só a parte `https://SEU_DOMINIO`.

---

## Header obrigatório

| Name            | Value                                      |
|-----------------|--------------------------------------------|
| `Authorization` | `Bearer COLAR_AQUI_O_ESPELHAMENTO_N8N_SECRET` |

**Regra:** o texto depois de `Bearer ` (com um espaço) deve ser **idêntico** à variável `ESPELHAMENTO_N8N_SECRET` configurada na **Vercel** (e no `.env.local` do desenvolvimento).

**Exemplo (valor fictício):**

```
Authorization: Bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

No n8n, em **HTTP Request**:

- Aba **Headers** → Add header  
  - **Name:** `Authorization`  
  - **Value:** `Bearer {{ $vars.SEGREDO_ESPELHAMENTO }}` *(recomendado: variável/credential no n8n)*  
  - ou colar o Bearer fixo *(menos seguro)*.

---

## Body — JSON mínimo (nomes exatos)

O backend exige **três** strings (camelCase):

```json
{
  "instanceName": "nome_da_instancia_evolution_igual_ao_app",
  "grupoOrigemJid": "120123456789012345@g.us",
  "textoBruto": "Texto da mensagem com https://s.shopee.com.br/..."
}
```

**Opcionais:**

```json
{
  "instanceName": "...",
  "grupoOrigemJid": "...",
  "textoBruto": "...",
  "idMensagem": "id_opcional_da_mensagem",
  "userId": "uuid_do_usuario_supabase_so_se_der_erro_ambiguo",
  "imagemBase64": "base64_opcional_sem_prefixo_data",
  "imagemMimeType": "image/jpeg"
}
```

- Envie **`userId`** só se a API responder **400** com mensagem de instância **ambígua** (mais de uma linha com o mesmo `nome_instancia`).

---

## Configuração do nó HTTP Request (resumo)

1. **Method:** `POST`  
2. **URL:** (copiar da caixa no topo deste doc)  
3. **Authentication:** não precisa do menu “Predefined Credential Type” se você usar header manual; o importante é o header `Authorization` acima.  
4. **Send Body:** ligado  
5. **Body Content Type:** **JSON**  
6. **JSON / Body:** usar uma das opções abaixo.

---

## Opção A — Body fixo (só para teste manual)

Cole no body (valores de teste):

```json
{
  "instanceName": "SUBSTITUIR_PELO_NOME_DA_INSTANCIA",
  "grupoOrigemJid": "SUBSTITUIR_PELO_JID_DO_GRUPO_ORIGEM",
  "textoBruto": "Oferta https://s.shopee.com.br/9Ux95f1o0b teste"
}
```

Execute o nó e confira a resposta (200 com `action`, ou 401 se o Bearer estiver errado).

---

## Opção B — Body com expressões n8n (ligado ao item anterior do fluxo)

No body JSON do **HTTP Request**, use expressões (o caminho dentro de `$json` depende do webhook da Evolution — **ajuste** após uma execução real):

```json
{
  "instanceName": "={{ $json.instance || $json.body?.instance }}",
  "grupoOrigemJid": "={{ $json.data?.key?.remoteJid || $json.body?.data?.key?.remoteJid }}",
  "textoBruto": "={{ $json.data?.message?.conversation || $json.data?.message?.extendedTextMessage?.text || $json.body?.data?.message?.conversation || '' }}",
  "idMensagem": "={{ $json.data?.key?.id || $json.body?.data?.key?.id }}"
}
```

Se o webhook encapsular tudo em `body`, pode ser necessário usar `$json.body` como raiz (já sugerido em parte nas expressões).

---

## Opção C — Nó **Code** antes do HTTP (recomendado para texto + mídia)

Adicione um nó **Code** (JavaScript) **antes** do HTTP Request e conecte a saída dele ao HTTP. Cole o código e **ajuste** `root` conforme o JSON que aparece na execução do webhook:

```javascript
const item = $input.first().json;
const root = item.body ?? item;

const instanceName = root.instance ?? root.instanceName ?? "";
const key = root.data?.key ?? root.key ?? {};
const grupoOrigemJid = key.remoteJid ?? "";

const msg = root.data?.message ?? root.message ?? {};
const textoBruto =
  msg.conversation ||
  msg.extendedTextMessage?.text ||
  msg.imageMessage?.caption ||
  msg.videoMessage?.caption ||
  "";
const imagemBase64 = root.base64 ?? "";
const imagemMimeType = msg.imageMessage?.mimetype || msg.videoMessage?.mimetype || "image/jpeg";

return [
  {
    json: {
      instanceName: String(instanceName).trim(),
      grupoOrigemJid: String(grupoOrigemJid).trim(),
      textoBruto: String(textoBruto).trim(),
      idMensagem: key.id != null ? String(key.id) : "",
      imagemBase64: String(imagemBase64 || "").trim(),
      imagemMimeType: String(imagemMimeType || "").trim(),
    },
  },
];
```

No **HTTP Request**, body JSON:

```json
{
  "instanceName": "={{ $json.instanceName }}",
  "grupoOrigemJid": "={{ $json.grupoOrigemJid }}",
  "textoBruto": "={{ $json.textoBruto }}",
  "idMensagem": "={{ $json.idMensagem }}",
  "imagemBase64": "={{ $json.imagemBase64 }}",
  "imagemMimeType": "={{ $json.imagemMimeType }}"
}
```

---

## Respostas úteis (para IF / Switch depois do HTTP)

| HTTP | Corpo (exemplo) | Significado |
|------|------------------|-------------|
| **401** | `error` com texto de não autorizado | `Authorization` errado ou segredo não definido na Vercel. |
| **400** | `instanceName, grupoOrigemJid...` ou `Ambíguo` | Campos faltando ou precisa de `userId`. |
| **200** | `"action": "skip"` | Ver `reason` (`no_active_config_for_group`, `no_shopee_links`, `instance_not_found`, …). |
| **200** | `"action": "sent"` | Processou; se `ESPELHAMENTO_N8N_WEBHOOK_URL` estiver na Vercel, o disparo WhatsApp foi tentado. |
| **200** | `"action": "error"` | Shopee não configurada, falha na troca de link ou falha no webhook de disparo. |

---

## Checklist antes de ir para produção

- [ ] Migration `espelhamento_*` aplicada no Supabase.  
- [ ] Na Vercel: `ESPELHAMENTO_N8N_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`.  
- [ ] Opcional: `ESPELHAMENTO_N8N_WEBHOOK_URL` (webhook que envia para o WhatsApp, mesmo padrão do Grupos de Venda).  
- [ ] No app Afiliado Analytics: usuário com **Shopee** configurada + **config de espelhamento ativa** (origem = JID que chega no webhook).  
- [ ] `instanceName` **igual** ao `nome_instancia` salvo no app.

---

*Arquivo gerado para envio ao programador n8n. Domínio de exemplo: `afiliado-analytics-dev.vercel.app`.*
