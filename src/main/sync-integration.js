const { ipcMain, app, dialog } = require('electron');
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
    
    // Configurar manejadores IPC para sincronización
    setupSyncHandlers(store, mainWindow);
    
    // Iniciar sincronización automática si está habilitada
    if (config.autoSyncEnabled) {
      startAutoSync(store, mainWindow, config.syncIntervalMinutes);
    }
    
    console.log('Sistema de sincronización inicializado correctamente');
  } catch (error) {
    console.error('Error al configurar sincronización:', error);
  }
}

/**
 * Configura los manejadores IPC para sincronización
 * @param {Store} store - Instancia del almacenamiento local
 * @param {BrowserWindow} mainWindow - Ventana principal para notificaciones
 */
function setupSyncHandlers(store, mainWindow) {
  // Manejar solicitud de sincronización manual
  ipcMain.handle('sync-data', async () => {
    try {
      return await synchronize(store, mainWindow);
    } catch (error) {
      console.error('Error en sincronización manual:', error);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  });
  
  // Manejar solicitud de estado de sincronización
  ipcMain.handle('get-sync-status', () => {
    return getSyncStatus(store);
  });
  
  // Obtener configuración de Azure
  ipcMain.handle('get-azure-config', () => {
    return azureConfig.initAzureConfig();
  });
  
  // Actualizar configuración de Azure
  ipcMain.handle('update-azure-config', async (event, newConfig) => {
    try {
      // Actualizar configuración
      const updatedConfig = azureConfig.updateAzureConfig(newConfig);
      
      // Actualizar configuración en el módulo de sincronización
      azureSync.setAzureConfig({
        connectionString: updatedConfig.connectionString,
        containerName: updatedConfig.containerName,
        tableName: updatedConfig.tableName,
        maxRetries: updatedConfig.maxRetries || 3
      });
      
      // Actualizar intervalo de sincronización si cambió
      if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
      }
      
      if (updatedConfig.autoSyncEnabled) {
        startAutoSync(store, mainWindow, updatedConfig.syncIntervalMinutes);
      }
      
      return { success: true, config: updatedConfig };
    } catch (error) {
      console.error('Error al actualizar configuración de Azure:', error);
      return { 
        success: false, 
        message: `Error al actualizar configuración: ${error.message}` 
      };
    }
  });
  
  // Verificar conexión con Azure
  ipcMain.handle('check-azure-connection', async () => {
    try {
      // Configuración actual
      const config = azureConfig.initAzureConfig();
      
      if (!config.connectionString) {
        return {
          success: false,
          message: 'No hay configuración de conexión. Configure la cadena de conexión de Azure.'
        };
      }
      
      // Comprobar si está en línea
      if (!azureSync.isConfigValid()) {
        return {
          success: false,
          message: 'Configuración de Azure no válida'
        };
      }
      
      // Intentamos una operación simple
      try {
        await azureSync.logSyncEvent('system', 'test-device', 'connection-test', {});
        return {
          success: true,
          message: 'Conexión exitosa con Azure Storage'
        };
      } catch (error) {
        return {
          success: false,
          message: `Error de conexión: ${error.message}`
        };
      }
    } catch (error) {
      console.error('Error al verificar conexión con Azure:', error);
      return {
        success: false,
        message: `Error al verificar conexión: ${error.message}`
      };
    }
  });
  
  // Forzar descarga desde Azure
  ipcMain.handle('force-download-from-azure', async () => {
    try {
      if (syncInProgress) {
        return { 
          success: false, 
          message: 'Hay una sincronización en progreso. Espere a que termine.' 
        };
      }
      
      syncInProgress = true;
      
      if (mainWindow) {
        mainWindow.webContents.send('sync-status-changed', { 
          status: 'downloading',
          message: 'Descargando datos de Azure...'
        });
      }
      
      try {
        // Descargar datos simplificados 
        const result = await azureSync.downloadLatestData('system');
        
        if (result.success && result.data) {
          // Guardar datos descargados
          if (result.data.clients) {
            store.set('clients', result.data.clients);
          }
          
          if (result.data.installations) {
            store.set('installations', result.data.installations);
          }
          
          // Actualizar timestamp de última sincronización
          azureConfig.updateLastSyncTime(new Date().toISOString());
          
          if (mainWindow) {
            mainWindow.webContents.send('database-imported');
          }
          
          return {
            success: true,
            message: 'Descarga completada correctamente'
          };
        } else {
          return {
            success: false,
            message: result.message || 'No hay datos disponibles para descargar'
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `Error al descargar datos: ${error.message}`
        };
      } finally {
        syncInProgress = false;
        
        if (mainWindow) {
          mainWindow.webContents.send('sync-status-changed', { 
            status: 'completed',
            message: 'Descarga completada'
          });
        }
      }
    } catch (error) {
      console.error('Error en descarga forzada:', error);
      syncInProgress = false;
      
      return { 
        success: false, 
        message: `Error en descarga forzada: ${error.message}` 
      };
    }
  });
  
  // Forzar subida a Azure
  ipcMain.handle('force-upload-to-azure', async () => {
    try {
      if (syncInProgress) {
        return { 
          success: false, 
          message: 'Hay una sincronización en progreso. Espere a que termine.' 
        };
      }
      
      syncInProgress = true;
      
      if (mainWindow) {
        mainWindow.webContents.send('sync-status-changed', { 
          status: 'uploading',
          message: 'Subiendo datos a Azure...'
        });
      }
      
      try {
        // Obtener datos actuales
        const clients = store.get('clients') || [];
        const installations = store.get('installations') || [];
        
        // Preparar datos para subir
        const dataToUpload = { clients, installations };
        
        // Subir datos a Azure
        const result = await azureSync.uploadData(dataToUpload, 'system', 'app-device');
        
        if (result.success) {
          // Actualizar timestamp de última sincronización
          azureConfig.updateLastSyncTime(new Date().toISOString());
          
          return {
            success: true,
            message: 'Subida completada correctamente'
          };
        } else {
          return {
            success: false,
            message: result.message || 'Error al subir datos'
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `Error al subir datos: ${error.message}`
        };
      } finally {
        syncInProgress = false;
        
        if (mainWindow) {
          mainWindow.webContents.send('sync-status-changed', { 
            status: 'completed',
            message: 'Subida completada'
          });
        }
      }
    } catch (error) {
      console.error('Error en subida forzada:', error);
      syncInProgress = false;
      
      return { 
        success: false, 
        message: `Error en subida forzada: ${error.message}` 
      };
    }
  });
  
  // Activar/desactivar sincronización automática
  ipcMain.handle('set-auto-sync', async (event, enabled) => {
    try {
      // Actualizar configuración
      const config = azureConfig.initAzureConfig();
      config.autoSyncEnabled = enabled;
      azureConfig.updateAzureConfig(config);
      
      // Actualizar el intervalo de sincronización
      if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
      }
      
      if (enabled) {
        startAutoSync(store, mainWindow, config.syncIntervalMinutes);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error al cambiar configuración de sincronización automática:', error);
      return { 
        success: false, 
        message: `Error: ${error.message}` 
      };
    }
  });
  
  // Restablecer estado de sincronización
  ipcMain.handle('reset-sync-state', async () => {
    try {
      // Restablecer timestamp de última sincronización
      azureConfig.updateLastSyncTime(null);
      
      return { success: true };
    } catch (error) {
      console.error('Error al restablecer estado de sincronización:', error);
      return { 
        success: false, 
        message: `Error: ${error.message}` 
      };
    }
  });
  
  // Exportar base de datos
  ipcMain.handle('export-database', async () => {
    try {
      // Obtener ruta para guardar
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Exportar base de datos',
        defaultPath: path.join(app.getPath('documents'), 'servitecgas-backup.json'),
        filters: [
          { name: 'Archivos JSON', extensions: ['json'] }
        ]
      });
      
      if (canceled || !filePath) {
        return { success: false, message: 'Operación cancelada por el usuario' };
      }
      
      // Obtener datos para el respaldo
      const clients = store.get('clients') || [];
      const installations = store.get('installations') || [];
      
      // Crear objeto de respaldo
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          clients,
          installations
        }
      };
      
      // Guardar archivo
      fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
      
      return {
        success: true,
        message: 'Base de datos exportada correctamente',
        filePath
      };
    } catch (error) {
      console.error('Error al exportar base de datos:', error);
      return {
        success: false,
        message: `Error al exportar base de datos: ${error.message}`
      };
    }
  });
  
  // Importar base de datos
  ipcMain.handle('import-database', async () => {
    try {
      // Mostrar diálogo para seleccionar archivo
      const { filePaths, canceled } = await dialog.showOpenDialog({
        title: 'Importar base de datos',
        properties: ['openFile'],
        filters: [
          { name: 'Archivos JSON', extensions: ['json'] }
        ]
      });
      
      if (canceled || filePaths.length === 0) {
        return { success: false, message: 'Operación cancelada por el usuario' };
      }
      
      // Leer archivo
      const fileContent = fs.readFileSync(filePaths[0], 'utf8');
      const backupData = JSON.parse(fileContent);
      
      // Verificar estructura
      if (!backupData.data || !backupData.data.clients || !backupData.data.installations) {
        return { success: false, message: 'El archivo no tiene un formato válido' };
      }
      
      // Importar datos
      store.set('clients', backupData.data.clients);
      store.set('installations', backupData.data.installations);
      
      // Notificar a la interfaz
      if (mainWindow) {
        mainWindow.webContents.send('database-imported');
      }
      
      return {
        success: true,
        message: 'Base de datos importada correctamente',
        stats: {
          clients: backupData.data.clients.length,
          installations: backupData.data.installations.length
        }
      };
    } catch (error) {
      console.error('Error al importar base de datos:', error);
      return {
        success: false,
        message: `Error al importar base de datos: ${error.message}`
      };
    }
  });
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
    if (mainWindow) {
      mainWindow.webContents.send('sync-status-changed', { 
        status: 'in-progress',
        message: 'Sincronización en progreso...'
      });
    }
    
    // Configuración válida
    if (!azureSync.isConfigValid()) {
      syncInProgress = false;
      
      if (mainWindow) {
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
          if (dataChanged && mainWindow) {
            mainWindow.webContents.send('database-imported');
          }
        }
        
        // Actualizar timestamp de última sincronización
        azureConfig.updateLastSyncTime(new Date().toISOString());
        
        if (mainWindow) {
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
        if (mainWindow) {
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
      if (mainWindow) {
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