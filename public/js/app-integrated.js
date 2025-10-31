/**
 * Aplicação Principal - Mapeamento OOH Integrado
 * Este é um exemplo de como integrar todos os módulos
 *
 * TODO: Substituir o app.js atual por este após implementar as rotas de API
 */

import { CONFIG, debugLog, debugError } from './config.js';
import { MapManager } from './map-manager.js';
import { UploadWizard } from './upload-wizard.js';

// Estado global da aplicação
const appState = {
    mapManager: null,
    mode: null, // 'embed' ou 'direct'
    projectId: null,
    projectName: null,
    uploadWizard: null
};

/**
 * Inicialização da aplicação
 */
document.addEventListener('DOMContentLoaded', async () => {
    debugLog('🗺️ Iniciando Mapa OOH Interativo...');

    try {
        // Detecta modo e obtém ID
        const { mode, id } = detectMode();
        appState.mode = mode;
        appState.projectId = id;

        if (!id) {
            showWelcomeScreen();
            return;
        }

        // Mostra loading
        showLoading(true);

        // Obtém nome do projeto
        appState.projectName = await fetchProjectName(id);

        // Inicializa mapa e sistema de camadas
        appState.mapManager = new MapManager();
        await appState.mapManager.initLayers(id, appState.projectName);

        // Setup UI
        setupUI();
        setupEventListeners();

        // Ajusta visualização
        appState.mapManager.fitAllLayers();

        showLoading(false);
        debugLog('✅ Aplicação inicializada com sucesso');

    } catch (error) {
        debugError('Erro na inicialização:', error);
        showError(error.message);
    }
});

/**
 * Detecta modo de operação e ID
 */
function detectMode() {
    const isInIframe = window.self !== window.top;
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id') || urlParams.get('table');

    if (id) {
        return {
            mode: isInIframe ? CONFIG.modes.EMBED : CONFIG.modes.DIRECT,
            id: id
        };
    }

    if (isInIframe) {
        // Tenta detectar do referrer (fallback)
        const referrer = document.referrer;
        const extractedId = extractNotionId(referrer);
        if (extractedId) {
            return { mode: CONFIG.modes.EMBED, id: extractedId };
        }
    }

    return { mode: CONFIG.modes.DIRECT, id: null };
}

/**
 * Extrai ID do Notion da URL
 */
