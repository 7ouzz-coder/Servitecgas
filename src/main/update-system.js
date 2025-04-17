// Sistema de actualizaciones automáticas
const { app, dialog, shell } = require('electron');
const axios = require('axios');
const semver = require('semver');
const fs = require('fs');
const path = require('path');

// URL base para obtener información de actualizaciones
// REEMPLAZAR con tu URL real en Azure Blob Storage
const UPDATE_CHECK_URL = 'https://storage.servitecgas.com/updates/version.json';

// Intervalo entre verificaciones (24 horas)
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000;

// Variable para almacenar la última información de actualización
let latestUpdateInfo = null;

/**
 * Inicializa el sistema de actualizaciones
 * @param {BrowserWindow} mainWindow - Referencia a la ventana principal
 */
function initUpdateSystem(mainWindow) {
  // Crear carpeta de aplicación si no existe
  const appDataPath = app.getPath('userData');
  const updatesPath = path.join(appDataPath, 'updates');
  if (!fs.existsSync(updatesPath)) {
    fs.mkdirSync(updatesPath, { recursive: true });
  }

  // Verificar actualizaciones inicial (después de 3 segundos)
  setTimeout(() => {
    checkForUpdates(mainWindow);
  }, 3000);

  // Verificar actualizaciones periódicamente
  setInterval(() => {
    checkForUpdates(mainWindow);
  }, UPDATE_CHECK_INTERVAL);
}

/**
 * Verifica si hay actualizaciones disponibles
 * @param {BrowserWindow} mainWindow - Referencia a la ventana principal
 */
async function checkForUpdates(mainWindow) {
    try {
      // Simulación para desarrollo: crear una versión local si no podemos conectar
      let updateData;
      
      try {
        // Intentar obtener datos reales primero
        const response = await axios.get(UPDATE_CHECK_URL, {
          headers: { 'Cache-Control': 'no-cache' },
          timeout: 5000 // Reducir el timeout a 5 segundos
        });
        
        updateData = response.data;
      } catch (connectionError) {
        console.log('No se pudo conectar al servidor de actualizaciones. Usando datos locales.');
        
        // Crear datos de actualización local para desarrollo
        const currentVersion = app.getVersion();
        
        // Crear versión simulada: incrementar último dígito
        const versionParts = currentVersion.split('.');
        versionParts[versionParts.length - 1] = parseInt(versionParts[versionParts.length - 1] || 0) + 1;
        const simulatedNewVersion = versionParts.join('.');
        
        updateData = {
          version: simulatedNewVersion,
          url: "https://storage.servitecgas.com/updates/servitecgas-" + simulatedNewVersion + ".exe",
          notes: "Esta es una actualización simulada para fines de desarrollo. Los servidores reales no están disponibles.",
          previousVersions: [
            {
              version: currentVersion,
              date: new Date().toISOString(),
              notes: "Versión actual del sistema."
            }
          ]
        };
        
        // Determinar si debemos simular una nueva versión disponible o no
        const simulateNewVersion = process.env.NODE_ENV === 'development';
        if (!simulateNewVersion) {
          updateData.version = currentVersion;
        }
      }
      
      // Verificar que la respuesta tiene la estructura correcta
      if (!updateData || !updateData.version) {
        console.error('Formato de datos de actualización inválido');
        return;
      }
      
      // Guardar información de actualización
      latestUpdateInfo = updateData;
      const latestVersion = updateData.version;
      const currentVersion = app.getVersion();
      
      // Comparar versiones
      if (semver.gt(latestVersion, currentVersion)) {
        console.log(`Nueva versión disponible: ${latestVersion} (actual: ${currentVersion})`);
        
        // Notificar a la ventana principal
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-available', latestUpdateInfo);
        } else {
          // Si la ventana no está disponible, mostrar diálogo nativo
          showUpdateDialog(latestUpdateInfo);
        }
      } else {
        console.log(`La aplicación está actualizada (${currentVersion})`);
      }
    } catch (error) {
      console.error('Error al verificar actualizaciones:', error.message);
    }
  }

/**
 * Muestra un diálogo de actualización nativo
 * @param {Object} updateInfo - Información de la actualización
 */
async function showUpdateDialog(updateInfo) {
  try {
    const dialogOptions = {
      type: 'info',
      title: 'Actualización disponible',
      message: `Hay una nueva versión de Servitecgas disponible: ${updateInfo.version}`,
      detail: updateInfo.notes || 'Se recomienda actualizar para obtener las últimas mejoras.',
      buttons: ['Descargar ahora', 'Más tarde'],
      cancelId: 1
    };
    
    const { response } = await dialog.showMessageBox(dialogOptions);
    
    if (response === 0) {
      // Abrir navegador para descargar la actualización
      shell.openExternal(updateInfo.url);
    }
  } catch (error) {
    console.error('Error al mostrar diálogo de actualización:', error);
  }
}

/**
 * Guarda el registro de actualización
 * @param {string} version - Versión instalada
 */
function logUpdateInstalled(version) {
  try {
    const appDataPath = app.getPath('userData');
    const updateLogPath = path.join(appDataPath, 'updates', 'update-history.json');
    
    // Cargar historial existente o crear uno nuevo
    let history = [];
    if (fs.existsSync(updateLogPath)) {
      try {
        const historyData = fs.readFileSync(updateLogPath, 'utf8');
        history = JSON.parse(historyData);
      } catch (error) {
        console.error('Error al leer historial de actualizaciones:', error);
      }
    }
    
    // Añadir nueva entrada
    history.push({
      version,
      date: new Date().toISOString(),
      previousVersion: app.getVersion()
    });
    
    // Guardar historial
    fs.writeFileSync(updateLogPath, JSON.stringify(history, null, 2), 'utf8');
  } catch (error) {
    console.error('Error al guardar registro de actualización:', error);
  }
}

// Exportar funciones
module.exports = {
  initUpdateSystem,
  checkForUpdates,
  getLatestUpdateInfo: () => latestUpdateInfo
};