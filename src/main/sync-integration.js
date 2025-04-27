const azureSync = require('./azure/sync');
const azureConfig = require('./azure/config');
const path = require('path');
const fs = require('fs');
const { sendNotification, sendAlert } = require('./utils/notification-manager');
require('dotenv').config();

// Intervalo para sincronización automática (10 minutos por defecto)
const DEFAULT_SYNC_INTERVAL = 10 * 60 * 1000;

// Variable para almacenar el temporizador de sincronización
let syncTimer = null;
let syncInProgress = false;

/**
 * Configura la integración de sincronización
 * @param {Store} store - Instancia del almacenamiento local
 * @param {BrowserWindow} mainWindow - Ventana principal para notificaciones
 */
async function setupSync(store, mainWindow) {
  try {
    // Inicializar configuración de Azure
    const config = azureConfig.initAzureConfig();
    
    // Configurar el módulo de sincronización
    azureSync.setAzureConfig({
      connectionString: config.connectionString,
      containerName: config.containerName,
      tableName: config.tableName,
      maxRetries: config.maxRetries || 3
    });

    console.log('Configuración de Azure inicializada');
    
    // No configuramos manejadores IPC aquí, lo dejamos para el gestor centralizado
    
    // Iniciar sincronización automática si está habilitada
    if (config.autoSyncEnabled) {
      startAutoSync(store, mainWindow, config.syncIntervalMinutes);
    }
    
    console.log('Sistema de sincronización inicializado correctamente');
  } catch (error) {
    console.error('Error al configurar sincronización:', error);
    throw error; // Para manejo superior
  }
}

/**
 * Inicia la sincronización automática periódica
 * @param {Store} store - Instancia del almacenamiento local
 * @param {BrowserWindow} mainWindow - Ventana principal para notificaciones
 * @param {number} intervalMinutes - Intervalo en minutos (mínimo 5)
 */
function startAutoSync(store, mainWindow, intervalMinutes = 10) {
  // Detener sincronización existente si hay alguna
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  
  // Intervalo mínimo: 5 minutos
  const interval = Math.max(5, intervalMinutes) * 60 * 1000;
  
  // Configurar sincronización periódica
  syncTimer = setInterval(async () => {
    if (!syncInProgress) {
      try {
        await synchronize(store, mainWindow);
      } catch (error) {
        console.error('Error en sincronización automática:', error);
      }
    }
  }, interval);
  
  console.log(`Sincronización automática configurada cada ${intervalMinutes} minutos`);
}

/**
 * Reinicia la sincronización automática con nueva configuración
 * @param {Store} store - Instancia del almacenamiento local
 * @param {BrowserWindow} mainWindow - Ventana principal para notificaciones
 * @param {Object} config - Nueva configuración
 */
function restartAutoSync(store, mainWindow, config) {
  stopAutoSync();
  
  // Actualizar configuración en el módulo de sincronización
  if (config && config.connectionString) {
    azureSync.setAzureConfig({
      connectionString: config.connectionString,
      containerName: config.containerName,
      tableName: config.tableName,
      maxRetries: config.maxRetries || 3
    });
  }
  
  if (config && config.autoSyncEnabled) {
    startAutoSync(store, mainWindow, config.syncIntervalMinutes);
  }
  
  return true;
}

/**
 * Realiza la sincronización con Azure
 * @param {Store} store - Instancia del almacenamiento local
 * @param {BrowserWindow} mainWindow - Ventana principal para notificaciones
 * @returns {Promise<Object>} - Resultado de la sincronización
 */