function extractNotionId(url) {
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
 * Formata ID do Notion para UUID
 */
function formatNotionId(id) {
    const cleanId = id.replace(/-/g, '');
    if (cleanId.length === 32) {
        return `${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(12, 16)}-${cleanId.slice(16, 20)}-${cleanId.slice(20)}`;
    }
    return id;
}

/**
 * Busca nome do projeto via API
 */
async function fetchProjectName(projectId) {
    try {
        // Tenta via API
        const response = await fetch(`${CONFIG.api.mapData}?pageId=${projectId}`);
        if (response.ok) {
            const data = await response.json();
            return data.pageName || 'Projeto OOH';
        }
    } catch (error) {
        debugError('Erro ao buscar nome do projeto:', error);
    }

    return 'Projeto OOH';
}

/**
 * Setup da interface de usuário
 */
function setupUI() {
    const layerManager = appState.mapManager.getLayerManager();
    const layers = layerManager.getAllLayers();

    const layerList = document.getElementById('layer-list');
    layerList.innerHTML = '';

    layers.forEach(layer => {
        const layerItem = createLayerItem(layer);
        layerList.appendChild(layerItem);
    });

    // Mostra painel de camadas se não estiver em embed
    if (appState.mode === CONFIG.modes.DIRECT) {
        document.getElementById('layer-panel').classList.remove('hidden');
        document.getElementById('add-layer-btn').classList.remove('hidden');
    }
}

/**
 * Cria elemento HTML para uma camada
 */
function createLayerItem(layer) {
    const div = document.createElement('div');
    div.className = 'layer-item';
    div.dataset.layerId = layer.id;

    div.innerHTML = `
        <div class="layer-header">
            <input type="checkbox" class="layer-toggle" ${layer.visible ? 'checked' : ''}>
            <span class="layer-color" style="background: ${layer.color}"></span>
            <span class="layer-name">${layer.name}</span>
            <span class="layer-count">(${layer.pointCount})</span>
        </div>
        <div class="layer-controls">
            <input type="range" class="layer-opacity" min="0" max="100" value="${layer.opacity * 100}">
            ${appState.mode === CONFIG.modes.DIRECT ? `
                <button class="layer-edit" title="Editar">✏️</button>
                <button class="layer-delete" title="Excluir">🗑️</button>
            ` : ''}
        </div>
    `;

    return div;
}

/**
 * Setup de event listeners
 */
function setupEventListeners() {
    const layerManager = appState.mapManager.getLayerManager();

    // Toggle visibilidade de camadas
    document.addEventListener('click', async (e) => {
        if (e.target.matches('.layer-toggle')) {
            const layerId = e.target.closest('.layer-item').dataset.layerId;
            await layerManager.toggleLayerVisibility(layerId);
        }

        // Botão de adicionar camada
        if (e.target.matches('#add-layer-btn')) {
            openUploadWizard();
        }

        // Editar camada
        if (e.target.matches('.layer-edit')) {
            const layerId = e.target.closest('.layer-item').dataset.layerId;
            openEditLayerModal(layerId);
        }

        // Deletar camada
        if (e.target.matches('.layer-delete')) {
            const layerId = e.target.closest('.layer-item').dataset.layerId;
            await layerManager.deleteLayer(layerId);
        }
    });

    // Slider de opacidade
    document.addEventListener('input', (e) => {
        if (e.target.matches('.layer-opacity')) {
            const layerId = e.target.closest('.layer-item').dataset.layerId;
            const opacity = parseInt(e.target.value) / 100;
            layerManager.setLayerOpacity(layerId, opacity);
        }
    });

    // Eventos customizados do LayerManager
    window.addEventListener('layerUpdated', (e) => {
        updateLayerItemUI(e.detail.layerId);
    });

    window.addEventListener('layerRemoved', (e) => {
        const item = document.querySelector(`[data-layer-id="${e.detail.layerId}"]`);
        if (item) item.remove();
    });

    // Eventos do UploadWizard
    window.addEventListener('showMappingWizard', (e) => {
        showMappingWizardUI(e.detail);
    });

    window.addEventListener('geocodingProgress', (e) => {
        updateProgressUI(e.detail.current, e.detail.total);
    });
}

/**
 * Abre wizard de upload
 */
function openUploadWizard() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx,.xls,.csv,.kml';

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            showLoading(true, 'Processando arquivo...');

            const wizard = new UploadWizard(appState.projectId, async (result) => {
                // Recarrega camadas
                await appState.mapManager.getLayerManager().loadLayers();
                setupUI();
                showLoading(false);
            });

            await wizard.startUpload(file);

        } catch (error) {
            debugError('Erro no upload:', error);
            showError(error.message);
            showLoading(false);
        }
    };

    fileInput.click();
}

/**
 * Abre modal de edição de camada
 */
function openEditLayerModal(layerId) {
    const layer = appState.mapManager.getLayerManager().getLayer(layerId);
    if (!layer) return;

    // TODO: Implementar modal de edição
    const newName = prompt('Novo nome da camada:', layer.name);
    if (newName && newName !== layer.name) {
        appState.mapManager.getLayerManager().renameLayer(layerId, newName);
    }
}

/**
 * Atualiza UI de um item de camada
 */
function updateLayerItemUI(layerId) {
    const layer = appState.mapManager.getLayerManager().getLayer(layerId);
    const item = document.querySelector(`[data-layer-id="${layerId}"]`);

    if (item && layer) {
        item.querySelector('.layer-name').textContent = layer.name;
        item.querySelector('.layer-color').style.background = layer.color;
        item.querySelector('.layer-count').textContent = `(${layer.pointCount})`;
        item.querySelector('.layer-toggle').checked = layer.visible;
        item.querySelector('.layer-opacity').value = layer.opacity * 100;
    }
}

/**
 * Mostra wizard de mapeamento de colunas
 */
function showMappingWizardUI(detail) {
    // TODO: Implementar UI do wizard
    // Por enquanto, auto-confirma o mapeamento detectado
    setTimeout(() => {
        detail.onConfirm(detail.data.mapping);
    }, 100);
}

/**
 * Atualiza UI de progresso
 */
function updateProgressUI(current, total) {
    const percent = Math.round((current / total) * 100);
    showLoading(true, `Geocodificando: ${current}/${total} (${percent}%)`);
}

/**
 * Mostra tela de boas-vindas
 */
function showWelcomeScreen() {
    document.getElementById('direct-mode-message').classList.remove('hidden');
    showLoading(false);
}

/**
 * Mostra/oculta loading
 */
function showLoading(show, message = 'Carregando...') {
    const overlay = document.getElementById('loading-overlay');
    const text = overlay.querySelector('p');

    if (text) text.textContent = message;

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
}

// Debug helpers
window.appState = appState;
window.debugReloadLayers = async () => {
    await appState.mapManager.getLayerManager().loadLayers();
    setupUI();
};
