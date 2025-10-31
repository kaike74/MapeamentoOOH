// Configurações
const CONFIG = {
    // URL do Cloudflare Worker (ajustar após deploy)
    apiEndpoint: '/api',
    defaultCenter: [-15.7939, -47.8828], // Centro do Brasil (Brasília)
    defaultZoom: 4,
    markerColor: '#e74c3c',
    cache: {
        enabled: true,
        ttl: 5 * 60 * 1000 // 5 minutos
    }
};

// Estado da aplicação
const appState = {
    map: null,
    markers: [],
    mode: null, // 'embed' ou 'direct'
    currentPageId: null,
    currentTableId: null
};

// Cache simples em memória
const cache = new Map();

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    console.log('🗺️ Iniciando Mapa OOH...');
    detectMode();
});

/**
 * Detecta o modo de operação (embed ou direct)
 */
function detectMode() {
    const isInIframe = window.self !== window.top;
    const urlParams = new URLSearchParams(window.location.search);
    const tableId = urlParams.get('id') || urlParams.get('table');

    if (isInIframe) {
        console.log('📍 Modo: EMBED (dentro do Notion)');
        appState.mode = 'embed';
        handleEmbedMode();
    } else if (tableId) {
        console.log('📍 Modo: DIRECT com ID');
        appState.mode = 'direct';
        appState.currentTableId = tableId;
        handleDirectModeWithId(tableId);
    } else {
        console.log('📍 Modo: DIRECT sem ID');
        appState.mode = 'direct';
        showDirectModeMessage();
    }
}

/**
 * Manipula modo embed (dentro do Notion)
 */
async function handleEmbedMode() {
    try {
        const referrer = document.referrer;
        console.log('🔗 Referrer:', referrer);

        if (!referrer || !referrer.includes('notion')) {
            throw new Error('Não foi possível detectar a página do Notion. Certifique-se de que está embutido corretamente.');
        }

        const pageId = extractNotionPageId(referrer);
        if (!pageId) {
            throw new Error('ID da página do Notion não encontrado no referrer.');
        }

        console.log('📄 Page ID extraído:', pageId);
        appState.currentPageId = pageId;

        // Buscar dados da tabela
        await loadMapData(pageId);

    } catch (error) {
        console.error('❌ Erro no modo embed:', error);
        showError(error.message);
    }
}

/**
 * Manipula modo direto com ID na URL
 */
async function handleDirectModeWithId(tableId) {
    try {
        console.log('🔍 Carregando tabela:', tableId);
        await loadMapDataByTableId(tableId);
    } catch (error) {
        console.error('❌ Erro ao carregar tabela:', error);
        showError(error.message);
    }
}

/**
 * Extrai o ID da página do Notion do URL
 */
function extractNotionPageId(url) {
    // Formatos possíveis:
    // https://www.notion.so/workspace/Page-Name-18b20b549cf580ed9111df87746d4cb8
    // https://notion.so/18b20b549cf580ed9111df87746d4cb8

    const patterns = [
        /notion\.so\/[^\/]*\/[^-]+-([a-f0-9]{32})/i,
        /notion\.so\/([a-f0-9]{32})/i,
        /notion\.so\/[^\/]*-([a-f0-9]{32})/i
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return formatNotionId(match[1]);
        }
    }

    return null;
}

/**
 * Formata ID do Notion para o formato UUID
 */
function formatNotionId(id) {
    // Remove hífens se existirem
    const cleanId = id.replace(/-/g, '');

    // Adiciona hífens no formato UUID
    if (cleanId.length === 32) {
        return `${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(12, 16)}-${cleanId.slice(16, 20)}-${cleanId.slice(20)}`;
    }

    return id;
}

/**
 * Carrega dados do mapa pela página do Notion
 */
async function loadMapData(pageId) {
    showLoading(true);

    try {
        // Verifica cache
        const cacheKey = `page-${pageId}`;
        if (CONFIG.cache.enabled && cache.has(cacheKey)) {
            const cached = cache.get(cacheKey);
            if (Date.now() - cached.timestamp < CONFIG.cache.ttl) {
                console.log('✅ Dados do cache');
                await renderMap(cached.data);
                return;
            }
        }

        // Busca dados da API
        const response = await fetch(`${CONFIG.apiEndpoint}/map-data?pageId=${pageId}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }

        const data = await response.json();

        // Armazena no cache
        if (CONFIG.cache.enabled) {
            cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
        }

        await renderMap(data);

    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        throw error;
    } finally {
        showLoading(false);
    }
}

/**
 * Carrega dados do mapa pelo ID da tabela
 */
async function loadMapDataByTableId(tableId) {
    showLoading(true);

    try {
        // Verifica cache
        const cacheKey = `table-${tableId}`;
        if (CONFIG.cache.enabled && cache.has(cacheKey)) {
            const cached = cache.get(cacheKey);
            if (Date.now() - cached.timestamp < CONFIG.cache.ttl) {
                console.log('✅ Dados do cache');
                await renderMap(cached.data);
                return;
            }
        }

        // Busca dados da API
        const response = await fetch(`${CONFIG.apiEndpoint}/table-data?tableId=${tableId}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }

        const data = await response.json();

        // Armazena no cache
        if (CONFIG.cache.enabled) {
            cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
        }

        await renderMap(data);

    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        throw error;
    } finally {
        showLoading(false);
    }
}

/**
 * Renderiza o mapa com os dados
 */
