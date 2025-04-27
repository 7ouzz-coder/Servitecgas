/**
 * Sistema centralizado para la gestión de manejadores de eventos
 */

// Conjunto global para rastrear manejadores registrados
const registeredHandlers = new Set();

/**
 * Registra un manejador IPC de forma segura, evitando duplicados
 * @param {IpcMain} ipcMain - Objeto ipcMain de Electron
 * @param {string} channel - Nombre del canal IPC
 * @param {Function} handler - Función manejadora
 * @returns {boolean} - Verdadero si se registró correctamente
 */
function safeRegisterHandler(ipcMain, channel, handler) {
  if (registeredHandlers.has(channel)) {
    console.log(`Manejador para '${channel}' ya registrado, omitiendo...`);
    return false;
  }
  
  try {
    ipcMain.handle(channel, handler);
    registeredHandlers.add(channel);
    console.log(`Manejador IPC registrado: ${channel}`);
    return true;
  } catch (error) {
    console.error(`Error al registrar manejador para '${channel}':`, error);
    return false;
  }
}

/**
 * Elimina un manejador IPC registrado previamente
 * @param {IpcMain} ipcMain - Objeto ipcMain de Electron
 * @param {string} channel - Nombre del canal IPC
 * @returns {boolean} - Verdadero si se eliminó correctamente
 */
function removeHandler(ipcMain, channel) {
  try {
    ipcMain.removeHandler(channel);
    registeredHandlers.delete(channel);
    console.log(`Manejador IPC eliminado: ${channel}`);
    return true;
  } catch (error) {
    console.error(`Error al eliminar manejador para '${channel}':`, error);
    return false;
  }
}

/**
 * Verifica si un canal ya tiene un manejador registrado
 * @param {string} channel - Nombre del canal IPC
 * @returns {boolean} - Verdadero si el canal ya tiene un manejador
 */
function hasHandler(channel) {
  return registeredHandlers.has(channel);
}

/**
 * Obtiene todos los manejadores registrados
 * @returns {Array<string>} - Lista de canales registrados
 */
function getRegisteredHandlers() {
  return Array.from(registeredHandlers);
}

/**
 * Limpia todos los manejadores registrados (para pruebas o reinicialización)
 * @param {IpcMain} ipcMain - Objeto ipcMain de Electron
 */
function clearAllHandlers(ipcMain) {
  for (const channel of registeredHandlers) {
    try {
      ipcMain.removeHandler(channel);
    } catch (error) {
      console.error(`Error al eliminar manejador para '${channel}':`, error);
    }
  }
  registeredHandlers.clear();
  console.log('Todos los manejadores IPC han sido eliminados');
}

module.exports = {
  safeRegisterHandler,
  removeHandler,
  hasHandler,
  getRegisteredHandlers,
  clearAllHandlers,
  registeredHandlers // Exportar el conjunto para acceso directo si es necesario
};