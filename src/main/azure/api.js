const axios = require('axios');

// URL base de la API de Azure
// IMPORTANTE: Reemplazar con tu URL real
const API_BASE_URL = 'https://your-azure-function-app.azurewebsites.net/api';

/**
 * Sincroniza cambios locales con el servidor
 * @param {string} token - Token de autenticación
 * @param {Array} changes - Cambios a sincronizar
 * @returns {Promise<Object>} - Resultado de la sincronización
 */
async function syncChanges(token, changes) {
  try {
    const response = await axios.post(`${API_BASE_URL}/sync`, changes, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error al sincronizar cambios:', error.response?.data || error.message);
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
  try {
    const response = await axios.get(`${API_BASE_URL}/changes`, {
      params: { since: lastSync },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener cambios:', error.response?.data || error.message);
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

module.exports = {
  syncChanges,
  getChanges,
  getUserInfo,
  getClients,
  getInstallations,
  getUpcomingMaintenance,
  sendWhatsAppMessage,
  generateReport
};