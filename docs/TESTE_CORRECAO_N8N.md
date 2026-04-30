Como ligar no n8n (sem duplicar)
Onde encaixar: entre If1 (que já filtra shopee + @g.us) e Convert to File. Se o check retornar active: false, você encerra a branch. Se active: true, segue o fluxo atual.

Novo nó HTTP Request — "Check Mirrored"
Method: GET
URL:

https://afiliado-analytics-dev.vercel.app/api/espelhamento/n8n/is-mirrored
Send Query Parameters: ligado
instance → ={{ $('Edit Fields').item.json.body.instance }}
grupo → ={{ $('Edit Fields').item.json.remoteJid.Grupo }}
Send Headers: ligado
Authorization → Bearer a9F3kL8xQ2vP7mR4ZtY6bH1wE5uC0sNqD (o mesmo que você já usa)
Response → Never Error: ligado (pra não quebrar o workflow se cair a rede)
Resposta será {"active": true} ou {"active": false, "reason": "..."} — um único item. Sem risco de iteração múltipla.

Novo nó If — "Is Mirrored?"
Adicionar um If depois do "Check Mirrored":

Condition: ={{ $json.active }} equals true (booleano)
True → segue para Convert to File → HTTP Request (pipeline atual)
False → ponta morta (não faz nada)
Fluxo final

Webhook → If → If2 → Edit Fields → If1 → [Check Mirrored] → [Is Mirrored?]
                                                                  │ true
                                                                  ▼
                                                        Convert to File → HTTP Request
Por que isso não duplica como a opção 1
O endpoint sempre retorna 1 objeto JSON, independente de quantas configs existem no banco. A consolidação é feita em memória no Vercel com .some(...).
O nó If no n8n com valor booleano simples não itera.
Mesmo que alguém configure 13 destinos para o mesmo grupo de origem, o check responde true uma vez — e o /pipeline atual já sabe juntar destinos em um único POST de disparo (em route.ts:246 via groupIds = [...new Set(...)]).
O que vai economizar
Cada mensagem não-espelhada hoje = 1 POST de ~3 MB (base64) no Vercel.
Com o check = 1 GET de ~300 bytes (query + resposta JSON curta) no Vercel, e nada depois.

Redução estimada: ~99% do volume de bytes por mensagem descartada. As únicas requests pesadas que chegarão ao pipeline são as que realmente precisam ser processadas.

Depois do deploy, testa em um grupo NÃO-espelhado mandando um link Shopee — a execução no n8n deve terminar logo após o "Is Mirrored?", sem chamar o /pipeline. E em um grupo espelhado, confirma que o disparo ainda funciona normal.

Quer que eu faça commit dessa mudança agora ou prefere testar localmente primeiro?