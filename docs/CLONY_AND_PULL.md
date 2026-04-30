🚀 1. Clonar o repositório (primeira vez)

No PC do Marcos:

git clone https://github.com/CODENXT-SOFTWARE/Afiliado-Analytics-DEV.git

Depois entra na pasta:

cd Afiliado-Analytics-DEV

👉 Isso já baixa todo o código da sua organização pro PC dele.

🔐 2. Autenticação (ESSENCIAL)

O GitHub não aceita senha — só token.

Ele precisa fazer:
Ir em:
Settings → Developer settings → Personal access tokens
Criar um token com:
✅ repo (full control)
Quando o Git pedir login:
Username → user do GitHub
Password → colar o token

⚙️ 3. Configurar identidade (uma vez só)

git config --global user.name "Marcos Gomes"
git config --global user.email "emaildele@gmail.com"

🔄 4. Fluxo básico de trabalho (o que ele vai fazer sempre)
📥 Atualizar o projeto

Antes de começar qualquer coisa:

git pull origin main
🌱 Criar uma nova branch (BOA PRÁTICA)

git checkout -b feature/nome-da-feature

👉 Nunca trabalhar direto na main

✍️ Fazer alterações e subir

git add .
git commit -m "feat: adiciona tal coisa"
git push origin feature/nome-da-feature