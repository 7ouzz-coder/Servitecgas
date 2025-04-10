const { contextBridge, ipcRenderer } = require('electron');

// Exponer una API segura al proceso de renderizado
contextBridge.exposeInMainWorld('api', {
  // ============================================================
  // Eventos
  // ============================================================
  
  // Alertas
  onAlert: (callback) => {
    ipcRenderer.on('show-alert', (event, data) => callback(data));
  },
  
  // Actualización de base de datos
  onDatabaseImported: (callback) => {
    ipcRenderer.on('database-imported', () => callback());
  },
  
  // Mantenimientos próximos
  onMaintenanceDue: (callback) => {
    ipcRenderer.on('maintenance-due', (event, data) => callback(data));
  },
  
  // Eventos de autenticación
  onAuthChanged: (callback) => {
    ipcRenderer.on('auth-changed', (event, data) => callback(data));
  },
  
  // Estado de sincronización
  onSyncStatusChanged: (callback) => {
    ipcRenderer.on('sync-status-changed', (event, data) => callback(data));
  },
  
  // Sincronización completada
  onSyncCompleted: (callback) => {
    ipcRenderer.on('sync-completed', (event, data) => callback(data));
  },
  
  // ============================================================
  // Autenticación
  // ============================================================
  
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  logout: () => ipcRenderer.invoke('logout'),
  checkAuth: () => ipcRenderer.invoke('check-auth'),
  getUserInfo: () => ipcRenderer.invoke('get-user-info'),
  updateUser: (userData) => ipcRenderer.invoke('update-user', userData),
  changePassword: (passwords) => ipcRenderer.invoke('change-password', passwords),
  
  // Administración de usuarios (solo admin)
  listUsers: () => ipcRenderer.invoke('list-users'),
  createUser: (userData) => ipcRenderer.invoke('create-user', userData),
  updateUserAdmin: (userId, userData) => ipcRenderer.invoke('update-user-admin', userId, userData),
  deleteUser: (userId) => ipcRenderer.invoke('delete-user', userId),
  
  // ============================================================
  // Clientes
  // ============================================================
  
  getClients: () => ipcRenderer.invoke('get-clients'),
  addClient: (client) => ipcRenderer.invoke('add-client', client),
  updateClient: (client) => ipcRenderer.invoke('update-client', client),
  deleteClient: (clientId) => ipcRenderer.invoke('delete-client', clientId),
  
  // ============================================================
  // Instalaciones
  // ============================================================
  
  getInstallations: () => ipcRenderer.invoke('get-installations'),
  addInstallation: (installation) => ipcRenderer.invoke('add-installation', installation),
  updateInstallation: (installation) => ipcRenderer.invoke('update-installation', installation),
  deleteInstallation: (installationId) => ipcRenderer.invoke('delete-installation', installationId),
  
  // ============================================================
  // Mantenimiento
  // ============================================================
  
  getUpcomingMaintenance: () => ipcRenderer.invoke('get-upcoming-maintenance'),
  registerMaintenance: (data) => ipcRenderer.invoke('register-maintenance', data),
  calculateNextMaintenanceDate: (lastDate, frequency) => 
    ipcRenderer.invoke('calculate-next-maintenance', { lastMaintenanceDate: lastDate, frequency }),
  
  // ============================================================
  // WhatsApp
  // ============================================================
  
  sendWhatsappMessage: (messageData) => ipcRenderer.invoke('send-whatsapp-message', messageData),
  
  // ============================================================
  // Utilidades
  // ============================================================
  
  generateId: () => ipcRenderer.invoke('generate-id'),
  formatDate: (date) => ipcRenderer.invoke('format-date', date),
  
  // ============================================================
  // Sincronización con Azure
  // ============================================================
  
  syncData: () => ipcRenderer.invoke('sync-data'),
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  getAzureConfig: () => ipcRenderer.invoke('get-azure-config'),
  updateAzureConfig: (config) => ipcRenderer.invoke('update-azure-config', config),
  checkAzureConnection: () => ipcRenderer.invoke('check-azure-connection'),
  forceDownloadFromAzure: () => ipcRenderer.invoke('force-download-from-azure'),
  forceUploadToAzure: () => ipcRenderer.invoke('force-upload-to-azure'),
  setAutoSync: (enabled) => ipcRenderer.invoke('set-auto-sync', enabled),
  resetSyncState: () => ipcRenderer.invoke('reset-sync-state'),
  
  // ============================================================
  // Exportar/Importar Base de Datos
  // ============================================================
  
  exportDatabase: () => ipcRenderer.invoke('export-database'),
  importDatabase: () => ipcRenderer.invoke('import-database')
});