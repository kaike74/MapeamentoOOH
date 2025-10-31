# 🗺️ Mapeamento OOH

Sistema de mapeamento interativo de pontos OOH (Out-of-Home) integrado com Notion, desenvolvido para substituir o Google My Maps com detecção automática de tabelas.

## ✨ Funcionalidades

### Modo Dual de Operação

- **Embed Mode**: Detecta automaticamente quando está embutido no Notion e carrega os dados da página
- **Direct Mode**: Permite acesso direto via URL com ID da tabela ou interface para gerar links

### Integração com Notion

- Detecção automática de tabelas OOH em páginas do Notion
- Sincronização em tempo real com dados do Notion
- Suporte a múltiplos campos: Endereço, Exibidora, Produto, UF, Praça
- Exibição de imagens de capa dos registros
- Sistema de cache para performance otimizada

### Mapa Interativo

- Biblioteca Leaflet para visualização interativa
- Marcadores personalizados
- Tooltips com informações completas e imagens
- Zoom automático para incluir todos os pontos
- Design responsivo para desktop, tablet e mobile

## 🏗️ Estrutura do Projeto

```
MapeamentoOOH/
├── public/                   # Frontend estático
│   ├── index.html           # Página principal
│   ├── css/
│   │   └── style.css        # Estilos
│   └── js/
│       └── app.js           # Lógica do frontend
├── functions/               # Cloudflare Pages Functions
│   └── [[path]].js         # Handler de rotas API
├── workers/                 # Cloudflare Workers (alternativo)
│   └── notion-api.js       # Worker para API Notion
├── wrangler.toml           # Configuração Cloudflare
├── package.json            # Dependências
└── README.md               # Documentação
```

## 🚀 Deploy

### Cloudflare Pages (Recomendado)

1. **Conecte o repositório ao Cloudflare Pages**:
   - Acesse o dashboard do Cloudflare
   - Vá em "Pages" > "Create a project"
   - Conecte seu repositório Git

2. **Configure o build**:
   - Build command: `(deixar vazio)`
   - Build output directory: `public`

3. **Configure variáveis de ambiente**:
   - Adicione `NOTION_TOKEN` com seu token de integração do Notion

4. **Deploy**:
   ```bash
   npm run pages:deploy
   ```

### Configuração do Notion

1. **Crie uma integração interna**:
   - Acesse https://www.notion.so/my-integrations
   - Clique em "New integration"
   - Dê um nome (ex: "Mapa OOH")
   - Copie o "Internal Integration Token"

2. **Compartilhe páginas com a integração**:
   - Abra a página do Notion que contém a tabela OOH
   - Clique em "•••" > "Connections" > "Connect to"
   - Selecione sua integração

3. **Configure o token no Cloudflare**:
   ```bash
   # Via Wrangler CLI
   wrangler pages secret put NOTION_TOKEN

   # Ou via Dashboard:
   # Settings > Environment Variables > Add variable
   ```

## 📊 Schema da Tabela OOH

Sua tabela do Notion deve conter os seguintes campos:

| Campo       | Tipo          | Obrigatório | Descrição                    |
|-------------|---------------|-------------|------------------------------|
| Lat/long    | Text          | ✅ Sim      | Coordenadas "lat,lng"       |
| Endereço    | Title/Text    | ✅ Sim      | Nome/localização do ponto   |
| Exibidora   | Text          | ⬜ Não      | Nome da exibidora           |
| Produto     | Multi-select  | ⬜ Não      | Tipo de produto OOH         |
| UF          | Text          | ⬜ Não      | Estado                      |
| Praça       | Text          | ⬜ Não      | Cidade                      |
| Incluso     | Checkbox      | ⬜ Não      | Se incluído na proposta     |
| Cover       | File/URL      | ⬜ Não      | Imagem do ponto             |

### Exemplo de Dados

```
Endereço: Av. Paulista, 1000
Lat/long: -23.561414, -46.655882
Exibidora: JCDecaux
Produto: Digital, Backlight
UF: SP
Praça: São Paulo
Incluso: ✅
```

## 🎨 Como Usar

### Modo 1: Embed no Notion

1. Copie a URL do seu site deployado
2. Na página do Notion, digite `/embed`
3. Cole a URL do site
4. O mapa detectará automaticamente a tabela da página

### Modo 2: Link Direto

1. Acesse o site diretamente
2. Clique em "Gerar Link Direto"
3. Insira o ID da tabela do Notion
4. Use o link gerado para acessar o mapa

