const { contextBridge, ipcRenderer } = require('electron');

// Versión simplificada para debug
contextBridge.exposeInMainWorld('api', {
  // Eventos básicos
  onAlert: (callback) => {
    ipcRenderer.on('show-alert', (event, data) => callback(data));
  },
  
  // Funciones básicas para clientes
  getClients: () => {
    return ipcRenderer.invoke('get-clients');
  },
  
  // Funciones para instalaciones
  getInstallations: () => {
    return ipcRenderer.invoke('get-installations');
  },
  
  // Funciones para mantenimiento
  getUpcomingMaintenance: () => {
    return ipcRenderer.invoke('get-upcoming-maintenance');
  },
  
  // Función básica para fecha
  formatDate: (date) => {
    if (!date) return '';
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString();
  }
});