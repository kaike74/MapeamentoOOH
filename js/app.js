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

// Sistema de Debug
const DEBUG = {
    enabled: true, // Mude para false em produção
    log: (...args) => {
        if (DEBUG.enabled) console.log('[MAPA-OOH]', ...args);
    },
    info: (...args) => {
        if (DEBUG.enabled) console.info('[MAPA-OOH]', ...args);
    },
    warn: (...args) => {
        if (DEBUG.enabled) console.warn('[MAPA-OOH]', ...args);
    },
    error: (...args) => {
        if (DEBUG.enabled) console.error('[MAPA-OOH]', ...args);
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

/**
 * Coleta informações de debug do ambiente
 */
function collectDebugInfo() {
    return {
        referrer: document.referrer,
        location: {
            href: window.location.href,
            hash: window.location.hash,
            search: window.location.search,
            pathname: window.location.pathname
        },
        isInIframe: window.self !== window.top,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
    };
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    console.log('🗺️ Iniciando Mapa OOH...');
    detectMode();
});

/**
 * Detecta o modo de operação (embed ou direct)
 */
function detectMode() {
    const debugInfo = collectDebugInfo();
    DEBUG.info('🔍 Informações de debug:', debugInfo);

    const isInIframe = window.self !== window.top;
    const urlParams = new URLSearchParams(window.location.search);
    const tableId = urlParams.get('id') || urlParams.get('table');

    if (isInIframe) {
        console.log('📍 Modo: EMBED (dentro do Notion)');
        DEBUG.info('🔗 Embed detectado - Referrer:', debugInfo.referrer);
        appState.mode = 'embed';
        handleEmbedMode();
    } else if (tableId) {
        console.log('📍 Modo: DIRECT com ID');
        DEBUG.info('🆔 Table ID fornecido:', tableId);
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
 * Tenta obter o page ID via PostMessage (para comunicação cross-origin)
 */
async function tryPostMessage() {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            DEBUG.warn('⏱️ Timeout: PostMessage não respondeu em 2s');
            resolve(null);
        }, 2000);

        window.addEventListener('message', function handler(event) {
            DEBUG.log('📬 Mensagem recebida:', event.origin, event.data);

            if (event.origin.includes('notion.so') && event.data.pageId) {
                clearTimeout(timeout);
                window.removeEventListener('message', handler);
                DEBUG.log('✅ Page ID recebido via PostMessage:', event.data.pageId);
                resolve(event.data.pageId);
            }
        });

        // Solicitar ID via PostMessage
        if (window.parent !== window) {
            DEBUG.log('📤 Solicitando page ID via PostMessage ao parent...');
            window.parent.postMessage({ type: 'request-page-id' }, '*');
        } else {
            DEBUG.warn('⚠️ Não está em iframe, não é possível solicitar via PostMessage');
            clearTimeout(timeout);
            resolve(null);
        }
    });
}

/**
 * Manipula modo embed (dentro do Notion)
 */
