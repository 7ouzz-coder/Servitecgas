// Servicio para respaldos automáticos
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { setupStore } = require('../db/store');

// Intervalo para respaldos automáticos (7 días en milisegundos)
const BACKUP_INTERVAL = 7 * 24 * 60 * 60 * 1000;

// Número máximo de respaldos a mantener
const MAX_BACKUPS = 5;

// Variable para almacenar el temporizador
let backupTimer = null;

/**
 * Inicializa el servicio de respaldos automáticos
 * @param {BrowserWindow} mainWindow - Referencia a la ventana principal
 */
function setupAutomaticBackup(mainWindow) {
  // Crear respaldo inicial después de 5 minutos
  setTimeout(() => {
    createBackup(mainWindow)
      .then(result => {
        console.log('Respaldo inicial creado:', result.path);
      })
      .catch(error => {
        console.error('Error al crear respaldo inicial:', error);
      });
  }, 5 * 60 * 1000);
  
  // Configurar respaldo periódico
  backupTimer = setInterval(() => {
    createBackup(mainWindow)
      .then(result => {
        console.log('Respaldo automático creado:', result.path);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('backup-created', result);
        }
      })
      .catch(error => {
        console.error('Error al crear respaldo automático:', error);
      });
  }, BACKUP_INTERVAL);
}

/**
 * Crea un respaldo de la base de datos
 * @param {BrowserWindow} mainWindow - Referencia a la ventana principal
 * @returns {Promise<Object>} - Información del respaldo
 */
async function createBackup(mainWindow) {
  try {
    // Obtener datos de la base de datos
    const store = setupStore();
    const clients = store.get('clients') || [];
    const installations = store.get('installations') || [];
    const maintenanceHistory = store.get('maintenanceHistory') || [];
    
    // Crear objeto de respaldo
    const backupData = {
      version: app.getVersion(),
      timestamp: new Date().toISOString(),
      data: {
        clients,
        installations,
        maintenanceHistory
      }
    };
    
    // Obtener ruta de respaldos
    const backupDir = getBackupDirectory();
    
    // Crear nombre de archivo con fecha
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupFile = path.join(backupDir, `servitecgas-backup-${dateStr}.json`);
    
    // Guardar respaldo
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
    
    // Limpiar respaldos antiguos
    cleanupOldBackups();
    
    return {
      success: true,
      path: backupFile,
      timestamp: backupData.timestamp,
      size: fs.statSync(backupFile).size,
      entries: {
        clients: clients.length,
        installations: installations.length,
        maintenanceHistory: maintenanceHistory.length
      }
    };
  } catch (error) {
    console.error('Error al crear respaldo:', error);
    throw new Error(`Error al crear respaldo: ${error.message}`);
  }
}

/**
 * Obtiene la ruta del directorio de respaldos
 * @returns {string} - Ruta del directorio
 */
function getBackupDirectory() {
  const backupDir = path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

/**
 * Limpia respaldos antiguos
 */
function cleanupOldBackups() {
  try {
    const backupDir = getBackupDirectory();
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('servitecgas-backup-') && file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        time: fs.statSync(path.join(backupDir, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Más reciente primero
    
    // Eliminar respaldos antiguos
    if (backupFiles.length > MAX_BACKUPS) {
      backupFiles.slice(MAX_BACKUPS).forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`Respaldo antiguo eliminado: ${file.name}`);
      });
    }
  } catch (error) {
    console.error('Error al limpiar respaldos antiguos:', error);
  }
}

/**
 * Obtiene una lista de respaldos disponibles
 * @returns {Promise<Array>} - Lista de respaldos
 */
async function getBackupList() {
  try {
    const backupDir = getBackupDirectory();
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('servitecgas-backup-') && file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        let version = 'Desconocida';
        let timestamp = stats.mtime.toISOString();
        let entries = { clients: 0, installations: 0 };
        
        // Intentar leer metadatos del archivo
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          version = data.version || version;
          timestamp = data.timestamp || timestamp;
          entries = {
            clients: data.data?.clients?.length || 0,
            installations: data.data?.installations?.length || 0
          };
        } catch (error) {
          console.error(`Error al leer metadatos del respaldo ${file}:`, error);
        }
        
        return {
          name: file,
          path: filePath,
          size: stats.size,
          date: stats.mtime,
          version,
          timestamp,
          entries
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime()); // Más reciente primero
    
    return backupFiles;
  } catch (error) {
    console.error('Error al obtener lista de respaldos:', error);
    return [];
  }
}

