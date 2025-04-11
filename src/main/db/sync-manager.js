const { ipcMain } = require('electron');
const { 
  setupStore, 
  recordChange, 
  getLastSyncTime, 
  setLastSyncTime 
} = require('./store');
const { getAuthToken } = require('../azure/auth');
const azureSync = require('../azure/sync');
const azureConfig = require('../azure/config');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Control de estado de sincronización
let syncInProgress = false;
let syncInterval = null;
let deviceId = null;

/**
 * Configura el gestor de sincronización
 * @param {BrowserWindow} mainWindow - Ventana principal de la aplicación
 */
function setupSyncManager(mainWindow) {
  // Inicializar identificador único para este dispositivo
  initDeviceId();
  
  // Inicializar configuración de Azure
  initAzureConfig();
  
  // Manejadores IPC para sincronización
  setupSyncHandlers(mainWindow);
  
  // Configurar sincronización automática periódica
  setupAutoSync(mainWindow);
  
  // Escuchar eventos de conexión para sincronizar cuando se restablezca la conexión
  setupConnectivityListeners(mainWindow);
}

/**
 * Inicializa el ID de dispositivo
 */
function initDeviceId() {
  try {
    const store = setupStore();
    deviceId = store.get('deviceId');
    
    // Si no existe, crear un nuevo ID de dispositivo
    if (!deviceId) {
      deviceId = generateDeviceId();
      store.set('deviceId', deviceId);
    }
    
    console.log('ID de dispositivo:', deviceId);
  } catch (error) {
    console.error('Error al inicializar ID de dispositivo:', error);
    // Usar un ID aleatorio si hay error
    deviceId = `device-${uuidv4()}`;
  }
}

/**
 * Genera un ID de dispositivo único
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
    // En caso de error, generar un ID aleatorio
    return `device-${uuidv4()}`;
  }
}

/**
 * Inicializa la configuración de Azure
 */
function initAzureConfig() {
  try {
    // Cargar configuración
    const config = azureConfig.initAzureConfig();
    
    // Configurar el módulo de sincronización
    azureSync.setAzureConfig({
      connectionString: config.connectionString,
      containerName: config.containerName,
      tableName: config.tableName,
      maxRetries: config.maxRetries || 3
    });
    
    console.log('Configuración de Azure inicializada');
    
    return config;
  } catch (error) {
    console.error('Error al inicializar configuración de Azure:', error);
    return null;
  }
}

/**
 * Configura los manejadores IPC para la sincronización
 * @param {BrowserWindow} mainWindow - Ventana principal de la aplicación
 */
