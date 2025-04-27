const { Client } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const electron = require('electron');

// Variables para gestionar el cliente de WhatsApp
let whatsappClient = null;
let isWhatsAppReady = false;
let sessionDataPath = null;
let mainWindowRef = null;
let initializationInProgress = false;
let reconnectAttempts = 0;
let maxReconnectAttempts = 3;
let reconnectInterval = null;
let messageHistory = [];
let messageHistoryPath = null;

/**
 * Configura el servicio de WhatsApp
 * @param {BrowserWindow} mainWindow - Ventana principal de la aplicación
 */
function setupWhatsAppService(mainWindow) {
  // Guardar referencia a la ventana principal
  mainWindowRef = mainWindow;
  
  // Definir rutas para almacenamiento
  const userDataPath = electron.app.getPath('userData');
  const whatsappDataPath = path.join(userDataPath, 'whatsapp-session');
  
  // Crear carpeta si no existe
  if (!fs.existsSync(whatsappDataPath)) {
    fs.mkdirSync(whatsappDataPath, { recursive: true });
  }
  
  sessionDataPath = path.join(whatsappDataPath, 'session.json');
  messageHistoryPath = path.join(userDataPath, 'message-history.json');
  
  // Cargar historial de mensajes si existe
  loadMessageHistory();
  
  // Verificar si existe una sesión guardada e iniciar automáticamente
  if (fs.existsSync(sessionDataPath)) {
    console.log('Sesión de WhatsApp encontrada, iniciando automáticamente...');
    // Aumentar el tiempo de espera para asegurar que todos los recursos estén cargados
    setTimeout(() => {
      initializeWhatsAppClient();
    }, 5000); // 5 segundos
  } else {
    console.log('No se inicia WhatsApp automáticamente. El usuario deberá conectarse manualmente.');
  }
}

/**
 * Inicializa el cliente de WhatsApp con manejo mejorado de sesión y reconexión
 * @returns {Promise<void>}
 */
async function initializeWhatsAppClient() {
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
      
      // Guardar la sesión cuando esté lista
      try {
        if (whatsappClient && whatsappClient.session) {
          const sessionJson = JSON.stringify(whatsappClient.session);
          console.log(`Guardando sesión de WhatsApp (longitud: ${sessionJson.length} caracteres)`);
          fs.writeFileSync(sessionDataPath, sessionJson, 'utf8');
          console.log('Sesión de WhatsApp guardada correctamente');
          
          // Verificar que el archivo se guardó correctamente
          if (fs.existsSync(sessionDataPath)) {
            const stats = fs.statSync(sessionDataPath);
            console.log(`Archivo de sesión guardado: ${stats.size} bytes`);
          }
        } else {
          console.error('No hay datos de sesión disponibles para guardar');
        }
      } catch (error) {
        console.error('Error detallado al guardar sesión de WhatsApp:', error);
      }
      
      // Notificar al frontend
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('whatsapp-ready');
        mainWindowRef.webContents.send('show-alert', {
          type: 'success',
          message: 'WhatsApp conectado correctamente'
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
    await whatsappClient.initialize();
    console.log('Cliente de WhatsApp inicializado correctamente');
    
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
    
    throw error; // Re-lanzar el error para manejo superior
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
        initializeWhatsAppClient().catch(error => {
          console.error('Error al intentar reconexión:', error);
        });
      } catch (error) {
        console.error('Error al intentar reconexión:', error);
      }
    } else {
      console.log('Inicialización ya en progreso, esperando...');
    }
  }, 30000); // Intentar cada 30 segundos
}

/**
 * Carga el historial de mensajes guardado
 */
function loadMessageHistory() {
  try {
    if (fs.existsSync(messageHistoryPath)) {
      const data = fs.readFileSync(messageHistoryPath, 'utf8');
      messageHistory = JSON.parse(data);
      console.log(`Historial de mensajes cargado: ${messageHistory.length} mensajes`);
    } else {
      messageHistory = [];
      console.log('No se encontró historial de mensajes, se inicia uno nuevo');
    }
  } catch (error) {
    console.error('Error al cargar historial de mensajes:', error);
    messageHistory = [];
  }
}

/**
 * Guarda un mensaje enviado en el historial local
 * @param {string} recipient - Número del destinatario
 * @param {string} messageText - Texto del mensaje
 * @param {string} status - Estado del mensaje ('sent', 'failed', etc.)
 */
function saveMessageToHistory(recipient, messageText, status = 'sent') {
  try {
    // Crear nuevo registro
    const newMessage = {
      id: Date.now().toString(),
      recipient: recipient,
      message: messageText,
      timestamp: new Date().toISOString(),
      status: status
    };
    
    // Añadir al historial
    messageHistory.push(newMessage);
    
    // Limitar el historial a 500 mensajes para evitar archivos muy grandes
    if (messageHistory.length > 500) {
      messageHistory = messageHistory.slice(-500);
    }
    
    // Guardar en disco
    fs.writeFileSync(messageHistoryPath, JSON.stringify(messageHistory, null, 2), 'utf8');
    console.log('Mensaje guardado en historial');
  } catch (error) {
    console.error('Error al guardar mensaje en historial:', error);
  }
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
    
    // Registrar el mensaje enviado en el historial local
    saveMessageToHistory(to, message, 'sent');
    
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
    
    // Guardar el mensaje fallido en el historial
    saveMessageToHistory(to, message, 'failed');
    
    return {
      success: false,
      message: `Error al enviar mensaje: ${error.message || 'Error desconocido'}`
    };
  }
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
      console.log('Archivo de sesión eliminado correctamente');
    }
    
    isWhatsAppReady = false;
    whatsappClient = null;
    
    // Notificar al frontend
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('whatsapp-disconnected');
      mainWindowRef.webContents.send('show-alert', {
        type: 'success',
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
}

/**
 * Devuelve el historial de mensajes enviados
 * @returns {Array} - Historial de mensajes
 */
function getMessageHistory() {
  return messageHistory;
}

/**
 * Verifica si WhatsApp está conectado
 * @returns {boolean} - Estado de conexión
 */
function isWhatsAppConnected() {
  return isWhatsAppReady;
}

// Exportar las funciones públicas del módulo
module.exports = {
  setupWhatsAppService,
  sendWhatsAppMessage,
  isWhatsAppConnected,
  logoutWhatsApp,
  initializeWhatsAppClient,
  getMessageHistory
};