/**
 * Restaura un respaldo
 * @param {string} backupPath - Ruta al archivo de respaldo
 * @returns {Promise<Object>} - Resultado de la restauración
 */
async function restoreBackup(backupPath) {
  try {
    // Verificar si el archivo existe
    if (!fs.existsSync(backupPath)) {
      throw new Error('El archivo de respaldo no existe');
    }
    
    // Leer archivo de respaldo
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    // Verificar estructura básica
    if (!backupData.data || !backupData.timestamp) {
      throw new Error('El archivo de respaldo tiene un formato inválido');
    }
    
    // Validar datos básicos
    if (!Array.isArray(backupData.data.clients) || !Array.isArray(backupData.data.installations)) {
      throw new Error('Los datos del respaldo están dañados o incompletos');
    }
    
    // Crear respaldo de seguridad de los datos actuales
    await createBackup(null);
    
    // Restaurar datos
    const store = setupStore();
    
    // Restaurar clientes
    if (backupData.data.clients) {
      store.set('clients', backupData.data.clients);
    }
    
    // Restaurar instalaciones
    if (backupData.data.installations) {
      store.set('installations', backupData.data.installations);
    }
    
    // Restaurar historial de mantenimiento
    if (backupData.data.maintenanceHistory) {
      store.set('maintenanceHistory', backupData.data.maintenanceHistory);
    }
    
    return {
      success: true,
      timestamp: backupData.timestamp,
      version: backupData.version,
      stats: {
        clients: backupData.data.clients.length,
        installations: backupData.data.installations.length,
        maintenanceHistory: backupData.data.maintenanceHistory?.length || 0
      }
    };
  } catch (error) {
    console.error('Error al restaurar respaldo:', error);
    throw new Error(`Error al restaurar respaldo: ${error.message}`);
  }
}

/**
 * Detiene el servicio de respaldos automáticos
 */
function stopAutomaticBackup() {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
}

/**
 * Crea un respaldo manual
 * @param {string} customPath - Ruta personalizada (opcional)
 * @returns {Promise<Object>} - Información del respaldo
 */
async function createManualBackup(customPath = null) {
  try {
    // Obtener datos de la base de datos
    const store = setupStore();
    const clients = store.get('clients') || [];
    const installations = store.get('installations') || [];
    const maintenanceHistory = store.get('maintenanceHistory') || [];
    
    // Crear objeto de respaldo
    const backupData = {
      version: app.getVersion(),
      timestamp: new Date().toISOString(),
      data: {
        clients,
        installations,
        maintenanceHistory
      }
    };
    
    // Determinar ruta del archivo
    let backupFile;
    if (customPath) {
      backupFile = customPath;
    } else {
      // Usar la ruta predeterminada con formato de fecha y hora
      const backupDir = getBackupDirectory();
      const dateTime = new Date().toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .split('.')[0];
      
      backupFile = path.join(backupDir, `servitecgas-backup-manual-${dateTime}.json`);
    }
    
    // Guardar respaldo
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
    
    return {
      success: true,
      path: backupFile,
      timestamp: backupData.timestamp,
      size: fs.statSync(backupFile).size,
      entries: {
        clients: clients.length,
        installations: installations.length,
        maintenanceHistory: maintenanceHistory.length
      }
    };
  } catch (error) {
    console.error('Error al crear respaldo manual:', error);
    throw new Error(`Error al crear respaldo manual: ${error.message}`);
  }
}

// Exportar funciones
module.exports = {
  setupAutomaticBackup,
  createBackup,
  getBackupList,
  restoreBackup,
  stopAutomaticBackup,
  createManualBackup
};