// src/main/services/whatsapp.js - Integración con WhatsApp
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let whatsappClient = null;
let isWhatsAppReady = false;

/**
 * Configura el servicio de WhatsApp
 * @param {BrowserWindow} mainWindow - Ventana principal de la aplicación
 */
function setupWhatsAppService(mainWindow) {
  // Inicializar el cliente de WhatsApp
  whatsappClient = new Client({
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  // Evento para mostrar el código QR
  whatsappClient.on('qr', (qr) => {
    // Generar QR en la terminal (solo para desarrollo)
    qrcode.generate(qr, { small: true });
    
    // Enviar el QR a la interfaz de usuario
    if (mainWindow) {
      mainWindow.webContents.send('whatsapp-qr', qr);
    }
  });

  // Evento cuando el cliente está listo
  whatsappClient.on('ready', () => {
    isWhatsAppReady = true;
    
    if (mainWindow) {
      mainWindow.webContents.send('whatsapp-ready');
      mainWindow.webContents.send('show-alert', {
        type: 'success',
        message: 'WhatsApp conectado y listo para enviar mensajes'
      });
    }
  });

  // Eventos de error
  whatsappClient.on('auth_failure', () => {
    isWhatsAppReady = false;
    if (mainWindow) {
      mainWindow.webContents.send('whatsapp-auth-failure');
      mainWindow.webContents.send('show-alert', {
        type: 'error',
        message: 'Error de autenticación en WhatsApp'
      });
    }
  });

  // Inicializar el cliente
  try {
    whatsappClient.initialize();
  } catch (error) {
    console.error('Error al inicializar WhatsApp:', error);
  }
}

/**
 * Envía un mensaje de WhatsApp
 * @param {string} to - Número de teléfono del destinatario (con código de país)
 * @param {string} message - Mensaje a enviar
 * @returns {Promise<Object>} - Resultado del envío
 */
async function sendWhatsAppMessage(to, message) {
  if (!isWhatsAppReady || !whatsappClient) {
    return {
      success: false,
      message: 'WhatsApp no está conectado'
    };
  }
  
  try {
    // Formatear el número según el formato requerido por WhatsApp Web
    const formattedNumber = to.replace(/\D/g, '');
    
    // Enviar mensaje
    const response = await whatsappClient.sendMessage(`${formattedNumber}@c.us`, message);
    
    return {
      success: true,
      message: 'Mensaje enviado con éxito',
      data: response
    };
  } catch (error) {
    console.error('Error al enviar mensaje WhatsApp:', error);
    return {
      success: false,
      message: `Error al enviar mensaje: ${error.message}`
    };
  }
}

module.exports = {
  setupWhatsAppService,
  sendWhatsAppMessage
};