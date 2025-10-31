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
    console.log(`[DEBUG] 📄 handleMapDataRequest - pageId: ${pageId}`);

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
        console.log(`[DEBUG] ✅ Cache HIT para pageId: ${pageId}`);
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
        console.log(`[DEBUG] 🔍 Buscando blocos da página ${pageId}...`);
        const blocks = await getPageBlocks(pageId, notionToken);
        console.log(`[DEBUG] ✅ ${blocks.length} blocos encontrados`);

        const tableId = findOOHTable(blocks);

        if (!tableId) {
            throw new Error('Tabela OOH não encontrada na página');
        }

        console.log(`[DEBUG] 📊 Buscando dados da tabela ${tableId}...`);
        const tableData = await getTableData(tableId, notionToken);
        console.log(`[DEBUG] ✅ ${tableData.length} registros encontrados`);

        const points = processTableData(tableData);

        const result = { pageId, tableId, points, timestamp: Date.now() };
        await setCache(cacheKey, result, CACHE_TTL);

        console.log(`[DEBUG] 🎉 Sucesso! Retornando ${points.length} pontos`);
        return new Response(JSON.stringify(result), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'X-Cache': 'MISS'
            }
        });
    } catch (error) {
        console.error('[ERROR] Erro em handleMapDataRequest:', error);
        throw error;
    }
}

async function handleTableDataRequest(url, env, corsHeaders) {
    const tableId = url.searchParams.get('tableId');
    console.log(`[DEBUG] 📊 handleTableDataRequest - tableId: ${tableId}`);

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
        console.log(`[DEBUG] ✅ Cache HIT para tableId: ${tableId}`);
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
        console.log(`[DEBUG] 🔍 Buscando dados da tabela ${tableId}...`);
        const tableData = await getTableData(tableId, notionToken);
        console.log(`[DEBUG] ✅ ${tableData.length} registros encontrados na tabela`);

        const points = processTableData(tableData);

        const result = { tableId, points, timestamp: Date.now() };
        await setCache(cacheKey, result, CACHE_TTL);

        console.log(`[DEBUG] 🎉 Sucesso! Retornando ${points.length} pontos`);
        return new Response(JSON.stringify(result), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'X-Cache': 'MISS'
            }
        });
    } catch (error) {
        console.error('[ERROR] Erro em handleTableDataRequest:', error);
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
    console.log(`[DEBUG] Procurando tabela OOH em ${blocks.length} blocos`);

    for (const block of blocks) {
        console.log(`[DEBUG] Tipo de bloco: ${block.type}`);

        // Procura qualquer tipo de database
        if (block.type === 'child_database' ||
            block.type === 'database' ||
            block.type === 'linked_database' ||
            block.type === 'table' ||
            (block.database && block.database.id)) {

            const tableId = block.id || block.database?.id;
            console.log(`[DEBUG] ✅ Tabela encontrada! ID: ${tableId}, Tipo: ${block.type}`);
            return tableId;
        }
    }

    console.log('[DEBUG] ❌ Nenhuma tabela encontrada nos blocos');
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
    console.log(`[DEBUG] Processando ${results.length} registros da tabela OOH`);
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

            console.log(`[DEBUG] Ponto: "${endereco}", Lat/long: ${latlong}, Incluso: ${incluso}`);

            // Valida campos obrigatórios
            if (!latlong || !endereco) {
                console.log(`[DEBUG] ❌ Pulando ponto sem coordenadas/endereço: ${endereco || 'sem nome'}`);
                continue;
            }

            // CORREÇÃO CRÍTICA: Não filtrar por "Incluso" por padrão
            // Apenas pula se o campo existir E for explicitamente false E houver outros pontos inclusos
            // Para facilitar, vamos IGNORAR o filtro de "Incluso" completamente
            // Se precisar filtrar no futuro, pode adicionar um parâmetro na URL

            // if (incluso === false) {
            //     console.log(`[DEBUG] ⚠️ Pulando ponto não incluso: ${endereco}`);
            //     continue;
            // }

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

            console.log(`[DEBUG] ✅ Ponto adicionado: ${endereco}`);
        } catch (error) {
            console.warn('[ERROR] Erro ao processar ponto:', page.id, error);
        }
    }

    console.log(`[DEBUG] 🎯 Total de pontos processados: ${points.length}`);
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
