/**
 * Cloudflare Pages Function para API
 * Captura apenas rotas /api/*
 */

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE = 'https://api.notion.com/v1';
const CACHE_TTL = 300;

export async function onRequest(context) {
    const { request, env } = context;

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const url = new URL(request.url);
        const path = url.pathname;

        // Rotas API
        if (path.includes('map-data')) {
            return await handleMapDataRequest(url, env, corsHeaders);
        } else if (path.includes('table-data')) {
            return await handleTableDataRequest(url, env, corsHeaders);
        }

        // Fallback - nenhuma rota conhecida
        return new Response(JSON.stringify({
            error: 'Rota não encontrada',
            available: ['/api/map-data', '/api/table-data']
        }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Function error:', error);
        return new Response(JSON.stringify({
            error: error.message || 'Internal Server Error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

// === Handlers ===

async function handleMapDataRequest(url, env, corsHeaders) {
    const pageId = url.searchParams.get('pageId');

    if (!pageId) {
        return new Response(JSON.stringify({
            error: 'pageId é obrigatório'
        }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const cacheKey = `map-data-${pageId}`;
    const cached = await getCache(cacheKey);
    if (cached) {
        return new Response(JSON.stringify(cached), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'X-Cache': 'HIT'
            }
        });
    }

    const notionToken = env.NOTION_TOKEN;
    if (!notionToken) {
        throw new Error('NOTION_TOKEN não configurado');
    }

    try {
        const blocks = await getPageBlocks(pageId, notionToken);
        const tableId = findOOHTable(blocks);

        if (!tableId) {
            throw new Error('Tabela OOH não encontrada na página');
        }

        const tableData = await getTableData(tableId, notionToken);
        const points = processTableData(tableData);

        const result = { pageId, tableId, points, timestamp: Date.now() };
        await setCache(cacheKey, result, CACHE_TTL);

        return new Response(JSON.stringify(result), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'X-Cache': 'MISS'
            }
        });
    } catch (error) {
        throw error;
    }
}

async function handleTableDataRequest(url, env, corsHeaders) {
    const tableId = url.searchParams.get('tableId');

    if (!tableId) {
        return new Response(JSON.stringify({
            error: 'tableId é obrigatório'
        }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const cacheKey = `table-data-${tableId}`;
    const cached = await getCache(cacheKey);
    if (cached) {
        return new Response(JSON.stringify(cached), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'X-Cache': 'HIT'
            }
        });
    }

    const notionToken = env.NOTION_TOKEN;
    if (!notionToken) {
        throw new Error('NOTION_TOKEN não configurado');
    }

    try {
        const tableData = await getTableData(tableId, notionToken);
        const points = processTableData(tableData);

        const result = { tableId, points, timestamp: Date.now() };
        await setCache(cacheKey, result, CACHE_TTL);

        return new Response(JSON.stringify(result), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'X-Cache': 'MISS'
            }
        });
    } catch (error) {
        throw error;
    }
}

// === Notion API Functions ===

async function getPageBlocks(pageId, token) {
    const url = `${NOTION_API_BASE}/blocks/${pageId}/children`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': NOTION_API_VERSION,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Erro ao buscar blocos: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.results || [];
}

function findOOHTable(blocks) {
    for (const block of blocks) {
        if (block.type === 'child_database' || block.type === 'database' || block.type === 'linked_database') {
            return block.id;
        }
    }
    return null;
}

async function getTableData(databaseId, token) {
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
        throw new Error(`Erro ao buscar dados da tabela: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.results || [];
}

function processTableData(results) {
    const points = [];

    for (const page of results) {
        try {
            const props = page.properties;
            const latlong = getPropertyValue(props['Lat/long'] || props['Latlong'] || props['Coordenadas']);
            const endereco = getPropertyValue(props['Endereço'] || props['Endereco'] || props['Nome']);
            const exibidora = getPropertyValue(props['Exibidora']);
            const produto = getPropertyValue(props['Produto']);
            const uf = getPropertyValue(props['UF'] || props['Estado']);
            const praca = getPropertyValue(props['Praça'] || props['Praca'] || props['Cidade']);
            const incluso = getPropertyValue(props['Incluso']);

            if (!latlong || !endereco) continue;
            if (incluso !== null && incluso !== undefined && !incluso) continue;

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
            console.warn('Erro ao processar ponto:', page.id, error);
        }
    }

    return points;
}

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

// === Cache Functions ===

async function getCache(key) {
    try {
        const cache = caches.default;
        const cacheUrl = `https://cache.internal/${key}`;
        const response = await cache.match(cacheUrl);

        if (response) {
            const data = await response.json();
            if (data.expires > Date.now()) {
                return data.value;
            }
        }
    } catch (error) {
        console.warn('Cache read error:', error);
    }
    return null;
}

async function setCache(key, value, ttl) {
    try {
        const cache = caches.default;
        const cacheUrl = `https://cache.internal/${key}`;
        const data = {
            value,
            expires: Date.now() + (ttl * 1000)
        };

        const response = new Response(JSON.stringify(data), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `max-age=${ttl}`
            }
        });

        await cache.put(cacheUrl, response);
    } catch (error) {
        console.warn('Cache write error:', error);
    }
}
