/**
 * Sistema de Geocodificação
 * Converte endereços em coordenadas usando Nominatim (OpenStreetMap)
 */

import { CONFIG, debugLog, debugError, debugWarn } from './config.js';

export class GeocodingService {
    constructor() {
        this.cache = new Map();
        this.queue = [];
        this.processing = false;
        this.lastRequestTime = 0;
    }

    /**
     * Geocodifica um único endereço
     * @param {Object} addressData - Dados do endereço
     * @returns {Promise<Object>} {lat, lng, confidence, formatted_address}
     */
    async geocode(addressData) {
        const {
            address,
            city,
            state,
            zipcode,
            country = 'Brasil'
        } = addressData;

        // Verifica se já tem coordenadas
        if (addressData.latitude && addressData.longitude) {
            const lat = parseFloat(addressData.latitude);
            const lng = parseFloat(addressData.longitude);

            if (!isNaN(lat) && !isNaN(lng)) {
                return {
                    lat,
                    lng,
                    confidence: 1.0,
                    formatted_address: address,
                    source: 'provided'
                };
            }
        }

        // Monta query de busca
        const query = this.buildQuery(address, city, state, zipcode, country);

        // Verifica cache
        const cacheKey = this.getCacheKey(query);
        if (this.cache.has(cacheKey)) {
            debugLog('✅ Geocoding cache HIT:', query);
            return this.cache.get(cacheKey);
        }

        debugLog('🔍 Geocoding:', query);

        try {
            // Adiciona à fila para respeitar rate limit
            const result = await this.addToQueue(query);

            // Armazena no cache
            if (result) {
                this.cache.set(cacheKey, result);
            }

            return result;

        } catch (error) {
            debugError('Erro ao geocodificar:', query, error);
            throw error;
        }
    }

    /**
     * Geocodifica múltiplos endereços em lote
     * @param {Array} addressList - Lista de objetos com dados de endereço
     * @param {Function} progressCallback - Callback de progresso (atual, total)
     * @returns {Promise<Array>} Lista de resultados
     */
    async geocodeBatch(addressList, progressCallback = null) {
        debugLog(`📍 Geocodificando ${addressList.length} endereços...`);

        const results = [];
        const batchSize = CONFIG.geocoding.batchSize;

        for (let i = 0; i < addressList.length; i += batchSize) {
            const batch = addressList.slice(i, i + batchSize);

            const batchResults = await Promise.all(
                batch.map(async (addressData, index) => {
                    try {
                        const result = await this.geocode(addressData);

                        if (progressCallback) {
                            progressCallback(i + index + 1, addressList.length);
                        }

                        return {
                            ...addressData,
                            ...result,
                            success: true
                        };

                    } catch (error) {
                        debugWarn(`Falha ao geocodificar endereço ${i + index}:`, error);

                        if (progressCallback) {
                            progressCallback(i + index + 1, addressList.length);
                        }

                        return {
                            ...addressData,
                            success: false,
                            error: error.message
                        };
                    }
                })
            );

            results.push(...batchResults);

            // Pausa entre lotes
            if (i + batchSize < addressList.length) {
                await this.delay(CONFIG.geocoding.rateLimit);
            }
        }

        const successCount = results.filter(r => r.success).length;
        debugLog(`✅ Geocoding concluído: ${successCount}/${addressList.length} sucessos`);

        return results;
    }

    /**
     * Monta query de busca a partir dos dados
     * @param {string} address - Endereço
     * @param {string} city - Cidade
     * @param {string} state - Estado
     * @param {string} zipcode - CEP
     * @param {string} country - País
     * @returns {string} Query formatada
     */
    buildQuery(address, city, state, zipcode, country) {
        const parts = [];

        if (address) parts.push(address);
        if (city) parts.push(city);
        if (state) parts.push(state);
        if (zipcode) parts.push(zipcode);
        if (country) parts.push(country);

        return parts.join(', ');
    }

    /**
     * Gera chave de cache
     * @param {string} query - Query de busca
     * @returns {string} Chave de cache
     */
    getCacheKey(query) {
        return query.toLowerCase().trim();
    }

