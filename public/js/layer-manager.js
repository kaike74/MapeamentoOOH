/**
 * Gerenciador de Camadas
 * Controla camadas dinâmicas do mapa e integração com API
 */

import { CONFIG, debugLog, debugError } from './config.js';
import { KMLProcessor } from './kml-processor.js';

export class LayerManager {
    constructor(mapInstance) {
        this.map = mapInstance;
        this.layers = new Map(); // layerId => LayerData
        this.layerGroups = new Map(); // layerId => L.LayerGroup
        this.projectId = null;
        this.projectName = null;
    }

    /**
     * Inicializa gerenciador com projeto
     * @param {string} projectId - ID do projeto (table/page ID)
     * @param {string} projectName - Nome do projeto
     */
    async initialize(projectId, projectName) {
        this.projectId = projectId;
        this.projectName = projectName;

        debugLog(`🗂️ Inicializando gerenciador de camadas para: ${projectName}`);

        try {
            await this.loadLayers();
        } catch (error) {
            debugError('Erro ao carregar camadas:', error);
            throw error;
        }
    }

    /**
     * Carrega lista de camadas disponíveis
     */
    async loadLayers() {
        debugLog('📋 Carregando lista de camadas...');

        try {
            const response = await fetch(
                `${CONFIG.api.layerList}?projectId=${this.projectId}`
            );

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const data = await response.json();
            debugLog(`✅ ${data.layers?.length || 0} camadas encontradas`);

            // Limpa camadas existentes
            this.clearAllLayers();

            // Adiciona novas camadas
            if (data.layers && data.layers.length > 0) {
                for (const layerData of data.layers) {
                    await this.addLayer(layerData);
                }
            }

            return data.layers;

        } catch (error) {
            debugError('Erro ao carregar camadas:', error);
            throw error;
        }
    }

    /**
     * Adiciona uma camada ao mapa
     * @param {Object} layerData - Dados da camada
     * @returns {string} ID da camada
     */
    async addLayer(layerData) {
        const {
            id,
            name,
            color = CONFIG.markers.defaultColor,
            icon = CONFIG.markers.defaultIcon,
            visible = true,
            opacity = 1.0,
            kmlUrl = null,
            pointCount = 0
        } = layerData;

        debugLog(`➕ Adicionando camada: ${name}`);

        // Armazena dados da camada
        this.layers.set(id, {
            id,
            name,
            color,
            icon,
            visible,
            opacity,
            kmlUrl,
            pointCount,
            loaded: false
        });

        // Cria grupo de camada
        const layerGroup = L.layerGroup();
        this.layerGroups.set(id, layerGroup);

        // Adiciona ao mapa se visível
        if (visible && kmlUrl) {
            await this.loadLayerData(id);
            layerGroup.addTo(this.map);
        }

        // Atualiza UI
        this.updateLayerUI(id);

        return id;
    }

    /**
     * Carrega dados KML de uma camada
     * @param {string} layerId - ID da camada
     */
    async loadLayerData(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer || layer.loaded) return;

        debugLog(`📥 Carregando dados da camada: ${layer.name}`);