async function handleEmbedMode() {
    try {
        let pageId = null;

        // TENTATIVA 1: Referrer completo
        const referrer = document.referrer;
        console.log('🔗 Referrer:', referrer);
        DEBUG.info('🔗 Referrer completo:', referrer);

        if (referrer && referrer.includes('notion')) {
            pageId = extractNotionPageId(referrer);
            if (pageId) {
                DEBUG.log('✅ ID extraído do referrer:', pageId);
                console.log('✅ ID extraído do referrer:', pageId);
            }
        }

        // TENTATIVA 2: Window location (se disponível)
        if (!pageId) {
            DEBUG.info('🔄 Tentativa 2: Acessando parent window...');
            try {
                const parentUrl = window.parent.location.href;
                DEBUG.log('🔗 Parent URL:', parentUrl);
                pageId = extractNotionPageId(parentUrl);
                if (pageId) {
                    DEBUG.log('✅ ID extraído do parent:', pageId);
                    console.log('✅ ID extraído do parent:', pageId);
                }
            } catch (e) {
                DEBUG.warn('⚠️ Não foi possível acessar parent window (normal em cross-origin):', e.message);
            }
        }

        // TENTATIVA 3: PostMessage listener
        if (!pageId) {
            DEBUG.info('🔄 Tentativa 3: PostMessage...');
            console.log('🔄 Tentando PostMessage...');
            pageId = await tryPostMessage();
            if (pageId) {
                DEBUG.log('✅ ID recebido via PostMessage:', pageId);
                console.log('✅ ID recebido via PostMessage:', pageId);
            }
        }

        // TENTATIVA 4: URL fragments/hash
        if (!pageId) {
            DEBUG.info('🔄 Tentativa 4: Hash e Search params...');
            const hash = window.location.hash;
            const search = window.location.search;
            DEBUG.log('🔗 Hash:', hash, 'Search:', search);
            console.log('🔗 Hash:', hash, 'Search:', search);

            pageId = extractNotionPageId(hash + search);
            if (pageId) {
                DEBUG.log('✅ ID extraído de hash/search:', pageId);
                console.log('✅ ID extraído de hash/search:', pageId);
            }
        }

        if (!pageId) {
            const debugInfo = collectDebugInfo();
            throw new Error(`
❌ Não foi possível detectar o ID da página do Notion.

📋 Informações de debug:
• Referrer: ${debugInfo.referrer}
• Hash: ${debugInfo.location.hash}
• Search: ${debugInfo.location.search}
• No iframe: ${debugInfo.isInIframe ? 'Sim' : 'Não'}

💡 Soluções:
1. Use o modo direto com ID manual
2. Certifique-se de que o embed tem permissões corretas
3. Tente recarregar a página do Notion
            `);
        }

        console.log('📄 Page ID final:', pageId);
        DEBUG.info('📄 Page ID final formatado:', pageId);
        appState.currentPageId = pageId;
        await loadMapData(pageId);

    } catch (error) {
        DEBUG.error('❌ Erro no modo embed:', error);
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
    DEBUG.log('[DEBUG] Tentando extrair ID da URL:', url);

    // Padrões mais flexíveis para diferentes formatos
    const patterns = [
        // URL completa com nome da página
        /notion\.so\/[^\/]*\/[^-]+-([a-f0-9]{32})/i,
        // URL direta com ID
        /notion\.so\/([a-f0-9]{32})/i,
        // URL com workspace
        /notion\.so\/[^\/]*-([a-f0-9]{32})/i,
        // Fragment/hash
        /#([a-f0-9]{32})/i,
        // Query parameter
        /[?&]id=([a-f0-9]{32})/i,
        // Qualquer sequência de 32 caracteres hex
        /([a-f0-9]{32})/i
    ];

    for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const match = url.match(pattern);
        if (match) {
            DEBUG.log(`[DEBUG] ✅ ID encontrado com padrão ${i + 1}: ${match[1]}`);
            return formatNotionId(match[1]);
        }
    }

    DEBUG.warn('[DEBUG] ❌ Nenhum ID encontrado nos padrões');
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
    DEBUG.error('🚨 Exibindo erro ao usuário:', message);

    // Se for erro de embed, mostrar informações específicas
    if (appState.mode === 'embed' && message.includes('ID da página')) {
        const debugInfo = collectDebugInfo();

        const enhancedMessage = `
${message}

🔧 Informações técnicas:
• Referrer: ${debugInfo.referrer || 'Não disponível'}
• URL atual: ${debugInfo.location.href}
• No iframe: ${debugInfo.isInIframe ? 'Sim' : 'Não'}
• Timestamp: ${debugInfo.timestamp}

💡 Possíveis soluções:
1. Recarregue a página do Notion
2. Tente usar o modo direto (botão abaixo)
3. Verifique se o embed tem as permissões necessárias
4. Consulte o console do navegador (F12) para mais detalhes
        `;

        document.getElementById('error-text').innerHTML = enhancedMessage.replace(/\n/g, '<br>');
    } else {
        document.getElementById('error-text').textContent = message;
    }

    document.getElementById('error-message').classList.remove('hidden');
    showLoading(false);

    // Event listener para retry
    const retryButton = document.getElementById('retry-button');
    // Remove listeners antigos para evitar duplicação
    const newRetryButton = retryButton.cloneNode(true);
    retryButton.parentNode.replaceChild(newRetryButton, retryButton);

    newRetryButton.addEventListener('click', () => {
        DEBUG.info('🔄 Usuário solicitou retry...');
        document.getElementById('error-message').classList.add('hidden');
        window.location.reload();
    });
}

// Debug helpers (remover em produção)
window.appState = appState;
window.testCoords = parseCoordinates;
