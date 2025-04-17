const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { setupStore } = require('./db/store');
const AuthService = require('./services/auth'); // Servicio de autenticación local
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const errorHandler = require('./utils/error-handler');

// Cargar variables de entorno
require('dotenv').config();

// Importar servicios
const { 
  setupWhatsAppService, 
  sendWhatsAppMessage, 
  isWhatsAppConnected, 
  logoutWhatsApp,
  getMessageHistory
} = require('./services/whatsapp');

const { 
  setupAutomaticBackup, 
  createBackup, 
  getBackupList, 
  restoreBackup,
  createManualBackup
} = require('./services/backup');

const { initUpdateSystem } = require('./update-system');

// Variable para la ventana principal
let mainWindow;

// Variables para servicios
let authService;

// Variable para controlar los handlers IPC
let ipcHandlersRegistered = false;

// Función para crear la ventana principal
function createWindow() {
  try {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 1024,
      minHeight: 700,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false
      },
      icon: path.join(__dirname, '../../assets/logo.png'),
      show: false // No mostrar hasta que esté listo
    });

    // Cargar la pantalla de login
    mainWindow.loadFile(path.join(__dirname, '../renderer/login.html'))
      .catch(error => {
        errorHandler.captureError('mainWindow.loadFile', error);
      });

    // Mostrar cuando esté listo para evitar parpadeos
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      mainWindow.focus();
    });

    // En modo de desarrollo, abrir DevTools
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }

    // Evento de cierre
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
    
    // Capturar errores de renderizado
    mainWindow.webContents.on('render-process-gone', (event, details) => {
      errorHandler.captureError('render-process-gone', new Error(`Proceso de renderizado terminado: ${details.reason}`), details);
    });
    
    // Capturar errores de carga de página
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      errorHandler.captureError('did-fail-load', new Error(`Error al cargar página: ${errorDescription}`), { errorCode });
    });
  } catch (error) {
    errorHandler.captureError('createWindow', error);
    throw error; // Re-lanzar para manejo superior
  }
}

// Iniciar la aplicación
app.whenReady().then(async () => {
  try {
    // Limpiar logs antiguos al iniciar
    errorHandler.cleanupOldLogs();
    
    createWindow();
    
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    
    // Configurar almacenamiento de datos
    const store = setupStore();
    
    // Inicializar servicio de autenticación
    authService = new AuthService(store);
    
    // Configurar servicio de WhatsApp
    setupWhatsAppService(mainWindow);
    
    // Configurar sistema de respaldos automáticos
    setupAutomaticBackup(mainWindow);
    
    // Inicializar sistema de actualizaciones
    initUpdateSystem(mainWindow);
    
    // Configurar sincronización con Azure
    const { setupSync } = require('./sync-integration');
    try {
      await setupSync(store, mainWindow);
      console.log('Sincronización configurada correctamente');
    } catch (error) {
      errorHandler.captureError('setupSync', error);
      console.error('Error al inicializar sincronización:', error);
    }
    
    // Configurar manejadores IPC
    setupIpcHandlers(store);
  } catch (error) {
    errorHandler.captureError('app.whenReady', error);
    console.error('Error crítico al iniciar la aplicación:', error);
  }
}).catch(error => {
  errorHandler.captureError('app.whenReady.catch', error);
  console.error('Error fatal al iniciar la aplicación:', error);
});

// Salir cuando todas las ventanas estén cerradas (excepto en macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    const { stopAutoSync } = require('./sync-integration');
    // Detener la sincronización automática antes de salir
    stopAutoSync();
    app.quit();
  }
});

