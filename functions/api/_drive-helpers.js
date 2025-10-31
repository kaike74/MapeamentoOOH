/**
 * Helpers para Google Drive API
 * Gerenciamento de arquivos KML e estrutura de pastas
 */

/**
 * Busca ou cria pasta do projeto no Drive
 * Estrutura: Mapeamento_OOH/[projectName]/
 * @param {Object} drive - Cliente Google Drive
 * @param {string} projectName - Nome do projeto
 * @returns {Promise<string>} ID da pasta do projeto
 */
export async function getOrCreateProjectFolder(drive, projectName) {
    console.log(`[DRIVE] 📁 Buscando pasta para projeto: ${projectName}`);

    // Busca pasta raiz "Mapeamento_OOH"
    const rootFolderId = await getOrCreateFolder(drive, 'Mapeamento_OOH', null);

    // Busca/cria pasta do projeto
    const projectFolderId = await getOrCreateFolder(drive, projectName, rootFolderId);

    console.log(`[DRIVE] ✅ Pasta do projeto: ${projectFolderId}`);
    return projectFolderId;
}

/**
 * Busca ou cria uma pasta no Drive
 * @param {Object} drive - Cliente Google Drive
 * @param {string} folderName - Nome da pasta
 * @param {string|null} parentId - ID da pasta pai (null = raiz)
 * @returns {Promise<string>} ID da pasta
 */
async function getOrCreateFolder(drive, folderName, parentId) {
    // Busca pasta existente
    const query = parentId
        ? `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
        : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

    const existing = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive'
    });

    if (existing.data.files && existing.data.files.length > 0) {
        return existing.data.files[0].id;
    }

    // Cria nova pasta
    const folder = await drive.files.create({
        requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentId ? [parentId] : undefined
        },
        fields: 'id'
    });

    console.log(`[DRIVE] ✅ Pasta criada: ${folderName} (${folder.data.id})`);
    return folder.data.id;
}

/**
 * Lista arquivos KML de um projeto
 * @param {Object} drive - Cliente Google Drive
 * @param {string} folderId - ID da pasta do projeto
 * @returns {Promise<Array>} Lista de camadas
 */
export async function listProjectKMLs(drive, folderId) {
    console.log(`[DRIVE] 📋 Listando KMLs na pasta: ${folderId}`);

    const response = await drive.files.list({
        q: `'${folderId}' in parents and (name contains '.kml' or mimeType='application/vnd.google-earth.kml+xml') and trashed=false`,
        fields: 'files(id, name, size, modifiedTime, webContentLink)',
        orderBy: 'name',
        spaces: 'drive'
    });

    const files = response.data.files || [];

    // Filtra arquivos excluídos (soft delete)
    const activeLayers = files
        .filter(file => !file.name.includes('_EXCLUIDO_'))
        .map(file => ({
            id: file.id,
            name: file.name.replace('.kml', ''),
            fileName: file.name,
            size: file.size,
            modifiedTime: file.modifiedTime,
            kmlUrl: file.webContentLink
        }));

    console.log(`[DRIVE] ✅ ${activeLayers.length} camadas ativas encontradas`);
    return activeLayers;
}

/**
 * Faz upload de arquivo KML
 * @param {Object} drive - Cliente Google Drive
 * @param {string} folderId - ID da pasta
 * @param {string} fileName - Nome do arquivo
 * @param {string} kmlContent - Conteúdo KML
 * @returns {Promise<Object>} Dados do arquivo criado
 */
export async function uploadKML(drive, folderId, fileName, kmlContent) {
    console.log(`[DRIVE] ⬆️ Fazendo upload de KML: ${fileName}`);

    // Garante extensão .kml
    if (!fileName.endsWith('.kml')) {
        fileName = fileName + '.kml';
    }

    // Sanitiza nome do arquivo
    fileName = sanitizeFileName(fileName);

    // Cria arquivo
    const response = await drive.files.create({
        requestBody: {
            name: fileName,
            mimeType: 'application/vnd.google-earth.kml+xml',
            parents: [folderId]
        },
        media: {
            mimeType: 'application/vnd.google-earth.kml+xml',
            body: kmlContent
        },
        fields: 'id, name, webContentLink'
    });

    console.log(`[DRIVE] ✅ KML uploaded: ${response.data.id}`);
    return response.data;
}

/**
 * Renomeia arquivo no Drive
 * @param {Object} drive - Cliente Google Drive
 * @param {string} fileId - ID do arquivo
 * @param {string} newName - Novo nome
 * @returns {Promise<Object>} Dados atualizados
 */
export async function renameFile(drive, fileId, newName) {
    console.log(`[DRIVE] ✏️ Renomeando arquivo ${fileId} para: ${newName}`);

    // Garante extensão .kml
    if (!newName.endsWith('.kml')) {
        newName = newName + '.kml';
    }

    newName = sanitizeFileName(newName);

    const response = await drive.files.update({
        fileId: fileId,
        requestBody: {
            name: newName
        },
        fields: 'id, name'
    });

    console.log(`[DRIVE] ✅ Arquivo renomeado`);
    return response.data;
}

/**
 * Soft delete de arquivo (adiciona _EXCLUIDO_ no nome)
 * @param {Object} drive - Cliente Google Drive
 * @param {string} fileId - ID do arquivo
 * @returns {Promise<Object>} Dados atualizados
 */
export async function softDeleteFile(drive, fileId) {
    console.log(`[DRIVE] 🗑️ Soft delete do arquivo: ${fileId}`);

    // Busca nome atual
    const file = await drive.files.get({
        fileId: fileId,
        fields: 'name'
    });

    const currentName = file.data.name;

    // Adiciona sufixo _EXCLUIDO_
    const newName = currentName.replace('.kml', '_EXCLUIDO_.kml');

    return await renameFile(drive, fileId, newName);
}

/**
 * Lê conteúdo de arquivo KML
 * @param {Object} drive - Cliente Google Drive
 * @param {string} fileId - ID do arquivo
 * @returns {Promise<string>} Conteúdo do KML
 */
export async function readKMLFile(drive, fileId) {
    console.log(`[DRIVE] 📥 Lendo KML: ${fileId}`);

    const response = await drive.files.get({
        fileId: fileId,
        alt: 'media'
    });

    return response.data;
}

/**
 * Busca metadados de um projeto
 * @param {Object} drive - Cliente Google Drive
 * @param {string} folderId - ID da pasta do projeto
 * @returns {Promise<Object|null>} Metadados ou null
 */
export async function getProjectMetadata(drive, folderId) {
    try {
        const response = await drive.files.list({
            q: `'${folderId}' in parents and name='.metadata.json' and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive'
        });

        if (response.data.files && response.data.files.length > 0) {
            const fileId = response.data.files[0].id;
            const content = await drive.files.get({
                fileId: fileId,
                alt: 'media'
            });

            return JSON.parse(content.data);
        }
    } catch (error) {
        console.warn(`[DRIVE] ⚠️ Erro ao ler metadados:`, error);
    }

    return null;
}

