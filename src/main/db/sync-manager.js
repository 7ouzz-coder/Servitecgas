const { ipcMain } = require('electron');
const { 
  setupStore, 
  recordChange, 
  getLastSyncTime, 
  setLastSyncTime 
} = require('./store');
const { getAuthToken } = require('../azure/auth');
const apiClient = require('../azure/api');

// Control de estado de sincronización
let syncInProgress = false;
let syncInterval = null;

/**
 * Configura el gestor de sincronización
 * @param {BrowserWindow} mainWindow - Ventana principal de la aplicación
 */
function setupSyncManager(mainWindow) {
  // Manejadores IPC para sincronización
  ipcMain.handle('sync-data', async () => {
    return await synchronize(mainWindow);
  });
  
  ipcMain.handle('get-sync-status', () => {
    const store = setupStore();
    const pendingChanges = store.get('pendingChanges') || [];
    return {
      lastSync: getLastSyncTime(),
      pendingChanges: pendingChanges.length,
      syncInProgress
    };
  });
  
  // Configurar sincronización automática periódica (cada 10 minutos)
  syncInterval = setInterval(() => {
    if (!syncInProgress) {
      synchronize(mainWindow)
        .catch(error => {
          console.error('Error en sincronización automática:', error);
        });
    }
  }, 10 * 60 * 1000);
  
  // Escuchar eventos de conexión para sincronizar cuando se restablezca la conexión
  if (mainWindow) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.executeJavaScript(`
        window.addEventListener('online', () => {
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
    const token = await getAuthToken();
    
    if (!token) {
      return { 
        success: false, 
        message: 'No autenticado. Inicie sesión para sincronizar.' 
      };
    }
    
    // 1. Obtener cambios pendientes
    const pendingChanges = store.get('pendingChanges') || [];
    
    // 2. Si hay cambios pendientes, enviarlos al servidor
    let syncResults = { sent: 0, received: 0, conflicts: 0 };
    
    if (pendingChanges.length > 0) {
      if (mainWindow) {
        mainWindow.webContents.send('sync-status-changed', { 
          status: 'sending-changes',
          message: `Enviando ${pendingChanges.length} cambios...`
        });
      }
      
      // Enviar cambios al servidor
      const result = await apiClient.syncChanges(token, pendingChanges);
      syncResults.sent = result.processedCount || 0;
      syncResults.conflicts = result.conflicts?.length || 0;
      
      // Manejar conflictos si los hay
      if (result.conflicts && result.conflicts.length > 0) {
        handleConflicts(result.conflicts);
      }
      
      // Limpiar cambios enviados exitosamente
      const remainingChanges = handleSyncResponse(pendingChanges, result);
      store.set('pendingChanges', remainingChanges);
    }
    
    // 3. Obtener cambios del servidor desde la última sincronización
    const lastSync = getLastSyncTime();
    
    if (mainWindow) {
      mainWindow.webContents.send('sync-status-changed', { 
        status: 'receiving-changes',
        message: 'Obteniendo cambios del servidor...'
      });
    }
    
    const serverChanges = await apiClient.getChanges(token, lastSync);
    syncResults.received = serverChanges.length;
    
    // 4. Aplicar cambios del servidor localmente
    if (serverChanges.length > 0) {
      applyServerChanges(serverChanges);
    }
    
    // 5. Actualizar timestamp de última sincronización
    setLastSyncTime(new Date().toISOString());
    
    // 6. Notificar sincronización completada
    if (mainWindow) {
      mainWindow.webContents.send('sync-completed', {
        success: true,
        stats: syncResults,
        timestamp: new Date().toISOString()
      });
      
      mainWindow.webContents.send('sync-status-changed', { 
        status: 'completed',
        message: 'Sincronización completada'
      });
    }
    
    return { 
      success: true, 
      message: 'Sincronización completada',
      stats: syncResults
    };
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
 * Maneja la respuesta de sincronización para determinar qué cambios quedan pendientes
 * @param {Array} pendingChanges - Cambios pendientes enviados
 * @param {Object} syncResponse - Respuesta del servidor
 * @returns {Array} - Cambios que siguen pendientes
 */
function handleSyncResponse(pendingChanges, syncResponse) {
  const store = setupStore();
  
  // Si no hay información específica sobre éxitos/fallos, asumimos que todos fueron procesados
  if (!syncResponse.succeeded && !syncResponse.failed) {
    return [];
  }
  
  // Filtrar los cambios que fallaron
  return pendingChanges.filter(change => {
    const changeId = `${change.entityType}-${change.entityId}-${change.operation}`;
    return syncResponse.failed && syncResponse.failed.includes(changeId);
  });
}

/**
 * Maneja conflictos de sincronización
 * @param {Array} conflicts - Conflictos reportados por el servidor
 */
function handleConflicts(conflicts) {
  const store = setupStore();
  
  conflicts.forEach(conflict => {
    // En este ejemplo, aplicamos una estrategia simple: la versión del servidor gana
    // En una implementación real, podrías notificar al usuario y permitirle decidir
    
    const { entityType, entityId, serverData } = conflict;
    
    // Actualizar los datos locales con la versión del servidor
    if (entityType === 'client') {
      const clients = store.get('clients') || [];
      const index = clients.findIndex(c => c.id === entityId);
      
      if (index !== -1) {
        clients[index] = serverData;
        store.set('clients', clients);
      }
    } else if (entityType === 'installation') {
      const installations = store.get('installations') || [];
      const index = installations.findIndex(i => i.id === entityId);
      
      if (index !== -1) {
        installations[index] = serverData;
        store.set('installations', installations);
      }
    }
    
    // Registrar el conflicto para posible revisión
    const conflictsLog = store.get('syncConflicts') || [];
    conflictsLog.push({
      ...conflict,
      timestamp: new Date().toISOString(),
      resolution: 'server-wins'
    });
    
    store.set('syncConflicts', conflictsLog);
  });
}

/**
 * Aplica los cambios recibidos del servidor a la base de datos local
 * @param {Array} changes - Cambios recibidos del servidor
 */
function applyServerChanges(changes) {
  const store = setupStore();
  
  // Procesamos los cambios por tipo y operación
  changes.forEach(change => {
    const { entityType, operation, entityId, data } = change;
    
    switch (entityType) {
      case 'client':
        applyClientChange(operation, entityId, data);
        break;
      case 'installation':
        applyInstallationChange(operation, entityId, data);
        break;
      default:
        console.warn(`Tipo de entidad desconocido en cambio del servidor: ${entityType}`);
    }
  });
}

/**
 * Aplica un cambio a un cliente
 * @param {string} operation - Operación ('create', 'update', 'delete')
 * @param {string} clientId - ID del cliente
 * @param {Object} data - Datos del cliente
 */
function applyClientChange(operation, clientId, data) {
  const store = setupStore();
  const clients = store.get('clients') || [];
  
  switch (operation) {
    case 'create':
    case 'update':
      const existingIndex = clients.findIndex(c => c.id === clientId);
      
      if (existingIndex !== -1) {
        // Actualizar cliente existente
        clients[existingIndex] = { ...data, syncStatus: 'synced' };
      } else {
        // Añadir nuevo cliente
        clients.push({ ...data, syncStatus: 'synced' });
      }
      break;
    
    case 'delete':
      // Eliminar cliente
      const newClients = clients.filter(c => c.id !== clientId);
      store.set('clients', newClients);
      
      // También eliminar sus instalaciones
      const installations = store.get('installations') || [];
      const newInstallations = installations.filter(i => i.clientId !== clientId);
      store.set('installations', newInstallations);
      return;
  }
  
  store.set('clients', clients);
}

/**
 * Aplica un cambio a una instalación
 * @param {string} operation - Operación ('create', 'update', 'delete')
 * @param {string} installationId - ID de la instalación
 * @param {Object} data - Datos de la instalación
 */
function applyInstallationChange(operation, installationId, data) {
  const store = setupStore();
  const installations = store.get('installations') || [];
  
  switch (operation) {
    case 'create':
    case 'update':
      const existingIndex = installations.findIndex(i => i.id === installationId);
      
      if (existingIndex !== -1) {
        // Actualizar instalación existente
        installations[existingIndex] = { ...data, syncStatus: 'synced' };
      } else {
        // Añadir nueva instalación
        installations.push({ ...data, syncStatus: 'synced' });
      }
      break;
    
    case 'delete':
      // Eliminar instalación
      const newInstallations = installations.filter(i => i.id !== installationId);
      store.set('installations', newInstallations);
      return;
  }
  
  store.set('installations', installations);
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