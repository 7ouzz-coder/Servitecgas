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
let autoInitOnStartup = true; // Cambiado a true para iniciar automáticamente
let reconnectAttempts = 0;
let maxReconnectAttempts = 3;
let reconnectInterval = null;

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
  
  // Verificar si existe una sesión guardada e iniciar automáticamente
  if (fs.existsSync(sessionDataPath) && autoInitOnStartup) {
    console.log('Sesión de WhatsApp encontrada, iniciando automáticamente...');
    // Esperar un poco para que la aplicación termine de cargar
    setTimeout(() => {
      initializeWhatsAppClient();
    }, 3000);
  } else {
    console.log('No se inicia WhatsApp automáticamente. El usuario deberá conectarse manualmente.');
  }
}

/**
 * Inicializa el cliente de WhatsApp con manejo mejorado de sesión y reconexión
 */
function initializeWhatsAppClient() {
  if (initializationInProgress) {
    console.log('Inicialización de WhatsApp ya en progreso');
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('show-alert', {
        type: 'warning',
        message: 'Ya hay una inicialización de WhatsApp en progreso'
      });
    }
    return;
  }
  
  console.log('Iniciando proceso de inicialización de WhatsApp');
  initializationInProgress = true;
  
  try {
    // Notificar al frontend que estamos iniciando
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('whatsapp-initialization-started');
    }
    
    // Verificar si hay una sesión guardada
    let sessionData = null;
    const sessionExists = fs.existsSync(sessionDataPath);
    
    console.log(`Verificando sesión de WhatsApp (existe: ${sessionExists})`);
    
    if (sessionExists) {
      try {
        const sessionContent = fs.readFileSync(sessionDataPath, 'utf8');
        console.log(`Sesión leída, longitud: ${sessionContent.length} caracteres`);
        sessionData = JSON.parse(sessionContent);
        console.log('Sesión de WhatsApp encontrada y parseada correctamente');
      } catch (error) {
        console.error('Error al leer datos de sesión de WhatsApp:', error);
        // Si hay error, eliminamos el archivo corrupto
        try {
          fs.unlinkSync(sessionDataPath);
          console.log('Archivo de sesión corrupto eliminado');
        } catch (unlinkError) {
          console.error('Error al eliminar archivo de sesión corrupto:', unlinkError);
        }
      }
    } else {
      console.log('No se encontró archivo de sesión existente, se creará uno nuevo');
    }
    
    // Destruir cliente existente si hay uno
    if (whatsappClient) {
      console.log('Destruyendo cliente WhatsApp existente');
      try {
        whatsappClient.destroy().catch(err => console.error('Error al destruir cliente anterior:', err));
        whatsappClient = null;
        console.log('Cliente WhatsApp anterior destruido');
      } catch (error) {
        console.error('Error al destruir cliente anterior:', error);
      }
    }
    
    // Log de opciones de puppet
    const puppeteerOpts = {
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas'
      ]
    };
    
    console.log('Configurando puppeteer con opciones:', JSON.stringify(puppeteerOpts));
    
    // Inicializar el cliente de WhatsApp con sesión si existe
    const clientOptions = {
      puppeteer: puppeteerOpts,
      restartOnAuthFail: true,
      qrMaxRetries: 3
    };
    
    if (sessionData) {
      clientOptions.session = sessionData;
      console.log('Usando sesión existente para inicializar WhatsApp');
    } else {
      console.log('Inicializando WhatsApp sin sesión previa');
    }
    
    console.log('Creando nueva instancia de Cliente WhatsApp');
    whatsappClient = new Client(clientOptions);
    
    // Eventos con logging mejorado
    whatsappClient.on('qr', (qr) => {
      console.log('==== CÓDIGO QR GENERADO ====');
      console.log(`Longitud del QR: ${qr.length} caracteres`);
      console.log('============================');
      
      // Reiniciar contador de reintentos cuando se muestra un QR
      reconnectAttempts = 0;
      
      // Verificar que la ventana principal existe antes de enviar
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        try {
          console.log('Enviando código QR a la interfaz de usuario');
          
          // Enviar objeto con múltiples formatos para compatibilidad
          mainWindowRef.webContents.send('whatsapp-qr', {
            qrCode: qr,
            qrLength: qr.length,
            timestamp: new Date().toISOString(),
            qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr)}`
          });
          
          console.log('Código QR enviado correctamente al frontend');
        } catch (error) {
          console.error('Error detallado al enviar QR a la interfaz:', error);
        }
      } else {
        console.error('La ventana principal no está disponible para enviar el QR');
      }
    });
    
    whatsappClient.on('ready', () => {
      console.log('Cliente WhatsApp listo');
      isWhatsAppReady = true;
      initializationInProgress = false;
      reconnectAttempts = 0;
      
      // Limpiar intervalo de reconexión si existe
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
      
      // Guardar la sesión cuando esté lista
      if (whatsappClient && whatsappClient.session && sessionDataPath) {
        try {
          const sessionJson = JSON.stringify(whatsappClient.session);
          console.log(`Guardando sesión de WhatsApp (longitud: ${sessionJson.length} caracteres)`);
          fs.writeFileSync(sessionDataPath, sessionJson, 'utf8');
          console.log('Sesión de WhatsApp guardada correctamente');
        } catch (error) {
          console.error('Error detallado al guardar sesión de WhatsApp:', error);
        }
      }
      
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        console.log('Notificando al frontend que WhatsApp está listo');
        mainWindowRef.webContents.send('whatsapp-ready');
        mainWindowRef.webContents.send('show-alert', {
          type: 'success',
          message: 'WhatsApp conectado y listo para enviar mensajes'
        });
      }
    });
    
    whatsappClient.on('auth_failure', (error) => {
      console.error('Error de autenticación en WhatsApp:', error);
      isWhatsAppReady = false;
      initializationInProgress = false;
      
      // Eliminar archivo de sesión si existe
      if (sessionDataPath && fs.existsSync(sessionDataPath)) {
        try {
          fs.unlinkSync(sessionDataPath);
          console.log('Archivo de sesión eliminado después de fallo de autenticación');
        } catch (unlinkError) {
          console.error('Error al eliminar archivo de sesión tras fallo:', unlinkError);
        }
      }
      
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        console.log('Notificando al frontend sobre fallo de autenticación');
        mainWindowRef.webContents.send('whatsapp-auth-failure');
        mainWindowRef.webContents.send('show-alert', {
          type: 'error',
          message: 'Error de autenticación en WhatsApp'
        });
      }
    });
    
    whatsappClient.on('disconnected', (reason) => {
      console.log('WhatsApp desconectado. Razón:', reason);
      isWhatsAppReady = false;
      initializationInProgress = false;
      
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        console.log('Notificando al frontend sobre desconexión');
        mainWindowRef.webContents.send('whatsapp-disconnected');
        mainWindowRef.webContents.send('show-alert', {
          type: 'warning',
          message: 'WhatsApp se ha desconectado'
        });
      }
      
      // Intentar reconexión automática
      handleSessionReconnection();
    });
    
    // Agregar más eventos para mejor depuración
    whatsappClient.on('loading_screen', (percent, message) => {
      console.log(`Cargando WhatsApp: ${percent}% - ${message}`);
      
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('whatsapp-loading', { percent, message });
      }
    });
    
    whatsappClient.on('authenticated', () => {
      console.log('WhatsApp autenticado correctamente');
      
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('whatsapp-authenticated');
        mainWindowRef.webContents.send('show-alert', {
          type: 'info',
          message: 'WhatsApp autenticado correctamente. Cargando...'
        });
      }
    });
    
    // Inicializar el cliente
    console.log('Llamando a whatsappClient.initialize()');
    whatsappClient.initialize()
      .then(() => {
        console.log('Cliente de WhatsApp inicializado correctamente');
      })
      .catch(error => {
        console.error('Error detallado al inicializar WhatsApp:', error);
        initializationInProgress = false;
        
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('whatsapp-initialization-failed', { error: error.message });
          mainWindowRef.webContents.send('show-alert', {
            type: 'error',
            message: `Error al inicializar WhatsApp: ${error.message}`
          });
        }
      });
    
  } catch (error) {
    console.error('Error crítico al configurar WhatsApp:', error);
    initializationInProgress = false;
    
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('whatsapp-initialization-failed', { error: error.message });
      mainWindowRef.webContents.send('show-alert', {
        type: 'error',
        message: `Error crítico al configurar WhatsApp: ${error.message}`
      });
    }
  }
}

/**
 * Maneja la reconexión automática después de una desconexión
 */
function handleSessionReconnection() {
  // Si no hay una sesión guardada, no intentar reconectar
  if (!fs.existsSync(sessionDataPath)) {
    console.log('No hay sesión guardada para intentar reconexión');
    return;
  }
  
  // Si ya hay un proceso de reconexión en marcha, no iniciar otro
  if (reconnectInterval) {
    console.log('Ya hay un proceso de reconexión en marcha');
    return;
  }
  
  console.log('Iniciando proceso de reconexión automática');
  
  // Reiniciar contador de intentos
  reconnectAttempts = 0;
  
  // Configurar intervalo para intentos de reconexión
  reconnectInterval = setInterval(() => {
    // Si la reconexión ya fue exitosa o se alcanzó el límite de intentos
    if (isWhatsAppReady || reconnectAttempts >= maxReconnectAttempts) {
      console.log(`Deteniendo intentos de reconexión: ${isWhatsAppReady ? 'Conectado' : 'Máximo de intentos alcanzado'}`);
      clearInterval(reconnectInterval);
      reconnectInterval = null;
      
      // Si se alcanzó el máximo de intentos, notificar al usuario
      if (!isWhatsAppReady && reconnectAttempts >= maxReconnectAttempts) {
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('show-alert', {
            type: 'warning',
            message: 'No se pudo reconectar automáticamente a WhatsApp. Es posible que necesites escanear el código QR nuevamente.'
          });
        }
      }
      
      return;
    }
    
    // Incrementar contador de intentos
    reconnectAttempts++;
    console.log(`Intento de reconexión ${reconnectAttempts}/${maxReconnectAttempts}`);
    
    // Intentar inicializar cliente
    if (!initializationInProgress) {
      try {
        initializeWhatsAppClient();
      } catch (error) {
        console.error('Error al intentar reconexión:', error);
      }
    } else {
      console.log('Inicialización ya en progreso, esperando...');
    }
  }, 30000); // Intentar cada 30 segundos
}

/**
 * Configurar los manejadores IPC para WhatsApp
 */
function setupWhatsAppIpcHandlers() {
  // Verificar si WhatsApp está conectado
  ipcMain.handle('is-whatsapp-connected', () => {
    console.log(`Verificando estado de WhatsApp. Está conectado: ${isWhatsAppReady}`);
    return isWhatsAppReady;
  });
  
  // Cerrar sesión de WhatsApp
  ipcMain.handle('logout-whatsapp', async () => {
    console.log('Solicitud para cerrar sesión de WhatsApp');
    
    try {
      if (!whatsappClient) {
        console.log('No hay cliente WhatsApp activo para cerrar sesión');
        return {
          success: false,
          message: 'No hay sesión activa de WhatsApp'
        };
      }
      
      console.log('Cerrando sesión de WhatsApp...');
      await whatsappClient.logout();
      console.log('Sesión de WhatsApp cerrada correctamente');
      
      // Eliminar archivo de sesión si existe
      if (sessionDataPath && fs.existsSync(sessionDataPath)) {
        try {
          fs.unlinkSync(sessionDataPath);
          console.log('Archivo de sesión eliminado correctamente');
        } catch (unlinkError) {
          console.error('Error al eliminar archivo de sesión:', unlinkError);
        }
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
      console.error('Error detallado al cerrar sesión de WhatsApp:', error);
      return {
        success: false,
        message: `Error al cerrar sesión: ${error.message || 'Error desconocido'}`
      };
    }
  });
  
  // Inicializar WhatsApp explícitamente
  ipcMain.handle('initialize-whatsapp', async () => {
    console.log('Solicitud para inicializar WhatsApp explícitamente');
    
    try {
      if (initializationInProgress) {
        return {
          success: false,
          message: 'Ya hay una inicialización en progreso'
        };
      }
      
      if (isWhatsAppReady) {
        return {
          success: true,
          message: 'WhatsApp ya está inicializado y conectado'
        };
      }
      
      // Iniciar el proceso de inicialización
      initializeWhatsAppClient();
      
      return {
        success: true,
        message: 'Inicialización de WhatsApp iniciada'
      };
    } catch (error) {
      console.error('Error al iniciar inicialización de WhatsApp:', error);
      return {
        success: false,
        message: `Error al iniciar WhatsApp: ${error.message}`
      };
    }
  });
  
  // Enviar mensaje WhatsApp
  ipcMain.handle('send-whatsapp-message', async (event, messageData) => {
    try {
      // Si es una solicitud de conexión, iniciar el proceso de autenticación
      if (messageData.action === 'connect') {
        console.log('Solicitud para iniciar conexión de WhatsApp');
        
        // Inicializar cliente WhatsApp si no está ya inicializado
        if (!whatsappClient || !initializationInProgress) {
          initializeWhatsAppClient();
        }
        
        return { 
          success: true, 
          message: 'Iniciando conexión con WhatsApp' 
        };
      }
      
      // Para enviar un mensaje, verificar que tenemos los datos necesarios
      if (!messageData.phone || !messageData.message) {
        return {
          success: false,
          message: 'Número de teléfono y mensaje son obligatorios'
        };
      }
      
      // Si es un mensaje normal, enviarlo
      const result = await sendWhatsAppMessage(messageData.phone, messageData.message);
      return result;
    } catch (error) {
      console.error('Error al procesar solicitud de WhatsApp:', error);
      return { 
        success: false, 
        message: `Error en WhatsApp: ${error.message}` 
      };
    }
  });
  
  // Obtener los chats de WhatsApp
  ipcMain.handle('get-whatsapp-chats', async () => {
    console.log('Solicitud para obtener chats de WhatsApp');
    
    if (!isWhatsAppReady || !whatsappClient) {
      console.log('WhatsApp no está conectado para obtener chats');
      return {
        success: false,
        message: 'WhatsApp no está conectado'
      };
    }
    
    try {
      console.log('Obteniendo chats...');
      const chats = await whatsappClient.getChats();
      console.log(`Se encontraron ${chats.length} chats`);
      
      // Formatear los chats para enviar solo datos necesarios
      const formattedChats = chats.map(chat => ({
        id: chat.id._serialized,
        name: chat.name,
        isGroup: chat.isGroup,
        timestamp: chat.timestamp,
        unreadCount: chat.unreadCount
      }));
      
      return {
        success: true,
        chats: formattedChats
      };
    } catch (error) {
      console.error('Error al obtener chats de WhatsApp:', error);
      return {
        success: false,
        message: `Error al obtener chats: ${error.message}`
      };
    }
  });
}

/**
 * Envía un mensaje de WhatsApp con mejor manejo de errores
 * @param {string} to - Número de teléfono del destinatario (con código de país)
 * @param {string} message - Mensaje a enviar
 * @returns {Promise<Object>} - Resultado del envío
 */
async function sendWhatsAppMessage(to, message) {
  console.log(`Solicitud para enviar mensaje a: ${to}`);
  
  if (!isWhatsAppReady || !whatsappClient) {
    console.log('WhatsApp no está listo para enviar mensajes');
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
    console.log(`Número después de quitar caracteres no numéricos: ${formattedNumber}`);
    
    // Verificar que tenga código de país
    if (!to.startsWith('+')) {
      if (formattedNumber.startsWith('0')) {
        formattedNumber = formattedNumber.substring(1);
        console.log(`Número después de quitar cero inicial: ${formattedNumber}`);
      }
      
      // Asumir código de país para Chile si no está
      if (!formattedNumber.startsWith('56')) {
        formattedNumber = '56' + formattedNumber;
        console.log(`Número después de agregar código de país: ${formattedNumber}`);
      }
    }
    
    // Formato final para WhatsApp API
    const chatId = `${formattedNumber}@c.us`;
    console.log(`ID de chat formateado: ${chatId}`);
    
    console.log('Enviando mensaje...');
    const response = await whatsappClient.sendMessage(chatId, message);
    console.log('Mensaje enviado exitosamente');
    
    // Registrar el mensaje enviado en un historial local
    saveMessageToHistory(to, message);
    
    return {
      success: true,
      message: 'Mensaje enviado con éxito',
      data: {
        id: response.id ? response.id.id : null,
        timestamp: response.timestamp || new Date().getTime(),
        to: to
      }
    };
  } catch (error) {
    console.error('Error detallado al enviar mensaje WhatsApp:', error);
    return {
      success: false,
      message: `Error al enviar mensaje: ${error.message || 'Error desconocido'}`
    };
  }
}

/**
 * Guarda un mensaje enviado en el historial local
 * @param {string} recipient - Número del destinatario
 * @param {string} messageText - Texto del mensaje
 */
function saveMessageToHistory(recipient, messageText) {
  try {
    // Ruta al archivo de historial
    const userDataPath = electron.app.getPath('userData');
    const historyPath = path.join(userDataPath, 'message-history.json');
    
    // Cargar historial existente o crear uno nuevo
    let history = [];
    if (fs.existsSync(historyPath)) {
      try {
        const historyData = fs.readFileSync(historyPath, 'utf8');
        history = JSON.parse(historyData);
      } catch (parseError) {
        console.error('Error al parsear historial de mensajes:', parseError);
        // Continuar con un historial vacío si hay error
      }
    }
    
    // Añadir nuevo mensaje al historial
    history.push({
      id: Date.now().toString(),
      recipient: recipient,
      message: messageText,
      timestamp: new Date().toISOString(),
      status: 'sent'
    });
    
    // Limitar el historial a 500 mensajes para evitar archivos muy grandes
    if (history.length > 500) {
      history = history.slice(-500);
    }
    
    // Guardar historial actualizado
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
  } catch (error) {
    console.error('Error al guardar mensaje en historial:', error);
    // No bloqueamos el flujo principal si hay error
  }
}

/**
 * Carga el historial de mensajes enviados
 * @returns {Array} - Historial de mensajes
 */
function getMessageHistory() {
  try {
    const userDataPath = electron.app.getPath('userData');
    const historyPath = path.join(userDataPath, 'message-history.json');
    
    if (!fs.existsSync(historyPath)) {
      return [];
    }
    
    const historyData = fs.readFileSync(historyPath, 'utf8');
    return JSON.parse(historyData);
  } catch (error) {
    console.error('Error al cargar historial de mensajes:', error);
    return [];
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
  logoutWhatsApp,
  initializeWhatsAppClient,
  getMessageHistory
};