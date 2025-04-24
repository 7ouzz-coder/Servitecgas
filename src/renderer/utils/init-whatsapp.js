/**
 * Configura todo lo necesario para la integración con WhatsApp
 */
async function initializeWhatsApp() {
    console.log('Inicializando integración con WhatsApp...');
    
    try {
      // 1. Cargar la biblioteca QRCode.js
      await loadQRCodeLibrary();
      console.log('✓ Biblioteca QRCode cargada');
      
      // 2. Cargar React y componentes
      await loadReact();
      console.log('✓ React cargado');
      
      await registerWhatsAppComponents();
      console.log('✓ Componentes de WhatsApp registrados');
      
      // 3. Configurar los listeners de eventos
      setupWhatsAppEventListeners();
      console.log('✓ Listeners de eventos configurados');
      
      console.log('Integración con WhatsApp inicializada correctamente');
      return true;
    } catch (error) {
      console.error('Error al inicializar integración con WhatsApp:', error);
      return false;
    }
  }
  
  /**
   * Configura los listeners de eventos de WhatsApp en el proceso de renderizado
   */
  function setupWhatsAppEventListeners() {
    if (!window.api) {
      console.error('API de Electron no disponible para configurar listeners de WhatsApp');
      return false;
    }
    
    console.log('Configurando listeners de eventos WhatsApp...');
    
    // Definir listeners si no existen las funciones
    if (!window.api.onWhatsAppQR) {
      window.api.onWhatsAppQR = (callback) => {
        console.log('Registrando listener para evento QR');
        window.addEventListener('whatsapp-qr', (event) => {
          console.log('Evento QR recibido:', event);
          if (event.detail) {
            callback(event.detail);
          }
        });
        
        // Establecer también un listener directo para el IPC
        if (window.ipcRenderer) {
          window.ipcRenderer.on('whatsapp-qr', (_, qrData) => {
            console.log('QR recibido vía IPC:', qrData ? 'Datos recibidos' : 'Sin datos');
            const event = new CustomEvent('whatsapp-qr', { detail: qrData });
            window.dispatchEvent(event);
          });
        }
        
        // Notificar al proceso principal que estamos listos para recibir eventos
        if (window.api.sendToMain) {
          window.api.sendToMain('renderer-ready-for-whatsapp-events');
        }
      };
    }
    
    if (!window.api.onWhatsAppReady) {
      window.api.onWhatsAppReady = (callback) => {
        window.addEventListener('whatsapp-ready', () => callback());
        
        if (window.ipcRenderer) {
          window.ipcRenderer.on('whatsapp-ready', () => {
            console.log('Evento ready recibido vía IPC');
            window.dispatchEvent(new Event('whatsapp-ready'));
            callback();
          });
        }
      };
    }
    
    if (!window.api.onWhatsAppAuthFailure) {
      window.api.onWhatsAppAuthFailure = (callback) => {
        window.addEventListener('whatsapp-auth-failure', () => callback());
        
        if (window.ipcRenderer) {
          window.ipcRenderer.on('whatsapp-auth-failure', () => {
            console.log('Evento auth-failure recibido vía IPC');
            window.dispatchEvent(new Event('whatsapp-auth-failure'));
            callback();
          });
        }
      };
    }
    
    if (!window.api.onWhatsAppDisconnected) {
      window.api.onWhatsAppDisconnected = (callback) => {
        window.addEventListener('whatsapp-disconnected', () => callback());
        
        if (window.ipcRenderer) {
          window.ipcRenderer.on('whatsapp-disconnected', () => {
            console.log('Evento disconnected recibido vía IPC');
            window.dispatchEvent(new Event('whatsapp-disconnected'));
            callback();
          });
        }
      };
    }
    
    // Listeners de prueba para desarrollo
    const enableTestMode = localStorage.getItem('whatsapp_test_mode') === 'true';
    if (enableTestMode) {
      console.log('🧪 Modo de prueba WhatsApp activado');
      // Es útil para probar la generación de QR sin WhatsApp real
      setTimeout(() => {
        console.log('Generando evento QR de prueba...');
        const testQrEvent = new CustomEvent('whatsapp-qr', { 
          detail: "https://example.com/test-qr-code" 
        });
        window.dispatchEvent(testQrEvent);
      }, 3000);
    }
    
    return true;
  }
  
  /**
   * Función para solicitar manualmente la conexión de WhatsApp
   * @returns {Promise} Promesa con el resultado de la solicitud
   */
  async function requestWhatsAppConnection() {
    console.log('Solicitando conexión WhatsApp manualmente...');
    
    if (!window.api || !window.api.sendWhatsAppMessage) {
      console.error('API para WhatsApp no disponible');
      return { success: false, message: 'API para WhatsApp no disponible' };
    }
    
    try {
      // Enviar solicitud de conexión
      const result = await window.api.sendWhatsAppMessage({ action: 'connect' });
      console.log('Solicitud de conexión enviada:', result);
      
      // Si la solicitud fue exitosa, mostrar mensaje
      if (result.success) {
        // Mostrar alerta
        showConnectionAlert();
      }
      
      return result;
    } catch (error) {
      console.error('Error al solicitar conexión WhatsApp:', error);
      return { success: false, message: error.message || 'Error al solicitar conexión' };
    }
  }
  
  /**
   * Muestra una alerta explicando el proceso de conexión
   */
  function showConnectionAlert() {
    // Crear alerta estilizada
    const alertEl = document.createElement('div');
    alertEl.className = 'whatsapp-connection-alert';
    alertEl.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #DCF8C6;
      color: #075E54;
      border: 1px solid #075E54;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.2);
      z-index: 9999;
      max-width: 400px;
      font-size: 14px;
    `;
    
    alertEl.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 10px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#075E54" style="margin-right: 10px;">
          <path d="M2.004 22l1.352-4.968A9.954 9.954 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10a9.954 9.954 0 0 1-5.03-1.355L2.004 22zM8.391 7.308a.961.961 0 0 0-.371.1 1.293 1.293 0 0 0-.294.228c-.12.113-.188.211-.261.306A2.729 2.729 0 0 0 6.9 9.62c.002.49.13.967.33 1.413.409.902 1.082 1.857 1.971 2.742.214.213.423.427.648.626a9.448 9.448 0 0 0 3.84 2.046l.569.087c.185.01.37-.004.556-.013a1.99 1.99 0 0 0 .833-.231c.166-.088.324-.178.476-.3.145-.117.281-.244.408-.381.11-.104.229-.212.24-.36.002-.17-.047-.4-.138-.644-.18-.496-.523-.96-.887-1.331-.185-.188-.38-.372-.59-.55-.017-.015-.035-.029-.05-.047-.098-.082-.145-.152-.145-.22 0-.073.031-.155.093-.24.061-.079.127-.152.196-.226.119-.129.257-.276.31-.493.007-.025.01-.05.013-.076a.947.947 0 0 0-.143-.534 4.578 4.578 0 0 0-.45-.673 1.17 1.17 0 0 0-.199-.19c-.069-.05-.145-.082-.219-.095-.073-.014-.146.015-.219.055-.072.038-.139.09-.207.143l-.25.187a7.062 7.062 0 0 1-.573-.989c.1-.112.203-.231.3-.358.036-.051.074-.103.105-.159.036-.064.069-.134.086-.209.011-.049.016-.1.018-.15.002-.39-.006-.08-.021-.119a.957.957 0 0 0-.078-.159c-.047-.069-.098-.138-.15-.202-.083-.104-.112-.237-.127-.36-.015-.12-.01-.245.028-.369.038-.124.103-.24.181-.338.15-.013.029-.031.043-.046-.742-.681-1.504-1.325-2.426-1.845a1.877 1.877 0 0 0-1.148-.357z"/>
        </svg>
        <strong>Conectando WhatsApp</strong>
        <button onclick="this.parentElement.parentElement.remove()" style="margin-left: auto; background: none; border: none; cursor: pointer; color: #075E54;">✕</button>
      </div>
      <p style="margin: 0 0 10px 0;">La solicitud de conexión ha sido enviada. En breve aparecerá un código QR para escanear.</p>
      <ol style="margin: 0; padding-left: 20px;">
        <li>Abre WhatsApp en tu teléfono</li>
        <li>Ve a Configuración > Dispositivos vinculados</li>
        <li>Toca en "Vincular un dispositivo"</li>
        <li>Escanea el código QR cuando aparezca</li>
      </ol>
    `;
    
    document.body.appendChild(alertEl);
    
    // Auto-eliminar después de 15 segundos
    setTimeout(() => {
      if (alertEl.parentNode) {
        alertEl.remove();
      }
    }, 15000);
  }
  
  /**
   * Función de depuración para probar la generación del código QR
   * @returns {boolean} Resultado de la prueba
   */
  function testQRGeneration() {
    console.log('Probando generación de código QR...');
    
    // Crear un contenedor temporal
    const container = document.createElement('div');
    container.id = 'qr-test-container';
    container.style.cssText = 'position:fixed; top:10px; right:10px; width:280px; background:white; z-index:9999; border:1px solid black; padding:10px; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.2);';
    document.body.appendChild(container);
    
    // Título
    const title = document.createElement('h3');
    title.textContent = 'Prueba de Generación QR';
    title.style.margin = '0 0 10px 0';
    container.appendChild(title);
    
    // Contenedor del QR
    const qrContainer = document.createElement('div');
    qrContainer.id = 'test-qr-inner';
    qrContainer.style.width = '256px';
    qrContainer.style.height = '256px';
    qrContainer.style.margin = '0 auto';
    qrContainer.style.background = '#f0f0f0';
    qrContainer.style.display = 'flex';
    qrContainer.style.alignItems = 'center';
    qrContainer.style.justifyContent = 'center';
    qrContainer.textContent = 'Generando...';
    container.appendChild(qrContainer);
    
    // Botones
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '10px';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'space-between';
    
    // Botón de cierre
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cerrar';
    closeBtn.style.padding = '5px 10px';
    closeBtn.onclick = () => container.remove();
    
    // Botón para alternar método
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Cambiar Método';
    toggleBtn.style.padding = '5px 10px';
    toggleBtn.onclick = () => {
      // Guardar el método actual y cambiarlo
      const currentMethod = localStorage.getItem('qr_test_method') || 'qrcode';
      const newMethod = currentMethod === 'qrcode' ? 'api' : 'qrcode';
      localStorage.setItem('qr_test_method', newMethod);
      
      // Regenerar QR con nuevo método
      generateQR(qrContainer, newMethod);
    };
    
    buttonContainer.appendChild(toggleBtn);
    buttonContainer.appendChild(closeBtn);
    container.appendChild(buttonContainer);
    
    // Generar QR con método preferido o disponible
    const preferredMethod = localStorage.getItem('qr_test_method') || 'qrcode';
    generateQR(qrContainer, preferredMethod);
    
    return true;
  }
  
  /**
   * Genera un código QR en el contenedor especificado usando el método especificado
   * @param {HTMLElement} container - Contenedor donde generar el QR
   * @param {string} method - Método a usar ('qrcode' o 'api')
   */
  function generateQR(container, method) {
    try {
      // Limpiar contenedor
      container.innerHTML = '';
      
      if (method === 'qrcode' && window.QRCode) {
        console.log('Generando QR con biblioteca QRCode.js');
        
        // Generar texto único para el QR
        const qrText = `https://servitecgas.com/test?t=${Date.now()}`;
        
        new window.QRCode(container, {
          text: qrText,
          width: 256,
          height: 256,
          colorDark: "#000000",
          colorLight: "#ffffff"
        });
        
        console.log('✅ QR generado con biblioteca QRCode');
      } else {
        // Usar API externa
        console.log('Generando QR con API externa');
        
        // Generar texto único para el QR
        const qrText = `https://servitecgas.com/test?t=${Date.now()}`;
        
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrText)}`;
        container.innerHTML = `
          <img src="${qrUrl}" width="256" height="256" alt="Test QR" style="display:block; margin:0 auto;">
        `;
        
        console.log('✅ QR generado con API externa');
      }
    } catch (error) {
      console.error('Error al generar QR:', error);
      container.innerHTML = `
        <div style="color:red; border:1px solid red; padding:10px; text-align:center;">
          <p>Error al generar QR:</p>
          <p>${error.message}</p>
        </div>
      `;
    }
  }
  
  // Exportar funciones
  window.initializeWhatsApp = initializeWhatsApp;
  window.testQRGeneration = testQRGeneration;
  window.requestWhatsAppConnection = requestWhatsAppConnection;
  
  // Auto-inicializar si se carga directamente
  document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOMContentLoaded: init-whatsapp.js cargado');
    
    // Auto-inicializar si está habilitado
    const autoInit = localStorage.getItem('whatsapp_auto_init') !== 'false';
    if (autoInit) {
      try {
        // Esperar un momento para asegurar que todo esté cargado
        setTimeout(async () => {
          await initializeWhatsApp();
        }, 1000);
      } catch (error) {
        console.error('Error en auto-inicialización de WhatsApp:', error);
      }
    }
  });