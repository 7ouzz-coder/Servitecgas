const { BlobServiceClient } = require('@azure/storage-blob');
const { TableClient } = require('@azure/data-tables');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Configuración de Azure (debe importarse desde un archivo de configuración seguro)
let AZURE_STORAGE_CONNECTION_STRING;
let AZURE_CONTAINER_NAME = 'servitecgas-data';
let AZURE_TABLE_NAME = 'servitecgassynclog';
let retryCount = 3; // Número de reintentos para operaciones fallidas

/**
 * Configura las credenciales de Azure
 * @param {Object} config - Configuración de Azure
 */
function setAzureConfig(config) {
    if (config.connectionString) {
        AZURE_STORAGE_CONNECTION_STRING = config.connectionString;
    }
    if (config.containerName) {
        AZURE_CONTAINER_NAME = config.containerName;
    }
    if (config.tableName) {
        AZURE_TABLE_NAME = config.tableName;
    }
    if (config.maxRetries) {
        retryCount = config.maxRetries;
    }
}

/**
 * Verifica si la configuración de Azure es válida
 * @returns {boolean} - Verdadero si la configuración es válida
 */
function isConfigValid() {
    return !!AZURE_STORAGE_CONNECTION_STRING && 
           !!AZURE_CONTAINER_NAME && 
           !!AZURE_TABLE_NAME;
}

/**
 * Inicializa los clientes de Azure necesarios para la sincronización
 * @returns {Object} - Objeto con los clientes de Azure
 */
async function initAzureClients() {
    if (!isConfigValid()) {
        throw new Error('La configuración de Azure no es válida');
    }

    try {
        // Crear cliente del servicio Blob
        const blobServiceClient = BlobServiceClient.fromConnectionString(
            AZURE_STORAGE_CONNECTION_STRING
        );

        // Verificar/crear el contenedor
        const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);
        
        // Intentar crear el contenedor si no existe
        try {
            console.log(`Verificando si existe el contenedor: ${AZURE_CONTAINER_NAME}`);
            const containerExists = await executeWithRetry(
                async () => {
                    const properties = await containerClient.getProperties();
                    return true;
                },
                'check container exists',
                1
            ).catch(() => false);
            
            if (!containerExists) {
                console.log(`Creando contenedor: ${AZURE_CONTAINER_NAME}`);
                await executeWithRetry(
                    () => containerClient.create({ access: 'private' }),
                    'create container'
                );
                console.log(`Contenedor creado: ${AZURE_CONTAINER_NAME}`);
            }
        } catch (error) {
            console.log(`Error al verificar o crear el contenedor: ${error.message}`);
            // Seguimos adelante, podría ser un problema de permisos
        }
        
        // Crear cliente de tabla
        const tableClient = TableClient.fromConnectionString(
            AZURE_STORAGE_CONNECTION_STRING,
            AZURE_TABLE_NAME
        );

        // Intentar crear la tabla si no existe
        try {
            console.log(`Verificando si existe la tabla: ${AZURE_TABLE_NAME}`);
            await executeWithRetry(
                () => tableClient.createTable(),
                'create table',
                1
            );
            console.log(`Tabla creada o ya existente: ${AZURE_TABLE_NAME}`);
        } catch (error) {
            if (error.statusCode !== 409) { // 409 = ya existe, lo que está bien
                console.log(`Error al crear tabla: ${error.message}`);
            }
        }

        return {
            blobServiceClient,
            containerClient,
            tableClient
        };
    } catch (error) {
        console.error('Error al inicializar clientes de Azure:', error);
        throw new Error(`Error al inicializar Azure: ${error.message}`);
    }
}

/**
 * Función para ejecutar una operación con reintentos en caso de fallo
 * @param {Function} operation - La función a ejecutar
 * @param {string} operationName - Nombre de la operación (para logs)
 * @param {number} maxRetries - Número máximo de reintentos
 * @returns {Promise<any>} - Resultado de la operación
 */
