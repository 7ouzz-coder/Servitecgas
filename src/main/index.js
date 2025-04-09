const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const cron = require('node-cron');
const { setupStore } = require('./db/store');
const { checkUpcomingMaintenance } = require('./services/maintenance');
const { setupWhatsAppService } = require('./services/whatsapp');

// Inicializar la base de datos
const store = setupStore();

// Ventana principal
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '../../assets/icons/app-icon.png')
  });

  // Cargar la interfaz principal
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Abrir DevTools en desarrollo
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Evento de cierre
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Crear menú de la aplicación
  setupApplicationMenu();
}

// Iniciar la aplicación
app.whenReady().then(() => {
  createWindow();
  
  // Inicializar WhatsApp
  setupWhatsAppService(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Configurar el programador para verificar mantenimientos diariamente
  setupMaintenanceScheduler();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Configurar programador de verificación de mantenimientos
function setupMaintenanceScheduler() {
  // Ejecutar todos los días a las 8:00 AM
  cron.schedule('0 8 * * *', () => {
    const upcomingMaintenance = checkUpcomingMaintenance(store);
    if (mainWindow && upcomingMaintenance.length > 0) {
      mainWindow.webContents.send('maintenance-due', upcomingMaintenance);
    }
  });
}

// Configurar el menú de la aplicación
function setupApplicationMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Exportar Base de Datos',
          click: async () => {
            const { filePath } = await dialog.showSaveDialog({
              buttonLabel: 'Exportar',
              defaultPath: 'gas-tech-backup.json'
            });
            if (filePath) {
              const fs = require('fs');
              const data = store.store;
              fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
              mainWindow.webContents.send('show-alert', {
                type: 'success',
                message: 'Base de datos exportada con éxito'
              });
            }
          }
        },
        {
          label: 'Importar Base de Datos',
          click: async () => {
            const { filePaths } = await dialog.showOpenDialog({
              buttonLabel: 'Importar',
              filters: [{ name: 'JSON', extensions: ['json'] }],
              properties: ['openFile']
            });
            if (filePaths.length > 0) {
              try {
                const fs = require('fs');
                const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
                store.store = data;
                mainWindow.webContents.send('db-imported');
                mainWindow.webContents.send('show-alert', {
                  type: 'success',
                  message: 'Base de datos importada con éxito'
                });
              } catch (error) {
                mainWindow.webContents.send('show-alert', {
                  type: 'error',
                  message: 'Error al importar: ' + error.message
                });
              }
            }
          }
        },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Tamaño real' },
        { role: 'zoomIn', label: 'Aumentar' },
        { role: 'zoomOut', label: 'Disminuir' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              title: 'GasTech App',
              message: 'GasTech App v1.0.0',
              detail: 'Aplicación para gestión de mantenimientos de instalaciones de gas y notificaciones a clientes.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Gestionar eventos IPC
require('./db/ipc-handlers')(ipcMain, store);

// src/main/db/store.js - Gestión de la base de datos
const { app } = require('electron');
const Store = require('electron-store');
const path = require('path');
const fs = require('fs');

let storeInstance = null;

/**
 * Configura y devuelve la instancia de la tienda de datos
 */
function setupStore() {
  if (storeInstance) return storeInstance;
  
  // Crear carpeta de base de datos si no existe
  const dbPath = path.join(app.getPath('userData'), 'database');
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }
  
  // Configuración para almacenar datos
  storeInstance = new Store({
    name: 'app-data',
    fileExtension: 'json',
    cwd: dbPath
  });
  
  return storeInstance;
}

module.exports = {
  setupStore,
};

// src/main/db/ipc-handlers.js - Manejadores de eventos IPC
const { v4: uuidv4 } = require('uuid');

module.exports = function(ipcMain, store) {
  // Clientes
  ipcMain.handle('get-clients', () => {
    return store.get('clients') || [];
  });

  ipcMain.handle('add-client', (event, client) => {
    const clients = store.get('clients') || [];
    const newClient = {
      ...client,
      id: client.id || uuidv4(),
      createdAt: new Date().toISOString()
    };
    const updatedClients = [...clients, newClient];
    store.set('clients', updatedClients);
    return newClient;
  });

  ipcMain.handle('update-client', (event, client) => {
    const clients = store.get('clients') || [];
    const index = clients.findIndex(c => c.id === client.id);
    if (index !== -1) {
      clients[index] = client;
      store.set('clients', clients);
      return client;
    }
    return null;
  });

  ipcMain.handle('delete-client', (event, clientId) => {
    const clients = store.get('clients') || [];
    const newClients = clients.filter(c => c.id !== clientId);
    store.set('clients', newClients);
    
    // También eliminar las instalaciones asociadas
    const installations = store.get('installations') || [];
    const newInstallations = installations.filter(i => i.clientId !== clientId);
    store.set('installations', newInstallations);
    
    return true;
  });

  // Instalaciones
  ipcMain.handle('get-installations', () => {
    return store.get('installations') || [];
  });

  ipcMain.handle('add-installation', (event, installation) => {
    const installations = store.get('installations') || [];
    const newInstallation = {
      ...installation,
      id: installation.id || uuidv4(),
      createdAt: new Date().toISOString(),
      components: installation.components.map(component => ({
        ...component,
        id: component.id || uuidv4()
      }))
    };
    const updatedInstallations = [...installations, newInstallation];
    store.set('installations', updatedInstallations);
    return newInstallation;
  });

  ipcMain.handle('update-installation', (event, installation) => {
    const installations = store.get('installations') || [];
    const index = installations.findIndex(i => i.id === installation.id);
    if (index !== -1) {
      installations[index] = installation;
      store.set('installations', installations);
      return installation;
    }
    return null;
  });

  ipcMain.handle('delete-installation', (event, installationId) => {
    const installations = store.get('installations') || [];
    const newInstallations = installations.filter(i => i.id !== installationId);
    store.set('installations', newInstallations);
    return true;
  });

  // Mantenimiento
  ipcMain.handle('get-upcoming-maintenance', () => {
    const installations = store.get('installations') || [];
    const clients = store.get('clients') || [];
    const today = new Date();
    const upcomingMaintenance = [];
    
    installations.forEach(installation => {
      installation.components.forEach(component => {
        if (component.nextMaintenanceDate) {
          const nextMaintenance = new Date(component.nextMaintenanceDate);
          const diffDays = Math.floor((nextMaintenance - today) / (1000 * 60 * 60 * 24));
          
          // Considerar mantenimientos en los próximos 30 días
          if (diffDays <= 30 && diffDays >= 0) {
            const client = clients.find(c => c.id === installation.clientId);
            
            upcomingMaintenance.push({
              clientName: client ? client.name : 'Cliente desconocido',
              clientPhone: client ? client.phone : '',
              address: installation.address,
              componentName: component.name,
              nextMaintenanceDate: component.nextMaintenanceDate,
              daysLeft: diffDays,
              clientId: installation.clientId,
              installationId: installation.id,
              componentId: component.id
            });
          }
        }
      });
    });
    
    return upcomingMaintenance.sort((a, b) => a.daysLeft - b.daysLeft);
  });

  // WhatsApp
  ipcMain.handle('send-whatsapp-message', (event, data) => {
    const { phone, message } = data;
    
    // Este es un punto donde se integraría con el servicio de WhatsApp
    // Por ahora, solo retornamos como si hubiera sido exitoso
    return {
      success: true,
      message: `Mensaje enviado a ${phone}`
    };
  });
};

// src/main/services/maintenance.js - Servicio de mantenimiento
/**
 * Verifica los mantenimientos próximos
 * @param {Store} store - Instancia de la base de datos
 * @param {number} daysThreshold - Días de umbral para considerar un mantenimiento como próximo
 * @returns {Array} - Lista de mantenimientos próximos
 */
function checkUpcomingMaintenance(store, daysThreshold = 7) {
  const installations = store.get('installations') || [];
  const clients = store.get('clients') || [];
  const today = new Date();
  const upcomingMaintenance = [];
  
  installations.forEach(installation => {
    installation.components.forEach(component => {
      if (component.nextMaintenanceDate) {
        const nextMaintenance = new Date(component.nextMaintenanceDate);
        const diffDays = Math.floor((nextMaintenance - today) / (1000 * 60 * 60 * 24));
        
        // Notificar si el mantenimiento está dentro del umbral de días
        if (diffDays <= daysThreshold && diffDays >= 0) {
          const client = clients.find(c => c.id === installation.clientId);
          
          upcomingMaintenance.push({
            clientName: client ? client.name : 'Cliente desconocido',
            clientPhone: client ? client.phone : '',
            address: installation.address,
            componentName: component.name,
            nextMaintenanceDate: component.nextMaintenanceDate,
            daysLeft: diffDays,
            clientId: installation.clientId,
            installationId: installation.id,
            componentId: component.id
          });
        }
      }
    });
  });
  
  return upcomingMaintenance.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Calcula la fecha de la próxima mantención
 * @param {string} lastMaintenanceDate - Fecha de la última mantención
 * @param {number} frequencyMonths - Frecuencia de mantención en meses
 * @returns {string} - Fecha de la próxima mantención
 */
function calculateNextMaintenanceDate(lastMaintenanceDate, frequencyMonths) {
  if (!lastMaintenanceDate) return null;
  
  const lastDate = new Date(lastMaintenanceDate);
  const nextDate = new Date(lastDate);
  nextDate.setMonth(nextDate.getMonth() + frequencyMonths);
  
  return nextDate.toISOString().split('T')[0];
}

module.exports = {
  checkUpcomingMaintenance,
  calculateNextMaintenanceDate
};

// src/main/services/whatsapp.js - Integración con WhatsApp
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let whatsappClient = null;
let isWhatsAppReady = false;

/**
 * Configura el servicio de WhatsApp
 * @param {BrowserWindow} mainWindow - Ventana principal de la aplicación
 */
function setupWhatsAppService(mainWindow) {
  // Inicializar el cliente de WhatsApp
  whatsappClient = new Client({
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  // Evento para mostrar el código QR
  whatsappClient.on('qr', (qr) => {
    // Generar QR en la terminal (solo para desarrollo)
    qrcode.generate(qr, { small: true });
    
    // Enviar el QR a la interfaz de usuario
    if (mainWindow) {
      mainWindow.webContents.send('whatsapp-qr', qr);
    }
  });

  // Evento cuando el cliente está listo
  whatsappClient.on('ready', () => {
    isWhatsAppReady = true;
    
    if (mainWindow) {
      mainWindow.webContents.send('whatsapp-ready');
      mainWindow.webContents.send('show-alert', {
        type: 'success',
        message: 'WhatsApp conectado y listo para enviar mensajes'
      });
    }
  });

  // Eventos de error
  whatsappClient.on('auth_failure', () => {
    isWhatsAppReady = false;
    if (mainWindow) {
      mainWindow.webContents.send('whatsapp-auth-failure');
      mainWindow.webContents.send('show-alert', {
        type: 'error',
        message: 'Error de autenticación en WhatsApp'
      });
    }
  });

  // Inicializar el cliente
  try {
    whatsappClient.initialize();
  } catch (error) {
    console.error('Error al inicializar WhatsApp:', error);
  }
}

/**
 * Envía un mensaje de WhatsApp
 * @param {string} to - Número de teléfono del destinatario (con código de país)
 * @param {string} message - Mensaje a enviar
 * @returns {Promise<Object>} - Resultado del envío
 */
async function sendWhatsAppMessage(to, message) {
  if (!isWhatsAppReady || !whatsappClient) {
    return {
      success: false,
      message: 'WhatsApp no está conectado'
    };
  }
  
  try {
    // Formatear el número según el formato requerido por WhatsApp Web
    const formattedNumber = to.replace(/\D/g, '');
    
    // Enviar mensaje
    const response = await whatsappClient.sendMessage(`${formattedNumber}@c.us`, message);
    
    return {
      success: true,
      message: 'Mensaje enviado con éxito',
      data: response
    };
  } catch (error) {
    console.error('Error al enviar mensaje WhatsApp:', error);
    return {
      success: false,
      message: `Error al enviar mensaje: ${error.message}`
    };
  }
}

module.exports = {
  setupWhatsAppService,
  sendWhatsAppMessage
};

// src/main/utils/date.js - Utilidades de fechas
/**
 * Formatea una fecha al formato local
 * @param {string|Date} date - Fecha a formatear
 * @returns {string} - Fecha formateada
 */
function formatDate(date) {
  if (!date) return '';
  
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString();
}

/**
 * Calcula la diferencia en días entre dos fechas
 * @param {string|Date} date1 - Primera fecha
 * @param {string|Date} date2 - Segunda fecha
 * @returns {number} - Diferencia en días
 */
function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  // Convertir a días
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

module.exports = {
  formatDate,
  daysBetween
};