### Obter ID da Tabela

1. Abra a tabela no Notion (full page)
2. Copie a URL: `https://notion.so/workspace/Table-18b20b549cf580ed9111df87746d4cb8`
3. O ID é: `18b20b549cf580ed9111df87746d4cb8`

Ou use o formato com hífen: `18b20b54-9cf5-80ed-9111-df87746d4cb8`

## 🛠️ Desenvolvimento Local

### Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/MapeamentoOOH.git
cd MapeamentoOOH

# Instale dependências
npm install
```

### Configuração Local

1. Crie arquivo `.dev.vars` na raiz:
   ```
   NOTION_TOKEN=seu_token_aqui
   ```

2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run pages:dev
   ```

3. Acesse: http://localhost:8788

### Testando

Para testar o embed mode localmente, você pode usar um iframe:

```html
<iframe
    src="http://localhost:8788"
    width="100%"
    height="600"
    frameborder="0">
</iframe>
```

## 📝 API Endpoints

### GET /api/map-data

Busca dados do mapa pela página do Notion.

**Query Parameters**:
- `pageId` (string, obrigatório): ID da página do Notion

**Response**:
```json
{
  "pageId": "18b20b54-9cf5-80ed-9111-df87746d4cb8",
  "tableId": "18b20b54-9cf5-81f1-93ca-000b7243b961",
  "points": [
    {
      "id": "...",
      "latlong": "-23.561414, -46.655882",
      "endereco": "Av. Paulista, 1000",
      "exibidora": "JCDecaux",
      "produto": ["Digital", "Backlight"],
      "uf": "SP",
      "praca": "São Paulo",
      "imagem": "https://..."
    }
  ],
  "timestamp": 1234567890
}
```

### GET /api/table-data

Busca dados do mapa pela tabela diretamente.

**Query Parameters**:
- `tableId` (string, obrigatório): ID da tabela/database do Notion

**Response**: Mesmo formato de `/api/map-data`

## 🔧 Configuração Avançada

### Cache

O sistema usa cache em dois níveis:

1. **Frontend Cache**: Cache em memória (5 minutos)
2. **Worker Cache**: Cloudflare Cache API (5 minutos)

Para ajustar o TTL, edite:
- Frontend: `public/js/app.js` → `CONFIG.cache.ttl`
- Worker: `functions/[[path]].js` → `CACHE_TTL`

### Customização do Mapa

Edite `public/js/app.js`:

```javascript
const CONFIG = {
    defaultCenter: [-15.7939, -47.8828], // Centro padrão
    defaultZoom: 4,                       // Zoom padrão
    markerColor: '#e74c3c',              // Cor dos marcadores
    // ...
};
```

### Customização Visual

Cores e estilos podem ser ajustados em `public/css/style.css`.

## 🐛 Troubleshooting

### Erro: "NOTION_TOKEN não configurado"

Verifique se a variável de ambiente está configurada no Cloudflare Pages.

### Erro: "Tabela OOH não encontrada"

- Verifique se a tabela está na página
- Confirme que a integração tem acesso à página
- Verifique se os campos obrigatórios existem

### Erro: "Coordenadas inválidas"

Certifique-se de que o campo "Lat/long" está no formato: `latitude, longitude`
Exemplo: `-23.561414, -46.655882`

### Mapa não carrega no Notion

- Verifique se o site está com HTTPS
- Confirme que o CORS está habilitado
- Teste o embed em outra página

## 📦 Dependências

### Frontend
- [Leaflet](https://leafletjs.com/) 1.9.4 - Biblioteca de mapas interativos
- JavaScript vanilla (ES6+)
- CSS3

### Backend
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless runtime
- [Notion API](https://developers.notion.com/) - Integração com Notion

### Desenvolvimento
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) - CLI do Cloudflare

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🙏 Agradecimentos

- [Leaflet](https://leafletjs.com/) pela excelente biblioteca de mapas
- [Notion](https://notion.so/) pela API poderosa
- [Cloudflare](https://cloudflare.com/) pela infraestrutura edge

## 📞 Suporte

Para questões e suporte:

- Abra uma [issue](https://github.com/seu-usuario/MapeamentoOOH/issues)
- Consulte a [documentação do Notion API](https://developers.notion.com/)
- Consulte a [documentação do Cloudflare Pages](https://developers.cloudflare.com/pages/)

---

Desenvolvido com ❤️ para otimizar propostas comerciais OOH
