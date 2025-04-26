const { ipcMain } = require('electron');

/**
 * Configura manejadores de IPC específicos para WhatsApp
 * @param {Object} whatsappService - Servicio de WhatsApp
 * @param {BrowserWindow} mainWindow - Ventana principal de Electron
 */
function setupWhatsAppIPC(whatsappService, mainWindow) {
  console.log(`[IPC] Configurando eventos WhatsApp para la interfaz de usuario`);

  // Notificar al frontend cuando esté listo para recibir eventos
  if (mainWindow) {
    mainWindow.on('ready-to-show', () => {
      console.log(`[IPC] Ventana principal lista para recibir eventos WhatsApp`);
      
      // Configurar utilidades de prueba para el frontend
      mainWindow.webContents.executeJavaScript(`
        console.log('[WhatsApp] Inicializando soporte en el frontend');
        
        // Función de utilidad para pruebas desde la consola del navegador
        window.testWhatsApp = function() {
          console.log('[WhatsApp] Ejecutando prueba desde frontend');
          if (window.api && window.api.sendWhatsAppMessage) {
            console.log('[WhatsApp] Enviando mensaje de prueba');
            window.api.sendWhatsAppMessage({ action: 'connect' })
              .then(result => console.log('[WhatsApp] Respuesta:', result))
              .catch(err => console.error('[WhatsApp] Error:', err));
            return true;
          } else {
            console.error('[WhatsApp] API no disponible');
            return false;
          }
        };
      `).catch(err => console.error('[IPC] Error al configurar utilidades de WhatsApp en el frontend:', err));
    });
    
    // Configurar envío periódico del estado de WhatsApp al frontend (cada minuto)
    // Esto permite que la interfaz se actualice incluso si no hay otros eventos
    const whatsappStatusInterval = setInterval(() => {
      if (mainWindow.isDestroyed()) {
        clearInterval(whatsappStatusInterval);
        return;
      }
      
      // Verificar estado actual y notificar al frontend
      const isConnected = whatsappService && typeof whatsappService.isWhatsAppConnected === 'function' 
                         ? whatsappService.isWhatsAppConnected() 
                         : false;
      
      mainWindow.webContents.send('whatsapp-status-update', { 
        connected: isConnected,
        timestamp: new Date().toISOString()
      });
    }, 60000); // cada 60 segundos
    
    // Limpiar intervalo cuando la ventana se cierra
    mainWindow.on('closed', () => {
      clearInterval(whatsappStatusInterval);
    });
  }

  console.log(`[IPC] Configuración de eventos WhatsApp completada`);
}

module.exports = { setupWhatsAppIPC };