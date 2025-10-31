# 🗺️ Mapeamento OOH - Roadmap de Implementação

## ✅ Módulos Frontend Criados

### 1. config.js
- ✅ Configurações globais do sistema
- ✅ Constantes de API endpoints
- ✅ Configurações de mapas, marcadores, cache
- ✅ Detecção automática de colunas
- ✅ Funções de debug

### 2. kml-processor.js
- ✅ Parse de KML para GeoJSON
- ✅ Conversão de GeoJSON para KML
- ✅ Validação de estrutura KML
- ✅ Extração de dados estendidos
- ✅ Processamento de estilos

### 3. geocoding.js
- ✅ Integração com Nominatim (OpenStreetMap)
- ✅ Geocodificação individual e em lote
- ✅ Rate limiting automático
- ✅ Cache de resultados
- ✅ Auto-detecção de tipos de colunas
- ✅ Cálculo de confiança dos resultados

### 4. layer-manager.js
- ✅ Gerenciamento de camadas dinâmicas
- ✅ Carregamento lazy de KMLs
- ✅ Toggle de visibilidade
- ✅ Controle de opacidade
- ✅ Renomear camadas
- ✅ Alterar cores e ícones
- ✅ Soft delete
- ✅ Criação de marcadores customizados
- ✅ Sistema de eventos para UI

### 5. upload-wizard.js
- ✅ Processamento de Excel, CSV e KML
- ✅ Auto-mapeamento de colunas
- ✅ Interface de assistente (evento-driven)
- ✅ Geocodificação automática
- ✅ Validações de arquivo
- ✅ Progress tracking

### 6. map-manager.js
- ✅ Inicialização do mapa Leaflet
- ✅ Integração com LayerManager
- ✅ Ajuste automático de bounds

## 🚧 Próximos Passos

### Backend - Cloudflare Functions

#### 1. Expandir /api/[[path]].js
Adicionar novas rotas:

```javascript
// /api/layer-list?projectId=XXX
- Lista KMLs na pasta do projeto
- Retorna: [{ id, name, color, icon, pointCount, kmlUrl }]

// /api/layer-upload (POST)
- Recebe: { projectId, fileName, kmlData }
- Salva KML no Google Drive
- Retorna: { layerId, success }

// /api/layer-manage (POST)
- Actions: rename, delete, update_style
- Gerencia arquivos KML no Drive
- Retorna: { success }

// /api/kml-data?layerId=XXX&projectId=XXX
- Retorna conteúdo do KML
- Com cache (1 hora)
```

#### 2. Integração Google Drive
Reutilizar sistema existente e adicionar:
- ✅ Busca de pasta hierárquica (já existe)
- 🚧 Criar pasta por projeto: `Mapeamento_OOH/[Nome da Página]/`
- 🚧 Listar arquivos KML
- 🚧 Upload de KML
- 🚧 Renomear arquivo
- 🚧 Soft delete (adicionar `_EXCLUIDO_`)
- 🚧 Metadados em `.metadata.json`

#### 3. Notion API
Expandir funções existentes:
- ✅ Buscar dados de tabela OOH (já existe)
- 🚧 Obter nome da página pai
- 🚧 Buscar database ID a partir de record ID

### Frontend - Interface HTML/CSS

#### 1. Atualizar public/index.html

Adicionar estrutura:

```html
<!-- Sidebar de Camadas -->
<div id="layer-panel" class="layer-panel">
    <h3>Camadas</h3>
    <div id="layer-list"></div>
    <button id="add-layer-btn">+ Adicionar Camada</button>
</div>

<!-- Modal de Upload -->
<div id="upload-modal" class="modal hidden">
    <div class="wizard-step-1">
        <!-- Seleção de arquivo -->
    </div>
    <div class="wizard-step-2">
        <!-- Mapeamento de colunas -->
    </div>
    <div class="wizard-step-3">
        <!-- Preview e confirmação -->
    </div>
</div>

<!-- Modal de Edição de Camada -->
<div id="edit-layer-modal" class="modal hidden">
    <!-- Formulário de edição -->
</div>
```

#### 2. Atualizar public/css/style.css

Adicionar estilos:
- Painel lateral de camadas (colapsável em mobile)
- Controles de camada (checkbox, slider, botões)
- Modal de wizard com steps
- Seletor de cores e ícones
- Progress bars
- Badges de camadas
- Responsividade mobile

#### 3. Criar public/js/ui-controller.js

Gerenciar UI:
- Renderizar lista de camadas
- Handlers de eventos
- Modais de upload e edição
- Progress tracking
- Feedback visual

#### 4. Atualizar public/js/app.js

Integrar todos os módulos:

```javascript
import { CONFIG } from './config.js';
import { MapManager } from './map-manager.js';
import { UploadWizard } from './upload-wizard.js';

const mapManager = new MapManager();
let projectId, projectName;

// Detectar modo e ID
// Inicializar mapa
// Carregar camadas
// Setup event listeners
```

