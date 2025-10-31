/**
 * Configurações globais do sistema de Mapeamento OOH
 */

export const CONFIG = {
    // API Endpoints
    // IMPORTANTE: Sistema usa RECORD ID (ID do registro) não database ID
    api: {
        endpoint: '/api',
        mapData: '/api/map-data',          // GET ?recordId=XXX (mudou de pageId)
        layerList: '/api/layer-list',      // GET ?projectId=XXX
        layerUpload: '/api/layer-upload',  // POST
        layerManage: '/api/layer-manage',  // POST
        kmlData: '/api/kml-data',          // GET ?layerId=XXX&projectId=XXX
        geocode: '/api/geocode'            // POST (futuro)
    },

    // Configurações do mapa
    map: {
        defaultCenter: [-15.7939, -47.8828], // Centro do Brasil (Brasília)
        defaultZoom: 4,
        maxZoom: 19,
        minZoom: 3,
        clusterDistance: 50, // Distância para clustering de pontos
        clusterMaxZoom: 15 // Zoom máximo para clustering
    },

    // Configurações de marcadores
    markers: {
        defaultColor: '#e74c3c',
        defaultIcon: 'pin',
        availableIcons: [
            { id: 'pin', label: 'Alfinete', icon: '📍' },
            { id: 'store', label: 'Loja', icon: '🏪' },
            { id: 'building', label: 'Prédio', icon: '🏢' },
            { id: 'flag', label: 'Bandeira', icon: '🚩' },
            { id: 'star', label: 'Estrela', icon: '⭐' },
            { id: 'target', label: 'Alvo', icon: '🎯' },
            { id: 'billboard', label: 'Outdoor', icon: '📺' }
        ],
        defaultColors: [
            '#e74c3c', // Vermelho
            '#3498db', // Azul
            '#2ecc71', // Verde
            '#f39c12', // Laranja
            '#9b59b6', // Roxo
            '#1abc9c', // Turquesa
            '#e67e22', // Laranja escuro
            '#34495e'  // Cinza escuro
        ]
    },

    // Configurações de cache
    cache: {
        enabled: true,
        ttl: 5 * 60 * 1000, // 5 minutos
        kmlTTL: 60 * 60 * 1000, // 1 hora para KMLs
        geocodeTTL: 30 * 24 * 60 * 60 * 1000 // 30 dias para geocoding
    },

    // Configurações de upload
    upload: {
        maxFileSize: 10 * 1024 * 1024, // 10 MB
        acceptedFormats: {
            spreadsheet: ['.xlsx', '.xls', '.csv'],
            kml: ['.kml']
        },
        maxRows: 5000 // Máximo de linhas por arquivo
    },

    // Configurações de geocodificação
    geocoding: {
        provider: 'nominatim', // OpenStreetMap Nominatim
        apiUrl: 'https://nominatim.openstreetmap.org/search',
        userAgent: 'MapeamentoOOH/1.0',
        rateLimit: 1000, // 1 requisição por segundo
        batchSize: 10, // Processar 10 endereços por vez
        timeout: 10000 // 10 segundos
    },

    // Detecção automática de colunas
    columnDetection: {
        // Padrões para detectar tipo de coluna (case-insensitive)
        patterns: {
            latitude: ['lat', 'latitude', 'latitud'],
            longitude: ['lng', 'lon', 'long', 'longitude', 'longitud'],
            address: ['endereco', 'endereço', 'address', 'rua', 'logradouro'],
            city: ['cidade', 'city', 'municipio', 'município'],
            state: ['estado', 'state', 'uf'],
            zipcode: ['cep', 'zip', 'zipcode', 'postal', 'codigo postal'],
            label: ['nome', 'name', 'titulo', 'título', 'label', 'rotulo', 'rótulo'],
            category: ['categoria', 'category', 'tipo', 'type', 'classificacao']
        }
    },

    // Modos de operação
    modes: {
        EMBED: 'embed',    // Dentro do Notion (iframe)
        DIRECT: 'direct'   // URL direta
    },

    // Mensagens e textos
    messages: {
        loading: 'Carregando mapa...',
        uploadingFile: 'Processando arquivo...',
        geocoding: 'Geocodificando endereços...',
        savingLayer: 'Salvando camada...',
        deletingLayer: 'Excluindo camada...',
        errorGeneric: 'Ocorreu um erro. Tente novamente.',
        noPointsFound: 'Nenhum ponto encontrado.',
        invalidFile: 'Arquivo inválido. Verifique o formato.',
        fileTooLarge: 'Arquivo muito grande. Máximo: 10 MB.',
        tooManyRows: 'Muitas linhas. Máximo: 5000.'
    },

    // Google Drive (reutilizando estrutura existente)
    drive: {
        baseFolderName: 'Mapeamento_OOH',
        sharedDriveName: 'REDE COMPARTILHADA E-RÁDIOS',
        deletedSuffix: '_EXCLUIDO_',
        metadataFile: '.metadata.json'
    },

    // Notion
    notion: {
        apiVersion: '2022-06-28',
        idPattern: /[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i
    },

    // Debug
    debug: true
};

// Utilitário para log de debug
export function debugLog(...args) {
    if (CONFIG.debug) {
        console.log('[MAPA-OOH]', ...args);
    }
}

export function debugError(...args) {
    console.error('[MAPA-OOH] ❌', ...args);
}

export function debugWarn(...args) {
    console.warn('[MAPA-OOH] ⚠️', ...args);
}
