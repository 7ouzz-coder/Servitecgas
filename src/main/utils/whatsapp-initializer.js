/**
 * Este script permite inicializar WhatsApp automáticamente al cargar la aplicación
 * y proporciona métodos para controlar su funcionamiento.
 */

// Estado global de WhatsApp
window.WHATSAPP_STATE = {
    initialized: false,
    connecting: false,
    connected: false,
    qrCode: null,
    error: null,
    lastUpdated: null
  };
  
  // Configuración
  const WHATSAPP_CONFIG = {
    autoInitialize: true,       // Inicializar automáticamente
    retryOnError: true,         // Reintentar en caso de error
    maxRetries: 3,              // Máximo número de reintentos
    retryDelay: 3000,           // Retraso entre reintentos (ms)
    debugMode: true             // Modo debug para más logs
  };
  
  /**
   * Inicializar el sistema de WhatsApp
   * @returns {Promise<boolean>} Resultado de la inicialización
   */
  async function initializeWhatsApp() {
    console.log('📱 Inicializando sistema WhatsApp...');
    
    // Si ya estamos inicializados o conectados, no hacer nada
    if (window.WHATSAPP_STATE.initialized) {
      console.log('✅ Sistema WhatsApp ya inicializado');
      return true;
    }
    
    // Si estamos en proceso de conexión, no hacer nada
    if (window.WHATSAPP_STATE.connecting) {
      console.log('⏳ Sistema WhatsApp ya está conectando...');
      return false;
    }
    
    // Marcar como en proceso de conexión
    window.WHATSAPP_STATE.connecting = true;
    window.WHATSAPP_STATE.lastUpdated = new Date();
    
    try {
      // Verificar si tenemos las APIs necesarias
      if (!window.api) {
        throw new Error('API de Electron no disponible');
      }
      
      // Cargar biblioteca QR si es necesario
      await loadQRCodeLibrary();
      
      // Configurar event listeners
      setupWhatsAppEventListeners();
      
      // Verificar el estado actual
      const connected = await checkWhatsAppStatus();
      
      // Actualizar estado
      window.WHATSAPP_STATE.initialized = true;
      window.WHATSAPP_STATE.connected = connected;
      window.WHATSAPP_STATE.connecting = false;
      window.WHATSAPP_STATE.lastUpdated = new Date();
      
      console.log(`✅ Sistema WhatsApp inicializado (Conectado: ${connected})`);
      return true;
    } catch (error) {
      console.error('❌ Error al inicializar WhatsApp:', error);
      
      // Actualizar estado
      window.WHATSAPP_STATE.error = error.message;
      window.WHATSAPP_STATE.connecting = false;
      window.WHATSAPP_STATE.lastUpdated = new Date();
      
      // Reintentar si está configurado
      if (WHATSAPP_CONFIG.retryOnError) {
        return retryInitialization();
      }
      
      return false;
    }
  }
  
  /**
   * Reintentar la inicialización con delay
   * @param {number} attemptCount - Número de intento actual
   * @returns {Promise<boolean>} Resultado del reintento
   */
  async function retryInitialization(attemptCount = 1) {
    if (attemptCount > WHATSAPP_CONFIG.maxRetries) {
      console.error(`❌ Se alcanzó el máximo de ${WHATSAPP_CONFIG.maxRetries} intentos para inicializar WhatsApp`);
      return false;
    }
    
    console.log(`🔄 Reintentando inicialización de WhatsApp (intento ${attemptCount}/${WHATSAPP_CONFIG.maxRetries})...`);
    
    return new Promise(resolve => {
      setTimeout(async () => {
        try {
          window.WHATSAPP_STATE.connecting = true;
          
          // Verificar si tenemos las APIs necesarias
          if (!window.api) {
            throw new Error('API de Electron no disponible');
          }
          
          // Configurar event listeners nuevamente
          setupWhatsAppEventListeners();
          
          // Verificar el estado actual
          const connected = await checkWhatsAppStatus();
          
          // Actualizar estado
          window.WHATSAPP_STATE.initialized = true;
          window.WHATSAPP_STATE.connected = connected;
          window.WHATSAPP_STATE.connecting = false;
          window.WHATSAPP_STATE.error = null;
          window.WHATSAPP_STATE.lastUpdated = new Date();
          
          console.log(`✅ Reintento ${attemptCount} exitoso (Conectado: ${connected})`);
          resolve(true);
        } catch (error) {
          console.error(`❌ Error en reintento ${attemptCount}:`, error);
          
          window.WHATSAPP_STATE.error = error.message;
          window.WHATSAPP_STATE.connecting = false;
          window.WHATSAPP_STATE.lastUpdated = new Date();
          
          // Intentar de nuevo recursivamente
          resolve(retryInitialization(attemptCount + 1));
        }
      }, WHATSAPP_CONFIG.retryDelay);
    });
  }
  
  /**
   * Cargar biblioteca para generar códigos QR
   * @returns {Promise<void>}
   */
  async function loadQRCodeLibrary() {
    // Verificar si ya está disponible
    if (window.QRCode) {
      if (WHATSAPP_CONFIG.debugMode) {
        console.log('✅ Biblioteca QRCode ya disponible');
      }
      return;
    }
    
    return new Promise((resolve, reject) => {
      console.log('🔄 Cargando biblioteca QRCode...');
      
      // Crear elemento script
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.integrity = 'sha512-CNgIRecGo7nphbeZ04Sc13ka07paqdeTu0WR1IM4kNcpmBAUSHSQX0FslNhTDadL4O5SAGapGt4FodqL8My0mA==';
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'no-referrer';
      script.async = true;
      
      // Configurar eventos
      script.onload = () => {
        console.log('✅ Biblioteca QRCode cargada correctamente');
        resolve();
      };
      
      script.onerror = (error) => {
        console.warn('⚠️ Error al cargar biblioteca QRCode:', error);
        // No rechazamos para continuar con método alternativo
        resolve();
      };
      
      // Agregar al documento
      document.head.appendChild(script);
    });
  }
  
  /**
   * Configurar los listeners para eventos de WhatsApp
   */
  function setupWhatsAppEventListeners() {
    if (!window.api) return;
    
    // QR Code
    if (window.api.onWhatsAppQR) {
      window.api.onWhatsAppQR((qrData) => {
        console.log('📱 Código QR de WhatsApp recibido');
        
        // Guardar datos del QR
        window.WHATSAPP_STATE.qrCode = qrData;
        window.WHATSAPP_STATE.lastUpdated = new Date();
        
        // Disparar evento personalizado
        const event = new CustomEvent('whatsapp-qr-received', { detail: qrData });
        document.dispatchEvent(event);
      });
    }
    
    // WhatsApp conectado
    if (window.api.onWhatsAppReady) {
      window.api.onWhatsAppReady(() => {
        console.log('✅ WhatsApp conectado y listo');
        
        // Actualizar estado
        window.WHATSAPP_STATE.connected = true;
        window.WHATSAPP_STATE.connecting = false;
        window.WHATSAPP_STATE.qrCode = null;
        window.WHATSAPP_STATE.error = null;
        window.WHATSAPP_STATE.lastUpdated = new Date();
        
        // Disparar evento
        document.dispatchEvent(new Event('whatsapp-connected'));
      });
    }
    
    // Error de autenticación
    if (window.api.onWhatsAppAuthFailure) {
      window.api.onWhatsAppAuthFailure(() => {
        console.error('❌ Error de autenticación en WhatsApp');
        
        // Actualizar estado
        window.WHATSAPP_STATE.connected = false;
        window.WHATSAPP_STATE.connecting = false;
        window.WHATSAPP_STATE.error = 'Error de autenticación';
        window.WHATSAPP_STATE.lastUpdated = new Date();
        
        // Disparar evento
        document.dispatchEvent(new Event('whatsapp-auth-failure'));
      });
    }
    
    // Desconexión
    if (window.api.onWhatsAppDisconnected) {
      window.api.onWhatsAppDisconnected(() => {
        console.log('🔌 WhatsApp desconectado');
        
        // Actualizar estado
        window.WHATSAPP_STATE.connected = false;
        window.WHATSAPP_STATE.connecting = false;
        window.WHATSAPP_STATE.lastUpdated = new Date();
        
        // Disparar evento
        document.dispatchEvent(new Event('whatsapp-disconnected'));
      });
    }
  }
  
  /**
   * Verificar el estado actual de la conexión WhatsApp
   * @returns {Promise<boolean>} true si está conectado
   */
  async function checkWhatsAppStatus() {
    try {
      if (window.api && window.api.isWhatsAppConnected) {
        const isConnected = await window.api.isWhatsAppConnected();
        if (WHATSAPP_CONFIG.debugMode) {
          console.log(`Estado de WhatsApp: ${isConnected ? 'Conectado ✅' : 'Desconectado ❌'}`);
        }
        return isConnected;
      }
      return false;
    } catch (error) {
      console.error('Error al verificar estado de WhatsApp:', error);
      return false;
    }
  }
  
  /**
   * Solicitar conexión con WhatsApp
   * @returns {Promise<Object>} Resultado de la solicitud
   */
  async function connectToWhatsApp() {
    console.log('🔄 Solicitando conexión con WhatsApp...');
    
    // Verificar si ya estamos conectados
    if (window.WHATSAPP_STATE.connected) {
      console.log('✅ WhatsApp ya está conectado');
      return { success: true, message: 'WhatsApp ya está conectado' };
    }
    
    // Verificar si ya estamos en proceso de conexión
    if (window.WHATSAPP_STATE.connecting) {
      console.log('⏳ Ya hay una solicitud de conexión en proceso');
      return { success: false, message: 'Ya hay una solicitud de conexión en proceso' };
    }
    
    // Actualizar estado
    window.WHATSAPP_STATE.connecting = true;
    window.WHATSAPP_STATE.error = null;
    window.WHATSAPP_STATE.lastUpdated = new Date();
    
    try {
      // Verificar APIs disponibles
      if (!window.api) {
        throw new Error('API de Electron no disponible');
      }
      
      // Método 1: sendWhatsAppMessage con action=connect
      if (window.api.sendWhatsAppMessage) {
        try {
          const result = await window.api.sendWhatsAppMessage({ action: 'connect' });
          console.log('✅ Solicitud de conexión enviada mediante sendWhatsAppMessage', result);
          return { success: true, message: 'Solicitud de conexión enviada' };
        } catch (error) {
          console.warn('⚠️ Error al conectar usando sendWhatsAppMessage:', error);
          // Continuar con siguiente método
        }
      }
      
      // Método 2: initializeWhatsApp
      if (window.api.initializeWhatsApp) {
        try {
          const result = await window.api.initializeWhatsApp();
          console.log('✅ Solicitud de conexión enviada mediante initializeWhatsApp', result);
          return { success: true, message: 'Solicitud de conexión enviada' };
        } catch (error) {
          console.warn('⚠️ Error al conectar usando initializeWhatsApp:', error);
          // Continuar con siguiente método
        }
      }
      
      throw new Error('No se pudo conectar con WhatsApp: métodos no disponibles');
    } catch (error) {
      console.error('❌ Error al solicitar conexión con WhatsApp:', error);
      
      // Actualizar estado
      window.WHATSAPP_STATE.connecting = false;
      window.WHATSAPP_STATE.error = error.message;
      window.WHATSAPP_STATE.lastUpdated = new Date();
      
      return { success: false, message: error.message };
    }
  }
  
  /**
   * Cerrar sesión de WhatsApp
   * @returns {Promise<Object>} Resultado de la operación
   */
  async function logoutWhatsApp() {
    console.log('🔄 Cerrando sesión de WhatsApp...');
    
    try {
      if (!window.api || !window.api.logoutWhatsApp) {
        throw new Error('Función de cierre de sesión no disponible');
      }
      
      // Solicitar cierre de sesión
      const result = await window.api.logoutWhatsApp();
      
      if (result.success) {
        console.log('✅ Sesión de WhatsApp cerrada correctamente');
        
        // Actualizar estado
        window.WHATSAPP_STATE.connected = false;
        window.WHATSAPP_STATE.qrCode = null;
        window.WHATSAPP_STATE.lastUpdated = new Date();
        
        // Disparar evento
        document.dispatchEvent(new Event('whatsapp-logged-out'));
      } else {
        throw new Error(result.message || 'Error no especificado');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error al cerrar sesión de WhatsApp:', error);
      
      // Actualizar estado
      window.WHATSAPP_STATE.error = error.message;
      window.WHATSAPP_STATE.lastUpdated = new Date();
      
      return { success: false, message: error.message };
    }
  }
  
  // Exportar funciones al ámbito global
  window.whatsAppInitializer = {
    init: initializeWhatsApp,
    connect: connectToWhatsApp,
    logout: logoutWhatsApp,
    checkStatus: checkWhatsAppStatus,
    getState: () => ({ ...window.WHATSAPP_STATE })
  };
  
  // Auto-inicializar cuando se carga el script (si está habilitado)
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Script de inicialización de WhatsApp cargado');
    
    if (WHATSAPP_CONFIG.autoInitialize) {
      console.log('🔄 Auto-inicialización de WhatsApp activada');
      
      // Pequeño retraso para asegurar que todo esté cargado
      setTimeout(() => {
        initializeWhatsApp().catch(error => {
          console.error('Error en auto-inicialización de WhatsApp:', error);
        });
      }, 1500);
    }
  });