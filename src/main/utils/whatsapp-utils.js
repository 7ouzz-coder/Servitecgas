/**
 * Utilidades mejoradas para la inicialización y gestión de WhatsApp
 */

// Variable global para rastrear el estado de WhatsApp
window.whatsappStatus = {
    initialized: false,
    connected: false,
    qrGenerated: false,
    error: null
  };
  
  /**
   * Inicializa el sistema de WhatsApp y configura todo lo necesario
   * @returns {Promise<boolean>} - true si la inicialización fue exitosa
   */
  async function initializeWhatsApp() {
    console.log('🔄 Inicializando sistema de WhatsApp...');
    
    if (window.whatsappStatus.initialized) {
      console.log('✅ Sistema WhatsApp ya inicializado');
      return true;
    }
    
    try {
      // 1. Verificar si tenemos acceso a las APIs necesarias
      if (!window.api) {
        throw new Error('API de Electron no disponible');
      }
      
      // 2. Cargar las bibliotecas necesarias
      console.log('🔄 Cargando bibliotecas para WhatsApp...');
      await loadQRLibrary();
      
      // 3. Configurar los listeners de eventos
      console.log('🔄 Configurando listeners para eventos de WhatsApp...');
      setupWhatsAppEventListeners();
      
      // 4. Verificar estado actual de WhatsApp
      console.log('🔄 Verificando estado actual de WhatsApp...');
      const isConnected = await checkWhatsAppStatus();
      
      // 5. Marcar como inicializado
      window.whatsappStatus.initialized = true;
      window.whatsappStatus.connected = isConnected;
      
      console.log(`✅ Sistema WhatsApp inicializado (Conectado: ${isConnected})`);
      return true;
    } catch (error) {
      console.error('❌ Error al inicializar sistema WhatsApp:', error);
      window.whatsappStatus.error = error.message;
      return false;
    }
  }
  
  /**
   * Carga la biblioteca necesaria para generar códigos QR
   * @returns {Promise<void>}
   */
  async function loadQRLibrary() {
    // Verifica si QRCode ya está disponible globalmente
    if (window.QRCode) {
      console.log('✅ QRCode ya está disponible');
      return;
    }
    
    return new Promise((resolve, reject) => {
      console.log('🔄 Cargando biblioteca QRCode.js...');
      
      // Crear elemento script
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.integrity = 'sha512-CNgIRecGo7nphbeZ04Sc13ka07paqdeTu0WR1IM4kNcpmBAUSHSQX0FslNhTDadL4O5SAGapGt4FodqL8My0mA==';
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'no-referrer';
      script.async = true;
      
      // Configurar eventos de carga
      script.onload = () => {
        console.log('✅ QRCode.js cargado correctamente');
        resolve();
      };
      
      script.onerror = (error) => {
        console.error('❌ Error al cargar QRCode.js:', error);
        // No rechazar la promesa, continuaremos usando el método alternativo
        resolve();
      };
      
      // Agregar al documento
      document.head.appendChild(script);
    });
  }
  
  /**
   * Configura los listeners para eventos de WhatsApp
   */
  function setupWhatsAppEventListeners() {
    if (!window.api) return;
    
    // QR Code generado
    if (window.api.onWhatsAppQR) {
      window.api.onWhatsAppQR((qrData) => {
        console.log('📱 Código QR recibido de WhatsApp', typeof qrData);
        window.whatsappStatus.qrGenerated = true;
        
        // Disparar evento personalizado para que cualquier componente pueda reaccionar
        const event = new CustomEvent('whatsapp-qr-received', { detail: qrData });
        document.dispatchEvent(event);
      });
    }
    
    // WhatsApp listo/conectado
    if (window.api.onWhatsAppReady) {
      window.api.onWhatsAppReady(() => {
        console.log('✅ WhatsApp conectado y listo');
        window.whatsappStatus.connected = true;
        window.whatsappStatus.qrGenerated = false;
        
        // Mostrar notificación
        showNotification('success', 'WhatsApp conectado correctamente');
        
        // Disparar evento
        document.dispatchEvent(new Event('whatsapp-connected'));
      });
    }
    
    // Error de autenticación
    if (window.api.onWhatsAppAuthFailure) {
      window.api.onWhatsAppAuthFailure(() => {
        console.error('❌ Error de autenticación de WhatsApp');
        window.whatsappStatus.connected = false;
        window.whatsappStatus.error = 'Error de autenticación';
        
        // Mostrar notificación
        showNotification('danger', 'Error de autenticación en WhatsApp');
        
        // Disparar evento
        document.dispatchEvent(new Event('whatsapp-auth-failure'));
      });
    }
    
    // Desconexión
    if (window.api.onWhatsAppDisconnected) {
      window.api.onWhatsAppDisconnected(() => {
        console.log('🔌 WhatsApp desconectado');
        window.whatsappStatus.connected = false;
        
        // Mostrar notificación
        showNotification('warning', 'WhatsApp se ha desconectado');
        
        // Disparar evento
        document.dispatchEvent(new Event('whatsapp-disconnected'));
      });
    }
  }
  
  /**
   * Verifica el estado actual de WhatsApp
   * @returns {Promise<boolean>} - true si WhatsApp está conectado
   */
  async function checkWhatsAppStatus() {
    try {
      if (window.api && window.api.isWhatsAppConnected) {
        const isConnected = await window.api.isWhatsAppConnected();
        console.log(`Estado de WhatsApp: ${isConnected ? 'Conectado ✅' : 'Desconectado ❌'}`);
        return isConnected;
      }
      return false;
    } catch (error) {
      console.error('Error al verificar estado de WhatsApp:', error);
      return false;
    }
  }
  
  /**
   * Muestra una notificación en la interfaz
   * @param {string} type - Tipo de notificación (success, danger, warning, info)
   * @param {string} message - Mensaje a mostrar
   */
  function showNotification(type, message) {
    // Usar función global si existe
    if (typeof window.showAlert === 'function') {
      window.showAlert(type, message);
      return;
    }
    
    // Implementación alternativa
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) {
      // Crear contenedor de alertas si no existe
      const container = document.createElement('div');
      container.id = 'alert-container';
      container.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
      container.style.zIndex = '9999';
      document.body.appendChild(container);
    }
    
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type} alert-dismissible fade show`;
    alertElement.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    const container = document.getElementById('alert-container');
    container.appendChild(alertElement);
    
    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
      if (alertElement.parentNode) {
        try {
          const bsAlert = new bootstrap.Alert(alertElement);
          bsAlert.close();
        } catch (e) {
          // Si falla, eliminar manualmente
          alertElement.remove();
        }
      }
    }, 5000);
  }
  
  /**
   * Solicita explícitamente la conexión con WhatsApp
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async function connectWhatsApp() {
    try {
      console.log('🔄 Solicitando conexión con WhatsApp...');
      
      // Inicializar WhatsApp si no se ha hecho
      if (!window.whatsappStatus.initialized) {
        await initializeWhatsApp();
      }
      
      // Verificar si la API está disponible
      if (!window.api) {
        throw new Error('API de Electron no disponible');
      }
      
      // Intentar métodos alternativos en caso de que uno falle
      try {
        // Método 1: Usando la función sendWhatsAppMessage con acción 'connect'
        if (window.api.sendWhatsAppMessage) {
          const result = await window.api.sendWhatsAppMessage({ action: 'connect' });
          console.log('✅ Solicitud de conexión enviada vía sendWhatsAppMessage', result);
          return result;
        }
      } catch (error) {
        console.warn('⚠️ Error al conectar usando sendWhatsAppMessage:', error);
      }
      
      try {
        // Método 2: Usando la función initializeWhatsApp
        if (window.api.initializeWhatsApp) {
          const result = await window.api.initializeWhatsApp();
          console.log('✅ Solicitud de conexión enviada vía initializeWhatsApp', result);
          return result;
        }
      } catch (error) {
        console.warn('⚠️ Error al conectar usando initializeWhatsApp:', error);
      }
      
      throw new Error('No se pudo conectar con WhatsApp: métodos de conexión no disponibles');
    } catch (error) {
      console.error('❌ Error al solicitar conexión con WhatsApp:', error);
      window.whatsappStatus.error = error.message;
      return { success: false, message: error.message };
    }
  }
  
  // Exportar funciones al ámbito global
  window.whatsAppUtils = {
    initialize: initializeWhatsApp,
    connect: connectWhatsApp,
    checkStatus: checkWhatsAppStatus
  };
  
  // Auto-inicializar cuando se carga el script
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Script de utilidades WhatsApp cargado');
    
    // Inicializar automáticamente después de un breve retraso
    setTimeout(() => {
      initializeWhatsApp().catch(error => {
        console.error('Error en auto-inicialización:', error);
      });
    }, 1000);
  });