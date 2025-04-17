const axios = require('axios');
require('dotenv').config();

// URL base de la API de Azure
const API_BASE_URL = process.env.AZURE_API_URL || 'https://servitecgas-dev-api.azurewebsites.net/api';

// Determinar si estamos en modo desarrollo
const DEV_MODE = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development';

// Variable para controlar el modo offline
let isOfflineMode = DEV_MODE; // Iniciar en modo offline si estamos en desarrollo

/**
 * Sincroniza cambios locales con el servidor
 * @param {string} token - Token de autenticación
 * @param {Array} changes - Cambios a sincronizar
 * @returns {Promise<Object>} - Resultado de la sincronización
 */

async function syncChanges(token, changes) {
  // Si estamos en modo desarrollo o offline, simular sincronización exitosa
  if (isOfflineMode) {
    return {
      success: true,
      offline: true,
      message: DEV_MODE ? 'Modo desarrollo: sin sincronización con Azure' : 'Modo offline: los cambios se sincronizarán cuando haya conexión'
    };
  }

  try {
    const response = await axios.post(`${API_BASE_URL}/sync`, changes, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000 // Reducir el timeout para fallar más rápido
    });
    return response.data;
  } catch (error) {
    console.error('Error al sincronizar cambios:', error.response?.data || error.message);
    
    // Si el error es de tipo ENOTFOUND o ETIMEDOUT, entrar en modo offline
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.log('Entrando en modo offline por problema de conexión');
      isOfflineMode = true;
      
      return {
        success: true,
        offline: true,
        message: 'Modo offline: los cambios se sincronizarán cuando haya conexión'
      };
    }
    
    throw new Error(error.response?.data?.message || error.message);
  }
}


/**
 * Obtiene cambios desde el servidor
 * @param {string} token - Token de autenticación
 * @param {string|null} lastSync - Timestamp de la última sincronización
 * @returns {Promise<Array>} - Cambios del servidor
 */
async function getChanges(token, lastSync) {
  // Si estamos en modo offline, devolver un array vacío
  if (isOfflineMode) {
    return {
      success: true,
      offline: true,
      data: []
    };
  }
  
  try {
    const response = await axios.get(`${API_BASE_URL}/changes`, {
      params: { since: lastSync },
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 5000
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener cambios:', error.response?.data || error.message);
    
    // Si el error es de conexión, entrar en modo offline
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.log('Entrando en modo offline por problema de conexión');
      isOfflineMode = true;
      
      return {
        success: true,
        offline: true,
        data: []
      };
    }
    
    throw new Error(error.response?.data?.message || error.message);
  }
}

/**
 * Obtiene información del usuario actual
 * @param {string} token - Token de autenticación
 * @returns {Promise<Object>} - Información del usuario
 */
async function getUserInfo(token) {
  try {
    const response = await axios.get(`${API_BASE_URL}/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener información del usuario:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message);
  }
}

/**
 * Obtiene todos los clientes del servidor
 * @param {string} token - Token de autenticación
 * @returns {Promise<Array>} - Lista de clientes
 */
async function getClients(token) {
  try {
    const response = await axios.get(`${API_BASE_URL}/clients`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener clientes:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message);
  }
}

/**
 * Obtiene todas las instalaciones del servidor
 * @param {string} token - Token de autenticación
 * @returns {Promise<Array>} - Lista de instalaciones
 */
async function getInstallations(token) {
  try {
    const response = await axios.get(`${API_BASE_URL}/installations`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener instalaciones:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message);
  }
}

/**
 * Obtiene mantenimientos próximos del servidor
 * @param {string} token - Token de autenticación
 * @param {number} days - Días a considerar como próximos
 * @returns {Promise<Array>} - Lista de mantenimientos próximos
 */
async function getUpcomingMaintenance(token, days = 30) {
  try {
    const response = await axios.get(`${API_BASE_URL}/maintenance/upcoming`, {
      params: { days },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener mantenimientos próximos:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message);
  }
}

/**
 * Envía un mensaje de WhatsApp desde el servidor
 * @param {string} token - Token de autenticación
 * @param {Object} messageData - Datos del mensaje
 * @returns {Promise<Object>} - Resultado del envío
 */
async function sendWhatsAppMessage(token, messageData) {
  try {
    const response = await axios.post(`${API_BASE_URL}/whatsapp/send`, messageData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error al enviar mensaje de WhatsApp:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message);
  }
}

/**
 * Genera un informe en el servidor
 * @param {string} token - Token de autenticación
 * @param {string} reportType - Tipo de informe
 * @param {Object} options - Opciones del informe
 * @returns {Promise<Object>} - URL para descargar el informe generado
 */
async function generateReport(token, reportType, options) {
  try {
    const response = await axios.post(`${API_BASE_URL}/reports/${reportType}`, options, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error al generar informe:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || error.message);
  }
}

/**
 * Verifica si la configuración de Azure es válida
 * @returns {boolean} - Verdadero si la configuración es válida
 */
function isConfigValid() {
  // Si estamos en modo desarrollo, siempre devolver true para evitar errores
  if (DEV_MODE) return true;
  
  return !!AZURE_STORAGE_CONNECTION_STRING && 
         !!AZURE_CONTAINER_NAME && 
         !!AZURE_TABLE_NAME;
}

/**
 * Intenta verificar la conexión y salir del modo offline si es posible
 * @returns {Promise<boolean>} - Verdadero si la conexión está disponible
 */
async function checkConnection() {
  // Si estamos en modo desarrollo, no intentar conectar
  if (DEV_MODE) return false;
  
  // Si no estamos en modo offline, no hay necesidad de verificar
  if (!isOfflineMode) return true;
  
  try {
    // Intentar una solicitud simple para verificar conexión
    await axios.get(`${API_BASE_URL}/ping`, { timeout: 3000 });
    
    console.log('Conexión restablecida, saliendo del modo offline');
    isOfflineMode = false;
    return true;
  } catch (error) {
    console.log('Continúa en modo offline, no hay conexión disponible');
    return false;
  }
}

module.exports = {
  syncChanges,
  getChanges,
  getUserInfo,
  getClients,
  getInstallations,
  getUpcomingMaintenance,
  sendWhatsAppMessage,
  generateReport,
  isConfigValid,
  checkConnection,
  isOfflineMode: () => isOfflineMode,
  setOfflineMode: (mode) => { isOfflineMode = mode; }
};