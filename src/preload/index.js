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
  
  // EVENTOS DE WHATSAPP
  
  // QR Code generado
  onWhatsAppQR: (callback) => {
    ipcRenderer.on('whatsapp-qr', (_, qrData) => callback(qrData));
  },
  
  // WhatsApp listo
  onWhatsAppReady: (callback) => {
    ipcRenderer.on('whatsapp-ready', () => callback());
  },
  
  // Error de autenticación
  onWhatsAppAuthFailure: (callback) => {
    ipcRenderer.on('whatsapp-auth-failure', () => callback());
  },
  
  // WhatsApp desconectado
  onWhatsAppDisconnected: (callback) => {
    ipcRenderer.on('whatsapp-disconnected', () => callback());
  },
  
  // Pantalla de carga
  onWhatsAppLoading: (callback) => {
    ipcRenderer.on('whatsapp-loading', (_, data) => callback(data));
  },
  
  // Autenticación correcta
  onWhatsAppAuthenticated: (callback) => {
    ipcRenderer.on('whatsapp-authenticated', () => callback());
  },
  
  // Inicialización comenzada
  onWhatsAppInitializationStarted: (callback) => {
    ipcRenderer.on('whatsapp-initialization-started', () => callback());
  },
  
  // Error en inicialización
  onWhatsAppInitializationFailed: (callback) => {
    ipcRenderer.on('whatsapp-initialization-failed', (event, data) => callback(data));
  },
  
  // Cambio en estado general de WhatsApp
  onWhatsAppStatusChanged: (callback) => {
    ipcRenderer.on('whatsapp-status-changed', (event, data) => callback(data));
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
      return ipcRenderer.invoke('calculate-next-maintenance-date', { 
        lastMaintenanceDate: lastDate, 
        frequency 
      });
    } catch (error) {
      console.error('Error al calcular fecha de próximo mantenimiento:', error);
      
      // Implementación local alternativa como fallback
      if (!lastDate) return null;
      
      const lastDateObj = new Date(lastDate);
      const nextDateObj = new Date(lastDateObj);
      nextDateObj.setMonth(nextDateObj.getMonth() + parseInt(frequency, 10));
      
      // Devolver en formato YYYY-MM-DD
      return nextDateObj.toISOString().split('T')[0];
    }
  },
  
  // ============================================================
  // WhatsApp
  // ============================================================
  
  // Verificar estado de conexión
  isWhatsAppConnected: () => ipcRenderer.invoke('is-whatsapp-connected'),
  
  // Inicializar cliente
  initializeWhatsApp: () => ipcRenderer.invoke('initialize-whatsapp'),
  
  // Cerrar sesión
  logoutWhatsApp: () => ipcRenderer.invoke('logout-whatsapp'),
  
  // Enviar mensaje (incluye acción de conectar)
  sendWhatsAppMessage: (messageData) => ipcRenderer.invoke('send-whatsapp-message', messageData),
  
  // Obtener historial de mensajes
  getWhatsAppMessageHistory: () => ipcRenderer.invoke('get-whatsapp-message-history'),
  
  // Obtener chats (para futuras implementaciones)
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

