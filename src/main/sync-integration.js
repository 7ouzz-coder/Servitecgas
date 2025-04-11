const { ipcMain, app, dialog } = require('electron');
const { initializeSync, synchronize, getSyncStatus } = require('./azure/sync');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Intervalo para sincronización automática (10 minutos)
const SYNC_INTERVAL = 10 * 60 * 1000;

// Variable para almacenar el temporizador de sincronización
let syncTimer = null;

/**
 * Configura la integración de sincronización
 * @param {Store} store - Instancia del almacenamiento local
 * @param {BrowserWindow} mainWindow - Ventana principal para notificaciones
 */
async function setupSync(store, mainWindow) {
  try {
    // Inicializar servicio de sincronización
    const initResult = await initializeSync(store);
    console.log('Resultado de inicialización de sincronización:', initResult);
    
    // Configurar manejadores IPC para sincronización
    setupSyncHandlers(store, mainWindow);
    
    // Iniciar sincronización automática
    startAutoSync(store, mainWindow);
    
    // Verificar conexión a internet y sincronizar al iniciar
    setTimeout(async () => {
      const status = getSyncStatus(store);
      if (status.connectionAvailable) {
        try {
          const result = await synchronize(store, mainWindow);
          console.log('Sincronización inicial:', result);
        } catch (error) {
          console.error('Error en sincronización inicial:', error);
        }
      }
    }, 5000); // Esperar 5 segundos después de iniciar
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
  ipcMain.handle('sync-now', async () => {
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
  
  // Manejar solicitud de exportación de respaldo
  ipcMain.handle('export-backup', async () => {
    try {
      const backupPath = process.env.BACKUP_PATH || path.join(app.getPath('userData'), 'backups');
      
      // Crear directorio si no existe
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
      }
      
      // Nombre del archivo de respaldo
      const filename = `servitecgas-backup-${new Date().toISOString().replace(/:/g, '-')}.json`;
      const filePath = path.join(backupPath, filename);
      
      // Obtener datos para el respaldo
      const clients = store.get('clients') || [];
      const installations = store.get('installations') || [];
      
      // Crear objeto de respaldo
      const backupData = {
        clients,
        installations,
        timestamp: new Date().toISOString(),
        appVersion: process.env.APP_VERSION || '1.0.0'
      };
      
      // Guardar archivo
      fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
      
      return {
        success: true,
        message: 'Respaldo creado correctamente',
        filePath
      };
    } catch (error) {
      console.error('Error al crear respaldo:', error);
      return {
        success: false,
        message: `Error al crear respaldo: ${error.message}`
      };
    }
  });
  
  // Manejar solicitud de importación de respaldo
  ipcMain.handle('import-backup', async () => {
    try {
      // Mostrar diálogo para seleccionar archivo
      const { filePaths, canceled } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Archivos JSON', extensions: ['json'] }
        ]
      });
      
      if (canceled || filePaths.length === 0) {
        return {
          success: false,
          message: 'Operación cancelada'
        };
      }
      
      // Leer archivo
      const fileData = fs.readFileSync(filePaths[0], 'utf8');
      const backupData = JSON.parse(fileData);
      
      // Validar datos
      if (!backupData.clients || !backupData.installations) {
        return {
          success: false,
          message: 'Archivo de respaldo inválido'
        };
      }
      
      // Crear respaldo de los datos actuales antes de importar
      const currentBackupPath = path.join(
        process.env.BACKUP_PATH || app.getPath('userData'), 
        'backups',
        `pre-import-backup-${new Date().toISOString().replace(/:/g, '-')}.json`
      );
      
      const currentData = {
        clients: store.get('clients') || [],
        installations: store.get('installations') || [],
        timestamp: new Date().toISOString(),
        note: 'Respaldo automático antes de importación'
      };
      
      fs.writeFileSync(currentBackupPath, JSON.stringify(currentData, null, 2));
      
      // Importar datos del respaldo
      store.set('clients', backupData.clients);
      store.set('installations', backupData.installations);
      
      // Forzar una sincronización para subir los cambios a Azure
      synchronize(store, mainWindow).catch(err => {
        console.error('Error al sincronizar después de importar:', err);
      });
      
      return {
        success: true,
        message: 'Respaldo importado correctamente',
        stats: {
          clients: backupData.clients.length,
          installations: backupData.installations.length
        }
      };
    } catch (error) {
      console.error('Error al importar respaldo:', error);
      return {
        success: false,
        message: `Error al importar respaldo: ${error.message}`
      };
    }
  });
}

/**
 * Inicia la sincronización automática periódica
 * @param {Store} store - Instancia del almacenamiento local
 * @param {BrowserWindow} mainWindow - Ventana principal para notificaciones
 */
function startAutoSync(store, mainWindow) {
  // Detener sincronización existente si hay alguna
  if (syncTimer) {
    clearInterval(syncTimer);
  }
  
  // Configurar sincronización periódica
  syncTimer = setInterval(async () => {
    const status = getSyncStatus(store);
    
    // Solo sincronizar si hay conexión a internet
    if (status.connectionAvailable && !status.inProgress) {
      try {
        await synchronize(store, mainWindow);
      } catch (error) {
        console.error('Error en sincronización automática:', error);
      }
    }
  }, SYNC_INTERVAL);
}

/**
 * Detiene la sincronización automática
 */
function stopAutoSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

module.exports = {
  setupSync,
  stopAutoSync
};