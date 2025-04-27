/**
 * Sistema centralizado para manejar notificaciones y evitar duplicados
 */

// Mapa para rastrear la última vez que se envió cada tipo de notificación
const notificationRegistry = new Map();

// Tiempo mínimo (en ms) entre notificaciones del mismo tipo
const DEFAULT_THROTTLE_TIME = 3000;

/**
 * Envía una notificación al frontend, evitando duplicados en un corto período
 * @param {BrowserWindow} window - Ventana principal de la aplicación
 * @param {string} channel - Canal de notificación
 * @param {Object} data - Datos de la notificación
 * @param {number} throttleTime - Tiempo mínimo entre notificaciones similares (ms)
 * @returns {boolean} - Verdadero si se envió la notificación
 */
function sendNotification(window, channel, data, throttleTime = DEFAULT_THROTTLE_TIME) {
  if (!window || window.isDestroyed()) {
    console.log(`No se puede enviar notificación: ventana no disponible`);
    return false;
  }

  // Crear una clave única para esta notificación
  const notificationKey = createNotificationKey(channel, data);
  const now = Date.now();
  const lastSent = notificationRegistry.get(notificationKey) || 0;

  // Verificar si ya se envió recientemente una notificación similar
  if (now - lastSent < throttleTime) {
    console.log(`Notificación "${channel}" throttled, ignorando duplicado reciente (${now - lastSent}ms < ${throttleTime}ms)`);
    return false;
  }

  // Registrar esta notificación
  notificationRegistry.set(notificationKey, now);

  // Enviar la notificación
  try {
    window.webContents.send(channel, data);
    return true;
  } catch (error) {
    console.error(`Error al enviar notificación "${channel}":`, error);
    return false;
  }
}

/**
 * Crea una clave única para una notificación basada en su contenido
 * @param {string} channel - Canal de notificación
 * @param {Object} data - Datos de la notificación
 * @returns {string} - Clave única
 */
function createNotificationKey(channel, data) {
  // Para alertas, consideramos el tipo y el mensaje como parte de la clave
  if (channel === 'show-alert' && data) {
    return `${channel}:${data.type}:${data.message}`;
  }

  // Para cambios de estado de sincronización
  if (channel === 'sync-status-changed' && data) {
    return `${channel}:${data.status}:${data.message}`;
  }

  // Para completado de sincronización
  if (channel === 'sync-completed') {
    return channel;
  }

  // Para notificaciones de WhatsApp
  if (channel.startsWith('whatsapp-')) {
    return channel;
  }

  // Para otras notificaciones, usa el canal y una representación simplificada de los datos
  let dataStr = '';
  if (data) {
    try {
      if (typeof data === 'object') {
        // Obtener solo las claves principales para la comparación
        dataStr = Object.keys(data).slice(0, 3).join(',');
      } else {
        dataStr = String(data).substring(0, 20);
      }
    } catch (e) {
      dataStr = 'invalid-data';
    }
  }
  
  return `${channel}:${dataStr}`;
}

/**
 * Limpia el registro de notificaciones
 * (útil para pruebas o cuando se desean forzar nuevas notificaciones)
 */
function clearNotificationRegistry() {
  notificationRegistry.clear();
}

/**
 * Envía una alerta al frontend
 * @param {BrowserWindow} window - Ventana principal de la aplicación
 * @param {string} type - Tipo de alerta ('success', 'danger', 'warning', 'info')
 * @param {string} message - Mensaje a mostrar
 * @param {number} throttleTime - Tiempo mínimo entre alertas similares (ms)
 * @returns {boolean} - Verdadero si se envió la alerta
 */
function sendAlert(window, type, message, throttleTime = DEFAULT_THROTTLE_TIME) {
  return sendNotification(window, 'show-alert', { type, message }, throttleTime);
}

module.exports = {
  sendNotification,
  sendAlert,
  clearNotificationRegistry
};