// Función auxiliar para crear componentes React si se necesitan
function setupReactComponents() {
  try {
    // Importar React y ReactDOM si están disponibles
    const React = require('react');
    const ReactDOM = require('react-dom');
    
    // Exponer React y ReactDOM para uso en el renderer
    contextBridge.exposeInMainWorld('React', React);
    contextBridge.exposeInMainWorld('ReactDOM', ReactDOM);
    
    // Crear componente WhatsApp QR para React
    const WhatsAppQRConnector = ({ onConnect, onLogout }) => {
      const [status, setStatus] = React.useState('disconnected');
      const [message, setMessage] = React.useState('No conectado a WhatsApp');
      const [isLoading, setIsLoading] = React.useState(false);
      const qrRef = React.useRef(null);
      
      React.useEffect(() => {
        // Verificar estado actual
        ipcRenderer.invoke('is-whatsapp-connected')
          .then(connected => {
            if (connected) {
              setStatus('connected');
              setMessage('WhatsApp conectado correctamente');
            }
          })
          .catch(error => console.error('Error al verificar estado:', error));
        
        // Configurar listeners
        const qrListener = (_, qrData) => {
          setIsLoading(false);
          setStatus('connecting');
          setMessage('Escanea el código QR con WhatsApp en tu teléfono');
          renderQR(qrData);
        };
        
        const readyListener = () => {
          setStatus('connected');
          setMessage('WhatsApp conectado correctamente');
          setIsLoading(false);
        };
        
        const authFailureListener = () => {
          setStatus('disconnected');
          setMessage('Error de autenticación en WhatsApp. Intenta nuevamente.');
          setIsLoading(false);
        };
        
        const disconnectListener = () => {
          setStatus('disconnected');
          setMessage('WhatsApp se ha desconectado');
          setIsLoading(false);
        };
        
        // Registrar listeners
        ipcRenderer.on('whatsapp-qr', qrListener);
        ipcRenderer.on('whatsapp-ready', readyListener);
        ipcRenderer.on('whatsapp-auth-failure', authFailureListener);
        ipcRenderer.on('whatsapp-disconnected', disconnectListener);
        
        // Limpiar listeners al desmontar
        return () => {
          ipcRenderer.removeListener('whatsapp-qr', qrListener);
          ipcRenderer.removeListener('whatsapp-ready', readyListener);
          ipcRenderer.removeListener('whatsapp-auth-failure', authFailureListener);
          ipcRenderer.removeListener('whatsapp-disconnected', disconnectListener);
        };
      }, []);
      
      const renderQR = (qrData) => {
        if (!qrRef.current) return;
        
        qrRef.current.innerHTML = '';
        
        try {
          let qrText = '';
          let qrUrl = null;
          
          // Extraer datos del QR según formato
          if (typeof qrData === 'object' && qrData.qrCode) {
            qrText = qrData.qrCode;
          } else if (typeof qrData === 'object' && qrData.qrImageUrl) {
            qrUrl = qrData.qrImageUrl;
          } else if (typeof qrData === 'string') {
            qrText = qrData;
          } else if (typeof qrData === 'object') {
            qrText = JSON.stringify(qrData);
          }
          
          // Si tenemos URL, usarla directamente
          if (qrUrl) {
            const img = document.createElement('img');
            img.src = qrUrl;
            img.width = 256;
            img.height = 256;
            img.alt = 'WhatsApp QR';
            qrRef.current.appendChild(img);
            return;
          }
          
          // Si window.QRCode está disponible
          if (window.QRCode) {
            new window.QRCode(qrRef.current, {
              text: qrText,
              width: 256,
              height: 256,
              colorDark: "#000000",
              colorLight: "#ffffff"
            });
          } else {
            // Usar API externa
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrText)}`;
            const img = document.createElement('img');
            img.src = qrCodeUrl;
            img.width = 256;
            img.height = 256;
            img.alt = 'WhatsApp QR';
            qrRef.current.appendChild(img);
          }
        } catch (error) {
          console.error('Error al generar QR en componente React:', error);
          qrRef.current.innerHTML = '<div style="color:red;">Error al generar QR</div>';
        }
      };
      
      const handleConnect = async () => {
        setIsLoading(true);
        setStatus('connecting');
        setMessage('Iniciando conexión con WhatsApp...');
        
        try {
          await ipcRenderer.invoke('send-whatsapp-message', { action: 'connect' });
          if (typeof onConnect === 'function') onConnect();
        } catch (error) {
          console.error('Error al conectar WhatsApp:', error);
          setStatus('disconnected');
          setMessage(`Error al conectar: ${error.message}`);
          setIsLoading(false);
        }
      };
      
      const handleLogout = async () => {
        try {
          await ipcRenderer.invoke('logout-whatsapp');
          if (typeof onLogout === 'function') onLogout();
        } catch (error) {
          console.error('Error al cerrar sesión:', error);
        }
      };
      
      // Renderizar componente React
      return React.createElement(
        'div',
        { className: 'whatsapp-connector' },
        React.createElement(
          'div', 
          { className: 'text-center mb-3' },
          React.createElement(
            'span',
            { 
              className: `badge ${
                status === 'connected' ? 'bg-success' : 
                status === 'connecting' ? 'bg-warning text-dark' : 'bg-secondary'
              } px-3 py-2 fs-6`
            },
            status === 'connected' ? 'Conectado' : 
            status === 'connecting' ? 'Conectando...' : 'No conectado'
          ),
          React.createElement('p', { className: 'mb-3' }, message)
        ),
        status === 'connecting' && React.createElement(
          'div',
          { className: 'qr-container text-center my-3' },
          isLoading ? 
            React.createElement(
              'div',
              { className: 'spinner-border text-success', role: 'status' },
              React.createElement('span', { className: 'visually-hidden' }, 'Cargando...')
            ) : 
            React.createElement(
              'div',
              { className: 'd-inline-block bg-white p-3 rounded shadow-sm' },
              React.createElement('div', { ref: qrRef, style: { width: '256px', height: '256px' } })
            )
        ),
        status === 'connected' ? 
          React.createElement(
            'div',
            { className: 'text-center' },
            React.createElement(
              'button',
              { 
                className: 'btn btn-outline-danger',
                onClick: handleLogout
              },
              React.createElement('i', { className: 'bi bi-box-arrow-right me-2' }),
              'Cerrar sesión de WhatsApp'
            )
          ) : 
          React.createElement(
            'div',
            { className: 'text-center' },
            React.createElement(
              'button',
              { 
                className: 'btn btn-success btn-lg',
                onClick: handleConnect,
                disabled: status === 'connecting'
              },
              React.createElement('i', { className: 'bi bi-whatsapp me-2' }),
              status === 'connecting' ? 'Conectando...' : 'Conectar WhatsApp'
            )
          )
      );
    };
    
    // Exponer componente de WhatsApp para React
    contextBridge.exposeInMainWorld('WhatsAppQRConnector', {
      default: WhatsAppQRConnector
    });
    
    return true;
  } catch (error) {
    console.error('Error al configurar componentes React:', error);
    return false;
  }
}

// Intentar inicializar React si está disponible
setupReactComponents();