async function renderMap(data) {
    console.log('🗺️ Renderizando mapa com', data.points?.length || 0, 'pontos');

    // Inicializa o mapa se ainda não existe
    if (!appState.map) {
        initMap();
    }

    // Remove marcadores anteriores
    appState.markers.forEach(marker => marker.remove());
    appState.markers = [];

    // Valida dados
    if (!data.points || data.points.length === 0) {
        throw new Error('Nenhum ponto encontrado. Verifique se a tabela possui dados válidos com coordenadas.');
    }

    // Adiciona marcadores
    const validPoints = [];

    data.points.forEach((point, index) => {
        try {
            const coords = parseCoordinates(point.latlong);
            if (!coords) {
                console.warn(`⚠️ Coordenadas inválidas no ponto ${index}:`, point.latlong);
                return;
            }

            const marker = L.marker([coords.lat, coords.lng], {
                icon: createCustomIcon()
            });

            const popupContent = createPopupContent(point);
            marker.bindPopup(popupContent, {
                maxWidth: 300,
                className: 'custom-popup'
            });

            marker.addTo(appState.map);
            appState.markers.push(marker);
            validPoints.push(coords);

        } catch (error) {
            console.warn(`⚠️ Erro ao processar ponto ${index}:`, error);
        }
    });

    // Ajusta zoom para incluir todos os pontos
    if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints.map(p => [p.lat, p.lng]));
        appState.map.fitBounds(bounds, { padding: [50, 50] });
    }

    console.log('✅ Mapa renderizado com sucesso!');
}

/**
 * Inicializa o mapa Leaflet
 */
function initMap() {
    appState.map = L.map('map').setView(CONFIG.defaultCenter, CONFIG.defaultZoom);

    // Adiciona tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(appState.map);

    console.log('✅ Mapa inicializado');
}

/**
 * Cria ícone customizado para os marcadores
 */
function createCustomIcon() {
    return L.divIcon({
        className: 'custom-marker',
        html: `
            <div style="
                background: ${CONFIG.markerColor};
                width: 30px;
                height: 30px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            "></div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });
}

/**
 * Cria conteúdo HTML do popup
 */
function createPopupContent(point) {
    const {
        endereco,
        exibidora,
        produto,
        uf,
        praca,
        imagem
    } = point;

    let html = '<div class="point-tooltip">';

    // Imagem (se disponível)
    if (imagem) {
        html += `<img src="${imagem}" alt="${endereco}" />`;
    }

    html += '<div class="point-tooltip-content">';

    // Título (Endereço)
    if (endereco) {
        html += `<h3>${endereco}</h3>`;
    }

    html += '<div class="tooltip-divider"></div>';

    // Informações
    if (exibidora) {
        html += `<p><strong>Exibidora:</strong> ${exibidora}</p>`;
    }

    if (produto) {
        const produtoStr = Array.isArray(produto) ? produto.join(', ') : produto;
        html += `<p><strong>Produto:</strong> ${produtoStr}</p>`;
    }

    if (praca || uf) {
        const local = [praca, uf].filter(Boolean).join(', ');
        html += `<p><strong>Local:</strong> ${local}</p>`;
    }

    html += '</div></div>';

    return html;
}

/**
 * Parse coordenadas do formato "lat,lng"
 */
function parseCoordinates(latlongStr) {
    if (!latlongStr || typeof latlongStr !== 'string') {
        return null;
    }

    const parts = latlongStr.split(',').map(s => s.trim());
    if (parts.length !== 2) {
        return null;
    }

    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lng)) {
        return null;
    }

    // Valida ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return null;
    }

    return { lat, lng };
}

/**
 * Mostra mensagem de modo direto
 */
function showDirectModeMessage() {
    document.getElementById('direct-mode-message').classList.remove('hidden');
    showLoading(false);

    // Event listeners
    document.getElementById('share-button').addEventListener('click', openShareModal);
}

/**
 * Abre modal de compartilhamento
 */
function openShareModal() {
    document.getElementById('share-modal').classList.remove('hidden');
    document.getElementById('generated-link-container').classList.add('hidden');
    document.getElementById('table-id-input').value = '';

    // Event listeners
    document.querySelector('.close-modal').addEventListener('click', closeShareModal);
    document.getElementById('generate-link-button').addEventListener('click', generateLink);
}

/**
 * Fecha modal de compartilhamento
 */
function closeShareModal() {
    document.getElementById('share-modal').classList.add('hidden');
}

/**
 * Gera link direto
 */
function generateLink() {
    const tableId = document.getElementById('table-id-input').value.trim();

    if (!tableId) {
        alert('Por favor, insira o ID da tabela.');
        return;
    }

    const link = `${window.location.origin}${window.location.pathname}?id=${tableId}`;
    document.getElementById('generated-link').value = link;
    document.getElementById('generated-link-container').classList.remove('hidden');

    // Event listener para copiar
    document.getElementById('copy-link-button').addEventListener('click', () => {
        const linkInput = document.getElementById('generated-link');
        linkInput.select();
        document.execCommand('copy');

        const button = document.getElementById('copy-link-button');
        button.textContent = '✅ Copiado!';
        setTimeout(() => {
            button.textContent = 'Copiar';
        }, 2000);
    });
}

/**
 * Mostra/oculta loading
 */
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

/**
 * Mostra mensagem de erro
 */
function showError(message) {
    document.getElementById('error-text').textContent = message;
    document.getElementById('error-message').classList.remove('hidden');
    showLoading(false);

    // Event listener para retry
    document.getElementById('retry-button').addEventListener('click', () => {
        document.getElementById('error-message').classList.add('hidden');
        window.location.reload();
    });
}

// Debug helpers (remover em produção)
window.appState = appState;
window.testCoords = parseCoordinates;