    /**
     * Adiciona requisição à fila (rate limiting)
     * @param {string} query - Query de busca
     * @returns {Promise<Object>} Resultado da geocodificação
     */
    async addToQueue(query) {
        return new Promise((resolve, reject) => {
            this.queue.push({ query, resolve, reject });
            this.processQueue();
        });
    }

    /**
     * Processa fila de requisições
     */
    async processQueue() {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0) {
            const { query, resolve, reject } = this.queue.shift();

            // Respeita rate limit
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < CONFIG.geocoding.rateLimit) {
                await this.delay(CONFIG.geocoding.rateLimit - timeSinceLastRequest);
            }

            try {
                const result = await this.fetchGeocoding(query);
                this.lastRequestTime = Date.now();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }

        this.processing = false;
    }

    /**
     * Faz requisição ao serviço de geocodificação
     * @param {string} query - Query de busca
     * @returns {Promise<Object>} Resultado
     */
    async fetchGeocoding(query) {
        const url = new URL(CONFIG.geocoding.apiUrl);
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'json');
        url.searchParams.set('addressdetails', '1');
        url.searchParams.set('limit', '1');

        const response = await fetch(url.toString(), {
            headers: {
                'User-Agent': CONFIG.geocoding.userAgent
            },
            signal: AbortSignal.timeout(CONFIG.geocoding.timeout)
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const data = await response.json();

        if (!data || data.length === 0) {
            throw new Error('Endereço não encontrado');
        }

        const result = data[0];

        return {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            confidence: this.calculateConfidence(result),
            formatted_address: result.display_name,
            source: 'nominatim',
            place_id: result.place_id
        };
    }

    /**
     * Calcula nível de confiança do resultado
     * @param {Object} result - Resultado do Nominatim
     * @returns {number} Confiança (0.0 a 1.0)
     */
    calculateConfidence(result) {
        // Importância do Nominatim vai de 0 a 1
        const importance = parseFloat(result.importance) || 0;

        // Ajusta baseado no tipo de resultado
        let confidence = importance;

        const type = result.type?.toLowerCase() || '';
        if (type.includes('house') || type.includes('building')) {
            confidence = Math.min(1.0, confidence + 0.2);
        } else if (type.includes('road') || type.includes('street')) {
            confidence = Math.min(0.9, confidence + 0.1);
        } else if (type.includes('city') || type.includes('town')) {
            confidence = Math.min(0.7, confidence);
        }

        return Math.max(0.1, Math.min(1.0, confidence));
    }

    /**
     * Valida coordenadas
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @returns {boolean} Válido ou não
     */
    static validateCoordinates(lat, lng) {
        return (
            !isNaN(lat) && !isNaN(lng) &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180
        );
    }

    /**
     * Limpa cache
     */
    clearCache() {
        this.cache.clear();
        debugLog('🗑️ Cache de geocoding limpo');
    }

    /**
     * Delay utilitário
     * @param {number} ms - Milissegundos
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Detecta tipo de dados de localização
     * @param {string} columnName - Nome da coluna
     * @returns {string|null} Tipo detectado ou null
     */
    static detectColumnType(columnName) {
        const name = columnName.toLowerCase().trim();
        const patterns = CONFIG.columnDetection.patterns;

        for (const [type, keywords] of Object.entries(patterns)) {
            if (keywords.some(keyword => name.includes(keyword))) {
                return type;
            }
        }

        return null;
    }

    /**
     * Auto-mapeia colunas de um dataset
     * @param {Array} headers - Lista de nomes de colunas
     * @returns {Object} Mapeamento {columnName: type}
     */
    static autoMapColumns(headers) {
        const mapping = {};

        headers.forEach(header => {
            const type = this.detectColumnType(header);
            if (type) {
                mapping[header] = type;
            }
        });

        debugLog('🔍 Auto-mapeamento de colunas:', mapping);
        return mapping;
    }
}

// Instância singleton
export const geocodingService = new GeocodingService();
