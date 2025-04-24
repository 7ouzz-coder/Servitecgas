/**
 * Carga React y ReactDOM en el contexto global
 * @returns {Promise} Promesa que se resuelve cuando React está cargado
 */
function loadReact() {
    return new Promise((resolve, reject) => {
      // Verificar si ya está cargado
      if (window.React && window.ReactDOM) {
        console.log('React ya está cargado');
        return resolve({ React: window.React, ReactDOM: window.ReactDOM });
      }
      
      console.log('Cargando React y ReactDOM...');
      
      // URL para React y ReactDOM
      const reactUrl = 'https://unpkg.com/react@17/umd/react.production.min.js';
      const reactDomUrl = 'https://unpkg.com/react-dom@17/umd/react-dom.production.min.js';
      
      // Cargar React primero
      const reactScript = document.createElement('script');
      reactScript.src = reactUrl;
      reactScript.async = true;
      
      reactScript.onload = () => {
        console.log('React cargado, cargando ReactDOM...');
        
        // Luego cargar ReactDOM
        const reactDomScript = document.createElement('script');
        reactDomScript.src = reactDomUrl;
        reactDomScript.async = true;
        
        reactDomScript.onload = () => {
          console.log('ReactDOM cargado correctamente');
          resolve({ React: window.React, ReactDOM: window.ReactDOM });
        };
        
        reactDomScript.onerror = (err) => {
          console.error('Error al cargar ReactDOM:', err);
          reject(new Error('No se pudo cargar ReactDOM'));
        };
        
        document.head.appendChild(reactDomScript);
      };
      
      reactScript.onerror = (err) => {
        console.error('Error al cargar React:', err);
        reject(new Error('No se pudo cargar React'));
      };
      
      document.head.appendChild(reactScript);
    });
  }
  
  /**
   * Registra los componentes de WhatsApp en el ámbito global
   * @returns {Promise} Promesa que se resuelve cuando los componentes están registrados
   */
  function registerWhatsAppComponents() {
    return new Promise(async (resolve, reject) => {
      try {
        // Cargar React primero
        await loadReact();
        
        // Ya tenemos el componente en el archivo aplicación 
        // Registrar el componente globalmente
        const WhatsAppQRComponent = window.WhatsAppQRComponent;
        
        if (!WhatsAppQRComponent) {
          // Si no existe, intentamos crearlo
          console.log('Creando componente WhatsAppQRComponent dinámicamente');
          
          // Aquí incluimos el código del componente directamente
          const React = window.React;
          const { useState, useEffect, useRef } = React;
          
          window.WhatsAppQRComponent = function WhatsAppQRComponent() {
            const [connectionStatus, setConnectionStatus] = useState('disconnected');
            const [qrCode, setQrCode] = useState('');
            const [statusMessage, setStatusMessage] = useState('No conectado a WhatsApp');
            const [isLoading, setIsLoading] = useState(false);
            const qrRef = useRef(null);
  
            useEffect(() => {
              // Verificar estado inicial
              checkWhatsAppStatus();
              // Configurar listeners
              setupWhatsAppListeners();
              // Limpieza
              return () => removeWhatsAppListeners();
            }, []);
  
            const checkWhatsAppStatus = async () => {
              try {
                if (window.api && window.api.isWhatsAppConnected) {
                  const connected = await window.api.isWhatsAppConnected();
                  if (connected) {
                    setConnectionStatus('connected');
                    setStatusMessage('WhatsApp conectado correctamente');
                  }
                }
              } catch (err) {
                console.error("Error al verificar estado WhatsApp:", err);
              }
            };
  
            const setupWhatsAppListeners = () => {
              if (window.api && window.api.onWhatsAppQR) {
                window.api.onWhatsAppQR(handleQrCode);
              }
              if (window.api && window.api.onWhatsAppReady) {
                window.api.onWhatsAppReady(handleWhatsAppReady);
              }
              if (window.api && window.api.onWhatsAppAuthFailure) {
                window.api.onWhatsAppAuthFailure(handleAuthFailure);
              }
              if (window.api && window.api.onWhatsAppDisconnected) {
                window.api.onWhatsAppDisconnected(handleDisconnected);
              }
            };
  
            const removeWhatsAppListeners = () => {
              console.log("Limpiando listeners de WhatsApp");
              // Implementar según sea necesario
            };
  
            const handleQrCode = (qrData) => {
              console.log("QR Code recibido:", typeof qrData);
              setIsLoading(false);
              
              let qrText = '';
              if (typeof qrData === 'object' && qrData.qrCode) {
                qrText = qrData.qrCode;
              } else if (typeof qrData === 'string') {
                qrText = qrData;
              } else if (typeof qrData === 'object') {
                qrText = JSON.stringify(qrData);
              }
              
              setQrCode(qrText);
              setConnectionStatus('connecting');
              setStatusMessage('Escanea el código QR con WhatsApp en tu teléfono');
              
              renderQRCode(qrText);
            };
  
            const renderQRCode = (qrText) => {
              if (!qrText || !qrRef.current) return;
              
              qrRef.current.innerHTML = '';
              
              try {
                if (window.QRCode) {
                  new window.QRCode(qrRef.current, {
                    text: qrText,
                    width: 256,
                    height: 256,
                    colorDark: "#000000",
                    colorLight: "#ffffff"
                  });
                } else {
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrText)}`;
                  qrRef.current.innerHTML = `
                    <img 
                      src="${qrUrl}" 
                      width="256" 
                      height="256" 
                      alt="Código QR WhatsApp"
                      style="background:white; padding:8px; border-radius:4px;"
                    />
                  `;
                }
              } catch (error) {
                console.error("Error al generar QR:", error);
                
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrText)}`;
                qrRef.current.innerHTML = `
                  <img 
                    src="${qrUrl}" 
                    width="256" 
                    height="256" 
                    alt="Código QR WhatsApp"
                    style="background:white; padding:8px; border-radius:4px;"
                  />
                `;
              }
            };
  
            const handleWhatsAppReady = () => {
              setConnectionStatus('connected');
              setStatusMessage('WhatsApp conectado correctamente');
              setQrCode('');
              setIsLoading(false);
            };
  
            const handleAuthFailure = () => {
              setConnectionStatus('disconnected');
              setStatusMessage('Error de autenticación. Intenta nuevamente.');
              setQrCode('');
              setIsLoading(false);
            };
  
            const handleDisconnected = () => {
              setConnectionStatus('disconnected');
              setStatusMessage('WhatsApp se ha desconectado');
              setQrCode('');
              setIsLoading(false);
            };
  
            const handleConnect = async () => {
              try {
                setConnectionStatus('connecting');
                setStatusMessage('Iniciando conexión con WhatsApp...');
                setIsLoading(true);
                
                if (window.api && window.api.sendWhatsAppMessage) {
                  await window.api.sendWhatsAppMessage({ action: 'connect' });
                  console.log("Solicitud de conexión enviada con éxito");
                } else {
                  throw new Error("API de WhatsApp no disponible");
                }
              } catch (error) {
                console.error("Error al conectar WhatsApp:", error);
                setConnectionStatus('disconnected');
                setStatusMessage(`Error: ${error.message || 'No se pudo conectar'}`);
                setIsLoading(false);
              }
            };
  
            const handleLogout = async () => {
              if (window.confirm('¿Estás seguro de que deseas cerrar la sesión de WhatsApp?')) {
                try {
                  if (window.api && window.api.logoutWhatsApp) {
                    const result = await window.api.logoutWhatsApp();
                    
                    if (result.success) {
                      setConnectionStatus('disconnected');
                      setStatusMessage('Sesión de WhatsApp cerrada correctamente');
                    } else {
                      window.alert(`Error: ${result.message || 'No se pudo cerrar sesión'}`);
                    }
                  } else {
                    window.alert('Función de cierre de sesión no disponible');
                  }
                } catch (error) {
                  window.alert(`Error: ${error.message || 'Error desconocido'}`);
                }
              }
            };
  
            return React.createElement(
              'div',
              { className: 'card mb-4' },
              React.createElement(
                'div',
                { className: 'card-header' },
                React.createElement('h5', { className: 'mb-0' }, 'Conexión WhatsApp')
              ),
              React.createElement(
                'div',
                { className: 'card-body' },
                React.createElement(
                  'div',
                  { className: 'text-center mb-3' },
                  React.createElement(
                    'span',
                    { 
                      className: `badge ${
                        connectionStatus === 'connected' ? 'bg-success' : 
                        connectionStatus === 'connecting' ? 'bg-warning' : 'bg-secondary'
                      } mb-2`
                    },
                    connectionStatus === 'connected' ? 'Conectado' : 
                    connectionStatus === 'connecting' ? 'Conectando...' : 'No conectado'
                  ),
                  React.createElement('p', { className: 'mb-3' }, statusMessage)
                ),
                connectionStatus === 'connecting' && React.createElement(
                  'div',
                  { className: 'qr-container text-center my-3' },
                  isLoading ? 
                    React.createElement(
                      'div',
                      { className: 'spinner-border text-primary', role: 'status' },
                      React.createElement('span', { className: 'visually-hidden' }, 'Cargando...')
                    ) : 
                    qrCode ? 
                      React.createElement(
                        'div',
                        { className: 'd-inline-block bg-white p-3 rounded shadow-sm' },
                        React.createElement('div', { ref: qrRef, style: { width: '256px', height: '256px', margin: '0 auto' } })
                      ) : null,
                  React.createElement(
                    'p',
                    { className: 'text-muted mt-2 small' },
                    'Abre WhatsApp en tu teléfono > Menú > Dispositivos vinculados > Vincular un dispositivo'
                  )
                ),
                connectionStatus === 'connected' ? 
                  React.createElement(
                    'div',
                    { className: 'text-center' },
                    React.createElement(
                      'div',
                      { className: 'alert alert-success mb-3' },
                      React.createElement('i', { className: 'bi bi-check-circle-fill me-2' }),
                      'WhatsApp conectado correctamente'
                    ),
                    React.createElement('p', { className: 'text-muted' }, 'Ya puedes enviar notificaciones a tus clientes'),
                    React.createElement(
                      'button',
                      { 
                        className: 'btn btn-outline-danger btn-sm mt-3',
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
                        className: 'btn btn-success',
                        onClick: handleConnect,
                        disabled: connectionStatus === 'connecting'
                      },
                      React.createElement('i', { className: 'bi bi-whatsapp me-2' }),
                      connectionStatus === 'connecting' ? 'Conectando...' : 'Conectar WhatsApp'
                    )
                  )
              )
            );
          };
        }
        
        console.log('Componentes de WhatsApp registrados correctamente');
        resolve();
      } catch (error) {
        console.error('Error al registrar componentes de WhatsApp:', error);
        reject(error);
      }
    });
  }
  
  // Exportar funciones
  window.loadReact = loadReact;
  window.registerWhatsAppComponents = registerWhatsAppComponents;
  
  // Auto-inicializar
  (async function() {
    try {
      console.log('Inicializando carga de React y componentes WhatsApp...');
      await loadReact();
      await registerWhatsAppComponents();
      console.log('React y componentes WhatsApp inicializados correctamente');
    } catch (error) {
      console.error('Error al inicializar React y componentes WhatsApp:', error);
    }
  })();