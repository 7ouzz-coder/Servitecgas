const { Client } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const electron = require('electron');

// Variables globales
let whatsappClient = null;
let isWhatsAppReady = false;
let sessionDataPath = null;
let mainWindowRef = null;
let initializationInProgress = false;

/**
 * Inicializa el servicio WhatsApp
 * @param {BrowserWindow} mainWindow - Ventana principal
 */
function init(mainWindow) {
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
  
  // Iniciar automáticamente si hay sesión guardada
  if (fs.existsSync(sessionDataPath)) {
    console.log('Sesión de WhatsApp encontrada, iniciando automáticamente...');
    setTimeout(() => {
      initializeClient();
    }, 3000);
  }
}

/**
 * Inicializa el cliente de WhatsApp
 */
function initializeClient() {
  if (initializationInProgress) {
    console.log('Inicialización de WhatsApp ya en progreso');
    return;
  }
  
  console.log('Iniciando proceso de inicialización de WhatsApp');
  initializationInProgress = true;
  
  try {
    // Cargar sesión previa si existe
    let sessionData = null;
    if (fs.existsSync(sessionDataPath)) {
      try {
        const sessionContent = fs.readFileSync(sessionDataPath, 'utf8');
        sessionData = JSON.parse(sessionContent);
        console.log('Sesión de WhatsApp cargada correctamente');
      } catch (error) {
        console.error('Error al leer sesión:', error);
        if (fs.existsSync(sessionDataPath)) {
          fs.unlinkSync(sessionDataPath);
        }
      }
    }
    
    // Configuración de Puppeteer
    const puppeteerOpts = {
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage'
      ]
    };
    
    // Opciones del cliente
    const clientOptions = {
      puppeteer: puppeteerOpts,
      restartOnAuthFail: true,
      qrMaxRetries: 3
    };
    
    // Usar sesión si existe
    if (sessionData) {
      clientOptions.session = sessionData;
    }
    
    // Crear cliente
    console.log('Creando cliente WhatsApp...');
    whatsappClient = new Client(clientOptions);
    
    // Configurar eventos
    whatsappClient.on('qr', (qr) => {
      console.log('Código QR generado');
      
      // Enviar QR al frontend
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        try {
          mainWindowRef.webContents.send('whatsapp-qr', qr);
          console.log('QR enviado correctamente al frontend');
        } catch (error) {
          console.error('Error al enviar QR al frontend:', error);
        }
      }
    });
    
    whatsappClient.on('ready', () => {
      console.log('Cliente WhatsApp listo');
      isWhatsAppReady = true;
      initializationInProgress = false;
      
      // Guardar sesión
      if (whatsappClient.session) {
        try {
          fs.writeFileSync(sessionDataPath, JSON.stringify(whatsappClient.session), 'utf8');
          console.log('Sesión guardada correctamente');
        } catch (error) {
          console.error('Error al guardar sesión:', error);
        }
      }
      
      // Notificar al frontend
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('whatsapp-ready');
      }
    });
    
    whatsappClient.on('auth_failure', () => {
      console.error('Error de autenticación en WhatsApp');
      isWhatsAppReady = false;
      initializationInProgress = false;
      
      // Eliminar sesión
      if (fs.existsSync(sessionDataPath)) {
        fs.unlinkSync(sessionDataPath);
      }
      
      // Notificar al frontend
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('whatsapp-auth-failure');
      }
    });
    
    whatsappClient.on('disconnected', () => {
      console.log('WhatsApp desconectado');
      isWhatsAppReady = false;
      
      // Notificar al frontend
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('whatsapp-disconnected');
      }
    });
    
    // Inicializar
    console.log('Inicializando cliente WhatsApp...');
    whatsappClient.initialize()
      .then(() => {
        console.log('Cliente WhatsApp inicializado correctamente');
      })
      .catch(error => {
        console.error('Error al inicializar WhatsApp:', error);
        initializationInProgress = false;
        
        // Notificar al frontend
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('whatsapp-initialization-failed');
        }
      });
    
  } catch (error) {
    console.error('Error al configurar WhatsApp:', error);
    initializationInProgress = false;
  }
}

/**
 * Verifica si WhatsApp está conectado
 */
function isConnected() {
  return isWhatsAppReady;
}

/**
 * Envía un mensaje de WhatsApp
 */
async function sendMessage(phoneNumber, messageText) {
  if (!isWhatsAppReady || !whatsappClient) {
    return {
      success: false,
      message: 'WhatsApp no está conectado'
    };
  }
  
  try {
    // Formatear número
    let formattedNumber = phoneNumber.replace(/\D/g, '');
    if (formattedNumber.startsWith('0')) {
      formattedNumber = formattedNumber.substring(1);
    }
    if (!formattedNumber.startsWith('56')) {
      formattedNumber = '56' + formattedNumber;
    }
    
    const chatId = `${formattedNumber}@c.us`;
    console.log(`Enviando mensaje a: ${chatId}`);
    
    await whatsappClient.sendMessage(chatId, messageText);
    console.log('Mensaje enviado exitosamente');
    
    return {
      success: true,
      message: 'Mensaje enviado con éxito'
    };
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    return {
      success: false,
      message: `Error al enviar mensaje: ${error.message}`
    };
  }
}

/**
 * Cierra la sesión de WhatsApp
 */
async function logout() {
  if (!whatsappClient) {
    return {
      success: false,
      message: 'No hay sesión activa de WhatsApp'
    };
  }
  
  try {
    await whatsappClient.logout();
    
    // Eliminar archivo de sesión
    if (fs.existsSync(sessionDataPath)) {
      fs.unlinkSync(sessionDataPath);
    }
    
    isWhatsAppReady = false;
    
    return {
      success: true,
      message: 'Sesión de WhatsApp cerrada correctamente'
    };
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

module.exports = {
  init,
  initializeClient,
  isConnected,
  sendMessage,
  logout
};