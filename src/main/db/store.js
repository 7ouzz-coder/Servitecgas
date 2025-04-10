const electron = require('electron');
const Store = require('electron-store');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

let storeInstance = null;

/**
 * Configura y devuelve la instancia de la tienda de datos
 */
function setupStore() {
  if (storeInstance) return storeInstance;
  
  // Crear carpeta de base de datos si no existe
  let dbPath;
  try {
    dbPath = path.join(electron.app.getPath('userData'), 'database');
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }
  } catch (error) {
    console.error('Error al crear directorio de base de datos:', error);
    // Si hay error, usar un directorio temporal
    dbPath = require('os').tmpdir();
  }
  
  // Configuración para almacenar datos
  try {
    storeInstance = new Store({
      name: 'app-data',
      fileExtension: 'json',
      cwd: dbPath
    });
    
    // Inicializar colecciones si no existen
    const collections = ['clients', 'installations'];
    collections.forEach(collection => {
      if (!storeInstance.has(collection)) {
        storeInstance.set(collection, []);
      }
    });
  } catch (error) {
    console.error('Error al configurar Store:', error);
    // Si hay error, crear una store en memoria
    storeInstance = {
      _data: {
        clients: [],
        installations: []
      },
      get: function(key) { return this._data[key]; },
      set: function(key, value) { this._data[key] = value; },
      has: function(key) { return key in this._data; }
    };
  }
  
  return storeInstance;
}

/**
 * Genera un nuevo ID único
 * @returns {string} ID único
 */
function generateId() {
  return uuidv4();
}

/**
 * Función placeholder para compatibilidad con código Azure
 * @param {Object} userData - Datos del usuario
 */
function setCurrentUser(userData) {
  console.log('setCurrentUser llamada (modo simplificado):', userData);
  // En la versión simplificada no hacemos nada con esto
}

/**
 * Función placeholder para compatibilidad con código Azure
 * @param {string} entityType - Tipo de entidad
 * @param {string} operation - Operación
 * @param {string} entityId - ID de entidad
 * @param {Object} data - Datos
 */
function recordChange(entityType, operation, entityId, data) {
  console.log('recordChange llamada (modo simplificado):', entityType, operation, entityId);
  // En la versión simplificada no hacemos nada con esto
}

module.exports = {
  setupStore,
  generateId,
  setCurrentUser,
  recordChange
};