        try {
            // Busca KML via API
            const response = await fetch(
                `${CONFIG.api.kmlData}?layerId=${layerId}&projectId=${this.projectId}`
            );

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const kmlString = await response.text();

            // Parse KML para GeoJSON
            const geojson = KMLProcessor.parseKML(kmlString);

            // Adiciona features ao mapa
            const layerGroup = this.layerGroups.get(layerId);
            this.addGeoJSONToLayer(geojson, layerGroup, layer);

            layer.loaded = true;
            layer.pointCount = geojson.features?.length || 0;

            debugLog(`✅ Camada carregada: ${layer.name} (${layer.pointCount} pontos)`);

        } catch (error) {
            debugError(`Erro ao carregar dados da camada ${layerId}:`, error);
            throw error;
        }
    }

    /**
     * Adiciona GeoJSON a um layer group
     * @param {Object} geojson - Dados GeoJSON
     * @param {L.LayerGroup} layerGroup - Grupo de camada
     * @param {Object} layerData - Dados da camada
     */
    addGeoJSONToLayer(geojson, layerGroup, layerData) {
        geojson.features.forEach(feature => {
            const { geometry, properties } = feature;

            if (geometry.type === 'Point') {
                const [lng, lat] = geometry.coordinates;
                const marker = this.createMarker(lat, lng, properties, layerData);
                layerGroup.addLayer(marker);
            }
            // Suporte para outros tipos de geometria pode ser adicionado aqui
        });
    }

    /**
     * Cria marcador customizado
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {Object} properties - Propriedades do ponto
     * @param {Object} layerData - Dados da camada
     * @returns {L.Marker} Marcador Leaflet
     */
    createMarker(lat, lng, properties, layerData) {
        const iconConfig = CONFIG.markers.availableIcons.find(
            i => i.id === layerData.icon
        ) || CONFIG.markers.availableIcons[0];

        const icon = L.divIcon({
            className: 'custom-marker',
            html: `
                <div style="
                    background: ${layerData.color};
                    width: 32px;
                    height: 32px;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                ">
                    <span style="transform: rotate(45deg);">${iconConfig.icon}</span>
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });

        const marker = L.marker([lat, lng], { icon });

        // Cria popup
        const popupContent = this.createPopupContent(properties, layerData);
        marker.bindPopup(popupContent, {
            maxWidth: 300,
            className: 'custom-popup'
        });

        return marker;
    }

    /**
     * Cria conteúdo HTML do popup
     * @param {Object} properties - Propriedades do ponto
     * @param {Object} layerData - Dados da camada
     * @returns {string} HTML do popup
     */
    createPopupContent(properties, layerData) {
        let html = '<div class="point-tooltip">';

        // Imagem (se disponível)
        if (properties.image || properties.imagem) {
            const imageUrl = properties.image || properties.imagem;
            html += `<img src="${imageUrl}" alt="${properties.name || 'Ponto'}" />`;
        }

        html += '<div class="point-tooltip-content">';

        // Título
        const title = properties.name || properties.label || properties.endereco || 'Sem nome';
        html += `<h3>${title}</h3>`;

        // Badge da camada
        html += `<div class="layer-badge" style="background: ${layerData.color}; color: white; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px; font-size: 12px;">${layerData.name}</div>`;

        html += '<div class="tooltip-divider"></div>';

        // Propriedades
        const excludeKeys = ['name', 'label', 'image', 'imagem', 'color', 'iconUrl', 'description'];

        Object.entries(properties).forEach(([key, value]) => {
            if (!excludeKeys.includes(key) && value != null && value !== '') {
                const displayKey = key.charAt(0).toUpperCase() + key.slice(1);
                const displayValue = Array.isArray(value) ? value.join(', ') : value;
                html += `<p><strong>${displayKey}:</strong> ${displayValue}</p>`;
            }
        });

        html += '</div></div>';
        return html;
    }

    /**
     * Toggle visibilidade de uma camada
     * @param {string} layerId - ID da camada
     */
    async toggleLayerVisibility(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) return;

        layer.visible = !layer.visible;

        const layerGroup = this.layerGroups.get(layerId);

        if (layer.visible) {
            if (!layer.loaded) {
                await this.loadLayerData(layerId);
            }
            layerGroup.addTo(this.map);
        } else {
            layerGroup.remove();
        }

        this.updateLayerUI(layerId);
    }

    /**
     * Altera opacidade de uma camada
     * @param {string} layerId - ID da camada
     * @param {number} opacity - Opacidade (0.0 a 1.0)
     */
    setLayerOpacity(layerId, opacity) {
        const layer = this.layers.get(layerId);
        if (!layer) return;

        layer.opacity = opacity;

        const layerGroup = this.layerGroups.get(layerId);
        layerGroup.eachLayer(marker => {
            marker.setOpacity(opacity);
        });

        this.updateLayerUI(layerId);
    }

    /**
     * Renomeia uma camada
     * @param {string} layerId - ID da camada
     * @param {string} newName - Novo nome
     */
    async renameLayer(layerId, newName) {
        const layer = this.layers.get(layerId);
        if (!layer) return;

        debugLog(`✏️ Renomeando camada ${layerId}: "${layer.name}" → "${newName}"`);

        try {
            const response = await fetch(CONFIG.api.layerManage, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'rename',
                    projectId: this.projectId,
                    layerId: layerId,
                    newName: newName
                })
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            layer.name = newName;
            this.updateLayerUI(layerId);

            debugLog(`✅ Camada renomeada com sucesso`);

        } catch (error) {
            debugError('Erro ao renomear camada:', error);
            throw error;
        }
    }

    /**
     * Altera cor de uma camada
     * @param {string} layerId - ID da camada
     * @param {string} color - Nova cor (hex)
     */
    async changeLayerColor(layerId, color) {
        const layer = this.layers.get(layerId);
        if (!layer) return;

        debugLog(`🎨 Alterando cor da camada ${layerId}: ${color}`);

        try {
            const response = await fetch(CONFIG.api.layerManage, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_style',
                    projectId: this.projectId,
                    layerId: layerId,
                    color: color
                })
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            layer.color = color;

            // Recarrega camada para aplicar nova cor
            if (layer.loaded && layer.visible) {
                layer.loaded = false;
                const layerGroup = this.layerGroups.get(layerId);
                layerGroup.clearLayers();
                await this.loadLayerData(layerId);
            }

            this.updateLayerUI(layerId);

            debugLog(`✅ Cor da camada alterada com sucesso`);

        } catch (error) {
            debugError('Erro ao alterar cor da camada:', error);
            throw error;
        }
    }

    /**
     * Exclui uma camada (soft delete)
     * @param {string} layerId - ID da camada
     */
    async deleteLayer(layerId) {
        const layer = this.layers.get(layerId);
        if (!layer) return;

        debugLog(`🗑️ Excluindo camada ${layerId}: "${layer.name}"`);

        if (!confirm(`Deseja realmente excluir a camada "${layer.name}"?`)) {
            return;
        }

        try {
            const response = await fetch(CONFIG.api.layerManage, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete',
                    projectId: this.projectId,
                    layerId: layerId
                })
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            // Remove do mapa
            const layerGroup = this.layerGroups.get(layerId);
            layerGroup.remove();

            // Remove dos registros
            this.layers.delete(layerId);
            this.layerGroups.delete(layerId);

            // Remove da UI
            this.removeLayerUI(layerId);

            debugLog(`✅ Camada excluída com sucesso`);

        } catch (error) {
            debugError('Erro ao excluir camada:', error);
            throw error;
        }
    }

    /**
     * Ajusta zoom para incluir todos os pontos de uma camada
     * @param {string} layerId - ID da camada
     */
    fitLayerBounds(layerId) {
        const layerGroup = this.layerGroups.get(layerId);
        if (!layerGroup || layerGroup.getLayers().length === 0) return;

        const bounds = layerGroup.getBounds();
        this.map.fitBounds(bounds, { padding: [50, 50] });
    }

    /**
     * Limpa todas as camadas
     */
    clearAllLayers() {
        this.layerGroups.forEach(layerGroup => layerGroup.remove());
        this.layers.clear();
        this.layerGroups.clear();
    }

    /**
     * Atualiza UI da camada (deve ser implementado por quem usa este manager)
     * @param {string} layerId - ID da camada
     */
    updateLayerUI(layerId) {
        // Dispara evento customizado para atualizar UI
        const event = new CustomEvent('layerUpdated', {
            detail: {
                layerId,
                layer: this.layers.get(layerId)
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Remove UI da camada
     * @param {string} layerId - ID da camada
     */
    removeLayerUI(layerId) {
        const event = new CustomEvent('layerRemoved', {
            detail: { layerId }
        });
        window.dispatchEvent(event);
    }

    /**
     * Retorna todas as camadas
     * @returns {Array} Lista de camadas
     */
    getAllLayers() {
        return Array.from(this.layers.values());
    }

    /**
     * Retorna uma camada específica
     * @param {string} layerId - ID da camada
     * @returns {Object|null} Dados da camada
     */
    getLayer(layerId) {
        return this.layers.get(layerId) || null;
    }
}