async function synchronize(store, mainWindow) {
  if (syncInProgress) {
    return { 
      success: false, 
      message: 'Sincronización en progreso' 
    };
  }
  
  syncInProgress = true;
  
  try {
    // Notificar inicio de sincronización
    sendNotification(mainWindow, 'sync-status-changed', { 
      status: 'in-progress',
      message: 'Sincronización en progreso...'
    });
    
    // Verificar configuración válida
    if (!azureSync.isConfigValid()) {
      syncInProgress = false;
      
      sendNotification(mainWindow, 'sync-status-changed', { 
        status: 'error',
        message: 'Configuración de Azure no válida'
      });
      
      return { 
        success: false, 
        message: 'La configuración de Azure no es válida. Configure la sincronización en la sección de Azure.' 
      };
    }
    
    // Obtener datos actuales
    const clients = store.get('clients') || [];
    const installations = store.get('installations') || [];
    
    // Preparar datos a sincronizar
    const localData = {
      clients,
      installations
    };
    
    // Realizar sincronización con Azure
    try {
      const result = await azureSync.synchronize(localData, 'system', 'app-device');
      
      if (result.success) {
        // Si hay datos recibidos y son diferentes, actualizamos localmente
        if (result.data) {
          let dataChanged = false;
          
          if (result.data.clients && JSON.stringify(clients) !== JSON.stringify(result.data.clients)) {
            store.set('clients', result.data.clients);
            dataChanged = true;
          }
          
          if (result.data.installations && JSON.stringify(installations) !== JSON.stringify(result.data.installations)) {
            store.set('installations', result.data.installations);
            dataChanged = true;
          }
          
          // Notificar cambios si los hubo
          if (dataChanged) {
            sendNotification(mainWindow, 'database-imported', null);
          }
        }
        
        // Actualizar timestamp de última sincronización
        azureConfig.updateLastSyncTime(new Date().toISOString());
        
        sendNotification(mainWindow, 'sync-status-changed', { 
          status: 'completed',
          message: 'Sincronización completada'
        });
        
        sendNotification(mainWindow, 'sync-completed', {
          success: true,
          timestamp: new Date().toISOString()
        }, 5000); // Aumentamos el throttle para este evento específico
        
        return {
          success: true,
          message: result.offline ? 
            'Trabajando en modo offline. Los cambios se sincronizarán más tarde.' : 
            'Sincronización completada correctamente'
        };
      } else {
        sendNotification(mainWindow, 'sync-status-changed', { 
          status: 'error',
          message: result.message || 'Error en sincronización'
        });
        
        return {
          success: false,
          message: result.message || 'Error en sincronización'
        };
      }
    } catch (error) {
      sendNotification(mainWindow, 'sync-status-changed', { 
        status: 'error',
        message: `Error: ${error.message}`
      });
      
      throw error; // Re-lanzar para manejo superior
    }
  } catch (error) {
    console.error('Error en sincronización:', error);
    return { 
      success: false, 
      message: `Error en sincronización: ${error.message}` 
    };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Obtiene el estado actual de sincronización
 * @param {Store} store - Instancia del almacenamiento local
 * @returns {Object} - Estado de sincronización
 */
function getSyncStatus(store) {
  const config = azureConfig.initAzureConfig();
  
  return {
    lastSync: config.lastSync,
    syncInProgress: syncInProgress,
    connectionAvailable: true, // Simplificado, en una implementación real se verificaría la conexión
    autoSyncEnabled: config.autoSyncEnabled || false,
    status: syncInProgress ? 'in-progress' : 'idle'
  };
}

/**
 * Forzar la descarga de datos desde Azure
 * @param {Store} store - Instancia del almacenamiento local
 * @param {BrowserWindow} mainWindow - Ventana principal para notificaciones
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function forceDownload(store, mainWindow) {
  if (syncInProgress) {
    return { 
      success: false, 
      message: 'Hay una sincronización en progreso. Espere a que termine.' 
    };
  }
  
  syncInProgress = true;
  
  try {
    sendNotification(mainWindow, 'sync-status-changed', { 
      status: 'downloading',
      message: 'Descargando datos de Azure...'
    });
    
    // Descargar datos
    const downloadResult = await azureSync.downloadLatestData('system');
    
    if (!downloadResult.success) {
      sendNotification(mainWindow, 'sync-status-changed', { 
        status: 'error',
        message: downloadResult.message
      });
      
      return downloadResult;
    }
    
    // Verificar que hay datos
    if (!downloadResult.data) {
      return {
        success: false,
        message: 'No hay datos disponibles para descargar.'
      };
    }
    
    // Guardar datos descargados
    const { clients, installations } = downloadResult.data;
    
    if (Array.isArray(clients)) {
      store.set('clients', clients);
    }
    
    if (Array.isArray(installations)) {
      store.set('installations', installations);
    }
    
    // Actualizar timestamp de última sincronización
    azureConfig.updateLastSyncTime(downloadResult.timestamp);
    
    sendNotification(mainWindow, 'database-imported', null);
    
    sendNotification(mainWindow, 'sync-completed', {
      success: true,
      stats: { downloaded: 1 },
      timestamp: downloadResult.timestamp
    });
    
    sendNotification(mainWindow, 'sync-status-changed', { 
      status: 'completed',
      message: 'Descarga completada'
    });
    
    return {
      success: true,
      message: 'Descarga de datos completada correctamente',
      timestamp: downloadResult.timestamp
    };
    
  } catch (error) {
    console.error('Error en descarga forzada:', error);
    
    sendNotification(mainWindow, 'sync-status-changed', { 
      status: 'error',
      message: `Error: ${error.message}`
    });
    
    return { 
      success: false, 
      message: `Error en descarga forzada: ${error.message}` 
    };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Forzar la subida de datos a Azure
 * @param {Store} store - Instancia del almacenamiento local
 * @param {BrowserWindow} mainWindow - Ventana principal para notificaciones
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function forceUpload(store, mainWindow) {
  if (syncInProgress) {
    return { 
      success: false, 
      message: 'Hay una sincronización en progreso. Espere a que termine.' 
    };
  }
  
  syncInProgress = true;
  
  try {
    sendNotification(mainWindow, 'sync-status-changed', { 
      status: 'uploading',
      message: 'Subiendo datos a Azure...'
    });
    
    // Obtener datos actuales
    const clients = store.get('clients') || [];
    const installations = store.get('installations') || [];
    
    // Preparar datos para subir
    const dataToUpload = { clients, installations };
    
    // Subir datos a Azure
    const uploadResult = await azureSync.uploadData(dataToUpload, 'system', 'app-device');
    
    if (!uploadResult.success) {
      sendNotification(mainWindow, 'sync-status-changed', { 
        status: 'error',
        message: uploadResult.message
      });
      
      return uploadResult;
    }
    
    // Actualizar timestamp de última sincronización
    azureConfig.updateLastSyncTime(uploadResult.timestamp);
    
    sendNotification(mainWindow, 'sync-completed', {
      success: true,
      stats: { uploaded: 1 },
      timestamp: uploadResult.timestamp
    });
    
    sendNotification(mainWindow, 'sync-status-changed', { 
      status: 'completed',
      message: 'Subida completada'
    });
    
    return {
      success: true,
      message: 'Subida de datos completada correctamente',
      timestamp: uploadResult.timestamp
    };
    
  } catch (error) {
    console.error('Error en subida forzada:', error);
    
    sendNotification(mainWindow, 'sync-status-changed', { 
      status: 'error',
      message: `Error: ${error.message}`
    });
    
    return { 
      success: false, 
      message: `Error en subida forzada: ${error.message}` 
    };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Activa/desactiva la sincronización automática
 * @param {boolean} enabled - Estado deseado
 * @param {Store} store - Instancia del almacenamiento local
 * @param {BrowserWindow} mainWindow - Ventana principal para notificaciones
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function setAutoSync(enabled, store, mainWindow) {
  try {
    // Actualizar configuración
    const config = azureConfig.initAzureConfig();
    config.autoSyncEnabled = enabled;
    azureConfig.updateAzureConfig(config);
    
    // Reiniciar sincronización si es necesario
    restartAutoSync(store, mainWindow, config);
    
    return { 
      success: true,
      message: `Sincronización automática ${enabled ? 'activada' : 'desactivada'}`
    };
  } catch (error) {
    console.error('Error al configurar sincronización automática:', error);
    return { 
      success: false, 
      message: `Error: ${error.message}` 
    };
  }
}

/**
 * Comprueba la conexión con Azure
 * @returns {Promise<Object>} - Estado de la conexión
 */
async function checkConnection() {
  try {
    const isConnected = !azureSync.isOfflineMode();
    
    if (isConnected) {
      return {
        success: true,
        message: 'Conexión establecida con Azure'
      };
    } else {
      return {
        success: false,
        message: 'Sin conexión a Azure'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error al verificar conexión: ${error.message}`
    };
  }
}

/**
 * Detiene la sincronización automática
 */
function stopAutoSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  console.log('Sincronización automática detenida');
}

module.exports = {
  setupSync,
  synchronize,
  getSyncStatus,
  forceDownload,
  forceUpload,
  setAutoSync,
  restartAutoSync,
  checkConnection,
  stopAutoSync
};