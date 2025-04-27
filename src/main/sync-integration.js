const { ipcMain } = require('electron');
const azureSync = require('./azure/sync');
const azureConfig = require('./azure/config');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Intervalo para sincronización automática (10 minutos)
const SYNC_INTERVAL = 10 * 60 * 1000;

// Variable para almacenar el temporizador de sincronización
let syncTimer = null;
let syncInProgress = false;

/**
 * Configura la integración de sincronización
 * @param {Store} store - Instancia del almacenamiento local
 * @param {BrowserWindow} mainWindow - Ventana principal para notificaciones
 * @param {Set} registeredHandlers - Conjunto de manejadores IPC ya registrados
 */
async function setupSync(store, mainWindow, registeredHandlers = new Set()) {
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
    return registeredHandlers;
  } catch (error) {
    console.error('Error al configurar sincronización:', error);
    return registeredHandlers;
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync-status-changed', { 
        status: 'in-progress',
        message: 'Sincronización en progreso...'
      });
    }
    
    // Configuración válida
    if (!azureSync.isConfigValid()) {
      syncInProgress = false;
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync-status-changed', { 
          status: 'error',
          message: 'Configuración de Azure no válida'
        });
      }
      
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
          if (dataChanged && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('database-imported');
          }
        }
        
        // Actualizar timestamp de última sincronización
        azureConfig.updateLastSyncTime(new Date().toISOString());
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sync-status-changed', { 
            status: 'completed',
            message: 'Sincronización completada'
          });
          
          mainWindow.webContents.send('sync-completed', {
            success: true,
            timestamp: new Date().toISOString()
          });
        }
        
        return {
          success: true,
          message: result.offline ? 
            'Trabajando en modo offline. Los cambios se sincronizarán más tarde.' : 
            'Sincronización completada correctamente'
        };
      } else {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sync-status-changed', { 
            status: 'error',
            message: result.message || 'Error en sincronización'
          });
        }
        
        return {
          success: false,
          message: result.message || 'Error en sincronización'
        };
      }
    } catch (error) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync-status-changed', { 
          status: 'error',
          message: `Error: ${error.message}`
        });
      }
      
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
  stopAutoSync
};