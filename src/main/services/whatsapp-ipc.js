const { ipcMain } = require('electron');

/**
 * Configura manejadores de IPC específicos para WhatsApp
 * @param {Object} whatsappService - Servicio de WhatsApp
 * @param {BrowserWindow} mainWindow - Ventana principal de Electron
 */
function setupWhatsAppIPC(whatsappService, mainWindow) {
  // Verificar conexión de WhatsApp
  ipcMain.handle('is-whatsapp-connected', () => {
    console.log(`[IPC] Verificando estado de WhatsApp`);
    const isConnected = whatsappService.isWhatsAppConnected();
    console.log(`[IPC] Estado de WhatsApp: ${isConnected ? 'Conectado' : 'Desconectado'}`);
    return isConnected;
  });

  // Inicializar WhatsApp explícitamente
  ipcMain.handle('initialize-whatsapp', async () => {
    console.log(`[IPC] Solicitud explícita para inicializar WhatsApp`);
    try {
      await whatsappService.initializeWhatsAppClient();
      return { success: true, message: 'Inicialización de WhatsApp comenzada' };
    } catch (error) {
      console.error(`[IPC] Error al inicializar WhatsApp:`, error);
      return { 
        success: false, 
        message: error.message || 'Error al inicializar WhatsApp' 
      };
    }
  });

  // Cerrar sesión de WhatsApp
  ipcMain.handle('logout-whatsapp', async () => {
    console.log(`[IPC] Solicitud para cerrar sesión de WhatsApp`);
    try {
      const result = await whatsappService.logoutWhatsApp();
      console.log(`[IPC] Resultado de cierre de sesión:`, result);
      return result;
    } catch (error) {
      console.error(`[IPC] Error al cerrar sesión:`, error);
      return {
        success: false,
        message: error.message || 'Error al cerrar sesión'
      };
    }
  });

  // Enviar mensaje de WhatsApp (incluye acción de conectar)
  ipcMain.handle('send-whatsapp-message', async (event, messageData) => {
    try {
      // Si es una solicitud de conexión, iniciar el proceso de autenticación
      if (messageData.action === 'connect') {
        console.log(`[IPC] Solicitud para iniciar conexión de WhatsApp`);
        
        // Notificar al frontend
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('whatsapp-status-changed', {
            status: 'connecting',
            message: 'Iniciando conexión con WhatsApp...'
          });
        }
        
        // Inicializar cliente
        setTimeout(() => {
          whatsappService.initializeWhatsAppClient()
            .catch(error => {
              console.error(`[IPC] Error al inicializar WhatsApp:`, error);
              
              // Notificar error al frontend
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('whatsapp-initialization-failed', {
                  error: error.message || 'Error desconocido'
                });
              }
            });
        }, 500);
        
        return { 
          success: true, 
          message: 'Iniciando conexión con WhatsApp' 
        };
      }
      
      // Para mensajes normales
      console.log(`[IPC] Solicitud para enviar mensaje a: ${messageData.phone}`);
      const result = await whatsappService.sendWhatsAppMessage(messageData.phone, messageData.message);
      console.log(`[IPC] Resultado de envío:`, result.success);
      return result;
    } catch (error) {
      console.error(`[IPC] Error al procesar solicitud de WhatsApp:`, error);
      return { 
        success: false, 
        message: error.message || 'Error al procesar solicitud de WhatsApp' 
      };
    }
  });

  // Obtener historial de mensajes
  ipcMain.handle('get-whatsapp-message-history', () => {
    console.log(`[IPC] Obteniendo historial de mensajes WhatsApp`);
    try {
      return whatsappService.getMessageHistory();
    } catch (error) {
      console.error(`[IPC] Error al obtener historial:`, error);
      return [];
    }
  });

  console.log(`[IPC] Manejadores de WhatsApp configurados correctamente`);
}

module.exports = { setupWhatsAppIPC };