const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

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
    }
  });

  // Cargar la interfaz principal
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Abrir DevTools
  mainWindow.webContents.openDevTools();

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
  
  // Configurar datos iniciales
  setupHandlers();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Configurar manejadores IPC básicos
function setupHandlers() {
  // Clientes básicos para prueba
  const mockClients = [
    { id: '1', name: 'Cliente Test 1', phone: '+1234567890', email: 'test@example.com' },
    { id: '2', name: 'Cliente Test 2', phone: '+9876543210', email: 'test2@example.com' }
  ];
  
  // Instalaciones básicas para prueba
  const mockInstallations = [
    { 
      id: '101', 
      clientId: '1',
      address: 'Dirección Test 1',
      type: 'Residencial',
      components: [
        { id: 'c1', name: 'Caldera', nextMaintenanceDate: '2025-05-01' }
      ]
    }
  ];
  
  // Manejadores básicos
  ipcMain.handle('get-clients', () => mockClients);
  ipcMain.handle('get-installations', () => mockInstallations);
  ipcMain.handle('get-upcoming-maintenance', () => {
    return [
      {
        clientId: '1',
        clientName: 'Cliente Test 1',
        componentName: 'Caldera',
        address: 'Dirección Test 1',
        nextMaintenanceDate: '2025-05-01',
        daysLeft: 30
      }
    ];
  });
}