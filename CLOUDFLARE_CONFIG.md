# ⚙️ Configuração do Cloudflare Pages

## Configurações Corretas para Deploy

Quando configurar seu projeto no Cloudflare Pages, use EXATAMENTE estas configurações:

### 📋 Build Settings

```
Framework preset: None
Build command: (deixar VAZIO - não preencher nada)
Build output directory: public
```

**IMPORTANTE**: Não adicione nenhum comando de build! O Cloudflare Pages serve os arquivos da pasta `public` diretamente.

### 🔧 Configuração Detalhada no Dashboard

1. **Project name**: `mapeamento-ooh` (ou nome de sua escolha)

2. **Production branch**: `main` ou `master`

3. **Build settings**:
   - Framework preset: `None`
   - Build command: **(DEIXAR VAZIO)**
   - Build output directory: `public`
   - Root directory: `/` (padrão)

4. **Environment variables** (Production & Preview):
   ```
   NOTION_TOKEN = seu_token_do_notion_aqui
   ```

### 📁 Estrutura Esperada

O Cloudflare Pages vai:
- Servir arquivos estáticos de `public/`
- Executar functions de `functions/` automaticamente
- Aplicar headers de `public/_headers`

```
Deploy:
├── public/               → Servido como site estático
│   ├── index.html       → https://seu-site.pages.dev/
│   ├── css/style.css    → https://seu-site.pages.dev/css/style.css
│   ├── js/app.js        → https://seu-site.pages.dev/js/app.js
│   └── _headers         → Aplica CORS e cache
└── functions/           → Rotas serverless
    └── [[path]].js      → Captura /api/*
```

### 🚀 Deploy via Dashboard (Recomendado)

1. Acesse: https://dash.cloudflare.com/
2. Vá em **Workers & Pages** > **Create application** > **Pages**
3. Clique em **Connect to Git**
4. Selecione o repositório `MapeamentoOOH`
5. Configure conforme acima
6. **NÃO** preencha o Build command
7. Clique em **Save and Deploy**

### 🔑 Configurar NOTION_TOKEN

Após o primeiro deploy (mesmo que falhe):

1. Vá em **Settings** > **Environment variables**
2. Clique em **Add variable**
3. Production:
   - Variable name: `NOTION_TOKEN`
   - Value: `secret_seu_token_aqui`
4. Clique em **Save**
5. Vá em **Deployments** > **Retry deployment**

### 🧪 Testar Deploy

Após deploy bem-sucedido, teste:

```bash
# Testar página principal
curl https://seu-projeto.pages.dev

# Testar API (deve retornar erro sem pageId, mas não 404)
curl https://seu-projeto.pages.dev/api/map-data

# Testar com pageId (substitua pelo seu)
curl "https://seu-projeto.pages.dev/api/map-data?pageId=18b20b54-9cf5-80ed-9111-df87746d4cb8"
```

### ❌ Erros Comuns e Soluções

#### Erro: "No such script: deploy"
**Causa**: Cloudflare tentando executar `npm run deploy`
**Solução**: Deixe o Build command **VAZIO**

#### Erro: "Build directory not found"
**Causa**: Build output directory incorreto
**Solução**: Use `public` (não `dist`, `build`, etc)

#### Erro: "NOTION_TOKEN is not defined"
**Causa**: Variável de ambiente não configurada
**Solução**: Adicione em Settings > Environment variables

#### Erro: 401 ao chamar API
**Causa**: Token do Notion inválido ou não configurado
**Solução**:
1. Verifique o token em https://www.notion.so/my-integrations
2. Reconfigure a variável no Cloudflare
3. Redeploy

### 📊 Verificar Logs

Para ver logs das Functions:

1. No dashboard: **Deployments** > Clique no deployment > **Functions**
2. Via CLI:
   ```bash
   wrangler pages deployment tail
   ```

### 🌐 Usar Domínio Customizado

1. No projeto, vá em **Custom domains**
2. Clique em **Set up a custom domain**
3. Digite: `mapa.seudominio.com.br`
4. Siga as instruções de DNS
5. Aguarde propagação (5-30 minutos)

### 🔄 Deploy Automático

Após configuração inicial, cada push para a branch configurada fará deploy automático:

```bash
git push origin main
# Cloudflare detecta e faz deploy automaticamente
```

### 📝 Exemplo de Configuração Completa

```yaml
# Estas são as configurações no dashboard:

Project Settings:
  Production branch: main

Build & Deployments:
  Build command: [VAZIO]
  Build output directory: public
  Root directory: /

Environment Variables:
  Production:
    NOTION_TOKEN: secret_abc123...
  Preview:
    NOTION_TOKEN: secret_abc123...
```

### ✅ Checklist de Deploy

- [ ] Repositório conectado ao Cloudflare Pages
- [ ] Build command está VAZIO
- [ ] Build output directory é `public`
- [ ] NOTION_TOKEN configurado nas variáveis de ambiente
- [ ] Deploy executado com sucesso
- [ ] Site acessível em https://seu-projeto.pages.dev
- [ ] API responde em /api/map-data
- [ ] Integração do Notion tem acesso às páginas
- [ ] Embed funciona no Notion

### 🆘 Precisa de Ajuda?

Se algo não funcionar:

1. Verifique os logs do deployment
2. Teste a API com curl
3. Verifique o console do navegador (F12)
4. Confirme que NOTION_TOKEN está configurado
5. Teste a integração do Notion manualmente

---

**Dica**: O primeiro deploy pode levar alguns minutos. Deployments subsequentes são muito mais rápidos (30-60 segundos).
