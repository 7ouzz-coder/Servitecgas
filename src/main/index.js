// src/main/index.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { setupStore } = require('./db/store');
const AuthService = require('./services/auth'); // Servicio de autenticación local
const fs = require('fs');
const errorHandler = require('./utils/error-handler');
const setupIpcHandlers = require('./db/ipc-handlers');
const { safeRegisterHandler, getRegisteredHandlers } = require('./utils/events-manager');
const { sendNotification, sendAlert } = require('./utils/notification-manager');

// Cargar variables de entorno
require('dotenv').config();

// Importar servicios
const whatsappService = require('./services/whatsapp');
const backupService = require('./services/backup');
const updateService = require('./update-system');
const syncService = require('./sync-integration');

// Variable para la ventana principal
let mainWindow;

// Variables para servicios
let authService;
let store;

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
    store = setupStore();
    
    // Inicializar servicio de autenticación
    authService = new AuthService(store);
    
    // Configurar servicio de WhatsApp
    whatsappService.setupWhatsAppService(mainWindow);
    
    // Configurar sistema de respaldos automáticos
    backupService.setupAutomaticBackup(mainWindow);
    
    // Inicializar sistema de actualizaciones
    updateService.initUpdateSystem(mainWindow);
    
    // Configurar sincronización con Azure
    try {
      // Configurar la sincronización con Azure
      await syncService.setupSync(store, mainWindow);
      console.log('Sincronización configurada correctamente');
    } catch (error) {
      errorHandler.captureError('setupSync', error);
      console.error('Error al inicializar sincronización:', error);
    }
    
    // Agrupar todos los servicios para los manejadores IPC
    const services = {
      authService,
      whatsappService,
      backupService,
      updateService,
      syncService
    };
    
    // Configurar manejadores IPC centralizados
    setupIpcHandlers(ipcMain, store, services, mainWindow);
    
    console.log('Aplicación inicializada correctamente');
    console.log('Manejadores IPC registrados:', getRegisteredHandlers().join(', '));
    
  } catch (error) {
    errorHandler.captureError('app.whenReady', error);
    console.error('Error crítico al iniciar la aplicación:', error);
    dialog.showErrorBox(
      'Error de inicialización', 
      `Ocurrió un error crítico al iniciar la aplicación: ${error.message}`
    );
  }
}).catch(error => {
  errorHandler.captureError('app.whenReady.catch', error);
  console.error('Error fatal al iniciar la aplicación:', error);
  dialog.showErrorBox(
    'Error fatal', 
    `Error al iniciar la aplicación: ${error.message}`
  );
});

// Salir cuando todas las ventanas estén cerradas (excepto en macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Detener servicios antes de salir
    if (syncService && syncService.stopAutoSync) {
      syncService.stopAutoSync();
    }
    app.quit();
  }
});