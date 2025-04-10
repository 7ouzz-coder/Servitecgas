const electron = require('electron');
const Store = require('electron-store');
const path = require('path');
const fs = require('fs');

let storeInstance = null;

/**
 * Configura y devuelve la instancia de la tienda de datos
 */
function setupStore() {
  if (storeInstance) return storeInstance;
  
  // Crear carpeta de base de datos si no existe
  const dbPath = path.join(electron.app.getPath('userData'), 'database');
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }
  
  // Configuración para almacenar datos
  storeInstance = new Store({
    name: 'app-data',
    fileExtension: 'json',
    cwd: dbPath
  });
  
  return storeInstance;
}

module.exports = {
  setupStore,
};