/**
 * Salva metadados de um projeto
 * @param {Object} drive - Cliente Google Drive
 * @param {string} folderId - ID da pasta do projeto
 * @param {Object} metadata - Metadados a salvar
 * @returns {Promise<void>}
 */
export async function saveProjectMetadata(drive, folderId, metadata) {
    console.log(`[DRIVE] 💾 Salvando metadados do projeto`);

    // Busca arquivo existente
    const response = await drive.files.list({
        q: `'${folderId}' in parents and name='.metadata.json' and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
    });

    const content = JSON.stringify(metadata, null, 2);

    if (response.data.files && response.data.files.length > 0) {
        // Atualiza existente
        const fileId = response.data.files[0].id;
        await drive.files.update({
            fileId: fileId,
            media: {
                mimeType: 'application/json',
                body: content
            }
        });
    } else {
        // Cria novo
        await drive.files.create({
            requestBody: {
                name: '.metadata.json',
                mimeType: 'application/json',
                parents: [folderId]
            },
            media: {
                mimeType: 'application/json',
                body: content
            }
        });
    }

    console.log(`[DRIVE] ✅ Metadados salvos`);
}

/**
 * Sanitiza nome de arquivo
 * @param {string} fileName - Nome original
 * @returns {string} Nome sanitizado
 */
function sanitizeFileName(fileName) {
    return fileName
        .replace(/[<>:"/\\|?*]/g, '_')  // Remove caracteres inválidos
        .replace(/\s+/g, '_')             // Substitui espaços por _
        .replace(/_{2,}/g, '_')           // Remove _ duplicados
        .substring(0, 255);               // Limita tamanho
}

/**
 * Inicializa cliente Google Drive
 * (Placeholder - implementar com service account)
 * @param {string} credentials - Credentials JSON
 * @returns {Object} Cliente Drive
 */
export async function initializeDriveClient(credentials) {
    // TODO: Implementar autenticação real com Google Drive API
    // Por enquanto retorna mock para desenvolvimento

    console.log('[DRIVE] ⚠️ Usando mock do Drive (implementar autenticação real)');

    return {
        files: {
            list: async () => ({ data: { files: [] } }),
            create: async () => ({ data: { id: 'mock-id', name: 'mock-file' } }),
            get: async () => ({ data: {} }),
            update: async () => ({ data: {} })
        }
    };
}
