/**
 * Cloudflare Pages Function - API Principal
 * Sistema baseado em RECORD ID para facilitar uso
 *
 * MUDANÇA IMPORTANTE:
 * - Aceita recordId (ID do registro/página) ao invés de tableId (database ID)
 * - Busca automaticamente a database pai
 * - Obtém título da página para nomenclatura
 */

import {
    handleMapDataRequest,
    handleLayerListRequest,
    handleLayerUploadRequest,
    handleLayerManageRequest,
    handleKMLDataRequest
} from './_handlers.js';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Handler principal
 */
export async function onRequest(context) {
    const { request, env } = context;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS_HEADERS });
    }

    try {
        const url = new URL(request.url);
        const path = url.pathname;

        console.log(`[API] 🚀 ${request.method} ${path}`);

        // Roteamento
        if (path.includes('map-data')) {
            return await handleMapDataRequest(url, env, CORS_HEADERS);
        }
        else if (path.includes('layer-list')) {
            return await handleLayerListRequest(url, env, CORS_HEADERS);
        }
        else if (path.includes('layer-upload')) {
            return await handleLayerUploadRequest(request, env, CORS_HEADERS);
        }
        else if (path.includes('layer-manage')) {
            return await handleLayerManageRequest(request, env, CORS_HEADERS);
        }
        else if (path.includes('kml-data')) {
            return await handleKMLDataRequest(url, env, CORS_HEADERS);
        }

        // Rota desconhecida
        return new Response(JSON.stringify({
            error: 'Rota não encontrada',
            available: [
                'GET  /api/map-data?recordId=XXX',
                'GET  /api/layer-list?projectId=XXX',
                'POST /api/layer-upload',
                'POST /api/layer-manage',
                'GET  /api/kml-data?layerId=XXX&projectId=XXX'
            ]
        }), {
            status: 404,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[API] ❌ Erro não tratado:', error);

        return new Response(JSON.stringify({
            error: error.message || 'Internal Server Error',
            stack: error.stack
        }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }
}