async function executeWithRetry(operation, operationName, maxRetries = retryCount) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            console.error(`Error en ${operationName} (intento ${attempt}/${maxRetries}):`, error.message);
            
            // Si es un error de autenticación, no reintentamos
            if (error.code === 'AuthenticationFailed' || 
                (error.details && error.details.errorCode === 'AuthenticationFailed')) {
                break;
            }
            
            // Esperar antes de reintentar (con backoff exponencial)
            if (attempt < maxRetries) {
                const delay = Math.min(Math.pow(2, attempt) * 1000, 30000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // Si llegamos aquí, todos los intentos fallaron
    throw lastError || new Error(`Error después de ${maxRetries} intentos en ${operationName}`);
}

/**
 * Sube un archivo de datos a Azure Blob Storage
 * @param {Object} data - Datos a subir 
 * @param {string} userId - ID del usuario que realiza la operación
 * @param {string} deviceId - ID del dispositivo
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function uploadData(data, userId, deviceId) {
    if (!isConfigValid()) {
        return { 
            success: false, 
            offline: true,
            message: 'Configuración de Azure no válida. Los datos se guardarán localmente.' 
        };
    }
    
    try {
        const { containerClient, tableClient } = await initAzureClients();
        
        // Generar nombre de archivo único
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const blobName = `${userId}/${deviceId}/${timestamp}-${uuidv4()}.json`;
        
        // Preparar datos para subir
        const blobContent = JSON.stringify({
            data,
            metadata: {
                userId,
                deviceId,
                timestamp: new Date().toISOString(),
                appVersion: process.env.npm_package_version || '1.0.0',
                platform: process.platform,
                hostname: os.hostname()
            }
        });
        
        // Subir datos al Blob Storage
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        
        await executeWithRetry(
            () => blockBlobClient.upload(blobContent, blobContent.length),
            'upload blob'
        );
        
        // Registrar evento de sincronización en Table Storage
        const syncLogEntry = {
            partitionKey: userId,
            rowKey: `${timestamp}-${uuidv4()}`,
            deviceId,
            blobName,
            syncType: 'upload',
            timestamp: new Date().toISOString(),
            success: true
        };
        
        await executeWithRetry(
            () => tableClient.createEntity(syncLogEntry),
            'log sync event'
        );
        
        return {
            success: true,
            blobName,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error al subir datos a Azure:', error);
        
        // Guardar copia local de respaldo
        try {
            const backupDir = path.join(os.tmpdir(), 'servitecgas-backup');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
            
            fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
            
            return {
                success: false,
                offline: error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT',
                message: `Error al subir datos: ${error.message}. Se ha guardado una copia de respaldo local.`,
                backupFile
            };
        } catch (backupError) {
            console.error('Error al guardar copia de respaldo:', backupError);
            return {
                success: false,
                message: `Error al subir datos: ${error.message}. No se pudo guardar copia de respaldo: ${backupError.message}`
            };
        }
    }
}

/**
 * Descarga el último conjunto de datos desde Azure
 * @param {string} userId - ID del usuario
 * @param {string} deviceId - ID del dispositivo (opcional)
 * @returns {Promise<Object>} - Datos descargados
 */
async function downloadLatestData(userId, deviceId = null) {
    if (!isConfigValid()) {
        return { 
            success: false, 
            offline: true,
            message: 'Configuración de Azure no válida. Se usarán datos locales.' 
        };
    }
    
    try {
        const { containerClient, tableClient } = await initAzureClients();
        
        // Prefijo para filtrar blobs
        const prefix = deviceId ? `${userId}/${deviceId}/` : `${userId}/`;
        
        // Listar blobs con el prefijo especificado
        const blobs = [];
        
        // Usar executeWithRetry para listar blobs
        await executeWithRetry(
            async () => {
                const iter = containerClient.listBlobsFlat({ prefix });
                for await (const blob of iter) {
                    blobs.push(blob);
                }
            },
            'list blobs'
        );
        
        if (blobs.length === 0) {
            return {
                success: false,
                message: 'No se encontraron datos para sincronizar',
                data: null
            };
        }
        
        // Ordenar blobs por fecha (más reciente primero)
        blobs.sort((a, b) => 
            new Date(b.properties.createdOn) - new Date(a.properties.createdOn)
        );
        
        // Descargar el blob más reciente
        const latestBlob = blobs[0];
        const blobClient = containerClient.getBlobClient(latestBlob.name);
        
        // Usar executeWithRetry para descargar el blob
        const downloadResponse = await executeWithRetry(
            () => blobClient.download(),
            'download blob'
        );
        
        // Leer el contenido del blob
        const downloaded = await streamToBuffer(downloadResponse.readableStreamBody);
        const blobContent = downloaded.toString();
        
        // Registrar evento de sincronización en Table Storage
        const timestamp = new Date().toISOString();
        const syncLogEntry = {
            partitionKey: userId,
            rowKey: `${timestamp.replace(/[:.]/g, '-')}-${uuidv4()}`,
            deviceId: deviceId || 'unknown',
            blobName: latestBlob.name,
            syncType: 'download',
            timestamp,
            success: true
        };
        
        await executeWithRetry(
            () => tableClient.createEntity(syncLogEntry),
            'log sync event'
        );
        
        // Parsear y devolver los datos
        const parsedData = JSON.parse(blobContent);
        
        return {
            success: true,
            data: parsedData.data,
            metadata: parsedData.metadata,
            timestamp
        };
    } catch (error) {
        console.error('Error al descargar datos de Azure:', error);
        return {
            success: false,
            offline: error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT',
            message: `Error al descargar cambios: ${error.message}`,
            error
        };
    }
}

/**
 * Realiza la sincronización completa entre local y Azure
 * @param {Object} localData - Datos locales
 * @param {string} userId - ID del usuario
 * @param {string} deviceId - ID del dispositivo
 * @param {Function} mergeStrategy - Función para resolver conflictos (opcional)
 * @returns {Promise<Object>} - Resultado de la sincronización
 */
async function synchronize(localData, userId, deviceId, mergeStrategy = null) {
    try {
        // 1. Primero intentamos descargar los datos más recientes
        const downloadResult = await downloadLatestData(userId, null); // Sin filtrar por device para obtener todos
        
        // 2. Si hay un error de conectividad, trabajamos en modo offline
        if (downloadResult.offline) {
            return {
                success: true,
                offline: true,
                message: 'Trabajando en modo offline. Los cambios se sincronizarán cuando haya conexión.',
                data: localData
            };
        }
        
        let finalData = localData;
        
        // 3. Si obtuvimos datos del servidor, los combinamos con los locales
        if (downloadResult.success && downloadResult.data) {
            // Si hay una estrategia de combinación personalizada, la usamos
            if (mergeStrategy && typeof mergeStrategy === 'function') {
                finalData = mergeStrategy(localData, downloadResult.data);
            } else {
                // Estrategia por defecto: los datos del servidor tienen prioridad
                // pero conservamos los cambios locales que no existen en el servidor
                finalData = {
                    ...downloadResult.data,
                    ...localData,
                    // Para listas/arrays que necesiten combinación especial:
                    clients: mergeArraysByKey(
                        downloadResult.data.clients || [],
                        localData.clients || [],
                        'id'
                    ),
                    installations: mergeArraysByKey(
                        downloadResult.data.installations || [],
                        localData.installations || [],
                        'id'
                    )
                };
            }
        }
        
        // 4. Subimos los datos combinados a Azure
        const uploadResult = await uploadData(finalData, userId, deviceId);
        
        // 5. Devolvemos el resultado
        return {
            success: uploadResult.success,
            offline: uploadResult.offline || false,
            message: uploadResult.message || 'Sincronización completada correctamente',
            data: finalData,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error durante la sincronización:', error);
        return {
            success: false,
            message: `Error durante la sincronización: ${error.message}`,
            error
        };
    }
}

/**
 * Combina dos arrays de objetos por una clave específica
 * Los elementos más recientes (por lastModified) tienen prioridad
 * @param {Array} serverArray - Array del servidor
 * @param {Array} localArray - Array local
 * @param {string} key - Clave para identificar elementos (ej: 'id')
 * @returns {Array} - Array combinado
 */
function mergeArraysByKey(serverArray, localArray, key) {
    // Crear un mapa para combinar elementos por ID
    const mergedMap = new Map();
    
    // Agregar elementos del servidor al mapa
    serverArray.forEach(item => {
        mergedMap.set(item[key], item);
    });
    
    // Agregar o actualizar elementos locales en el mapa
    localArray.forEach(localItem => {
        const serverItem = mergedMap.get(localItem[key]);
        
        if (!serverItem) {
            // Si el elemento no existe en el servidor, lo agregamos
            mergedMap.set(localItem[key], localItem);
        } else {
            // Si existe en ambos, elegimos el más reciente
            const serverModified = new Date(serverItem.lastModified || 0);
            const localModified = new Date(localItem.lastModified || 0);
            
            if (localModified > serverModified) {
                // El elemento local es más reciente
                mergedMap.set(localItem[key], localItem);
            }
        }
    });
    
    // Convertir el mapa de vuelta a un array
    return Array.from(mergedMap.values());
}

/**
 * Convierte un stream en un buffer
 * @param {ReadableStream} readableStream - Stream a convertir
 * @returns {Promise<Buffer>} - Buffer con el contenido del stream
 */
async function streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on('data', (data) => {
            chunks.push(data instanceof Buffer ? data : Buffer.from(data));
        });
        readableStream.on('end', () => {
            resolve(Buffer.concat(chunks));
        });
        readableStream.on('error', reject);
    });
}

