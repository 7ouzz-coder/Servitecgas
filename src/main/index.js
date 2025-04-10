const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { setupStore } = require('./db/store');
const AuthService = require('./services/auth');
const { v4: uuidv4 } = require('uuid');

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
app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  
  // Configurar almacenamiento de datos
  const store = setupStore();
  
  // Inicializar servicio de autenticación
  authService = new AuthService(store);
  
  // Configurar manejadores IPC
  setupHandlers(store);
});

// Salir cuando todas las ventanas estén cerradas (excepto en macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Configurar manejadores IPC
function setupHandlers(store) {
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
      createdBy: authService.getCurrentUser().id
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
        updatedAt: new Date().toISOString(),
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
        updatedAt: new Date().toISOString(),
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
  
  // ============================================================
  // Exportar/Importar base de datos
  // ============================================================
  
  ipcMain.handle('export-database', async () => {
    // Verificar autenticación
    if (!authService.checkAuth().isAuthenticated) {
      return { success: false, message: 'No autenticado' };
    }
    
    try {
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Exportar Base de Datos',
        defaultPath: `servitecgas-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [
          { name: 'Archivos JSON', extensions: ['json'] }
        ]
      });
      
      if (canceled || !filePath) {
        return { success: false, message: 'Operación cancelada por el usuario' };
      }
      
      // Obtener datos a exportar
      const dataToExport = {
        clients: store.get('clients') || [],
        installations: store.get('installations') || [],
        exportDate: new Date().toISOString(),
        exportedBy: authService.getCurrentUser().username,
        version: app.getVersion()
      };
      
      // Guardar archivo
      const fs = require('fs');
      fs.writeFileSync(filePath, JSON.stringify(dataToExport, null, 2));
      
      return {
        success: true,
        message: 'Base de datos exportada correctamente',
        filePath
      };
    } catch (error) {
      console.error('Error en exportación:', error);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  });
  
  ipcMain.handle('import-database', async () => {
    // Verificar autenticación
    if (!authService.checkAuth().isAuthenticated) {
      return { success: false, message: 'No autenticado' };
    }
    
    try {
      const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
        title: 'Importar Base de Datos',
        filters: [
          { name: 'Archivos JSON', extensions: ['json'] }
        ],
        properties: ['openFile']
      });
      
      if (canceled || filePaths.length === 0) {
        return { success: false, message: 'Operación cancelada por el usuario' };
      }
      
      // Leer archivo
      const fs = require('fs');
      const fileData = fs.readFileSync(filePaths[0], 'utf8');
      const importedData = JSON.parse(fileData);
      
      // Validar estructura
      if (!importedData.clients || !importedData.installations) {
        return { success: false, message: 'Formato de archivo inválido' };
      }
      
      // Realizar respaldo antes de importar
      const backupDir = path.join(app.getPath('userData'), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const backupPath = path.join(
        backupDir,
        `backup-pre-import-${new Date().toISOString().replace(/:/g, '-')}.json`
      );
      
      const backupData = {
        clients: store.get('clients') || [],
        installations: store.get('installations') || [],
        backupDate: new Date().toISOString(),
        backupReason: 'pre-import'
      };
      
      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
      
      // Importar datos
      store.set('clients', importedData.clients);
      store.set('installations', importedData.installations);
      
      // Notificar a la interfaz
      if (mainWindow) {
        mainWindow.webContents.send('database-imported');
      }
      
      return {
        success: true,
        message: 'Base de datos importada correctamente',
        stats: {
          clients: importedData.clients.length,
          installations: importedData.installations.length,
          backupPath
        }
      };
    } catch (error) {
      console.error('Error en importación:', error);
      return {
        success: false,
        message: `Error al importar: ${error.message}`
      };
    }
  });
}