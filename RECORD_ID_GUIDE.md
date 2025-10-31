# 📋 Guia: Como Usar o Sistema com Record ID

## 🎯 Mudança Importante

O sistema agora usa **Record ID** (ID do registro/página) ao invés de Database ID. Isso torna muito mais fácil para o usuário!

## 🔍 Como Obter o Record ID

### Método 1: Copiar Link da Página (RECOMENDADO)

1. Abra qualquer registro (página) dentro da sua database OOH no Notion
2. Clique nos três pontos `⋮⋮` no canto superior direito
3. Clique em "Copy link"
4. A URL terá este formato:
   ```
   https://www.notion.so/Uniasselvi-30-10-10-18b20b549cf580ed9111df87746d4cb8
   ```
5. O Record ID é a parte final: `18b20b549cf580ed9111df87746d4cb8`

### Método 2: Da Barra de Endereço

Quando você abre um registro no Notion, a URL já contém o ID:
```
https://www.notion.so/workspace/Nome-da-Pagina-18b20b549cf580ed9111df87746d4cb8
                                                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                           Este é o Record ID
```

## 🗺️ Como Usar no Mapa

### Modo Embed (No Notion)

1. Obtenha o Record ID (passos acima)
2. Monte a URL:
   ```
   https://caf1859f.mapeamentoooh.pages.dev/?id=18b20b549cf580ed9111df87746d4cb8
   ```
3. No Notion, digite `/embed`
4. Cole a URL completa
5. Pronto! O mapa carrega automaticamente

### Modo Direto (URL Externa)

Acesse diretamente:
```
https://caf1859f.mapeamentoooh.pages.dev/?id=18b20b549cf580ed9111df87746d4cb8
```

## 🔄 Como o Sistema Funciona

```
1. Você fornece: Record ID (ID de qualquer registro da database)
   ↓
2. Sistema busca: Database pai automaticamente
   ↓
3. Sistema obtém: Título da página/projeto
   ↓
4. Sistema cria: Pasta no Drive com o nome do projeto
   ↓
5. Sistema lista: Todos os KMLs disponíveis
   ↓
6. Mapa renderiza: Todos os pontos OOH
```

## 📂 Estrutura no Google Drive

```
Drives compartilhados/
└── REDE COMPARTILHADA E-RÁDIOS/
    └── Mapeamento_OOH/
        └── [Nome da Página - extraído do Record ID]/
            ├── .metadata.json
            ├── Pontos_OOH_principais.kml
            ├── Lojas_Cliente.kml
            └── Concorrentes.kml
```

O nome da pasta é obtido automaticamente do título da página no Notion!

## 🆚 Comparação: Antes vs Agora

### ❌ ANTES (Database ID)

```
1. Usuário tinha que:
   - Abrir a database em modo full page
   - Encontrar o ID específico da database
   - Muitas vezes o link não tinha o ID correto

2. Processo complicado:
   ❌ Difícil de explicar
   ❌ Usuário confundia IDs
   ❌ Não funcional em databases inline
```

### ✅ AGORA (Record ID)

```
1. Usuário faz:
   - Abre qualquer registro
   - Copia o link
   - Pronto!

2. Processo simples:
   ✅ Um clique: "Copy link"
   ✅ Funciona com qualquer registro
   ✅ Funciona em qualquer tipo de database
```

## 🎓 Exemplos Práticos

### Exemplo 1: Database Inline

Você tem uma página "Campanha São Paulo" com uma database inline de pontos OOH:

```
📄 Campanha São Paulo
   ├── 📊 Database: Pontos OOH
   │   ├── 📍 Ponto 1 - Av. Paulista  ← Copie link deste!
   │   ├── 📍 Ponto 2 - Av. Faria Lima
   │   └── 📍 Ponto 3 - Shopping Iguatemi
```

**Antes**: Era difícil obter o database ID de uma inline database
**Agora**: Abra qualquer ponto e copie o link!

### Exemplo 2: Múltiplos Projetos

```
📄 Projetos OOH
   ├── 📄 Campanha A
   │   └── 📊 Pontos OOH A
   └── 📄 Campanha B
       └── 📊 Pontos OOH B
```

Para cada campanha:
1. Abra um registro de qualquer ponto da campanha
2. Copie o link
3. Use no mapa

O sistema automaticamente:
- Identifica a database correta
- Cria pasta com nome da campanha
- Organiza as camadas

## 🔧 Para Desenvolvedores

### API Endpoints

#### GET /api/map-data?recordId=XXX

Busca dados do mapa a partir de um record ID.

**Request:**
```http
GET /api/map-data?recordId=18b20b549cf580ed9111df87746d4cb8
```

**Response:**
```json
{
  "recordId": "18b20b54-9cf5-80ed-9111-df87746d4cb8",
  "databaseId": "18b20b54-9cf5-81f1-93ca-000b7243b961",
  "projectName": "Campanha São Paulo",
  "points": [...],
  "pointCount": 150,
  "timestamp": 1698777600000
}
```

**Fluxo Interno:**
1. Recebe `recordId`
2. Busca dados da página via Notion API
3. Obtém `parent.database_id`
4. Extrai título da página
5. Busca todos os registros da database
6. Processa e retorna pontos OOH

### Funções de Helper

```javascript
// _notion-helpers.js

// Busca database pai de um record
getParentDatabaseId(recordId, token)
  → retorna: databaseId

// Busca título da página
getPageTitle(recordId, token)
  → retorna: "Nome do Projeto"

// Busca registros da database
getDatabaseRecords(databaseId, token)
  → retorna: [records...]
```

## ✨ Benefícios

1. **Mais Fácil para o Usuário**
   - Um clique: "Copy link"
   - Não precisa entender o que é database ID

2. **Mais Flexível**
   - Funciona com qualquer tipo de database
   - Funciona com databases inline
   - Funciona com databases full page

3. **Nomenclatura Automática**
   - Nome da pasta vem do título da página
   - Organização automática no Drive

4. **Menos Erros**
   - Usuário não confunde IDs
   - Sistema valida automaticamente
   - Mensagens de erro mais claras

## 🚨 Troubleshooting

### Erro: "Record não possui parent definido"

**Causa**: O record não está dentro de uma database

**Solução**: Certifique-se de copiar o link de um registro que está dentro de uma database OOH

### Erro: "Parent não é database nem página"

**Causa**: Estrutura incomum do Notion

**Solução**: Tente usar um record diferente da mesma database

### Erro: "Integração não tem acesso"

**Causa**: A integração do Notion não foi compartilhada com a página

**Solução**:
1. Abra a página no Notion
2. Clique em `⋮⋮` > "Connections"
3. Adicione sua integração "Mapa OOH"

## 📚 Recursos

- **Notion API**: https://developers.notion.com/reference/retrieve-a-page
- **Documentação Completa**: Ver `ROADMAP.md`
- **Exemplos de Uso**: Ver `README.md`

---

**Atualizado**: 2024-10-31
**Versão**: 2.0 (Record ID System)
