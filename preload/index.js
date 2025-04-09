const { contextBridge, ipcRenderer } = require('electron');
const { v4: uuidv4 } = require('uuid');

// Exponer APIs seguras a la interfaz web
contextBridge.exposeInMainWorld('api', {
  // Clientes
  getClients: () => ipcRenderer.invoke('get-clients'),
  addClient: (client) => {
    const newClient = {
      ...client,
      id: client.id || uuidv4(),
      createdAt: new Date().toISOString()
    };
    return ipcRenderer.invoke('add-client', newClient);
  },
  updateClient: (client) => ipcRenderer.invoke('update-client', client),
  deleteClient: (clientId) => ipcRenderer.invoke('delete-client', clientId),
  
  // Instalaciones
  getInstallations: () => ipcRenderer.invoke('get-installations'),
  addInstallation: (installation) => {
    const newInstallation = {
      ...installation,
      id: installation.id || uuidv4(),
      createdAt: new Date().toISOString(),
      components: installation.components.map(component => ({
        ...component,
        id: component.id || uuidv4()
      }))
    };
    return ipcRenderer.invoke('add-installation', newInstallation);
  },
  updateInstallation: (installation) => ipcRenderer.invoke('update-installation', installation),
  deleteInstallation: (installationId) => ipcRenderer.invoke('delete-installation', installationId),
  
  // Mantenimiento
  getUpcomingMaintenance: () => ipcRenderer.invoke('get-upcoming-maintenance'),
  
  // WhatsApp
  sendWhatsAppMessage: (data) => ipcRenderer.invoke('send-whatsapp-message', data),
  
  // Notificaciones y eventos
  onAlert: (callback) => {
    ipcRenderer.on('show-alert', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('show-alert');
  },
  onDatabaseImported: (callback) => {
    ipcRenderer.on('db-imported', callback);
    return () => ipcRenderer.removeAllListeners('db-imported');
  },
  onMaintenanceDue: (callback) => {
    ipcRenderer.on('maintenance-due', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('maintenance-due');
  },
  onWhatsAppQr: (callback) => {
    ipcRenderer.on('whatsapp-qr', (event, qr) => callback(qr));
    return () => ipcRenderer.removeAllListeners('whatsapp-qr');
  },
  onWhatsAppReady: (callback) => {
    ipcRenderer.on('whatsapp-ready', callback);
    return () => ipcRenderer.removeAllListeners('whatsapp-ready');
  },
  onWhatsAppAuthFailure: (callback) => {
    ipcRenderer.on('whatsapp-auth-failure', callback);
    return () => ipcRenderer.removeAllListeners('whatsapp-auth-failure');
  },
  
  // Utilidades
  generateId: () => uuidv4(),
  
  // Fecha y hora
  formatDate: (date) => {
    if (!date) return '';
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString();
  },
  calculateNextMaintenanceDate: (lastMaintenanceDate, frequencyMonths) => {
    if (!lastMaintenanceDate) return null;
    
    const lastDate = new Date(lastMaintenanceDate);
    const nextDate = new Date(lastDate);
    nextDate.setMonth(nextDate.getMonth() + parseInt(frequencyMonths, 10));
    
    return nextDate.toISOString().split('T')[0];
  }
});