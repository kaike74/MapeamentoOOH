/**
 * Gerenciador Principal do Mapa
 */

import { CONFIG, debugLog } from './config.js';
import { LayerManager } from './layer-manager.js';

export class MapManager {
    constructor() {
        this.map = null;
        this.layerManager = null;
        this.mode = null;
        this.projectId = null;
        this.projectName = null;
    }

    /**
     * Inicializa o mapa
     */
    initMap() {
        this.map = L.map('map').setView(CONFIG.map.defaultCenter, CONFIG.map.defaultZoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: CONFIG.map.maxZoom,
            minZoom: CONFIG.map.minZoom
        }).addTo(this.map);

        debugLog('✅ Mapa inicializado');
        return this.map;
    }

    /**
     * Inicializa sistema de camadas
     */
    async initLayers(projectId, projectName) {
        this.projectId = projectId;
        this.projectName = projectName;

        if (!this.map) {
            this.initMap();
        }

        this.layerManager = new LayerManager(this.map);
        await this.layerManager.initialize(projectId, projectName);

        debugLog('✅ Sistema de camadas inicializado');
    }

    /**
     * Retorna o gerenciador de camadas
     */
    getLayerManager() {
        return this.layerManager;
    }

    /**
     * Ajusta visualização para incluir todas as camadas
     */
    fitAllLayers() {
        if (!this.layerManager) return;

        const allBounds = [];
        this.layerManager.layerGroups.forEach(group => {
            if (group.getLayers().length > 0) {
                allBounds.push(group.getBounds());
            }
        });

        if (allBounds.length > 0) {
            const bounds = allBounds[0];
            allBounds.slice(1).forEach(b => bounds.extend(b));
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }
    }
}