function setupSyncHandlers(mainWindow) {
  // Sincronizar datos
  ipcMain.handle('sync-data', async () => {
    return await synchronize(mainWindow);
  });
  
  // Obtener estado de sincronización
  ipcMain.handle('get-sync-status', () => {
    const store = setupStore();
    const pendingChanges = store.get('pendingChanges') || [];
    
    return {
      lastSync: azureConfig.getLastSyncTime() || getLastSyncTime(),
      pendingChanges: pendingChanges.length,
      syncInProgress,
      deviceId
    };
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
      if (syncInterval) {
        clearInterval(syncInterval);
      }
      
      if (updatedConfig.autoSyncEnabled) {
        const intervalMs = Math.max(5, updatedConfig.syncIntervalMinutes || 10) * 60 * 1000;
        syncInterval = setInterval(() => {
          if (!syncInProgress) {
            synchronize(mainWindow)
              .catch(error => {
                console.error('Error en sincronización automática:', error);
              });
          }
        }, intervalMs);
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
      // Intentar descargar algún dato para verificar
      const config = azureConfig.initAzureConfig();
      
      if (!config.connectionString) {
        return {
          success: false,
          message: 'No hay configuración de conexión. Configure la cadena de conexión de Azure.'
        };
      }
      
      // Actualizar configuración en el módulo de sincronización
      azureSync.setAzureConfig({
        connectionString: config.connectionString,
        containerName: config.containerName,
        tableName: config.tableName,
        maxRetries: config.maxRetries || 3
      });
      
      // Intentar subir un pequeño objeto para verificar la conexión
      const testResult = await azureSync.logSyncEvent(
        'system',
        deviceId,
        'connection-test',
        { timestamp: new Date().toISOString() }
      );
      
      if (testResult.success) {
        return {
          success: true,
          message: 'Conexión exitosa con Azure Storage'
        };
      } else {
        return {
          success: false,
          message: testResult.message || 'Error de conexión no especificado'
        };
      }
    } catch (error) {
      console.error('Error al verificar conexión con Azure:', error);
      
      // Determinar si es un error de autenticación
      const isAuthError = error.message && (
        error.message.includes('AuthenticationFailed') ||
        error.message.includes('authentication') ||
        error.message.toLowerCase().includes('signature')
      );
      
      return {
        success: false,
        message: isAuthError ? 
          'Error de autenticación. Verifique que la cadena de conexión sea correcta.' : 
          `Error al verificar conexión: ${error.message}`,
        isAuthError,
        error: error.message
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
      
      // Obtener el usuario actual
      const authStatus = await getAuthToken();
      if (!authStatus) {
        return { 
          success: false, 
          message: 'No hay sesión activa. Inicie sesión para sincronizar.' 
        };
      }
      
      const userId = 'system'; // En una implementación real, usar el ID del usuario
      
      // Descargar datos
      const downloadResult = await azureSync.downloadLatestData(userId);
      
      if (!downloadResult.success) {
        if (mainWindow) {
          mainWindow.webContents.send('sync-status-changed', { 
            status: 'error',
            message: downloadResult.message
          });
        }
        
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
      const store = setupStore();
      const { clients, installations } = downloadResult.data;
      
      if (Array.isArray(clients)) {
        store.set('clients', clients);
      }
      
      if (Array.isArray(installations)) {
        store.set('installations', installations);
      }
      
      // Actualizar timestamp de última sincronización
      azureConfig.updateLastSyncTime(downloadResult.timestamp);
      
      // Limpiar cambios pendientes, ya que acabamos de reemplazar todo
      store.set('pendingChanges', []);
      
      if (mainWindow) {
        mainWindow.webContents.send('database-imported');
        mainWindow.webContents.send('sync-completed', {
          success: true,
          stats: { downloaded: 1 },
          timestamp: downloadResult.timestamp
        });
        
        mainWindow.webContents.send('sync-status-changed', { 
          status: 'completed',
          message: 'Descarga completada'
        });
      }
      
      return {
        success: true,
        message: 'Descarga de datos completada correctamente',
        timestamp: downloadResult.timestamp
      };
      
    } catch (error) {
      console.error('Error en descarga forzada:', error);
      
      if (mainWindow) {
        mainWindow.webContents.send('sync-status-changed', { 
          status: 'error',
          message: `Error: ${error.message}`
        });
      }
      
      return { 
        success: false, 
        message: `Error en descarga forzada: ${error.message}` 
      };
    } finally {
      syncInProgress = false;
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
      
      // Obtener el usuario actual
      const authStatus = await getAuthToken();
      if (!authStatus) {
        return { 
          success: false, 
          message: 'No hay sesión activa. Inicie sesión para sincronizar.' 
        };
      }
      
      const userId = 'system'; // En una implementación real, usar el ID del usuario
      
      // Obtener datos actuales
      const store = setupStore();
      const clients = store.get('clients') || [];
      const installations = store.get('installations') || [];
      
      // Preparar datos para subir
      const dataToUpload = { clients, installations };
      
      // Subir datos a Azure
      const uploadResult = await azureSync.uploadData(dataToUpload, userId, deviceId);
      
      if (!uploadResult.success) {
        if (mainWindow) {
          mainWindow.webContents.send('sync-status-changed', { 
            status: 'error',
            message: uploadResult.message
          });
        }
        
        return uploadResult;
      }
      
      // Actualizar timestamp de última sincronización
      azureConfig.updateLastSyncTime(uploadResult.timestamp);
      
      // Limpiar cambios pendientes, ya que acabamos de subir todo
      store.set('pendingChanges', []);
      
      if (mainWindow) {
        mainWindow.webContents.send('sync-completed', {
          success: true,
          stats: { uploaded: 1 },
          timestamp: uploadResult.timestamp
        });
        
        mainWindow.webContents.send('sync-status-changed', { 
          status: 'completed',
          message: 'Subida completada'
        });
      }
      
      return {
        success: true,
        message: 'Subida de datos completada correctamente',
        timestamp: uploadResult.timestamp
      };
      
    } catch (error) {
      console.error('Error en subida forzada:', error);
      
      if (mainWindow) {
        mainWindow.webContents.send('sync-status-changed', { 
          status: 'error',
          message: `Error: ${error.message}`
        });
      }
      
      return { 
        success: false, 
        message: `Error en subida forzada: ${error.message}` 
      };
    } finally {
      syncInProgress = false;
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
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
      
      if (enabled) {
        setupAutoSync(mainWindow);
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
      
      // Limpiar cambios pendientes
      const store = setupStore();
      store.set('pendingChanges', []);
      
      return { success: true };
    } catch (error) {
      console.error('Error al restablecer estado de sincronización:', error);
      return { 
        success: false, 
        message: `Error: ${error.message}` 
      };
    }
  });
}

/**
 * Configura la sincronización automática
 * @param {BrowserWindow} mainWindow - Ventana principal de la aplicación
 */
function setupAutoSync(mainWindow) {
  // Limpiar intervalo existente si hay
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  
  // Obtener configuración
  const config = azureConfig.initAzureConfig();
  
  // Si la sincronización automática está habilitada, configurar intervalo
  if (config.autoSyncEnabled) {
    // Intervalo mínimo: 5 minutos
    const intervalMs = Math.max(5, config.syncIntervalMinutes || 10) * 60 * 1000;
    
    syncInterval = setInterval(() => {
      if (!syncInProgress) {
        synchronize(mainWindow)
          .catch(error => {
            console.error('Error en sincronización automática:', error);
          });
      }
    }, intervalMs);
    
    console.log(`Sincronización automática configurada cada ${config.syncIntervalMinutes || 10} minutos`);
  }
}

/**
 * Configura los listeners de conectividad
 * @param {BrowserWindow} mainWindow - Ventana principal de la aplicación
 */
function setupConnectivityListeners(mainWindow) {
  if (mainWindow) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.executeJavaScript(`
        window.addEventListener('online', () => {
          console.log('Conexión a Internet restablecida');
          window.api.syncData();
        });
      `);
    });
  }
}

