const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { setupStore } = require('./db/store');
const AuthService = require('./services/auth'); // Servicio de autenticación local
const { setupWhatsAppService } = require('./services/whatsapp'); // Servicio de WhatsApp
const { v4: uuidv4 } = require('uuid');
// Cargar variables de entorno
require('dotenv').config();

// Variable para la ventana principal
let mainWindow;

// Variables para servicios
let authService;

// Función para crear la ventana principal
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Cargar la pantalla de login
  mainWindow.loadFile(path.join(__dirname, '../renderer/login.html'));

  // En modo de desarrollo, abrir DevTools
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Evento de cierre
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Iniciar la aplicación
app.whenReady().then(async () => {
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
  
  // Configurar sincronización con Azure
  const { setupSync } = require('./sync-integration');
  try {
    await setupSync(store, mainWindow);
    console.log('Sincronización configurada correctamente');
  } catch (error) {
    console.error('Error al inicializar sincronización:', error);
  }
  
  // Configurar manejadores IPC
  setupHandlers(store);
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

// Configurar manejadores IPC
function setupHandlers(store) {
  // Verificar si los handlers ya están configurados para evitar duplicación
  if (global.handlersConfigured) {
    console.log('Los manejadores IPC ya están configurados, saltando...');
    return;
  }
  
  // ============================================================
  // Manejadores para WhatsApp
  // ============================================================
  
  // Enviar mensaje de WhatsApp
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
    return isWhatsAppReady; // Esta variable debería estar definida en tu servicio de WhatsApp
  });
  
  // Cerrar sesión de WhatsApp
  ipcMain.handle('logout-whatsapp', async () => {
    try {
      if (!whatsappClient) {
        return {
          success: false,
          message: 'No hay sesión activa de WhatsApp'
        };
      }
      
      await whatsappClient.logout();
      
      // Eliminar archivo de sesión si existe
      if (sessionDataPath && fs.existsSync(sessionDataPath)) {
        fs.unlinkSync(sessionDataPath);
      }
      
      isWhatsAppReady = false;
      
      if (mainWindow) {
        mainWindow.webContents.send('whatsapp-disconnected');
        mainWindow.webContents.send('show-alert', {
          type: 'info',
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
  });

  // ============================================================
  // Autenticación
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
  
  // Administración de usuarios (solo para admins)
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
    // Verificar autenticación
    if (!authService.checkAuth().isAuthenticated) {
      return { success: false, message: 'No autenticado' };
    }
    
    const installations = store.get('installations') || [];
    
    // Asignar IDs a componentes si no los tienen
    const components = installation.components?.map(component => ({
      ...component,
      id: component.id || uuidv4()
    })) || [];
    
    const newInstallation = {
      ...installation,
      id: installation.id || uuidv4(),
      createdAt: new Date().toISOString(),
      createdBy: authService.getCurrentUser().id,
      lastModified: new Date().toISOString(),
      components
    };
    
    const updatedInstallations = [...installations, newInstallation];
    store.set('installations', updatedInstallations);
    
    return newInstallation;
  });
  
  ipcMain.handle('update-installation', (event, installation) => {
    // Verificar autenticación
    if (!authService.checkAuth().isAuthenticated) {
      return { success: false, message: 'No autenticado' };
    }
    
    const installations = store.get('installations') || [];
    const index = installations.findIndex(i => i.id === installation.id);
    
    if (index !== -1) {
      // Asegurarse de que los componentes tengan IDs
      const components = installation.components?.map(component => ({
        ...component,
        id: component.id || uuidv4()
      })) || [];
      
      const updatedInstallation = {
        ...installations[index],
        ...installation,
        components,
        lastModified: new Date().toISOString(),
        updatedBy: authService.getCurrentUser().id
      };
      
      installations[index] = updatedInstallation;
      store.set('installations', installations);
      
      return updatedInstallation;
    }
    
    return null;
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
            const client = clients.find(c => c.id === installation.clientId);
            
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
  
  ipcMain.handle('calculate-next-maintenance-date', (event, { lastMaintenanceDate, frequency }) => {
    if (!lastMaintenanceDate || !frequency) return null;
    
    try {
      const lastDate = new Date(lastMaintenanceDate);
      const nextDate = new Date(lastDate);
      nextDate.setMonth(nextDate.getMonth() + parseInt(frequency, 10));
      return nextDate.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error al calcular próxima fecha de mantenimiento:', error);
      return null;
    }
  });
  
  global.handlersConfigured = true;

  // Los manejadores para sincronización son gestionados en sync-integration.js
}