/**
 * Genera un ID de dispositivo único para identificar la instalación
 * @returns {string} - ID de dispositivo
 */
function generateDeviceId() {
    try {
        // Intentar generar un ID basado en el hardware
        const networkInterfaces = os.networkInterfaces();
        let macAddress = '';
        
        // Buscar una dirección MAC
        Object.keys(networkInterfaces).forEach(interfaceName => {
            const interfaces = networkInterfaces[interfaceName];
            interfaces.forEach(interfaceInfo => {
                if (!interfaceInfo.internal && interfaceInfo.mac && interfaceInfo.mac !== '00:00:00:00:00:00') {
                    macAddress = interfaceInfo.mac;
                }
            });
        });
        
        if (macAddress) {
            return `${os.hostname()}-${macAddress.replace(/:/g, '')}`;
        }
        
        // Si no hay MAC, usar características del sistema
        return `${os.hostname()}-${os.platform()}-${os.arch()}-${Math.floor(os.totalmem() / 1024 / 1024)}MB`;
    } catch (error) {
        console.error('Error al generar ID de dispositivo:', error);
        // En caso de error, generar un ID aleatorio y guardarlo
        const randomId = uuidv4();
        return `device-${randomId}`;
    }
}

/**
 * Registra un evento de sincronización en Azure Table Storage
 * @param {string} userId - ID del usuario
 * @param {string} deviceId - ID del dispositivo
 * @param {string} eventType - Tipo de evento
 * @param {Object} details - Detalles adicionales
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function logSyncEvent(userId, deviceId, eventType, details = {}) {
    if (!isConfigValid()) {
        return { success: false, message: 'Configuración de Azure no válida' };
    }
    
    try {
        const { tableClient } = await initAzureClients();
        
        const timestamp = new Date().toISOString();
        const syncLogEntry = {
            partitionKey: userId,
            rowKey: `${timestamp.replace(/[:.]/g, '-')}-${uuidv4()}`,
            deviceId,
            eventType,
            timestamp,
            details: JSON.stringify(details),
            success: true
        };
        
        await executeWithRetry(
            () => tableClient.createEntity(syncLogEntry),
            'log sync event'
        );
        
        return { success: true };
    } catch (error) {
        console.error('Error al registrar evento de sincronización:', error);
        return { 
            success: false, 
            message: `Error al registrar evento de sincronización: ${error.message}` 
        };
    }
}

module.exports = {
    setAzureConfig,
    isConfigValid,
    uploadData,
    downloadLatestData,
    synchronize,
    generateDeviceId,
    logSyncEvent
};