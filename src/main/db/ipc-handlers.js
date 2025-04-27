const { recordChange, generateId } = require('./store');
const { checkUpcomingMaintenance, calculateNextMaintenanceDate, getMaintenanceStats, registerMaintenance } = require('../services/maintenance');
const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');
const azureConfig = require('../azure/config');

/**
 * Configura los manejadores IPC para operaciones de base de datos
 * @param {IpcMain} ipcMain - Instancia de ipcMain
 * @param {Store} store - Instancia de la base de datos
 * @param {Object} services - Servicios disponibles (authService, whatsappService, etc.)
 * @param {BrowserWindow} mainWindow - Ventana principal para notificaciones
 */
module.exports = function setupIpcHandlers(ipcMain, store, services, mainWindow, registeredHandlers = new Set()) {
  const { authService, whatsappService, backupService, updateService, syncService } = services;
  
  // Función de ayuda para registrar un manejador solo si no existe aún
  const safeHandle = (channel, handler) => {
    if (registeredHandlers.has(channel)) {
      console.log(`Manejador para '${channel}' ya registrado, omitiendo...`);
      return;
    }
    ipcMain.handle(channel, handler);
    registeredHandlers.add(channel);
  };
  
  // <-- AUTENTICACIÓN -->
  
  safeHandle('login', async (event, credentials) => {
    const result = authService.login(credentials.username, credentials.password);
    
    // Si el login es exitoso, notificar a la interfaz
    if (result.success && mainWindow) {
      mainWindow.webContents.send('auth-changed', { 
        isAuthenticated: true, 
        user: result.user 
      });
    }
    
    return result;
  });
  
  // Continúa con el resto de los manejadores, pero cambiando ipcMain.handle por safeHandle
  safeHandle('logout', () => {
    const result = authService.logout();
    
    // Notificar a la interfaz
    if (mainWindow) {
      mainWindow.webContents.send('auth-changed', { 
        isAuthenticated: false 
      });
    }
    
    return result;
  });
  
  safeHandle('check-auth', () => {
    return authService.checkAuth();
  });
  
  safeHandle('get-user-info', () => {
    return authService.getCurrentUser();
  });
  
  safeHandle('update-user', (event, userData) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      return { success: false, message: 'No hay sesión activa' };
    }
    
    return authService.updateUser(currentUser.id, userData);
  });
  
  safeHandle('change-password', (event, { currentPassword, newPassword }) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      return { success: false, message: 'No hay sesión activa' };
    }
    
    return authService.changePassword(currentUser.id, currentPassword, newPassword);
  });
  
  // Administración de usuarios (solo para admins)
  safeHandle('list-users', () => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, message: 'Acceso denegado' };
    }
    
    return { success: true, users: authService.listUsers() };
  });
  
  safeHandle('create-user', (event, userData) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, message: 'Acceso denegado' };
    }
    
    return authService.createUser(userData);
  });
  
  safeHandle('update-user-admin', (event, userId, userData) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, message: 'Acceso denegado' };
    }
    
    return authService.updateUser(userId, userData);
  });
  
  safeHandle('delete-user', (event, userId) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, message: 'Acceso denegado' };
    }
    
    return authService.deleteUser(userId);
  });

  // <-- CLIENTES -->
  
  safeHandle('get-clients', () => {
    // Verificar autenticación
    if (!authService.checkAuth().isAuthenticated) {
      return [];
    }
    
    return store.get('clients') || [];
  });

  safeHandle('add-client', (event, client) => {
    try {
      // Verificar autenticación
      if (!authService.checkAuth().isAuthenticated) {
        return { success: false, message: 'No autenticado' };
      }
      
      const clients = store.get('clients') || [];
      
      // Crear una versión limpia del cliente que solo contenga datos serializables
      const cleanClient = {
        id: client.id || generateId(),
        name: client.name || '',
        phone: client.phone || '',
        email: client.email || '',
        notes: client.notes || '',
        createdAt: new Date().toISOString(),
        createdBy: authService.getCurrentUser().id,
        lastModified: new Date().toISOString()
      };
      
      const updatedClients = [...clients, cleanClient];
      store.set('clients', updatedClients);
      
      // Registrar cambio para sincronización si existe
      if (typeof recordChange === 'function') {
        recordChange('client', 'create', cleanClient.id, cleanClient);
      }
      
      return cleanClient;
    } catch (error) {
      console.error('Error al añadir cliente:', error);
      return { success: false, message: `Error al guardar cliente: ${error.message}` };
    }
  });

  safeHandle('update-client', (event, client) => {
    const clients = store.get('clients') || [];
    const index = clients.findIndex(c => c.id === client.id);
    
    if (index !== -1) {
      const updatedClient = {
        ...clients[index],
        ...client,
        lastModified: new Date().toISOString(),
        syncStatus: 'pending'
      };
      
      clients[index] = updatedClient;
      store.set('clients', clients);
      
      // Registrar cambio para sincronización
      if (typeof recordChange === 'function') {
        recordChange('client', 'update', updatedClient.id, updatedClient);
      }
      
      return updatedClient;
    }
    
    return null;
  });

  safeHandle('delete-client', (event, clientId) => {
    const clients = store.get('clients') || [];
    const clientToDelete = clients.find(c => c.id === clientId);
    
    if (!clientToDelete) {
      return { success: false, message: 'Cliente no encontrado' };
    }
    
    const newClients = clients.filter(c => c.id !== clientId);
    store.set('clients', newClients);
    
    // También eliminar las instalaciones asociadas
    const installations = store.get('installations') || [];
    const installationsToDelete = installations.filter(i => i.clientId === clientId);
    const newInstallations = installations.filter(i => i.clientId !== clientId);
    store.set('installations', newInstallations);
    
    // Registrar cambio del cliente para sincronización
    if (typeof recordChange === 'function') {
      recordChange('client', 'delete', clientId, clientToDelete);
      
      // Registrar cambios de instalaciones eliminadas para sincronización
      installationsToDelete.forEach(installation => {
        recordChange('installation', 'delete', installation.id, installation);
      });
    }
    
    return { success: true };
  });

  // <-- INSTALACIONES -->
  
  safeHandle('get-installations', () => {
    return store.get('installations') || [];
  });

  safeHandle('add-installation', (event, installation) => {
    const installations = store.get('installations') || [];
    
    // Asignar IDs a componentes si no los tienen
    const components = installation.components?.map(component => ({
      ...component,
      id: component.id || generateId()
    })) || [];
    
    const newInstallation = {
      ...installation,
      id: installation.id || generateId(),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      syncStatus: 'pending',
      components
    };
    
    const updatedInstallations = [...installations, newInstallation];
    store.set('installations', updatedInstallations);
    
    // Registrar cambio para sincronización
    if (typeof recordChange === 'function') {
      recordChange('installation', 'create', newInstallation.id, newInstallation);
    }
    
    return newInstallation;
  });

  safeHandle('update-installation', (event, installation) => {
    const installations = store.get('installations') || [];
    const index = installations.findIndex(i => i.id === installation.id);
    
    if (index !== -1) {
      // Asegurarse de que los componentes tengan IDs
      const components = installation.components?.map(component => ({
        ...component,
        id: component.id || generateId()
      })) || [];
      
      const updatedInstallation = {
        ...installations[index],
        ...installation,
        components,
        lastModified: new Date().toISOString(),
        syncStatus: 'pending'
      };
      
      installations[index] = updatedInstallation;
      store.set('installations', installations);
      
      // Registrar cambio para sincronización
      if (typeof recordChange === 'function') {
        recordChange('installation', 'update', updatedInstallation.id, updatedInstallation);
      }
      
      return updatedInstallation;
    }
    
    return null;
  });

  safeHandle('delete-installation', (event, installationId) => {
    const installations = store.get('installations') || [];
    const installationToDelete = installations.find(i => i.id === installationId);
    
    if (!installationToDelete) {
      return { success: false, message: 'Instalación no encontrada' };
    }
    
    const newInstallations = installations.filter(i => i.id !== installationId);
    store.set('installations', newInstallations);
    
    // Registrar cambio para sincronización
    if (typeof recordChange === 'function') {
      recordChange('installation', 'delete', installationId, installationToDelete);
    }
    
    return { success: true };
  });

  // <-- MANTENIMIENTO -->
  
  safeHandle('get-upcoming-maintenance', () => {
    return checkUpcomingMaintenance(store, 30); // Próximos 30 días
  });

  safeHandle('register-maintenance', (event, data) => {
    return registerMaintenance(store, data);
  });

  safeHandle('calculate-next-maintenance-date', (event, { lastMaintenanceDate, frequency }) => {
    return calculateNextMaintenanceDate(lastMaintenanceDate, frequency);
  });

  // <-- WHATSAPP -->
  
  // Verificar si WhatsApp está conectado
  safeHandle('is-whatsapp-connected', () => {
    if (!whatsappService) return false;
    return whatsappService.isWhatsAppConnected();
  });

  // Inicializar WhatsApp explícitamente
  safeHandle('initialize-whatsapp', async () => {
    if (!whatsappService) {
      return { success: false, message: 'Servicio WhatsApp no disponible' };
    }
    
    try {
      await whatsappService.initializeWhatsAppClient();
      return { success: true, message: 'Inicialización de WhatsApp iniciada' };
    } catch (error) {
      console.error('Error al inicializar WhatsApp:', error);
      return { 
        success: false, 
        message: error.message || 'Error al inicializar WhatsApp' 
      };
    }
  });

  // Cerrar sesión de WhatsApp
  safeHandle('logout-whatsapp', async () => {
    if (!whatsappService) {
      return { success: false, message: 'Servicio WhatsApp no disponible' };
    }
    
    try {
      const result = await whatsappService.logoutWhatsApp();
      return result;
    } catch (error) {
      console.error('Error al cerrar sesión de WhatsApp:', error);
      return {
        success: false,
        message: error.message || 'Error al cerrar sesión'
      };
    }
  });

  // Enviar mensaje WhatsApp (incluye acción de conectar)
  safeHandle('send-whatsapp-message', async (event, messageData) => {
    if (!whatsappService) {
      return { success: false, message: 'Servicio WhatsApp no disponible' };
    }
    
    try {
      // Si es una solicitud de conexión, iniciar el proceso de autenticación
      if (messageData.action === 'connect') {
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
              console.error('Error al inicializar WhatsApp:', error);
              
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
      
      // Si es un mensaje normal, verificar datos necesarios
      if (!messageData.phone || !messageData.message) {
        return {
          success: false,
          message: 'Número de teléfono y mensaje son obligatorios'
        };
      }
      
      // Enviar mensaje WhatsApp
      const result = await whatsappService.sendWhatsAppMessage(messageData.phone, messageData.message);
      return result;
    } catch (error) {
      console.error('Error al procesar solicitud de WhatsApp:', error);
      return { 
        success: false, 
        message: error.message || 'Error al procesar solicitud de WhatsApp' 
      };
    }
  });

  // Obtener historial de mensajes WhatsApp
  safeHandle('get-whatsapp-message-history', () => {
    if (!whatsappService) return [];
    
    try {
      return whatsappService.getMessageHistory();
    } catch (error) {
      console.error('Error al obtener historial de mensajes:', error);
      return [];
    }
  });

  // <-- RESPALDOS Y RESTAURACIÓN -->
  
  // Crear respaldo manual
  safeHandle('create-backup', async () => {
    if (!backupService) {
      return { success: false, message: 'Servicio de respaldo no disponible' };
    }
    
    try {
      // Pedir ruta al usuario
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Guardar respaldo',
        defaultPath: path.join(app.getPath('documents'), `servitecgas-backup-${new Date().toISOString().split('T')[0]}.json`),
        filters: [
          { name: 'Archivos JSON', extensions: ['json'] }
        ],
        properties: ['createDirectory']
      });
      
      if (canceled || !filePath) {
        return { success: false, message: 'Operación cancelada' };
      }
      
      // Crear respaldo
      const result = await backupService.createManualBackup(filePath);
      
      return {
        success: true,
        path: result.path,
        message: 'Respaldo creado correctamente'
      };
    } catch (error) {
      console.error('Error al crear respaldo manual:', error);
      return {
        success: false,
        message: `Error al crear respaldo: ${error.message}`
      };
    }
  });
  
  // Obtener lista de respaldos
  safeHandle('get-backup-list', async () => {
    if (!backupService) return [];
    
    try {
      return await backupService.getBackupList();
    } catch (error) {
      console.error('Error al obtener lista de respaldos:', error);
      return [];
    }
  });
  
  // Restaurar respaldo
  safeHandle('restore-backup', async (event, backupPath) => {
    if (!backupService) {
      return { success: false, message: 'Servicio de respaldo no disponible' };
    }
    
    try {
      // Si no se proporcionó una ruta, pedir al usuario
      if (!backupPath) {
        const { filePaths, canceled } = await dialog.showOpenDialog({
          title: 'Seleccionar respaldo para restaurar',
          filters: [
            { name: 'Archivos JSON', extensions: ['json'] }
          ],
          properties: ['openFile']
        });
        
        if (canceled || filePaths.length === 0) {
          return { success: false, message: 'Operación cancelada' };
        }
        
        backupPath = filePaths[0];
      }
      
      // Confirmar restauración
      const { response } = await dialog.showMessageBox({
        type: 'warning',
        title: 'Restaurar respaldo',
        message: '¿Estás seguro de restaurar este respaldo?',
        detail: 'Esta acción reemplazará todos los datos actuales. Se creará un respaldo de seguridad antes de restaurar.',
        buttons: ['Restaurar', 'Cancelar'],
        cancelId: 1
      });
      
      if (response === 1) {
        return { success: false, message: 'Operación cancelada' };
      }
      
      // Restaurar respaldo
      const result = await backupService.restoreBackup(backupPath);
      
      // Notificar a la interfaz
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('database-imported');
      }
      
      return {
        success: true,
        ...result,
        message: 'Respaldo restaurado correctamente'
      };
    } catch (error) {
      console.error('Error al restaurar respaldo:', error);
      return {
        success: false,
        message: `Error al restaurar respaldo: ${error.message}`
      };
    }
  });

  // <-- ACTUALIZACIONES -->
  
  // Verificar actualizaciones
  safeHandle('check-updates', async () => {
    if (!updateService) {
      return { success: false, message: 'Servicio de actualizaciones no disponible' };
    }
    
    try {
      await updateService.checkForUpdates(mainWindow);
      
      // Obtener información de la última actualización
      const updateInfo = updateService.getLatestUpdateInfo();
      
      if (!updateInfo) {
        return {
          success: false,
          message: 'No se pudo obtener información de actualizaciones'
        };
      }
      
      return {
        success: true,
        updateInfo,
        hasUpdate: updateInfo.version > app.getVersion(),
        currentVersion: app.getVersion()
      };
    } catch (error) {
      console.error('Error al verificar actualizaciones:', error);
      return {
        success: false,
        message: `Error al verificar actualizaciones: ${error.message}`
      };
    }
  });

  // <-- UTILIDADES -->
  
  safeHandle('generate-id', () => {
    return generateId();
  });
  
  safeHandle('format-date', (event, dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (error) {
      console.error('Error al formatear fecha:', error);
      return dateString;
    }
  });
  
  // <-- SINCRONIZACIÓN -->
  
  // Sincronizar datos
  if (syncService) {
    safeHandle('sync-data', async () => {
      if (!syncService) {
        return { success: false, message: 'Servicio de sincronización no disponible' };
      }
      
      try {
        return await syncService.synchronize(store, mainWindow);
      } catch (error) {
        console.error('Error en sincronización manual:', error);
        return {
          success: false,
          message: `Error: ${error.message}`
        };
      }
    });
  }
  
  // Obtener estado de sincronización
  safeHandle('get-sync-status', () => {
    if (!syncService) {
      return {
        lastSync: null,
        syncInProgress: false,
        connectionAvailable: false,
        autoSyncEnabled: false,
        status: 'error'
      };
    }
    
    return syncService.getSyncStatus(store);
  });
  
  // Obtener configuración de Azure
  safeHandle('get-azure-config', () => {
    return azureConfig.initAzureConfig();
  });
  
  // Actualizar configuración de Azure
  safeHandle('update-azure-config', async (event, newConfig) => {
    try {
      // Actualizar configuración
      const updatedConfig = azureConfig.updateAzureConfig(newConfig);
      
      // Reiniciar sincronización si el servicio está disponible
      if (syncService) {
        await syncService.stopAutoSync();
        
        if (updatedConfig.autoSyncEnabled) {
          await syncService.startAutoSync(store, mainWindow, updatedConfig.syncIntervalMinutes);
        }
      }
      
      return { success: true, config: updatedConfig };
    } catch (error) {
      console.error('Error al actualizar configuración de Azure:', error);
      return { 
        success: false, 
        message: `Error al actualizar configuración: ${error.message}` 
      };
    }
  });
  
  // Verificar conexión con Azure
  safeHandle('check-azure-connection', async () => {
    try {
      // Configuración actual
      const config = azureConfig.initAzureConfig();
      
      if (!config.connectionString) {
        return {
          success: false,
          message: 'No hay configuración de conexión. Configure la cadena de conexión de Azure.'
        };
      }
      
      // Verificar si estamos en modo offline
      if (!syncService) {
        return {
          success: false,
          message: 'Servicio de sincronización no disponible'
        };
      }
      
      // Intentar verificar conexión
      return await syncService.checkConnection();
    } catch (error) {
      console.error('Error al verificar conexión con Azure:', error);
      return {
        success: false,
        message: `Error al verificar conexión: ${error.message}`
      };
    }
  });
  
  // Forzar descarga desde Azure
  safeHandle('force-download-from-azure', async () => {
    if (!syncService) {
      return { success: false, message: 'Servicio de sincronización no disponible' };
    }
    
    try {
      return await syncService.forceDownload(store, mainWindow);
    } catch (error) {
      console.error('Error en descarga forzada:', error);
      return { 
        success: false, 
        message: `Error en descarga forzada: ${error.message}` 
      };
    }
  });
  
  // Forzar subida a Azure
  safeHandle('force-upload-to-azure', async () => {
    if (!syncService) {
      return { success: false, message: 'Servicio de sincronización no disponible' };
    }
    
    try {
      return await syncService.forceUpload(store, mainWindow);
    } catch (error) {
      console.error('Error en subida forzada:', error);
      return { 
        success: false, 
        message: `Error en subida forzada: ${error.message}` 
      };
    }
  });
  
  // Activar/desactivar sincronización automática
  safeHandle('set-auto-sync', async (event, enabled) => {
    if (!syncService) {
      return { success: false, message: 'Servicio de sincronización no disponible' };
    }
    
    try {
      return await syncService.setAutoSync(enabled, store, mainWindow);
    } catch (error) {
      console.error('Error al configurar sincronización automática:', error);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  });
  
  // Restablecer estado de sincronización
  safeHandle('reset-sync-state', async () => {
    if (!syncService) {
      return { success: false, message: 'Servicio de sincronización no disponible' };
    }
    
    try {
      return await syncService.resetSyncState();
    } catch (error) {
      console.error('Error al resetear estado de sincronización:', error);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  });
  
  // <-- EXPORTAR/IMPORTAR BASE DE DATOS -->
  
  // Exportar base de datos
  safeHandle('export-database', async () => {
    try {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Exportar base de datos',
        defaultPath: path.join(app.getPath('documents'), `servitecgas-data-${new Date().toISOString().split('T')[0]}.json`),
        filters: [
          { name: 'Archivos JSON', extensions: ['json'] }
        ]
      });
      
      if (canceled || !filePath) {
        return { success: false, message: 'Operación cancelada por el usuario' };
      }
      
      // Obtener datos para el respaldo
      const clients = store.get('clients') || [];
      const installations = store.get('installations') || [];
      const maintenanceHistory = store.get('maintenanceHistory') || [];
      
      // Crear objeto de respaldo
      const backupData = {
        version: app.getVersion(),
        timestamp: new Date().toISOString(),
        data: {
          clients,
          installations,
          maintenanceHistory
        }
      };
      
      // Guardar archivo
      fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
      
      return {
        success: true,
        message: 'Base de datos exportada correctamente',
        filePath
      };
    } catch (error) {
      console.error('Error al exportar base de datos:', error);
      return {
        success: false,
        message: `Error al exportar base de datos: ${error.message}`
      };
    }
  });
  
  // Importar base de datos
  safeHandle('import-database', async () => {
    try {
      // Mostrar diálogo para seleccionar archivo
      const { filePaths, canceled } = await dialog.showOpenDialog({
        title: 'Importar base de datos',
        properties: ['openFile'],
        filters: [
          { name: 'Archivos JSON', extensions: ['json'] }
        ]
      });
      
      if (canceled || filePaths.length === 0) {
        return { success: false, message: 'Operación cancelada por el usuario' };
      }
      
      // Crear respaldo de seguridad antes de importar
      if (backupService) {
        await backupService.createBackup();
      }
      
      // Leer archivo
      const fileContent = fs.readFileSync(filePaths[0], 'utf8');
      const backupData = JSON.parse(fileContent);
      
      // Verificar estructura
      if (!backupData.data || !backupData.data.clients || !backupData.data.installations) {
        return { success: false, message: 'El archivo no tiene un formato válido' };
      }
      
      // Importar datos
      store.set('clients', backupData.data.clients);
      store.set('installations', backupData.data.installations);
      
      // Si hay historial de mantenimiento, importarlo
      if (backupData.data.maintenanceHistory) {
        store.set('maintenanceHistory', backupData.data.maintenanceHistory);
      }
      
      // Notificar a la interfaz
      if (mainWindow) {
        mainWindow.webContents.send('database-imported');
      }
      
      return {
        success: true,
        message: 'Base de datos importada correctamente',
        stats: {
          clients: backupData.data.clients.length,
          installations: backupData.data.installations.length,
          maintenanceHistory: backupData.data.maintenanceHistory?.length || 0
        }
      };
    } catch (error) {
      console.error('Error al importar base de datos:', error);
      return {
        success: false,
        message: `Error al importar base de datos: ${error.message}`
      };
    }
  });

  console.log('Handlers IPC configurados: ' + Array.from(registeredHandlers).join(', '));
}