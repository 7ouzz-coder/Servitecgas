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
  
  // Eventos de WhatsApp
  onWhatsAppQR: (callback) => {
    ipcRenderer.on('whatsapp-qr', (event, qr) => callback(qr));
  },
  
  onWhatsAppReady: (callback) => {
    ipcRenderer.on('whatsapp-ready', () => callback());
  },
  
  onWhatsAppAuthFailure: (callback) => {
    ipcRenderer.on('whatsapp-auth-failure', () => callback());
  },
  
  onWhatsAppDisconnected: (callback) => {
    ipcRenderer.on('whatsapp-disconnected', () => callback());
  },
  
  // Eventos adicionales para WhatsApp
  onWhatsAppLoading: (callback) => {
    ipcRenderer.on('whatsapp-loading', (event, data) => callback(data));
  },
  
  onWhatsAppAuthenticated: (callback) => {
    ipcRenderer.on('whatsapp-authenticated', () => callback());
  },
  
  onWhatsAppInitializationStarted: (callback) => {
    ipcRenderer.on('whatsapp-initialization-started', () => callback());
  },
  
  onWhatsAppInitializationFailed: (callback) => {
    ipcRenderer.on('whatsapp-initialization-failed', (event, data) => callback(data));
  },
  
  // Eventos para respaldos
  onBackupCreated: (callback) => {
    ipcRenderer.on('backup-created', (event, data) => callback(data));
  },
  
  // Eventos para actualizaciones
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, data) => callback(data));
  },
  
  // Estado de conexión
  onConnectionStatusChanged: (callback) => {
    // Escuchar cambios de conexión online/offline
    window.addEventListener('online', () => callback({ isOnline: true }));
    window.addEventListener('offline', () => callback({ isOnline: false }));
    
    // Notificar estado inicial
    callback({ isOnline: navigator.onLine });
  },
  
  // Eliminar listeners (para limpieza)
  removeListener: (channel, listener) => {
    ipcRenderer.removeListener(channel, listener);
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
  
  // Función mejorada para añadir instalación con manejo seguro de errores
  addInstallation: async (installation) => {
    try {
      // Asegúrate de que la instalación sea serializable
      const safeInstallation = JSON.parse(JSON.stringify(installation));
      return await ipcRenderer.invoke('add-installation', safeInstallation);
    } catch (error) {
      console.error('Error en addInstallation:', error);
      throw new Error(`Error al guardar instalación: ${error.message || 'Error desconocido'}`);
    }
  },
  
  // Función mejorada para actualizar instalación
  updateInstallation: async (installation) => {
    try {
      // Asegúrate de que la instalación sea serializable
      const safeInstallation = JSON.parse(JSON.stringify(installation));
      return await ipcRenderer.invoke('update-installation', safeInstallation);
    } catch (error) {
      console.error('Error en updateInstallation:', error);
      throw new Error(`Error al actualizar instalación: ${error.message || 'Error desconocido'}`);
    }
  },
  
  deleteInstallation: (installationId) => ipcRenderer.invoke('delete-installation', installationId),
  
  // ============================================================
  // Mantenimiento
  // ============================================================
  
  getUpcomingMaintenance: () => ipcRenderer.invoke('get-upcoming-maintenance'),
  registerMaintenance: (data) => ipcRenderer.invoke('register-maintenance', data),
  
  // Función mejorada para calcular próxima fecha de mantenimiento
  calculateNextMaintenanceDate: (lastDate, frequency) => {
    try {
      // Implementación local para evitar el IPC
      if (!lastDate) return null;
      
      const lastDateObj = new Date(lastDate);
      const nextDateObj = new Date(lastDateObj);
      nextDateObj.setMonth(nextDateObj.getMonth() + parseInt(frequency, 10));
      
      // Devolver en formato YYYY-MM-DD
      return nextDateObj.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error al calcular fecha de próximo mantenimiento:', error);
      return null;
    }
  },
  
  // ============================================================
  // WhatsApp
  // ============================================================
  
  sendWhatsAppMessage: (messageData) => ipcRenderer.invoke('send-whatsapp-message', messageData),
  isWhatsAppConnected: () => ipcRenderer.invoke('is-whatsapp-connected'),
  logoutWhatsApp: () => ipcRenderer.invoke('logout-whatsapp'),
  getWhatsAppMessageHistory: () => ipcRenderer.invoke('get-whatsapp-message-history'),
  
  // Nuevas funciones para WhatsApp
  initializeWhatsApp: () => ipcRenderer.invoke('initialize-whatsapp'),
  getWhatsAppChats: () => ipcRenderer.invoke('get-whatsapp-chats'),
  
  // ============================================================
  // Respaldos y Restauración
  // ============================================================
  
  createBackup: () => ipcRenderer.invoke('create-backup'),
  getBackupList: () => ipcRenderer.invoke('get-backup-list'),
  restoreBackup: (backupPath) => ipcRenderer.invoke('restore-backup', backupPath),
  
  // ============================================================
  // Actualizaciones
  // ============================================================
  
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  
  // ============================================================
  // Utilidades
  // ============================================================
  
  // Función segura para generar ID
  generateId: async () => {
    try {
      return await ipcRenderer.invoke('generate-id');
    } catch (error) {
      console.error('Error al generar ID:', error);
      // Generar un ID local como fallback
      return 'local-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    }
  },
  
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

// Importar React y ReactDOM
const React = require('react');
const ReactDOM = require('react-dom');

// Importar el componente WhatsApp
const WhatsAppQRConnector = require('../renderer/components/WhatsAppQRConnector.jsx');

// Exponer React y ReactDOM para uso en el renderer
contextBridge.exposeInMainWorld('React', React);
contextBridge.exposeInMainWorld('ReactDOM', ReactDOM);

// Exponer el componente WhatsApp
contextBridge.exposeInMainWorld('WhatsAppQRConnector', WhatsAppQRConnector.default);