// Función completa setupIpcHandlers
function setupIpcHandlers(store) {
  // Evitar registrar los manejadores más de una vez
  if (ipcHandlersRegistered) {
    console.log('Los manejadores IPC ya están registrados, omitiendo...');
    return;
  }
  
  // Lista de todos los handlers que vamos a registrar
  const handlers = [
    'login', 'logout', 'check-auth', 'get-user-info', 'update-user', 'change-password',
    'list-users', 'create-user', 'update-user-admin', 'delete-user',
    'get-clients', 'add-client', 'update-client', 'delete-client',
    'get-installations', 'add-installation', 'update-installation', 'delete-installation',
    'get-upcoming-maintenance', 'register-maintenance', 'calculate-next-maintenance-date',
    'send-whatsapp-message', 'is-whatsapp-connected', 'logout-whatsapp', 'get-whatsapp-message-history',
    'initialize-whatsapp', 'get-whatsapp-chats',
    'create-backup', 'get-backup-list', 'restore-backup',
    'check-updates',
    'generate-id', 'format-date',
    'sync-data', 'get-sync-status', 'get-azure-config', 'update-azure-config',
    'check-azure-connection', 'force-download-from-azure', 'force-upload-to-azure',
    'set-auto-sync', 'reset-sync-state',
    'export-database', 'import-database'
  ];
  
  // Eliminar manejadores existentes para evitar duplicidad
  handlers.forEach(handler => {
    try {
      ipcMain.removeHandler(handler);
    } catch (error) {
      // Ignorar errores de manejadores no existentes
    }
  });
  
  // ============================================================
  // Manejadores para Autenticación
  // ============================================================
  
  ipcMain.handle('login', async (event, credentials) => {
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
  
  ipcMain.handle('logout', () => {
    const result = authService.logout();
    
    // Notificar a la interfaz
    if (mainWindow) {
      mainWindow.webContents.send('auth-changed', { 
        isAuthenticated: false 
      });
    }
    
    return result;
  });
  
  ipcMain.handle('check-auth', () => {
    return authService.checkAuth();
  });
  
  ipcMain.handle('get-user-info', () => {
    return authService.getCurrentUser();
  });
  
  ipcMain.handle('update-user', (event, userData) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      return { success: false, message: 'No hay sesión activa' };
    }
    
    return authService.updateUser(currentUser.id, userData);
  });
  
  ipcMain.handle('change-password', (event, { currentPassword, newPassword }) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      return { success: false, message: 'No hay sesión activa' };
    }
    
    return authService.changePassword(currentUser.id, currentPassword, newPassword);
  });
  
  // ============================================================
  // Administración de usuarios (solo para admins)
  // ============================================================
  
  ipcMain.handle('list-users', () => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, message: 'Acceso denegado' };
    }
    
    return { success: true, users: authService.listUsers() };
  });
  
  ipcMain.handle('create-user', (event, userData) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, message: 'Acceso denegado' };
    }
    
    return authService.createUser(userData);
  });
  
  ipcMain.handle('update-user-admin', (event, userId, userData) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, message: 'Acceso denegado' };
    }
    
    return authService.updateUser(userId, userData);
  });
  
  ipcMain.handle('delete-user', (event, userId) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, message: 'Acceso denegado' };
    }
    
    return authService.deleteUser(userId);
  });
  
  // ============================================================
  // Clientes
  // ============================================================
  
  ipcMain.handle('get-clients', () => {
    // Verificar autenticación
    if (!authService.checkAuth().isAuthenticated) {
      return [];
    }
    
    return store.get('clients') || [];
  });
  
  ipcMain.handle('add-client', (event, client) => {
    // Verificar autenticación
    if (!authService.checkAuth().isAuthenticated) {
      return { success: false, message: 'No autenticado' };
    }
    
    const clients = store.get('clients') || [];
    const newClient = {
      ...client,
      id: client.id || uuidv4(),
      createdAt: new Date().toISOString(),
      createdBy: authService.getCurrentUser().id,
      lastModified: new Date().toISOString()
    };
    
    const updatedClients = [...clients, newClient];
    store.set('clients', updatedClients);
    
    return newClient;
  });
  
  ipcMain.handle('update-client', (event, client) => {
    // Verificar autenticación
    if (!authService.checkAuth().isAuthenticated) {
      return { success: false, message: 'No autenticado' };
    }
    
    const clients = store.get('clients') || [];
    const index = clients.findIndex(c => c.id === client.id);
    
    if (index !== -1) {
      const updatedClient = {
        ...clients[index],
        ...client,
        lastModified: new Date().toISOString(),
        updatedBy: authService.getCurrentUser().id
      };
      
      clients[index] = updatedClient;
      store.set('clients', clients);
      return updatedClient;
    }
    
    return null;
  });
  
  ipcMain.handle('delete-client', (event, clientId) => {
    // Verificar autenticación
    if (!authService.checkAuth().isAuthenticated) {
      return { success: false, message: 'No autenticado' };
    }
    
    const clients = store.get('clients') || [];
    const newClients = clients.filter(c => c.id !== clientId);
    
    // Verificar si se eliminó algún cliente
    if (newClients.length === clients.length) {
      return { success: false, message: 'Cliente no encontrado' };
    }
    
    store.set('clients', newClients);
    
    // Eliminar instalaciones asociadas
    const installations = store.get('installations') || [];
    const newInstallations = installations.filter(i => i.clientId !== clientId);
    store.set('installations', newInstallations);
    
    return { success: true };
  });
  
  // ============================================================
  // Instalaciones
  // ============================================================
  
  ipcMain.handle('get-installations', () => {
    // Verificar autenticación
    if (!authService.checkAuth().isAuthenticated) {
      return [];
    }
    
    return store.get('installations') || [];
  });
  
  ipcMain.handle('add-installation', (event, installation) => {
    console.log('Recibiendo instalación para agregar:', JSON.stringify(installation).substring(0, 100) + '...');
    
    try {
      const installations = store.get('installations') || [];
      
      // Asegurarse de que todos los componentes tengan IDs válidos
      const cleanedComponents = installation.components.map(comp => {
        // Asegurar que solo tenemos datos primitivos, no objetos complejos
        return {
          id: comp.id || uuidv4(),
          name: String(comp.name || ''),
          model: String(comp.model || ''),
          lastMaintenanceDate: String(comp.lastMaintenanceDate || ''),
          frequency: String(comp.frequency || '12'),
          nextMaintenanceDate: String(comp.nextMaintenanceDate || ''),
          notes: String(comp.notes || '')
        };
      });
      
      // Crear nueva instalación limpia
      const newInstallation = {
        id: installation.id || uuidv4(),
        clientId: String(installation.clientId || ''),
        address: String(installation.address || ''),
        type: String(installation.type || ''),
        date: String(installation.date || ''),
        notes: String(installation.notes || ''),
        components: cleanedComponents,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      
      const updatedInstallations = [...installations, newInstallation];
      store.set('installations', updatedInstallations);
      
      return newInstallation;
    } catch (error) {
      console.error('Error al agregar instalación:', error);
      // Lanzar un error simple, sin objetos complejos
      throw new Error(error.message || 'Error al guardar instalación');
    }
  });
  
  // Manejar actualizar instalación
  ipcMain.handle('update-installation', (event, installation) => {
    console.log('Recibiendo instalación para actualizar:', JSON.stringify(installation).substring(0, 100) + '...');
    
    try {
      const installations = store.get('installations') || [];
      const index = installations.findIndex(i => i.id === installation.id);
      
      if (index !== -1) {
        // Asegurarse de que todos los componentes tengan IDs válidos
        const cleanedComponents = installation.components.map(comp => {
          // Asegurar que solo tenemos datos primitivos, no objetos complejos
          return {
            id: comp.id || uuidv4(),
            name: String(comp.name || ''),
            model: String(comp.model || ''),
            lastMaintenanceDate: String(comp.lastMaintenanceDate || ''),
            frequency: String(comp.frequency || '12'),
            nextMaintenanceDate: String(comp.nextMaintenanceDate || ''),
            notes: String(comp.notes || '')
          };
        });
        
        // Actualizar instalación existente con datos limpios
        const updatedInstallation = {
          ...installations[index],
          clientId: String(installation.clientId || ''),
          address: String(installation.address || ''),
          type: String(installation.type || ''),
          date: String(installation.date || ''),
          notes: String(installation.notes || ''),
          components: cleanedComponents,
          lastModified: new Date().toISOString()
        };
        
        installations[index] = updatedInstallation;
        store.set('installations', installations);
        
        return updatedInstallation;
      }
      
      throw new Error('Instalación no encontrada');
    } catch (error) {
      console.error('Error al actualizar instalación:', error);
      // Lanzar un error simple, sin objetos complejos
      throw new Error(error.message || 'Error al actualizar instalación');
    }
  });
  
  ipcMain.handle('delete-installation', (event, installationId) => {
    // Verificar autenticación
    if (!authService.checkAuth().isAuthenticated) {
      return { success: false, message: 'No autenticado' };
    }
    
    const installations = store.get('installations') || [];
    const newInstallations = installations.filter(i => i.id !== installationId);
    
    // Verificar si se eliminó alguna instalación
    if (newInstallations.length === installations.length) {
      return { success: false, message: 'Instalación no encontrada' };
    }
    
    store.set('installations', newInstallations);
    
    return { success: true };
  });
  
  // ============================================================
  // Mantenimiento
  // ============================================================
  
  ipcMain.handle('get-upcoming-maintenance', () => {
    // Verificar autenticación
    if (!authService.checkAuth().isAuthenticated) {
      return [];
    }
    
    const installations = store.get('installations') || [];
    const clients = store.get('clients') || [];
    const today = new Date();
    const upcomingMaintenance = [];
    
    installations.forEach(installation => {
      if (!installation.components) return;
      
      installation.components.forEach(component => {
        if (component.nextMaintenanceDate) {
          const nextMaintenance = new Date(component.nextMaintenanceDate);
          const diffDays = Math.floor((nextMaintenance - today) / (1000 * 60 * 60 * 24));
          
          // Notificar si el mantenimiento está dentro del umbral de días
          if (diffDays <= 30 && diffDays >= -30) { // Incluimos mantenimientos vencidos hasta 30 días
            const client = clients.find(c => c.id === installation.clientId) || { 
              name: 'Cliente desconocido',
              id: installation.clientId
            };
            
            upcomingMaintenance.push({
              clientId: installation.clientId,
              clientName: client ? client.name : 'Cliente desconocido',
              clientPhone: client ? client.phone : '',
              installationId: installation.id,
              address: installation.address,
              componentId: component.id,
              componentName: component.name,
              lastMaintenanceDate: component.lastMaintenanceDate,
              nextMaintenanceDate: component.nextMaintenanceDate,
              daysLeft: diffDays,
              urgent: diffDays <= 0 // Marcar como urgente si está vencido
            });
          }
        }
      });
    });
    
    // Ordenar: primero los vencidos, luego por días restantes
    return upcomingMaintenance.sort((a, b) => {
      // Si ambos están vencidos o ambos no están vencidos, ordenar por días restantes
      if ((a.daysLeft <= 0 && b.daysLeft <= 0) || (a.daysLeft > 0 && b.daysLeft > 0)) {
        return a.daysLeft - b.daysLeft;
      }
      // Si solo uno está vencido, ese va primero
      return a.daysLeft <= 0 ? -1 : 1;
    });
  });
  
  ipcMain.handle('register-maintenance', (event, data) => {
    // Verificar autenticación
    if (!authService.checkAuth().isAuthenticated) {
      return { success: false, message: 'No autenticado' };
    }
    
    try {
      const { installationId, componentId, maintenanceDate, notes } = data;
      
      const installations = store.get('installations') || [];
      const installationIndex = installations.findIndex(i => i.id === installationId);
      
      if (installationIndex === -1) {
        return { success: false, message: 'Instalación no encontrada' };
      }
      
      const installation = installations[installationIndex];
      
      if (!installation.components) {
        return { success: false, message: 'La instalación no tiene componentes' };
      }
      
      const componentIndex = installation.components.findIndex(c => c.id === componentId);
      
      if (componentIndex === -1) {
        return { success: false, message: 'Componente no encontrado' };
      }
      
      // Actualizar fechas de mantenimiento
      const component = installation.components[componentIndex];
      const lastMaintenanceDate = maintenanceDate || new Date().toISOString().split('T')[0];
      const frequency = component.frequency || 12; // Frecuencia en meses
      
      // Calcular próxima fecha de mantenimiento
      const lastDate = new Date(lastMaintenanceDate);
      const nextDate = new Date(lastDate);
      nextDate.setMonth(nextDate.getMonth() + parseInt(frequency, 10));
      const nextMaintenanceDate = nextDate.toISOString().split('T')[0];
      
      // Crear registro de mantenimiento
      const maintenanceRecord = {
        id: uuidv4(),
        date: lastMaintenanceDate,
        notes: notes || '',
        technicianId: authService.getCurrentUser().id,
        technicianName: authService.getCurrentUser().name,
        componentId,
        installationId
      };
      
      // Actualizar componente
      component.lastMaintenanceDate = lastMaintenanceDate;
      component.nextMaintenanceDate = nextMaintenanceDate;
      
      // Si no existe array de mantenimientos, crearlo
      if (!component.maintenanceHistory) {
        component.maintenanceHistory = [];
      }
      
      // Añadir registro al historial
      component.maintenanceHistory.push(maintenanceRecord);
      
      // Actualizar instalación
      installation.components[componentIndex] = component;
      installation.lastModified = new Date().toISOString();
      installations[installationIndex] = installation;
      
      // Guardar cambios
      store.set('installations', installations);
      
      // También guardar en una colección separada de mantenimientos
      const maintenanceHistory = store.get('maintenanceHistory') || [];
      maintenanceHistory.push({
        ...maintenanceRecord,
        clientId: installation.clientId,
        componentName: component.name,
        address: installation.address
      });
      store.set('maintenanceHistory', maintenanceHistory);
      
      return {
        success: true,
        installation,
        component,
        maintenanceRecord
      };
    } catch (error) {
      console.error('Error al registrar mantenimiento:', error);
      return {
        success: false,
        message: `Error al registrar mantenimiento: ${error.message}`
      };
    }
  });
  
  ipcMain.handle('calculate-next-maintenance-date', (event, { lastMaintenanceDate, frequency }) => {
    if (!lastMaintenanceDate || !frequency) return null;
    
    try {
      const lastDate = new Date(lastMaintenanceDate);
      const nextDate = new Date(lastDate);
      nextDate.setMonth(nextDate.getMonth() + parseInt(frequency, 10));
      
      // Solo devolver la cadena de fecha formateada, no el objeto Date completo
      return nextDate.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error al calcular próxima fecha de mantenimiento:', error);
      return null;
    }
  });
  
  // ============================================================
  // Manejadores para WhatsApp
  // ============================================================
  
  ipcMain.handle('send-whatsapp-message', async (event, data) => {
    // Verificar autenticación
    if (!authService.checkAuth().isAuthenticated) {
      return { success: false, message: 'No autenticado' };
    }
    
    try {
      // Si es una acción de conexión, iniciar el proceso de autenticación de WhatsApp
      if (data.action === 'connect') {
        // Esta acción inicia el proceso de autenticación de WhatsApp
        if (mainWindow) {
          mainWindow.webContents.send('show-alert', {
            type: 'info',
            message: 'Iniciando conexión con WhatsApp...'
          });
        }
        return { success: true, message: 'Iniciando conexión con WhatsApp' };
      }
      
      // Para enviar un mensaje, usamos la función del servicio
      const result = await sendWhatsAppMessage(data.phone, data.message);
      return result;
    } catch (error) {
      console.error('Error al procesar solicitud de WhatsApp:', error);
      return { 
        success: false, 
        message: `Error en WhatsApp: ${error.message}` 
      };
    }
  });
  
  // Verificar si WhatsApp está conectado
  ipcMain.handle('is-whatsapp-connected', () => {
    return isWhatsAppConnected();
  });
  
  // Cerrar sesión de WhatsApp
  ipcMain.handle('logout-whatsapp', async () => {
    try {
      return await logoutWhatsApp();
    } catch (error) {
      console.error('Error al cerrar sesión de WhatsApp:', error);
      return {
        success: false,
        message: `Error al cerrar sesión: ${error.message}`
      };
    }
  });
  
  // Obtener historial de mensajes
  ipcMain.handle('get-whatsapp-message-history', () => {
    try {
      return getMessageHistory();
    } catch (error) {
      console.error('Error al obtener historial de mensajes:', error);
      return [];
    }
  });
  
  // Nuevas funciones para WhatsApp
  ipcMain.handle('initialize-whatsapp', async () => {
    try {
      // Esta función podría inicializar explícitamente el cliente de WhatsApp
      // Depende de cómo esté implementado en tu servicio
      return { success: true, message: 'Cliente WhatsApp inicializado' };
    } catch (error) {
      console.error('Error al inicializar WhatsApp:', error);
      return { 
        success: false,
        message: `Error al inicializar WhatsApp: ${error.message}` 
      };
    }
  });
  
  ipcMain.handle('get-whatsapp-chats', async () => {
    try {
      // Esta función podría obtener la lista de chats
      // Implementación dependiente de tu servicio de WhatsApp
      return { success: true, chats: [] };
    } catch (error) {
      console.error('Error al obtener chats de WhatsApp:', error);
      return { 
        success: false,
        message: `Error al obtener chats: ${error.message}`,
        chats: []
      };
    }
  });

  // ============================================================
  // Respaldos y Restauración
  // ============================================================
  
  // Crear respaldo manual
  ipcMain.handle('create-backup', async () => {
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
      const result = await createManualBackup(filePath);
      
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
  ipcMain.handle('get-backup-list', async () => {
    try {
      return await getBackupList();
    } catch (error) {
      console.error('Error al obtener lista de respaldos:', error);
      return [];
    }
  });
  
  // Restaurar respaldo
  ipcMain.handle('restore-backup', async (event, backupPath) => {
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
      const result = await restoreBackup(backupPath);
      
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
  
  // ============================================================
  // Actualizaciones
  // ============================================================
  
  // Verificar actualizaciones manualmente
  ipcMain.handle('check-updates', async () => {
    try {
      // Importar función directamente para mantener el código limpio
      const { checkForUpdates, getLatestUpdateInfo } = require('./update-system');
      
      // Verificar actualizaciones
      await checkForUpdates(mainWindow);
      
      // Obtener información de la última actualización
      const updateInfo = getLatestUpdateInfo();
      
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
  
  // ============================================================
  // Utilidades
  // ============================================================
  
  ipcMain.handle('generate-id', () => {
    return uuidv4();
  });
  
  ipcMain.handle('format-date', (event, dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (error) {
      return dateString;
    }
  });
  
  // ============================================================
  // Exportar/Importar Base de Datos
  // ============================================================
  
  // Exportar base de datos
  ipcMain.handle('export-database', async () => {
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
  ipcMain.handle('import-database', async () => {
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
      await createBackup(mainWindow);
      
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
  
  // ============================================================
  // Sincronización con Azure
  // ============================================================
  
  // Estos manejadores son delegados al módulo de sincronización
  
  ipcMain.handle('sync-data', async () => {
    const { synchronize } = require('./sync-integration');
    return await synchronize(store, mainWindow);
  });
  
  ipcMain.handle('get-sync-status', () => {
    const { getSyncStatus } = require('./sync-integration');
    return getSyncStatus(store);
  });
  
  ipcMain.handle('get-azure-config', () => {
    const { initAzureConfig } = require('./azure/config');
    return initAzureConfig();
  });
  
  ipcMain.handle('update-azure-config', async (event, newConfig) => {
    const { updateAzureConfig } = require('./azure/config');
    return updateAzureConfig(newConfig);
  });
  
  ipcMain.handle('check-azure-connection', async () => {
    try {
      // Configuración actual
      const config = azureConfig.initAzureConfig();
      
      // Si estamos en modo desarrollo, informar al usuario
      if (process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development') {
        return {
          success: false,
          offline: true,
          dev: true,
          message: 'Modo desarrollo: Azure está desactivado. Cambia DEV_MODE=false en .env para activar Azure.'
        };
      }
      
      if (!config.connectionString) {
        return {
          success: false,
          message: 'No hay configuración de conexión. Configure la cadena de conexión de Azure.'
        };
      }
      
      // Verificar si estamos en modo offline
      const { isOfflineMode, checkConnection } = require('./azure/api');
      
      if (isOfflineMode()) {
        // Intentar reconectar
        const reconnected = await checkConnection();
        
        if (!reconnected) {
          return {
            success: false,
            offline: true,
            message: 'Trabajando en modo offline. No se pudo establecer conexión con Azure.'
          };
        }
      }
      
      return {
        success: true,
        message: 'Conexión exitosa con Azure Storage'
      };
    } catch (error) {
      console.error('Error al verificar conexión con Azure:', error);
      return {
        success: false,
        message: `Error al verificar conexión: ${error.message}`
      };
    }
  });
  
  ipcMain.handle('force-download-from-azure', async () => {
    const { synchronize } = require('./sync-integration');
    // Implementación específica para forzar descarga
    return await synchronize(store, mainWindow, { forceDownload: true });
  });
  
  ipcMain.handle('force-upload-to-azure', async () => {
    const { synchronize } = require('./sync-integration');
    // Implementación específica para forzar subida
    return await synchronize(store, mainWindow, { forceUpload: true });
  });
  
  ipcMain.handle('set-auto-sync', async (event, enabled) => {
    try {
      const { setAutoSync } = require('./sync-integration');
      return await setAutoSync(enabled, store, mainWindow);
    } catch (error) {
      console.error('Error al configurar sincronización automática:', error);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  });
  
  ipcMain.handle('reset-sync-state', async () => {
    try {
      // Implementación específica para resetear estado de sincronización
      const { resetSyncState } = require('./sync-integration');
      return await resetSyncState();
    } catch (error) {
      console.error('Error al resetear estado de sincronización:', error);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  });
  
  // Marcar que los handlers han sido registrados
  ipcHandlersRegistered = true;
  console.log('Todos los manejadores IPC registrados correctamente');
}