/**
 * Realiza la sincronización con Azure
 * @param {BrowserWindow} mainWindow - Ventana principal de la aplicación
 * @returns {Promise<Object>} - Resultado de la sincronización
 */
async function synchronize(mainWindow) {
  if (syncInProgress) {
    return { 
      success: false, 
      message: 'Sincronización en progreso' 
    };
  }
  
  try {
    syncInProgress = true;
    
    // Notificar inicio de sincronización
    if (mainWindow) {
      mainWindow.webContents.send('sync-status-changed', { 
        status: 'in-progress',
        message: 'Sincronización en progreso...'
      });
    }
    
    const store = setupStore();
    
    // Verificar si hay una configuración válida
    if (!azureSync.isConfigValid()) {
      return { 
        success: false, 
        message: 'La configuración de Azure no es válida. Configure la sincronización en la sección de Azure.' 
      };
    }
    
    // Obtener datos actuales
    const clients = store.get('clients') || [];
    const installations = store.get('installations') || [];
    
    // Obtener ID de usuario (en una implementación real, usar el ID real)
    const userId = 'system';
    
    // Preparar datos locales
    const localData = {
      clients,
      installations,
      lastUpdated: new Date().toISOString()
    };
    
    // Realizar sincronización
    const syncResult = await azureSync.synchronize(localData, userId, deviceId);
    
    // Manejar resultado
    if (syncResult.success) {
      // Si estamos en modo offline, no actualizamos nada
      if (syncResult.offline) {
        if (mainWindow) {
          mainWindow.webContents.send('sync-status-changed', { 
            status: 'offline',
            message: 'Trabajando en modo offline. Los cambios se sincronizarán cuando haya conexión.'
          });
        }
        
        return {
          success: true,
          offline: true,
          message: 'Trabajando en modo offline'
        };
      }
      
      // Actualizar datos locales si es necesario
      if (syncResult.data) {
        // Actualizar clientes si hay cambios
        if (syncResult.data.clients && 
            JSON.stringify(syncResult.data.clients) !== JSON.stringify(clients)) {
          store.set('clients', syncResult.data.clients);
        }
        
        // Actualizar instalaciones si hay cambios
        if (syncResult.data.installations && 
            JSON.stringify(syncResult.data.installations) !== JSON.stringify(installations)) {
          store.set('installations', syncResult.data.installations);
        }
        
        // Notificar a la interfaz si hubo cambios
        if (mainWindow && 
            (JSON.stringify(syncResult.data.clients) !== JSON.stringify(clients) ||
             JSON.stringify(syncResult.data.installations) !== JSON.stringify(installations))) {
          mainWindow.webContents.send('database-imported');
        }
      }
      
      // Actualizar timestamp de última sincronización
      azureConfig.updateLastSyncTime(syncResult.timestamp);
      
      // Limpiar cambios pendientes, ya que se han sincronizado
      store.set('pendingChanges', []);
      
      // Notificar sincronización completada
      if (mainWindow) {
        mainWindow.webContents.send('sync-completed', {
          success: true,
          timestamp: syncResult.timestamp
        });
        
        mainWindow.webContents.send('sync-status-changed', { 
          status: 'completed',
          message: 'Sincronización completada'
        });
      }
      
      return { 
        success: true, 
        message: 'Sincronización completada correctamente',
        timestamp: syncResult.timestamp
      };
    } else {
      // Notificar error
      if (mainWindow) {
        mainWindow.webContents.send('sync-status-changed', { 
          status: 'error',
          message: syncResult.message
        });
      }
      
      return { 
        success: false, 
        message: syncResult.message
      };
    }
  } catch (error) {
    console.error('Error en sincronización:', error);
    
    // Notificar error
    if (mainWindow) {
      mainWindow.webContents.send('sync-status-changed', { 
        status: 'error',
        message: `Error: ${error.message}`
      });
    }
    
    return { 
      success: false, 
      message: error.message 
    };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Detiene el gestor de sincronización
 */
function stopSyncManager() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

module.exports = {
  setupSyncManager,
  synchronize,
  stopSyncManager
};