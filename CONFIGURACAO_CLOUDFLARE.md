# ⚠️ CONFIGURAÇÃO CRÍTICA - CLOUDFLARE PAGES

## 🚨 Problema do 404 - SOLUÇÃO DEFINITIVA

Se o site está retornando "404 - Not Found", siga EXATAMENTE estas configurações:

### ✅ Configuração Correta no Dashboard

Vá em: **Cloudflare Dashboard** → **Pages** → **mapeamentoooh** → **Settings** → **Builds & deployments**

**Configure EXATAMENTE assim:**

```
Framework preset: None
Build command: (DEIXAR COMPLETAMENTE VAZIO)
Build output directory: (DEIXAR VAZIO OU .)
Root directory: (padrão: /)
```

**⚠️ CRÍTICO**: O campo "Build output directory" deve estar **VAZIO** ou com apenas um **ponto (.)**, NÃO "public"!

### 🔄 Aplicar Mudanças

Após ajustar a configuração:

1. Clique em **Save**
2. Vá em **Deployments**
3. Clique em **Retry deployment** no último deploy
4. Aguarde 2-3 minutos

### 📁 Estrutura Atual do Repositório

```
MapeamentoOOH/
├── index.html              ← Servido em /
├── css/
│   └── style.css          ← Servido em /css/style.css
├── js/
│   └── app.js             ← Servido em /js/app.js
├── functions/
│   └── api/
│       └── [[path]].js    ← API em /api/*
└── public/                ← (backup, não usado se config estiver vazia)
    ├── index.html
    ├── css/
    └── js/
```

### 🧪 Verificar Configuração Atual

Para verificar qual configuração está ativa:

1. **Dashboard** → **Pages** → **mapeamentoooh**
2. **Settings** → **Builds & deployments**
3. Verifique o campo **Build output directory**

**Se estiver "public"** → Mude para **vazio** e redeploy
**Se estiver vazio ou "."** → Correto!

### 🔍 Testar Após Deploy

```bash
# Teste 1: Página principal (deve retornar HTML)
curl -I https://mapeamentoooh.pages.dev

# Deve retornar:
# HTTP/2 200
# content-type: text/html

# Teste 2: API (deve retornar JSON com erro)
curl https://mapeamentoooh.pages.dev/api/map-data

# Deve retornar:
# {"error":"pageId é obrigatório"}
```

### 📊 Como o Cloudflare Pages Funciona

**Build output directory vazio ou ".":**
```
Repositório                  Site
index.html          →       /
css/style.css       →       /css/style.css
js/app.js          →       /js/app.js
functions/api/*     →       /api/* (Functions)
```

**Build output directory "public":**
```
Repositório                  Site
public/index.html   →       /
public/css/         →       /css/
public/js/          →       /js/
functions/api/*     →       /api/* (Functions)
```

### ⚡ Solução Rápida via Wrangler

Se preferir fazer via CLI:

```bash
# 1. Configurar corretamente
# Edite wrangler.toml ou use o dashboard

# 2. Deploy direto
npx wrangler pages deploy . --project-name=mapeamentoooh

# Isso faz deploy da raiz do repositório
```

### 🐛 Troubleshooting

#### Erro: "404 - Not Found" na página principal

**Causa**: Build output directory está configurado incorretamente

**Solução**:
1. Settings → Builds & deployments
2. Mude "Build output directory" para **vazio**
3. Retry deployment

#### Erro: "This site can't be reached"

**Causa**: DNS ainda propagando

**Solução**: Aguarde 5-10 minutos

#### Erro: API retorna 404

**Causa**: Functions não foram deployadas

**Solução**: Verifique que a pasta `functions/` está no repositório

### ✅ Checklist Final

- [ ] Build output directory está **vazio** ou **.**
- [ ] Build command está **vazio**
- [ ] Arquivos index.html, css/, js/ estão na **raiz**
- [ ] Pasta functions/ existe na **raiz**
- [ ] NOTION_TOKEN está configurado em Environment Variables
- [ ] Deploy foi feito após as mudanças
- [ ] Aguardou 2-3 minutos após deploy

### 🆘 Se Nada Funcionar

1. **Delete o projeto** no Cloudflare Pages
2. **Recrie do zero** com as configurações acima
3. **Conecte o repositório** novamente
4. **Configure exatamente** como descrito

---

**RESUMO**: O campo "Build output directory" deve estar **VAZIO**, não "public"!
