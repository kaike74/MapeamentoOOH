/**
 * Handlers de rotas API
 * Sistema baseado em RECORD ID (não database ID)
 */

import {
    getPageInfo,
    getParentDatabaseId,
    getPageTitle,
    getDatabaseRecords,
    processOOHData,
    normalizeNotionId
} from './_notion-helpers.js';

import {
    getOrCreateProjectFolder,
    listProjectKMLs,
    uploadKML,
    renameFile,
    softDeleteFile,
    readKMLFile,
    getProjectMetadata,
    saveProjectMetadata,
    initializeDriveClient
} from './_drive-helpers.js';

/**
 * GET /api/map-data?recordId=XXX
 * Busca dados do mapa a partir de um RECORD ID
 * MUDANÇA: Agora aceita recordId (ID do registro) ao invés de pageId/tableId
 */
export async function handleMapDataRequest(url, env, corsHeaders) {
    const recordId = url.searchParams.get('recordId') || url.searchParams.get('id');
    console.log(`[API] 📄 handleMapDataRequest - recordId: ${recordId}`);

    if (!recordId) {
        return new Response(JSON.stringify({
            error: 'recordId é obrigatório'
        }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const notionToken = env.NOTION_TOKEN;
    if (!notionToken) {
        throw new Error('NOTION_TOKEN não configurado');
    }

    try {
        // Normaliza ID
        const normalizedId = normalizeNotionId(recordId);

        // 1. Busca database pai do record
        const databaseId = await getParentDatabaseId(normalizedId, notionToken);
        console.log(`[API] ✅ Database ID: ${databaseId}`);

        // 2. Busca título da página/projeto
        const projectName = await getPageTitle(normalizedId, notionToken);
        console.log(`[API] ✅ Nome do projeto: ${projectName}`);

        // 3. Busca dados da database
        const records = await getDatabaseRecords(databaseId, notionToken);
        const points = processOOHData(records);

        const result = {
            recordId: normalizedId,
            databaseId: databaseId,
            projectName: projectName,
            points: points,
            pointCount: points.length,
            timestamp: Date.now()
        };

        console.log(`[API] 🎉 Sucesso! ${points.length} pontos retornados`);

        return new Response(JSON.stringify(result), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('[API] ❌ Erro em handleMapDataRequest:', error);
        return new Response(JSON.stringify({
            error: error.message,
            details: 'Verifique se o ID está correto e se a integração tem acesso à página'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

/**
 * GET /api/layer-list?projectId=XXX
 * Lista camadas disponíveis de um projeto
 */
export async function handleLayerListRequest(url, env, corsHeaders) {
    const projectId = url.searchParams.get('projectId') || url.searchParams.get('recordId');
    console.log(`[API] 📋 handleLayerListRequest - projectId: ${projectId}`);

    if (!projectId) {
        return new Response(JSON.stringify({
            error: 'projectId é obrigatório'
        }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const notionToken = env.NOTION_TOKEN;
        const driveCredentials = env.GOOGLE_DRIVE_CREDENTIALS;

        // Busca nome do projeto
        const projectName = await getPageTitle(normalizeNotionId(projectId), notionToken);

        // Inicializa Drive
        const drive = await initializeDriveClient(driveCredentials);

        // Busca pasta do projeto
        const folderId = await getOrCreateProjectFolder(drive, projectName);

        // Lista KMLs
        const layers = await listProjectKMLs(drive, folderId);

        // Busca metadados (cores, ícones, etc)
        const metadata = await getProjectMetadata(drive, folderId);

        // Mescla dados
        const layersWithMetadata = layers.map(layer => ({
            id: layer.id,
            name: layer.name,
            fileName: layer.fileName,
            kmlUrl: layer.kmlUrl,
            size: layer.size,
            modifiedTime: layer.modifiedTime,
            color: metadata?.layers?.[layer.id]?.color || '#e74c3c',
            icon: metadata?.layers?.[layer.id]?.icon || 'pin',
            visible: metadata?.layers?.[layer.id]?.visible !== false,
            opacity: metadata?.layers?.[layer.id]?.opacity || 1.0,
            pointCount: metadata?.layers?.[layer.id]?.pointCount || 0
        }));

        return new Response(JSON.stringify({
            projectId,
            projectName,
            folderId,
            layers: layersWithMetadata,
            layerCount: layersWithMetadata.length
        }), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('[API] ❌ Erro em handleLayerListRequest:', error);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

/**
 * POST /api/layer-upload
 * Faz upload de nova camada (KML)
 */
export async function handleLayerUploadRequest(request, env, corsHeaders) {
    console.log(`[API] ⬆️ handleLayerUploadRequest`);

    try {
        const body = await request.json();
        const { projectId, fileName, kmlData } = body;

        if (!projectId || !fileName || !kmlData) {
            return new Response(JSON.stringify({
                error: 'projectId, fileName e kmlData são obrigatórios'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const notionToken = env.NOTION_TOKEN;
        const driveCredentials = env.GOOGLE_DRIVE_CREDENTIALS;

        // Busca nome do projeto
        const projectName = await getPageTitle(normalizeNotionId(projectId), notionToken);

        // Inicializa Drive
        const drive = await initializeDriveClient(driveCredentials);

        // Busca/cria pasta do projeto
        const folderId = await getOrCreateProjectFolder(drive, projectName);

        // Upload do KML
        const file = await uploadKML(drive, folderId, fileName, kmlData);

        // Atualiza metadados
        const metadata = await getProjectMetadata(drive, folderId) || {
            project: { id: projectId, name: projectName },
            layers: {}
        };

        metadata.layers[file.id] = {
            name: fileName.replace('.kml', ''),
            color: '#e74c3c',
            icon: 'pin',
            visible: true,
            opacity: 1.0,
            file: file.name,
            created: new Date().toISOString()
        };

        await saveProjectMetadata(drive, folderId, metadata);

        return new Response(JSON.stringify({
            success: true,
            layerId: file.id,
            fileName: file.name,
            message: 'Camada criada com sucesso'
        }), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('[API] ❌ Erro em handleLayerUploadRequest:', error);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

/**
 * POST /api/layer-manage
 * Gerencia camadas (rename, delete, update_style)
 */
export async function handleLayerManageRequest(request, env, corsHeaders) {
    console.log(`[API] ⚙️ handleLayerManageRequest`);

    try {
        const body = await request.json();
        const { action, projectId, layerId, newName, color, icon } = body;

        if (!action || !projectId || !layerId) {
            return new Response(JSON.stringify({
                error: 'action, projectId e layerId são obrigatórios'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const notionToken = env.NOTION_TOKEN;
        const driveCredentials = env.GOOGLE_DRIVE_CREDENTIALS;

        const projectName = await getPageTitle(normalizeNotionId(projectId), notionToken);
        const drive = await initializeDriveClient(driveCredentials);
        const folderId = await getOrCreateProjectFolder(drive, projectName);
        const metadata = await getProjectMetadata(drive, folderId);

        let result = {};

        switch (action) {
            case 'rename':
                if (!newName) throw new Error('newName é obrigatório para rename');
                await renameFile(drive, layerId, newName);
                if (metadata && metadata.layers[layerId]) {
                    metadata.layers[layerId].name = newName;
                    await saveProjectMetadata(drive, folderId, metadata);
                }
                result = { message: 'Camada renomeada com sucesso' };
                break;

            case 'delete':
                await softDeleteFile(drive, layerId);
                result = { message: 'Camada excluída com sucesso' };
                break;

            case 'update_style':
                if (!metadata || !metadata.layers[layerId]) {
                    throw new Error('Metadados da camada não encontrados');
                }
                if (color) metadata.layers[layerId].color = color;
                if (icon) metadata.layers[layerId].icon = icon;
                await saveProjectMetadata(drive, folderId, metadata);
                result = { message: 'Estilo atualizado com sucesso' };
                break;

            default:
                throw new Error('Action inválida: ' + action);
        }

        return new Response(JSON.stringify({
            success: true,
            ...result
        }), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('[API] ❌ Erro em handleLayerManageRequest:', error);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

/**
 * GET /api/kml-data?layerId=XXX&projectId=XXX
 * Retorna conteúdo de um arquivo KML
 */
export async function handleKMLDataRequest(url, env, corsHeaders) {
    const layerId = url.searchParams.get('layerId');
    const projectId = url.searchParams.get('projectId');

    console.log(`[API] 📥 handleKMLDataRequest - layerId: ${layerId}`);

    if (!layerId || !projectId) {
        return new Response(JSON.stringify({
            error: 'layerId e projectId são obrigatórios'
        }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const driveCredentials = env.GOOGLE_DRIVE_CREDENTIALS;
        const drive = await initializeDriveClient(driveCredentials);

        // Lê KML
        const kmlContent = await readKMLFile(drive, layerId);

        return new Response(kmlContent, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/vnd.google-earth.kml+xml',
                'Cache-Control': 'public, max-age=3600' // Cache de 1 hora
            }
        });

    } catch (error) {
        console.error('[API] ❌ Erro em handleKMLDataRequest:', error);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
