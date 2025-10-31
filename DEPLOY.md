# 🚀 Guia de Deploy - Mapeamento OOH

## Deploy Rápido no Cloudflare Pages

### 1. Preparação

1. Crie uma conta no [Cloudflare](https://dash.cloudflare.com/sign-up)
2. Tenha seu token do Notion pronto ([criar integração](https://www.notion.so/my-integrations))

### 2. Deploy via Dashboard

#### Passo 1: Criar Projeto
1. Acesse: https://dash.cloudflare.com/
2. Vá em **Pages** no menu lateral
3. Clique em **Create a project**
4. Escolha **Connect to Git**

#### Passo 2: Conectar Repositório
1. Autorize o Cloudflare a acessar seu GitHub/GitLab
2. Selecione o repositório `MapeamentoOOH`
3. Clique em **Begin setup**

#### Passo 3: Configurar Build

⚠️ **IMPORTANTE**: Use exatamente estas configurações:

- **Project name**: `mapeamento-ooh` (ou nome de sua escolha)
- **Production branch**: `main` (ou sua branch principal)
- **Framework preset**: `None`
- **Build command**: **(DEIXAR COMPLETAMENTE VAZIO - não digitar nada)**
- **Build output directory**: `public`
- **Root directory**: `/` (padrão)

**NÃO** adicione nenhum comando de build! O Cloudflare Pages serve os arquivos diretamente.

Clique em **Save and Deploy**

#### Passo 4: Configurar Variáveis de Ambiente
1. Após o deploy inicial, vá em **Settings** > **Environment variables**
2. Clique em **Add variable**
3. Configure:
   - **Variable name**: `NOTION_TOKEN`
   - **Value**: Seu token de integração do Notion (ex: `secret_abc123...`)
   - **Environment**: Production (e Preview se desejar)
4. Clique em **Save**

#### Passo 5: Redeploye
1. Vá em **Deployments**
2. Clique em **Retry deployment** no último deploy
3. Aguarde finalizar

### 3. Deploy via CLI

```bash
# Instalar Wrangler
npm install -g wrangler

# Login no Cloudflare
wrangler login

# Criar arquivo .dev.vars com seu token
echo "NOTION_TOKEN=seu_token_aqui" > .dev.vars

# Deploy
npm run pages:deploy

# Configurar secret de produção
wrangler pages secret put NOTION_TOKEN
# Cole seu token quando solicitado
```

### 4. Configurar Notion

#### Criar Integração

1. Acesse: https://www.notion.so/my-integrations
2. Clique em **+ New integration**
3. Configure:
   - **Name**: Mapa OOH
   - **Associated workspace**: Seu workspace
   - **Type**: Internal Integration
4. Em **Capabilities**, certifique-se que está marcado:
   - ✅ Read content
   - ✅ Read comments (opcional)
5. Clique em **Submit**
6. **Copie o "Internal Integration Token"** (começa com `secret_`)

#### Dar Acesso à Página

1. Abra a página do Notion que contém sua tabela OOH
2. Clique nos **três pontos (•••)** no canto superior direito
3. Role até **Connections**
4. Clique em **Connect to** ou **Add connections**
5. Selecione sua integração **Mapa OOH**
6. Confirme

### 5. Testar

#### Modo Embed

1. Na página do Notion, digite `/embed`
2. Cole a URL do seu site: `https://mapeamento-ooh.pages.dev`
3. Ajuste o tamanho do embed
4. Aguarde o mapa carregar

#### Modo Direto

1. Acesse: `https://mapeamento-ooh.pages.dev`
2. Clique em **Gerar Link Direto**
3. Insira o ID da sua tabela (ex: `18b20b54-9cf5-81f1-93ca-000b7243b961`)
4. Teste o link gerado

### 6. Domínio Customizado (Opcional)

1. No Cloudflare Pages, vá em **Custom domains**
2. Clique em **Set up a custom domain**
3. Digite seu domínio (ex: `mapa.seusite.com.br`)
4. Siga as instruções para configurar DNS
5. Aguarde propagação (pode levar alguns minutos)

### 7. Verificar Logs

Para ver logs e debugar:

```bash
# Via CLI
wrangler pages deployment tail

# Ou via Dashboard:
# Pages > seu-projeto > Deployments > View details > Functions
```

## Problemas Comuns

### "NOTION_TOKEN não configurado"
- Verifique se adicionou a variável de ambiente no Cloudflare
- Redeploy após adicionar a variável

### "Erro 401 Unauthorized"
- Token do Notion inválido
- Verifique se copiou o token completo
- Crie uma nova integração se necessário

### "Tabela não encontrada"
- Certifique-se que a integração tem acesso à página
- Verifique se a página contém uma database/table
- Confirme que os campos obrigatórios existem

### Mapa não carrega no embed
- Verifique se o site está usando HTTPS (Cloudflare Pages usa por padrão)
- Teste em uma página diferente do Notion
- Verifique o console do navegador (F12) para erros

## URLs Importantes

- Dashboard Cloudflare: https://dash.cloudflare.com/
- Notion Integrations: https://www.notion.so/my-integrations
- Wrangler Docs: https://developers.cloudflare.com/workers/wrangler/
- Notion API Docs: https://developers.notion.com/

## Suporte

Se encontrar problemas:

1. Verifique os logs no Cloudflare Dashboard
2. Teste a API manualmente: `curl https://seu-site.pages.dev/api/map-data?pageId=ID`
3. Abra uma issue no GitHub
4. Consulte a documentação do Notion API

---

Bom deploy! 🚀
