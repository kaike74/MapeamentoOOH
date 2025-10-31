/**
 * Processador de arquivos KML
 * Converte entre KML e GeoJSON, valida estrutura, e processa dados
 */

import { debugLog, debugError, debugWarn } from './config.js';

export class KMLProcessor {
    /**
     * Parse arquivo KML para GeoJSON
     * @param {string} kmlString - String XML do KML
     * @returns {Object} GeoJSON FeatureCollection
     */
    static parseKML(kmlString) {
        try {
            debugLog('📄 Parseando KML...');

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(kmlString, 'text/xml');

            // Verifica erros de parse
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                throw new Error('XML inválido: ' + parserError.textContent);
            }

            // Extrai placemarks
            const placemarks = xmlDoc.querySelectorAll('Placemark');
            debugLog(`✅ ${placemarks.length} placemarks encontrados`);

            const features = [];

            placemarks.forEach((placemark, index) => {
                try {
                    const feature = this.parsePlacemark(placemark);
                    if (feature) {
                        features.push(feature);
                    }
                } catch (error) {
                    debugWarn(`Erro ao processar placemark ${index}:`, error);
                }
            });

            return {
                type: 'FeatureCollection',
                features: features
            };

        } catch (error) {
            debugError('Erro ao parsear KML:', error);
            throw error;
        }
    }

    /**
     * Parse um Placemark individual
     * @param {Element} placemark - Elemento XML Placemark
     * @returns {Object|null} GeoJSON Feature
     */
    static parsePlacemark(placemark) {
        // Extrai nome
        const name = placemark.querySelector('name')?.textContent || 'Sem nome';

        // Extrai descrição
        const description = placemark.querySelector('description')?.textContent || '';

        // Extrai coordenadas
        const coordinates = this.extractCoordinates(placemark);
        if (!coordinates) {
            return null;
        }

        // Extrai dados estendidos
        const extendedData = this.extractExtendedData(placemark);

        // Extrai estilo
        const style = this.extractStyle(placemark);

        return {
            type: 'Feature',
            geometry: coordinates,
            properties: {
                name,
                description,
                ...extendedData,
                ...style
            }
        };
    }

    /**
     * Extrai coordenadas de um Placemark
     * @param {Element} placemark - Elemento XML Placemark
     * @returns {Object|null} GeoJSON Geometry
     */
    static extractCoordinates(placemark) {
        // Tenta Point primeiro
        const point = placemark.querySelector('Point coordinates');
        if (point) {
            const coords = point.textContent.trim().split(',');
            const lng = parseFloat(coords[0]);
            const lat = parseFloat(coords[1]);

            if (!isNaN(lat) && !isNaN(lng)) {
                return {
                    type: 'Point',
                    coordinates: [lng, lat]
                };
            }
        }

        // Tenta LineString
        const lineString = placemark.querySelector('LineString coordinates');
        if (lineString) {
            const coords = this.parseCoordinateString(lineString.textContent);
            if (coords.length > 0) {
                return {
                    type: 'LineString',
                    coordinates: coords
                };
            }
        }

        // Tenta Polygon
        const polygon = placemark.querySelector('Polygon outerBoundaryIs coordinates');
        if (polygon) {
            const coords = this.parseCoordinateString(polygon.textContent);
            if (coords.length > 0) {
                return {
                    type: 'Polygon',
                    coordinates: [coords]
                };
            }
        }

        return null;
    }

    /**
     * Parse string de coordenadas do KML
     * @param {string} coordString - String com coordenadas
     * @returns {Array} Array de [lng, lat]
     */
    static parseCoordinateString(coordString) {
        return coordString
            .trim()
            .split(/\s+/)
            .map(coord => {
                const parts = coord.split(',');
                const lng = parseFloat(parts[0]);
                const lat = parseFloat(parts[1]);
                return !isNaN(lat) && !isNaN(lng) ? [lng, lat] : null;
            })
            .filter(coord => coord !== null);
    }

    /**
     * Extrai dados estendidos (ExtendedData)
     * @param {Element} placemark - Elemento XML Placemark
     * @returns {Object} Propriedades adicionais
     */
    static extractExtendedData(placemark) {
        const extendedData = {};
        const dataElements = placemark.querySelectorAll('ExtendedData Data');

        dataElements.forEach(data => {
            const name = data.getAttribute('name');
            const value = data.querySelector('value')?.textContent || '';
            if (name) {
                extendedData[name] = value;
            }
        });

        return extendedData;
    }

    /**
     * Extrai informações de estilo
     * @param {Element} placemark - Elemento XML Placemark
     * @returns {Object} Propriedades de estilo
     */
    static extractStyle(placemark) {
        const style = {};

        // Cor do ícone
        const iconColor = placemark.querySelector('IconStyle color')?.textContent;
        if (iconColor) {
            style.color = this.kmlColorToHex(iconColor);
        }

        // URL do ícone
        const iconHref = placemark.querySelector('Icon href')?.textContent;
        if (iconHref) {
            style.iconUrl = iconHref;
        }

        return style;
    }

    /**
     * Converte cor KML (aabbggrr) para hex (#rrggbb)
     * @param {string} kmlColor - Cor no formato KML
     * @returns {string} Cor hex
     */
    static kmlColorToHex(kmlColor) {
        if (kmlColor.length === 8) {
            const rr = kmlColor.substring(6, 8);
            const gg = kmlColor.substring(4, 6);
            const bb = kmlColor.substring(2, 4);
            return `#${rr}${gg}${bb}`;
        }
        return '#e74c3c'; // Default
    }

    /**
     * Converte GeoJSON para KML
     * @param {Object} geojson - GeoJSON FeatureCollection
     * @param {Object} options - Opções (layerName, color, icon)
     * @returns {string} String XML do KML
     */
    static toKML(geojson, options = {}) {
        const {
            layerName = 'Camada OOH',
            color = '#e74c3c',
            icon = 'pin'
        } = options;

        let kml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        kml += '<kml xmlns="http://www.opengis.net/kml/2.2">\n';
        kml += '  <Document>\n';
        kml += `    <name>${this.escapeXML(layerName)}</name>\n`;

        // Adiciona estilo
        const styleId = 'style_' + Date.now();
        kml += `    <Style id="${styleId}">\n`;
        kml += '      <IconStyle>\n';
        kml += `        <color>${this.hexToKMLColor(color)}</color>\n`;
        kml += '        <Icon>\n';
        kml += `          <href>http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png</href>\n`;
        kml += '        </Icon>\n';
        kml += '      </IconStyle>\n';
        kml += '    </Style>\n';

        // Adiciona features
        if (geojson.features) {
            geojson.features.forEach(feature => {
                kml += this.featureToKML(feature, styleId);
            });
        }

        kml += '  </Document>\n';
        kml += '</kml>';

        return kml;
    }

    /**
     * Converte uma Feature GeoJSON para Placemark KML
     * @param {Object} feature - GeoJSON Feature
     * @param {string} styleId - ID do estilo
     * @returns {string} XML do Placemark
     */
    static featureToKML(feature, styleId) {
        const { geometry, properties } = feature;
        const name = properties?.name || properties?.label || 'Sem nome';

        let kml = '    <Placemark>\n';
        kml += `      <name>${this.escapeXML(name)}</name>\n`;
        kml += `      <styleUrl>#${styleId}</styleUrl>\n`;

        // Descrição
        if (properties?.description) {
            kml += `      <description><![CDATA[${properties.description}]]></description>\n`;
        }

        // Extended Data
        if (properties && Object.keys(properties).length > 0) {
            kml += '      <ExtendedData>\n';
            Object.entries(properties).forEach(([key, value]) => {
                if (key !== 'name' && key !== 'description' && key !== 'color' && key !== 'iconUrl') {
                    kml += `        <Data name="${this.escapeXML(key)}">\n`;
                    kml += `          <value>${this.escapeXML(String(value))}</value>\n`;
                    kml += '        </Data>\n';
                }
            });
            kml += '      </ExtendedData>\n';
        }

        // Geometria
        if (geometry.type === 'Point') {
            const [lng, lat] = geometry.coordinates;
            kml += '      <Point>\n';
            kml += `        <coordinates>${lng},${lat},0</coordinates>\n`;
            kml += '      </Point>\n';
        } else if (geometry.type === 'LineString') {
            kml += '      <LineString>\n';
            kml += '        <coordinates>\n';
            geometry.coordinates.forEach(coord => {
                kml += `          ${coord[0]},${coord[1]},0\n`;
            });
            kml += '        </coordinates>\n';
            kml += '      </LineString>\n';
        } else if (geometry.type === 'Polygon') {
            kml += '      <Polygon>\n';
            kml += '        <outerBoundaryIs>\n';
            kml += '          <LinearRing>\n';
            kml += '            <coordinates>\n';
            geometry.coordinates[0].forEach(coord => {
                kml += `              ${coord[0]},${coord[1]},0\n`;
            });
            kml += '            </coordinates>\n';
            kml += '          </LinearRing>\n';
            kml += '        </outerBoundaryIs>\n';
            kml += '      </Polygon>\n';
        }

        kml += '    </Placemark>\n';
        return kml;
    }

    /**
     * Converte cor hex para KML (aabbggrr)
     * @param {string} hex - Cor hex (#rrggbb)
     * @returns {string} Cor KML
     */
    static hexToKMLColor(hex) {
        hex = hex.replace('#', '');
        const rr = hex.substring(0, 2);
        const gg = hex.substring(2, 4);
        const bb = hex.substring(4, 6);
        return `ff${bb}${gg}${rr}`;
    }

    /**
     * Escapa caracteres especiais XML
     * @param {string} str - String para escapar
     * @returns {string} String escapada
     */
    static escapeXML(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Valida estrutura de arquivo KML
     * @param {string} kmlString - String XML do KML
     * @returns {Object} {valid: boolean, error: string|null}
     */
    static validateKML(kmlString) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(kmlString, 'text/xml');

            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                return {
                    valid: false,
                    error: 'XML inválido: ' + parserError.textContent
                };
            }

            const kmlElement = xmlDoc.querySelector('kml');
            if (!kmlElement) {
                return {
                    valid: false,
                    error: 'Arquivo não é um KML válido (elemento <kml> não encontrado)'
                };
            }

            const placemarks = xmlDoc.querySelectorAll('Placemark');
            if (placemarks.length === 0) {
                return {
                    valid: false,
                    error: 'Nenhum Placemark encontrado no KML'
                };
            }

            return { valid: true, error: null };

        } catch (error) {
            return {
                valid: false,
                error: 'Erro ao validar KML: ' + error.message
            };
        }
    }
}
