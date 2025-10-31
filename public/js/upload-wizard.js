/**
 * Assistente de Upload de Camadas
 * Processa Excel, CSV e KML com mapeamento automático de colunas
 */

import { CONFIG, debugLog, debugError } from './config.js';
import { GeocodingService, geocodingService } from './geocoding.js';
import { KMLProcessor } from './kml-processor.js';

export class UploadWizard {
    constructor(projectId, onComplete) {
        this.projectId = projectId;
        this.onComplete = onComplete;
        this.currentFile = null;
        this.parsedData = null;
        this.columnMapping = {};
    }

    /**
     * Inicia processo de upload
     * @param {File} file - Arquivo selecionado
     */
    async startUpload(file) {
        debugLog('📤 Iniciando upload:', file.name);

        // Validações
        if (file.size > CONFIG.upload.maxFileSize) {
            throw new Error(CONFIG.messages.fileTooLarge);
        }

        this.currentFile = file;

        // Processa baseado no tipo
        const extension = file.name.split('.').pop().toLowerCase();

        if (['xlsx', 'xls', 'csv'].includes(extension)) {
            await this.processSpreadsheet(file);
        } else if (extension === 'kml') {
            await this.processKML(file);
        } else {
            throw new Error(CONFIG.messages.invalidFile);
        }
    }

    /**
     * Processa arquivo de planilha
     */
    async processSpreadsheet(file) {
        const text = await file.text();
        const rows = this.parseCSV(text);

        if (rows.length === 0) {
            throw new Error('Arquivo vazio');
        }

        if (rows.length > CONFIG.upload.maxRows) {
            throw new Error(CONFIG.messages.tooManyRows);
        }

        const headers = rows[0];
        const data = rows.slice(1);

        // Auto-mapeia colunas
        this.columnMapping = GeocodingService.autoMapColumns(headers);

        this.parsedData = {
            headers,
            rows: data,
            mapping: this.columnMapping
        };

        debugLog('✅ Planilha processada:', { headers, rowCount: data.length });

        // Mostra wizard de mapeamento
        this.showMappingWizard();
    }

    /**
     * Parse simples de CSV
     */
    parseCSV(text) {
        return text.split('\n')
            .filter(line => line.trim())
            .map(line => line.split(',').map(cell => cell.trim()));
    }

    /**
     * Processa arquivo KML
     */
    async processKML(file) {
        const text = await file.text();
        const validation = KMLProcessor.validateKML(text);

        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Upload direto do KML
        await this.uploadKML(text, file.name);
    }

    /**
     * Mostra wizard de mapeamento (UI placeholder - implementar no HTML)
     */
    showMappingWizard() {
        // Dispara evento para UI mostrar wizard
        window.dispatchEvent(new CustomEvent('showMappingWizard', {
            detail: {
                data: this.parsedData,
                onConfirm: (mapping) => this.confirmMapping(mapping)
            }
        }));
    }

    /**
     * Confirma mapeamento e processa geocodificação
     */
    async confirmMapping(mapping) {
        this.columnMapping = mapping;

        debugLog('📍 Iniciando geocodificação...');

        const addressData = this.parsedData.rows.map(row => {
            const data = {};
            this.parsedData.headers.forEach((header, index) => {
                const type = mapping[header];
                if (type) {
                    data[type] = row[index];
                }
            });
            return data;
        });

        // Geocodifica
        const results = await geocodingService.geocodeBatch(
            addressData,
            (current, total) => {
                window.dispatchEvent(new CustomEvent('geocodingProgress', {
                    detail: { current, total }
                }));
            }
        );

        // Converte para KML e faz upload
        await this.convertAndUpload(results);
    }

    /**
     * Converte dados para KML e faz upload
     */
    async convertAndUpload(points) {
        const geojson = {
            type: 'FeatureCollection',
            features: points.filter(p => p.success).map(point => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [point.lng, point.lat]
                },
                properties: point
            }))
        };

        const kml = KMLProcessor.toKML(geojson, {
            layerName: this.currentFile.name.replace(/\.[^/.]+$/, '')
        });

        await this.uploadKML(kml, this.currentFile.name);
    }

    /**
     * Faz upload do KML via API
     */
    async uploadKML(kmlString, fileName) {
        debugLog('☁️ Fazendo upload do KML...');

        const response = await fetch(CONFIG.api.layerUpload, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: this.projectId,
                fileName: fileName,
                kmlData: kmlString
            })
        });

        if (!response.ok) {
            throw new Error(`Erro no upload: ${response.status}`);
        }

        const result = await response.json();
        debugLog('✅ Upload concluído:', result);

        if (this.onComplete) {
            this.onComplete(result);
        }
    }
}
