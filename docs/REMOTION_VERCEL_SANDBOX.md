# Renderização MP4 com Remotion + Vercel Sandbox (Afiliado Analytics)

Este guia descreve o que está **implementado no repositório** e o que você precisa fazer na **Vercel** para o fluxo funcionar de ponta a ponta.

Documentação oficial Remotion: [Vercel Sandbox](https://www.remotion.dev/docs/vercel-sandbox) · [API `@remotion/vercel`](https://www.remotion.dev/docs/vercel/api)

---

## 1. O que já existe no projeto

| Item | Caminho / detalhe |
|------|-------------------|
| Composition ID fixo | `remotion/constants.ts` → `REMOTION_COMPOSITION_ID` = **`GeradorCriativos`** |
| Root Remotion (bundle) | `remotion/Root.tsx` — registra `VideoComposition` + `calculateMetadata` |
| Bundle de saída | `remotion/static-bundle/` (gerado pelo script; está no `.gitignore`) |
| Script de bundle | `npm run remotion:bundle` |
| Build com bundle | `npm run build` roda **`remotion:bundle` antes** do `next build` |
| API de render (SSE) | `src/app/api/remotion/render-mp4/route.ts` — stream de progresso + upload Blob |
| Hook no front | `src/hooks/use-remotion-sandbox-render.ts` — consome SSE e mostra progresso |
| Botão Exportar | `src/app/(main)/dashboard/video-editor/page.tsx` — passo 4 do gerador |
| Inclusão do bundle no deploy | `vercel.json` → `functions` → `includeFiles` para a rota de render |
| Dependências | `@remotion/vercel`, `@vercel/sandbox`, `@vercel/functions` |

---

## 2. Fluxo técnico (resumo)

1. Usuário clica **Exportar MP4** no passo 4.
2. O front envia `POST /api/remotion/render-mp4` com `{ inputProps }` (mesmo objeto do `<Player />`).
3. A API abre um **Vercel Sandbox**, envia o **bundle** (`remotion/static-bundle`), chama `renderMediaOnVercel`, depois `uploadToVercelBlob`.
4. A resposta é **Server-Sent Events (SSE)** com fases de progresso e, ao final, `{ type: "done", url, size }`.
5. O front exibe link para abrir/baixar o MP4.

---

## 3. Checklist na Vercel (obrigatório para funcionar 100%)

### 3.1. Blob Store

1. [Vercel](https://vercel.com) → seu projeto → **Storage** → **Create** → **Blob**.
2. **Connect to Project** no mesmo projeto do app.
3. Confirme que a variável **`BLOB_READ_WRITE_TOKEN`** aparece em **Settings → Environment Variables** (Production / Preview conforme o uso).
4. Faça **Redeploy** depois de conectar o Blob.

> Sem `BLOB_READ_WRITE_TOKEN`, a rota retorna erro 500 explicando a falta da variável.

### 3.2. Plano e timeout

- **Hobby:** timeout de função costuma ser **60s** por padrão; renders longos podem estourar. O `vercel.json` define `maxDuration: 300` para a rota de render — em **Pro** isso é respeitado de forma ampla; no Hobby verifique os limites atuais no dashboard.
- Vídeos muito longos ou muitas mídias: considere **Pro** (até 5 h no Sandbox, conforme doc Remotion).

### 3.3. Build na Vercel

O comando de build do projeto é:

```bash
npm run remotion:bundle && next build --turbopack
```

Assim a pasta **`remotion/static-bundle`** é gerada **no build** e empacotada com a função (via `includeFiles` no `vercel.json`).

Não commite `remotion/static-bundle` — ela é recriada no CI.

---

## 4. Variáveis de ambiente

| Variável | Onde vem | Uso |
|----------|-----------|-----|
| `BLOB_READ_WRITE_TOKEN` | Automática ao ligar Blob ao projeto | Upload do MP4 (`uploadToVercelBlob`) |

Não é necessário `BLOB_STORE_ID` na implementação atual (o template oficial usa `blobToken`).

---

## 5. Testar localmente

1. Copie o token do Blob para `.env.local` (só desenvolvimento):

   ```bash
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxx
   ```

2. Gere o bundle (ou deixe o primeiro request em dev gerar, se a rota chamar `bundleRemotionProject` — em **dev sem `VERCEL`**, a API recompila o bundle antes de enviar ao Sandbox).

3. `npm run dev` → Gerador de Criativos → passo 4 → **Exportar MP4** com ao menos uma mídia selecionada.

4. Render local ainda depende de **Vercel Sandbox** / credenciais; se falhar só em local, teste após deploy.

---

## 6. Testar em produção (Vercel)

1. Commit + push.
2. Aguarde o deploy concluir.
3. Abra o app em produção → Gerador → passo 4 → Exportar.
4. Se der erro, abra **Vercel → Project → Logs** na função da rota `/api/remotion/render-mp4`.

Erros comuns:

- **`BLOB_READ_WRITE_TOKEN` ausente** → reconectar Blob e redeploy.
- **Bundle não encontrado** → build não rodou `remotion:bundle` → confira script `build` no `package.json` e logs do build.
- **Timeout** → vídeo muito longo ou plano Hobby; reduza duração ou aumente limite/plano.

---

## 7. Arquivos que você não deve duplicar

- **Um único** `REMOTION_COMPOSITION_ID` / `id` na `<Composition>` — já em `remotion/Root.tsx` e importado na API.
- **Um único** caminho de bundle: `remotion/static-bundle` + constante `REMOTION_BUNDLE_DIR` em `helpers.ts`.

---

## 8. Template oficial (referência)

Para comparar com o projeto mantido pela Remotion:

```bash
npx create-video@latest --template vercel
```

Repositório de referência: [template-vercel no GitHub](https://github.com/remotion-dev/remotion/tree/main/packages/template-vercel).

---

## 9. Limites e custos (resumo)

| Item | Hobby | Pro / Enterprise |
|------|--------|------------------|
| Timeout Sandbox | 45 min | 5 h |
| Sandboxes simultâneos | 10 | 2000 |

Preços Sandbox: [Vercel Sandbox pricing](https://vercel.com/docs/vercel-sandbox/pricing).  
Arquivos no Blob permanecem até você apagá-los.

---

## 10. Checklist rápido antes de ir ao ar

- [ ] Blob criado e conectado ao projeto  
- [ ] `BLOB_READ_WRITE_TOKEN` visível nas envs + redeploy  
- [ ] `npm run build` local passa (inclui `remotion:bundle`)  
- [ ] Botão Exportar testado em preview/production  
- [ ] (Opcional) Spend limits na Vercel  

Se algo falhar, use os **Logs da função** na Vercel e a [documentação Remotion Vercel](https://www.remotion.dev/docs/vercel-sandbox).
