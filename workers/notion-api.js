/**
 * Cloudflare Worker para integração com Notion API
 * Busca dados de tabelas OOH e retorna pontos formatados para o mapa
 */

// Configuração da API Notion
const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE = 'https://api.notion.com/v1';

// Cache TTL (5 minutos)
const CACHE_TTL = 300;

/**
 * Handler principal do Worker
 */
export default {
    async fetch(request, env, ctx) {
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

            // Rotas
            if (path === '/api/map-data') {
                return await handleMapDataRequest(url, env, corsHeaders);
            } else if (path === '/api/table-data') {
                return await handleTableDataRequest(url, env, corsHeaders);
            } else if (path === '/' || path === '/index.html' || path.startsWith('/css/') || path.startsWith('/js/')) {
                // Servir arquivos estáticos
                return await handleStaticFiles(request, env);
            }

            return new Response('Not Found', { status: 404, headers: corsHeaders });

        } catch (error) {
            console.error('Worker error:', error);
            return new Response(JSON.stringify({
                error: error.message || 'Internal Server Error'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }
};

/**
 * Manipula requisição para obter dados do mapa pela página
 */
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

    // Verifica cache
    const cacheKey = `map-data-${pageId}`;
    const cached = await getCache(cacheKey);
    if (cached) {
        console.log('Cache hit:', cacheKey);
        return new Response(JSON.stringify(cached), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'X-Cache': 'HIT'
            }
        });
    }

    // Busca dados do Notion
    const notionToken = env.NOTION_TOKEN;
    if (!notionToken) {
        throw new Error('NOTION_TOKEN não configurado');
    }

    try {
        // 1. Buscar blocos da página
        const blocks = await getPageBlocks(pageId, notionToken);

        // 2. Encontrar tabela OOH
        const tableId = findOOHTable(blocks);
        if (!tableId) {
            throw new Error('Tabela OOH não encontrada na página');
        }

        // 3. Buscar dados da tabela
        const tableData = await getTableData(tableId, notionToken);

        // 4. Processar pontos
        const points = processTableData(tableData);

        const result = {
            pageId,
            tableId,
            points,
            timestamp: Date.now()
        };

        // Armazena no cache
        await setCache(cacheKey, result, CACHE_TTL);

        return new Response(JSON.stringify(result), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'X-Cache': 'MISS'
            }
        });

    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        throw error;
    }
}

/**
 * Manipula requisição para obter dados da tabela diretamente
 */
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

    // Verifica cache
    const cacheKey = `table-data-${tableId}`;
    const cached = await getCache(cacheKey);
    if (cached) {
        console.log('Cache hit:', cacheKey);
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
        // Buscar dados da tabela
        const tableData = await getTableData(tableId, notionToken);

        // Processar pontos
        const points = processTableData(tableData);

        const result = {
            tableId,
            points,
            timestamp: Date.now()
        };

        // Armazena no cache
        await setCache(cacheKey, result, CACHE_TTL);

        return new Response(JSON.stringify(result), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'X-Cache': 'MISS'
            }
        });

    } catch (error) {
        console.error('Erro ao buscar dados da tabela:', error);
        throw error;
    }
}

/**
 * Busca blocos de uma página do Notion
 */
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

/**
 * Encontra tabela OOH nos blocos
 */
function findOOHTable(blocks) {
    for (const block of blocks) {
        // Procura por blocos de banco de dados (database)
        if (block.type === 'child_database' || block.type === 'database') {
            return block.id;
        }

        // Também pode ser um linked database
        if (block.type === 'linked_database') {
            return block.id;
        }
    }

    return null;
}

/**
 * Busca dados de uma tabela (database) do Notion
 */
async function getTableData(databaseId, token) {
    const url = `${NOTION_API_BASE}/databases/${databaseId}/query`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': NOTION_API_VERSION,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            page_size: 100 // Ajustar se necessário
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Erro ao buscar dados da tabela: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.results || [];
}

/**
 * Processa dados da tabela e extrai pontos OOH
 */
function processTableData(results) {
    const points = [];

    for (const page of results) {
        try {
            const props = page.properties;

            // Extrai valores dos campos
            const latlong = getPropertyValue(props['Lat/long'] || props['Latlong'] || props['Coordenadas']);
            const endereco = getPropertyValue(props['Endereço'] || props['Endereco'] || props['Nome']);
            const exibidora = getPropertyValue(props['Exibidora']);
            const produto = getPropertyValue(props['Produto']);
            const uf = getPropertyValue(props['UF'] || props['Estado']);
            const praca = getPropertyValue(props['Praça'] || props['Praca'] || props['Cidade']);
            const incluso = getPropertyValue(props['Incluso']);

            // Valida campos obrigatórios
            if (!latlong || !endereco) {
                console.warn('Ponto sem coordenadas ou endereço:', page.id);
                continue;
            }

            // Verifica se está incluído (se campo existe)
            if (incluso !== null && incluso !== undefined && !incluso) {
                continue; // Pula pontos não inclusos
            }

            // Busca imagem de capa
            let imagem = null;
            if (page.cover) {
                if (page.cover.type === 'external') {
                    imagem = page.cover.external.url;
                } else if (page.cover.type === 'file') {
                    imagem = page.cover.file.url;
                }
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

/**
 * Extrai valor de uma propriedade do Notion
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
 * Funções de cache usando Cloudflare KV (se disponível) ou Cache API
 */
async function getCache(key) {
    try {
        // Tenta usar Cache API
        const cache = caches.default;
        const cacheUrl = `https://cache.internal/${key}`;
        const response = await cache.match(cacheUrl);

        if (response) {
            const data = await response.json();
            // Verifica se não expirou
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

/**
 * Manipula arquivos estáticos
 */
async function handleStaticFiles(request, env) {
    // Esta função será usada se o Worker também servir os arquivos estáticos
    // Para Cloudflare Pages, os arquivos são servidos automaticamente
    return new Response('Static files should be served by Cloudflare Pages', {
        status: 404
    });
}
