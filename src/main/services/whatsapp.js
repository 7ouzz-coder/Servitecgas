// Servicio de WhatsApp integrado
const { Client } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const electron = require('electron');
const { ipcMain } = require('electron');

// Variables para gestionar el cliente de WhatsApp
let whatsappClient = null;
let isWhatsAppReady = false;
let sessionDataPath = null;
let mainWindowRef = null;
let initializationInProgress = false;

/**
 * Configura el servicio de WhatsApp
 * @param {BrowserWindow} mainWindow - Ventana principal de la aplicación
 */
function setupWhatsAppService(mainWindow) {
  // Guardar referencia a la ventana principal
  mainWindowRef = mainWindow;
  
  // Definir ruta para guardar la sesión
  const userDataPath = electron.app.getPath('userData');
  const whatsappDataPath = path.join(userDataPath, 'whatsapp-session');
  
  // Crear carpeta si no existe
  if (!fs.existsSync(whatsappDataPath)) {
    fs.mkdirSync(whatsappDataPath, { recursive: true });
  }
  
  sessionDataPath = path.join(whatsappDataPath, 'session.json');
  
  // Configurar manejadores IPC
  setupWhatsAppIpcHandlers();
  
  // Intentar cargar sesión existente
  initializeWhatsAppClient();
}

/**
 * Inicializa el cliente de WhatsApp
 */
function initializeWhatsAppClient() {
  if (initializationInProgress) {
    console.log('Inicialización de WhatsApp ya en progreso');
    return;
  }
  
  initializationInProgress = true;
  
  try {
    // Verificar si hay una sesión guardada
    let sessionData = null;
    if (fs.existsSync(sessionDataPath)) {
      try {
        sessionData = JSON.parse(fs.readFileSync(sessionDataPath, 'utf8'));
        console.log('Sesión de WhatsApp encontrada');
      } catch (error) {
        console.error('Error al leer datos de sesión de WhatsApp:', error);
        // Si hay error, eliminamos el archivo corrupto
        fs.unlinkSync(sessionDataPath);
      }
    }
    
    // Destruir cliente existente si hay uno
    if (whatsappClient) {
      try {
        whatsappClient.destroy().catch(err => console.error('Error al destruir cliente anterior:', err));
        whatsappClient = null;
      } catch (error) {
        console.error('Error al destruir cliente anterior:', error);
      }
    }
    
    // Inicializar el cliente de WhatsApp
    whatsappClient = new Client({
      session: sessionData,
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas'
        ]
      }
    });
    
    // Evento para mostrar el código QR
    whatsappClient.on('qr', (qr) => {
      console.log('==== CÓDIGO QR GENERADO ====');
      console.log(`Longitud del QR: ${qr.length} caracteres`);
      console.log('============================');
      
      // Verificar que la ventana principal existe antes de enviar
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        try {
          console.log('Enviando código QR a la interfaz de usuario');
          mainWindowRef.webContents.send('whatsapp-qr', qr);
        } catch (error) {
          console.error('Error al enviar QR a la interfaz:', error);
        }
      } else {
        console.error('La ventana principal no está disponible para enviar el QR');
      }
    });
    
    // El resto de eventos también deberían verificar la existencia de la ventana
    whatsappClient.on('ready', () => {
      console.log('Cliente WhatsApp listo');
      isWhatsAppReady = true;
      
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('whatsapp-ready');
        mainWindowRef.webContents.send('show-alert', {
          type: 'success',
          message: 'WhatsApp conectado y listo para enviar mensajes'
        });
      }
    });
    
    // Eventos de error
    whatsappClient.on('auth_failure', (error) => {
      console.error('Error de autenticación en WhatsApp:', error);
      isWhatsAppReady = false;
      initializationInProgress = false;
      
      // Eliminar archivo de sesión si existe
      if (sessionDataPath && fs.existsSync(sessionDataPath)) {
        fs.unlinkSync(sessionDataPath);
      }
      
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('whatsapp-auth-failure');
        mainWindowRef.webContents.send('show-alert', {
          type: 'error',
          message: 'Error de autenticación en WhatsApp'
        });
      }
    });
    
    whatsappClient.on('disconnected', (reason) => {
      console.log('WhatsApp desconectado:', reason);
      isWhatsAppReady = false;
      initializationInProgress = false;
      
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('whatsapp-disconnected');
        mainWindowRef.webContents.send('show-alert', {
          type: 'warning',
          message: 'WhatsApp se ha desconectado'
        });
      }
    });
    
    // Inicializar el cliente
    whatsappClient.initialize()
      .then(() => {
        console.log('Cliente de WhatsApp inicializado correctamente');
      })
      .catch(error => {
        console.error('Error al inicializar WhatsApp:', error);
        initializationInProgress = false;
        
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('show-alert', {
            type: 'error',
            message: `Error al inicializar WhatsApp: ${error.message}`
          });
        }
      });
    
  } catch (error) {
    console.error('Error al configurar WhatsApp:', error);
    initializationInProgress = false;
    
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('show-alert', {
        type: 'error',
        message: `Error al configurar WhatsApp: ${error.message}`
      });
    }
  }
}

/**
 * Configura los manejadores IPC para WhatsApp
 */
function setupWhatsAppIpcHandlers() {
  // Verificar si WhatsApp está conectado
  ipcMain.handle('is-whatsapp-connected', () => {
    return isWhatsAppReady;
  });
  
  // Cerrar sesión de WhatsApp
  ipcMain.handle('logout-whatsapp', async () => {
    try {
      if (!whatsappClient) {
        return {
          success: false,
          message: 'No hay sesión activa de WhatsApp'
        };
      }
      
      await whatsappClient.logout();
      
      // Eliminar archivo de sesión si existe
      if (sessionDataPath && fs.existsSync(sessionDataPath)) {
        fs.unlinkSync(sessionDataPath);
      }
      
      isWhatsAppReady = false;
      
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('whatsapp-disconnected');
        mainWindowRef.webContents.send('show-alert', {
          type: 'info',
          message: 'Sesión de WhatsApp cerrada correctamente'
        });
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
  });
}

/**
 * Envía un mensaje de WhatsApp (función para uso interno)
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
      if (!formattedNumber.startsWith('56')) {
        formattedNumber = '56' + formattedNumber;
      }
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
    
    isWhatsAppReady = false;
    
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