## 📋 Checklist de Implementação

### Fase 1: Core Backend (Crítico)
- [ ] Expandir [[path]].js com novas rotas
- [ ] Implementar /api/layer-list
- [ ] Implementar /api/layer-upload
- [ ] Implementar /api/layer-manage
- [ ] Implementar /api/kml-data
- [ ] Funções helper para Google Drive
- [ ] Obter nome da página do Notion

### Fase 2: Frontend Integration
- [ ] Atualizar index.html com nova estrutura
- [ ] Criar/atualizar styles.css
- [ ] Criar ui-controller.js
- [ ] Atualizar app.js principal
- [ ] Integrar todos os módulos
- [ ] Event handlers completos

### Fase 3: Testing & Polish
- [ ] Testar upload de Excel/CSV
- [ ] Testar upload de KML
- [ ] Testar geocodificação
- [ ] Testar gerenciamento de camadas
- [ ] Testar modo embed vs direto
- [ ] Testar responsividade mobile
- [ ] Otimizar performance
- [ ] Error handling robusto

### Fase 4: Documentation
- [ ] README com instruções de uso
- [ ] Documentação de API
- [ ] Guia de contribuição
- [ ] Exemplos de uso

## 🎯 Features Implementadas vs Planejadas

### ✅ Implementado
- [x] Sistema modular de configuração
- [x] Processador completo de KML
- [x] Geocodificação com OpenStreetMap
- [x] Gerenciador de camadas dinâmicas
- [x] Assistente de upload com auto-mapeamento
- [x] Detecção automática de tipos de colunas
- [x] Cache inteligente
- [x] Sistema de eventos para UI
- [x] Marcadores customizados
- [x] Soft delete de camadas

### 🚧 Em Progresso
- [ ] Integração completa com Google Drive
- [ ] Rotas de API backend
- [ ] Interface HTML completa
- [ ] UI Controller

### 📝 Planejado
- [ ] Clustering de pontos para performance
- [ ] Filtros avançados
- [ ] Estatísticas por camada
- [ ] Export de dados
- [ ] Compartilhamento de mapas
- [ ] Modo offline
- [ ] PWA support

## 🚀 Como Continuar o Desenvolvimento

### 1. Backend Priority
O próximo passo crítico é implementar as rotas de API:

```bash
# Editar functions/api/[[path]].js
# Adicionar handlers para:
# - /api/layer-list
# - /api/layer-upload
# - /api/layer-manage
# - /api/kml-data
```

### 2. Testar Localmente
```bash
# Instalar Wrangler (Cloudflare CLI)
npm install -g wrangler

# Executar localmente
npx wrangler pages dev public

# Testar rotas
curl http://localhost:8788/api/layer-list?projectId=xxx
```

### 3. Deploy
```bash
# Commit changes
git add .
git commit -m "feat: Implement layer management system"

# Push (Cloudflare Pages faz deploy automático)
git push origin claude/fix-ember-mode-error-011CUeWTxzfcLYbuFBsjpnoz
```

## 📚 Recursos e Referências

### APIs Utilizadas
- **Notion API**: https://developers.notion.com/
- **Google Drive API**: https://developers.google.com/drive
- **Nominatim**: https://nominatim.openstreetmap.org/
- **Leaflet.js**: https://leafletjs.com/

### Documentação
- **KML Reference**: https://developers.google.com/kml/documentation
- **GeoJSON Spec**: https://geojson.org/
- **Cloudflare Pages**: https://developers.cloudflare.com/pages/

## 💡 Notas Técnicas

### Estrutura de Pastas no Drive
```
Drives compartilhados/
└── REDE COMPARTILHADA E-RÁDIOS/
    └── Mapeamento_OOH/
        └── [Nome da Página do Notion]/
            ├── .metadata.json (config de camadas)
            ├── Pontos_OOH_principais.kml
            ├── Lojas_Cliente.kml
            └── Concorrentes_EXCLUIDO_.kml (soft deleted)
```

### Formato do .metadata.json
```json
{
  "project": {
    "id": "xxx",
    "name": "Nome da Página",
    "created": "2024-10-31T00:00:00Z"
  },
  "layers": {
    "layer-id-1": {
      "name": "Pontos OOH principais",
      "color": "#e74c3c",
      "icon": "pin",
      "file": "Pontos_OOH_principais.kml",
      "visible": true,
      "opacity": 1.0
    }
  }
}
```

### Cache Strategy
- **Notion data**: 5 minutos
- **KML files**: 1 hora
- **Geocoding**: 30 dias
- **Layer list**: 5 minutos

---

**Status**: 🟡 Desenvolvimento em andamento
**Última atualização**: 2024-10-31
**Próximo milestone**: Implementar rotas de API backend
