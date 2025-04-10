const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const electron = require('electron');

// Variables para gestionar el cliente de WhatsApp
let whatsappClient = null;
let isWhatsAppReady = false;
let sessionDataPath = null;

/**
 * Configura el servicio de WhatsApp
 * @param {BrowserWindow} mainWindow - Ventana principal de la aplicación
 */
function setupWhatsAppService(mainWindow) {
  // Definir ruta para guardar la sesión
  const userDataPath = electron.app.getPath('userData');
  const whatsappDataPath = path.join(userDataPath, 'whatsapp-session');
  
  // Crear carpeta si no existe
  if (!fs.existsSync(whatsappDataPath)) {
    fs.mkdirSync(whatsappDataPath, { recursive: true });
  }
  
  sessionDataPath = path.join(whatsappDataPath, 'session.json');
  
  // Verificar si hay una sesión guardada
  let sessionData = null;
  if (fs.existsSync(sessionDataPath)) {
    try {
      sessionData = JSON.parse(fs.readFileSync(sessionDataPath, 'utf8'));
    } catch (error) {
      console.error('Error al leer datos de sesión de WhatsApp:', error);
      // Si hay error, eliminamos el archivo corrupto
      fs.unlinkSync(sessionDataPath);
    }
  }
  
  // Inicializar el cliente de WhatsApp
  whatsappClient = new Client({
    session: sessionData,
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
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
    
    // Mostrar alerta
    if (mainWindow) {
      mainWindow.webContents.send('show-alert', {
        type: 'info',
        message: 'Escanea el código QR con WhatsApp en tu teléfono'
      });
    }
  });

  // Evento cuando se guarda la sesión
  whatsappClient.on('authenticated', (session) => {
    // Guardar datos de sesión a un archivo
    if (sessionDataPath) {
      fs.writeFileSync(sessionDataPath, JSON.stringify(session), 'utf8');
    }
    
    if (mainWindow) {
      mainWindow.webContents.send('show-alert', {
        type: 'success',
        message: 'WhatsApp autenticado correctamente'
      });
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
    
    // Eliminar archivo de sesión si existe
    if (sessionDataPath && fs.existsSync(sessionDataPath)) {
      fs.unlinkSync(sessionDataPath);
    }
    
    if (mainWindow) {
      mainWindow.webContents.send('whatsapp-auth-failure');
      mainWindow.webContents.send('show-alert', {
        type: 'error',
        message: 'Error de autenticación en WhatsApp'
      });
    }
  });
  
  whatsappClient.on('disconnected', () => {
    isWhatsAppReady = false;
    
    if (mainWindow) {
      mainWindow.webContents.send('show-alert', {
        type: 'warning',
        message: 'WhatsApp se ha desconectado'
      });
    }
  });

  // Inicializar el cliente
  try {
    whatsappClient.initialize();
  } catch (error) {
    console.error('Error al inicializar WhatsApp:', error);
    
    if (mainWindow) {
      mainWindow.webContents.send('show-alert', {
        type: 'error',
        message: `Error al inicializar WhatsApp: ${error.message}`
      });
    }
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
      message: 'WhatsApp no está conectado. Por favor inicia sesión primero.'
    };
  }
  
  try {
    // Formatear el número según el formato requerido por WhatsApp Web
    let formattedNumber = to;
    
    // Eliminar cualquier carácter que no sea número
    formattedNumber = formattedNumber.replace(/\D/g, '');
    
    // Verificar que tenga código de país
    if (!formattedNumber.startsWith('+')) {
      if (formattedNumber.startsWith('0')) {
        formattedNumber = formattedNumber.substring(1);
      }
      
      // Asumir código de país (ej: +56 para Chile)
      formattedNumber = '56' + formattedNumber;
    }
    
    // Enviar mensaje
    const chatId = `${formattedNumber}@c.us`;
    const response = await whatsappClient.sendMessage(chatId, message);
    
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

/**
 * Verifica si WhatsApp está conectado
 * @returns {boolean} - Estado de conexión
 */
function isWhatsAppConnected() {
  return isWhatsAppReady;
}

/**
 * Cierra la sesión de WhatsApp
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function logoutWhatsApp() {
  if (!whatsappClient) {
    return {
      success: false,
      message: 'No hay sesión activa de WhatsApp'
    };
  }
  
  try {
    await whatsappClient.logout();
    
    // Eliminar archivo de sesión si existe
    if (sessionDataPath && fs.existsSync(sessionDataPath)) {
      fs.unlinkSync(sessionDataPath);
    }
    
    return {
      success: true,
      message: 'Sesión de WhatsApp cerrada correctamente'
    };
  } catch (error) {
    console.error('Error al cerrar sesión de WhatsApp:', error);
    return {
      success: false,
      message: `Error al cerrar sesión: ${error.message}`
    };
  }
}

module.exports = {
  setupWhatsAppService,
  sendWhatsAppMessage,
  isWhatsAppConnected,
  logoutWhatsApp
};