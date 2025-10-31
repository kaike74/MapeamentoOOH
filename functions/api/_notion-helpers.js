/**
 * Helpers para Notion API
 * Funções para buscar dados do Notion com suporte a record ID
 */

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE = 'https://api.notion.com/v1';

/**
 * Busca informações de um page/record
 * IMPORTANTE: Agora recebe RECORD ID, não database ID
 * @param {string} recordId - ID do registro (page)
 * @param {string} token - Token do Notion
 * @returns {Promise<Object>} Dados da página
 */
export async function getPageInfo(recordId, token) {
    const url = `${NOTION_API_BASE}/pages/${recordId}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': NOTION_API_VERSION,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Erro ao buscar página: ${response.status} - ${error}`);
    }

    return await response.json();
}

/**
 * Busca o database pai de um record
 * @param {string} recordId - ID do registro
 * @param {string} token - Token do Notion
 * @returns {Promise<string>} Database ID
 */
export async function getParentDatabaseId(recordId, token) {
    console.log(`[NOTION] 🔍 Buscando database pai do record: ${recordId}`);

    const pageInfo = await getPageInfo(recordId, token);

    if (!pageInfo.parent) {
        throw new Error('Record não possui parent definido');
    }

    // O parent pode ser database_id ou page_id
    if (pageInfo.parent.type === 'database_id') {
        const databaseId = pageInfo.parent.database_id;
        console.log(`[NOTION] ✅ Database ID encontrado: ${databaseId}`);
        return databaseId;
    } else if (pageInfo.parent.type === 'page_id') {
        // Se o parent é uma página, busca recursivamente
        return await getParentDatabaseId(pageInfo.parent.page_id, token);
    }

    throw new Error('Parent não é database nem página');
}

/**
 * Busca o título de uma página
 * @param {string} pageId - ID da página
 * @param {string} token - Token do Notion
 * @returns {Promise<string>} Título da página
 */
export async function getPageTitle(pageId, token) {
    console.log(`[NOTION] 📄 Buscando título da página: ${pageId}`);

    const pageInfo = await getPageInfo(pageId, token);

    // Tenta obter título de diferentes propriedades
    const properties = pageInfo.properties || {};

    // Procura por propriedade do tipo 'title'
    for (const [key, prop] of Object.entries(properties)) {
        if (prop.type === 'title' && prop.title && prop.title.length > 0) {
            const title = prop.title[0].plain_text;
            console.log(`[NOTION] ✅ Título encontrado: ${title}`);
            return title;
        }
    }

    // Fallback para parent se não encontrou título
    if (pageInfo.parent && pageInfo.parent.type === 'database_id') {
        return await getDatabaseTitle(pageInfo.parent.database_id, token);
    }

    return 'Projeto OOH';
}

/**
 * Busca o título de uma database
 * @param {string} databaseId - ID da database
 * @param {string} token - Token do Notion
 * @returns {Promise<string>} Título da database
 */
export async function getDatabaseTitle(databaseId, token) {
    const url = `${NOTION_API_BASE}/databases/${databaseId}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': NOTION_API_VERSION,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        return 'Database OOH';
    }

    const data = await response.json();

    if (data.title && data.title.length > 0) {
        return data.title[0].plain_text || 'Database OOH';
    }

    return 'Database OOH';
}

/**
 * Busca dados de uma database
 * @param {string} databaseId - ID da database
 * @param {string} token - Token do Notion
 * @returns {Promise<Array>} Registros da database
 */
export async function getDatabaseRecords(databaseId, token) {
    console.log(`[NOTION] 📊 Buscando registros da database: ${databaseId}`);

    const url = `${NOTION_API_BASE}/databases/${databaseId}/query`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': NOTION_API_VERSION,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ page_size: 100 })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Erro ao buscar database: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log(`[NOTION] ✅ ${data.results?.length || 0} registros encontrados`);

    return data.results || [];
}

/**
 * Processa dados da tabela OOH para pontos do mapa
 * @param {Array} results - Registros da database
 * @returns {Array} Pontos processados
 */
export function processOOHData(results) {
    console.log(`[NOTION] 🔄 Processando ${results.length} registros OOH`);
    const points = [];

    for (const page of results) {
        try {
            const props = page.properties;

            // Extrai propriedades
            const latlong = getPropertyValue(props['Lat/long'] || props['Latlong'] || props['Coordenadas']);
            const endereco = getPropertyValue(props['Endereço'] || props['Endereco'] || props['Nome']);
            const exibidora = getPropertyValue(props['Exibidora']);
            const produto = getPropertyValue(props['Produto']);
            const uf = getPropertyValue(props['UF'] || props['Estado']);
            const praca = getPropertyValue(props['Praça'] || props['Praca'] || props['Cidade']);

            // Valida campos obrigatórios
            if (!latlong || !endereco) {
                console.log(`[NOTION] ⚠️ Pulando registro sem coordenadas/endereço`);
                continue;
            }

            // Extrai imagem
            let imagem = null;
            if (page.cover) {
                imagem = page.cover.type === 'external'
                    ? page.cover.external.url
                    : page.cover.file?.url;
            }

            points.push({
                id: page.id,
                latlong,
                endereco,
                exibidora,
                produto,
                uf,
                praca,
                imagem
            });

        } catch (error) {
            console.warn(`[NOTION] ❌ Erro ao processar registro ${page.id}:`, error);
        }
    }

    console.log(`[NOTION] ✅ ${points.length} pontos processados com sucesso`);
    return points;
}

/**
 * Extrai valor de uma propriedade do Notion
 * @param {Object} property - Propriedade do Notion
 * @returns {any} Valor extraído
 */
function getPropertyValue(property) {
    if (!property) return null;
    const type = property.type;

    switch (type) {
        case 'title':
            return property.title?.[0]?.plain_text || null;
        case 'rich_text':
            return property.rich_text?.[0]?.plain_text || null;
        case 'number':
            return property.number;
        case 'select':
            return property.select?.name || null;
        case 'multi_select':
            return property.multi_select?.map(s => s.name) || [];
        case 'checkbox':
            return property.checkbox;
        case 'url':
            return property.url;
        case 'email':
            return property.email;
        case 'phone_number':
            return property.phone_number;
        case 'date':
            return property.date?.start || null;
        default:
            return null;
    }
}

/**
 * Normaliza ID do Notion para formato UUID
 * @param {string} id - ID do Notion
 * @returns {string} ID normalizado
 */
export function normalizeNotionId(id) {
    if (!id) return null;

    // Remove hífens
    const cleanId = id.replace(/-/g, '');

    // Verifica se tem 32 caracteres
    if (cleanId.length !== 32) {
        return id; // Retorna original se não for válido
    }

    // Adiciona hífens no formato UUID
    return `${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(12, 16)}-${cleanId.slice(16, 20)}-${cleanId.slice(20)}`;
}
