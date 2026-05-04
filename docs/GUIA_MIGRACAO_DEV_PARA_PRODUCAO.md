# Guia Simples: Copiar DEV para Produção (GitHub)

Este guia foi feito para quem nao mexe muito com Git.

Objetivo

- Pegar os arquivos do repo **DEV**
- Apagar o que existe dentro da pasta `afiliado-analytics/` do repo **producao**
- Colocar os arquivos do DEV nessa pasta

Repos usados:

- **Fonte (DEV):** `https://github.com/marcosdevg/Afiliado-Analytics-DEV.git`
- **Destino (producao):** `https://github.com/marcosdevg/Afiliado-analytics.git`

---

## Antes de comecar

1. Tenha o **Git** instalado.
2. Abra o **PowerShell**.
3. Faça login no GitHub no seu computador (se pedir senha/token durante o processo).

---

## Passo 1) Criar uma pasta temporaria

No PowerShell, rode:

```bash
mkdir C:\temp\migra-afiliado
cd C:\temp\migra-afiliado
```

---

## Passo 2) Baixar os 2 repositorios

```bash
git clone https://github.com/marcosdevg/Afiliado-Analytics-DEV.git dev
git clone https://github.com/marcosdevg/Afiliado-analytics.git prod
```

Agora voce tera:

- `C:\temp\migra-afiliado\dev` (codigo novo)
- `C:\temp\migra-afiliado\prod` (codigo de producao)

---

## Passo 3) Entrar no repo de producao

```bash
cd C:\temp\migra-afiliado\prod
git checkout main
git pull origin main
```

---

## Passo 4) Criar backup (muito importante)

Assim, se algo der errado, voce consegue voltar.

```bash
git checkout -b backup-antes-sync
git push -u origin backup-antes-sync
git checkout main
```

---

## Passo 5) Criar branch para a migracao

```bash
git checkout -b sync-dev-para-subpasta
```

---

## Passo 6) Apagar o conteudo antigo da pasta `afiliado-analytics/`

> Atencao: isso apaga somente dentro da pasta, nao apaga o repositorio.

```bash
Remove-Item -Recurse -Force ".\afiliado-analytics\*" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\afiliado-analytics\.*" -ErrorAction SilentlyContinue
```

---

## Passo 7) Copiar os arquivos do DEV para dentro da pasta `afiliado-analytics/`

```bash
Copy-Item -Path "..\dev\*" -Destination ".\afiliado-analytics\" -Recurse -Force
Remove-Item -Recurse -Force ".\afiliado-analytics\.git" -ErrorAction SilentlyContinue
```

Por que remover `.git`?

- Porque esse `.git` pertence ao repo DEV e nao pode ficar dentro do repo de producao.

---

- FORÇAR 
```bash
git push -u origin sync-dev-para-subpasta --force-with-lease
```
## Passo 8) Salvar no Git (commit)

```bash
git add .
git commit -m "sync: substituir conteudo de afiliado-analytics com Afiliado-Analytics-DEV"
git push -u origin sync-dev-para-subpasta
```

---

## Passo 9) Levar para `main` (producao)

Voce pode fazer de 2 formas:

- Forma A (recomendada): abrir PR no GitHub e dar merge
- Forma B (direto no terminal):

```bash
git checkout main
git merge --no-ff sync-dev-para-subpasta
git push origin main
```

---

## Passo 10) Conferir no GitHub

No repo `Afiliado-analytics`, veja se dentro da pasta `afiliado-analytics/` existem:

- `package.json`
- `src/`
- `public/`
- etc.

E confirme que **nao existe**:

- `afiliado-analytics/.git`

---

## Passo 11) Vercel

Se sua Vercel ja esta apontando para esse repo e para a pasta certa, ela deve iniciar deploy sozinha.

Depois do deploy, teste:

1. login
2. gerador de criativos
3. exportacao de video

---

## Se der erro, como voltar rapido

Como voce criou backup no Passo 4:

```bash
git checkout main
git reset --hard backup-antes-sync
git push origin main --force
```

> Use esse rollback apenas se precisar voltar urgente.

---

## Dica final

Se quiser evitar confusao no futuro, padronize seus repositorios para a mesma estrutura (ambos na raiz, ou ambos em subpasta).

