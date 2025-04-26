import { useState, useEffect, useRef } from 'react';

const WhatsAppQRConnector = () => {
  const [status, setStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected'
  const [message, setMessage] = useState('No conectado a WhatsApp');
  const [isLoading, setIsLoading] = useState(false);
  const qrRef = useRef(null);

  useEffect(() => {
    // Al montar, verificar el estado actual
    checkConnectionStatus();
    
    // Configurar listeners para eventos de WhatsApp
    setupEventListeners();
    
    // Limpieza al desmontar
    return () => {
      cleanupEventListeners();
    };
  }, []);

  const checkConnectionStatus = async () => {
    try {
      if (window.api && window.api.isWhatsAppConnected) {
        const connected = await window.api.isWhatsAppConnected();
        if (connected) {
          setStatus('connected');
          setMessage('WhatsApp conectado correctamente');
        }
      }
    } catch (error) {
      console.error('Error al verificar estado de WhatsApp:', error);
    }
  };

  const setupEventListeners = () => {
    if (window.api) {
      // QR Code
      if (window.api.onWhatsAppQR) {
        window.api.onWhatsAppQR(handleQRCode);
      }
      
      // Connected
      if (window.api.onWhatsAppReady) {
        window.api.onWhatsAppReady(handleReady);
      }
      
      // Auth Error
      if (window.api.onWhatsAppAuthFailure) {
        window.api.onWhatsAppAuthFailure(handleAuthFailure);
      }
      
      // Disconnected
      if (window.api.onWhatsAppDisconnected) {
        window.api.onWhatsAppDisconnected(handleDisconnected);
      }
      
      // Loading
      if (window.api.onWhatsAppLoading) {
        window.api.onWhatsAppLoading(handleLoading);
      }
    }
  };

  const cleanupEventListeners = () => {
    // Implementación básica, idealmente deberíamos remover los event listeners
    console.log('Limpiando event listeners de WhatsApp');
  };

  const handleQRCode = (qrData) => {
    console.log('QR Code recibido!', typeof qrData);
    setIsLoading(false);
    setStatus('connecting');
    setMessage('Escanea el código QR con WhatsApp en tu teléfono');
    
    // Limpiar el contenedor QR
    if (qrRef.current) {
      qrRef.current.innerHTML = '';
      
      try {
        let qrText = '';
        
        // Extraer texto QR según el formato recibido
        if (typeof qrData === 'object' && qrData.qrCode) {
          qrText = qrData.qrCode;
        } else if (typeof qrData === 'string') {
          qrText = qrData;
        } else if (typeof qrData === 'object') {
          qrText = JSON.stringify(qrData);
        }
        
        // Si tenemos la biblioteca QRCode disponible
        if (window.QRCode) {
          new window.QRCode(qrRef.current, {
            text: qrText,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff"
          });
        } else {
          // Alternativa usando API externa
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrText)}`;
          const img = document.createElement('img');
          img.src = qrUrl;
          img.width = 256;
          img.height = 256;
          img.alt = 'WhatsApp QR Code';
          qrRef.current.appendChild(img);
        }
      } catch (error) {
        console.error('Error al generar QR:', error);
        
        // Plan de respaldo: usar API externa
        if (qrRef.current) {
          const qrText = typeof qrData === 'string' ? qrData : 
                        (typeof qrData === 'object' && qrData.qrCode) ? qrData.qrCode : JSON.stringify(qrData);
          
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrText)}`;
          qrRef.current.innerHTML = `
            <img 
              src="${qrUrl}" 
              width="256" 
              height="256" 
              alt="WhatsApp QR Code"
            />
          `;
        }
      }
    }
  };

  const handleReady = () => {
    setStatus('connected');
    setMessage('WhatsApp conectado correctamente');
    setIsLoading(false);
  };

  const handleAuthFailure = () => {
    setStatus('disconnected');
    setMessage('Error de autenticación en WhatsApp. Intenta nuevamente.');
    setIsLoading(false);
  };

  const handleDisconnected = () => {
    setStatus('disconnected');
    setMessage('WhatsApp se ha desconectado');
    setIsLoading(false);
  };

  const handleLoading = (data) => {
    setIsLoading(true);
    setStatus('connecting');
    if (data && data.message) {
      setMessage(data.message);
    } else {
      setMessage('Conectando con WhatsApp...');
    }
  };

  const handleConnectClick = async () => {
    setIsLoading(true);
    setStatus('connecting');
    setMessage('Iniciando conexión con WhatsApp...');
    
    try {
      if (window.api && window.api.sendWhatsAppMessage) {
        await window.api.sendWhatsAppMessage({ action: 'connect' });
        console.log('Solicitud de conexión enviada correctamente');
      } else if (window.api && window.api.initializeWhatsApp) {
        await window.api.initializeWhatsApp();
        console.log('Inicialización de WhatsApp solicitada correctamente');
      } else {
        throw new Error('API de WhatsApp no disponible');
      }
    } catch (error) {
      console.error('Error al conectar WhatsApp:', error);
      setStatus('disconnected');
      setMessage(`Error al conectar: ${error.message}`);
      setIsLoading(false);
    }
  };

  const handleLogoutClick = async () => {
    if (window.confirm('¿Estás seguro de que deseas cerrar la sesión de WhatsApp?')) {
      try {
        if (window.api && window.api.logoutWhatsApp) {
          const result = await window.api.logoutWhatsApp();
          if (result.success) {
            setStatus('disconnected');
            setMessage('Sesión de WhatsApp cerrada correctamente');
          } else {
            alert(`Error: ${result.message}`);
          }
        }
      } catch (error) {
        console.error('Error al cerrar sesión:', error);
        alert(`Error al cerrar sesión: ${error.message}`);
      }
    }
  };

  return (
    <div className="card mb-4">
      <div className="card-header bg-primary bg-opacity-10">
        <h5 className="mb-0">
          <i className="bi bi-whatsapp me-2 text-success"></i>
          Conexión WhatsApp
        </h5>
      </div>
      <div className="card-body">
        <div className="text-center mb-3">
          <div className="mb-2">
            <span className={`badge ${
              status === 'connected' ? 'bg-success' : 
              status === 'connecting' ? 'bg-warning text-dark' : 'bg-secondary'
            } px-3 py-2 fs-6`}>
              {status === 'connected' ? 'Conectado' : 
               status === 'connecting' ? 'Conectando...' : 'No conectado'}
            </span>
          </div>
          <p className="mb-3">{message}</p>
        </div>

        {status === 'connecting' && (
          <div className="qr-container text-center mb-4">
            {isLoading ? (
              <div className="d-flex justify-content-center mb-3">
                <div className="spinner-border text-success" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
              </div>
            ) : (
              <div className="d-inline-block bg-white p-3 rounded shadow-sm mb-3">
                <div ref={qrRef} style={{width: 256, height: 256}}></div>
              </div>
            )}
            
            <div className="alert alert-info small">
              <ol className="mb-0 ps-3 text-start">
                <li>Abre WhatsApp en tu teléfono</li>
                <li>Toca en Menú ⋮ o Ajustes ⚙️</li>
                <li>Selecciona <strong>Dispositivos vinculados</strong></li>
                <li>Toca en <strong>Vincular un dispositivo</strong></li>
                <li>Apunta la cámara al código QR</li>
              </ol>
            </div>
          </div>
        )}

        {status === 'connected' ? (
          <div className="text-center">
            <div className="alert alert-success mb-4">
              <i className="bi bi-check-circle-fill me-2"></i>
              WhatsApp conectado correctamente
            </div>
            <p className="text-muted mb-4">Ya puedes enviar notificaciones a tus clientes</p>
            <button 
              className="btn btn-outline-danger"
              onClick={handleLogoutClick}
            >
              <i className="bi bi-box-arrow-right me-2"></i>
              Cerrar sesión de WhatsApp
            </button>
          </div>
        ) : (
          <div className="text-center">
            <button 
              className="btn btn-success btn-lg"
              onClick={handleConnectClick}
              disabled={status === 'connecting'}
            >
              <i className="bi bi-whatsapp me-2"></i>
              {status === 'connecting' ? 'Conectando...' : 'Conectar WhatsApp'}
            </button>
            
            <p className="text-muted small mt-3">
              Al conectar WhatsApp podrás enviar notificaciones a tus clientes
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppQRConnector;