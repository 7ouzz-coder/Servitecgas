import { useState, useEffect, useRef } from 'react';

const WhatsAppQRConnector = () => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected'
  const [qrCode, setQrCode] = useState('');
  const [statusMessage, setStatusMessage] = useState('No conectado a WhatsApp');
  const qrRef = useRef(null);

  useEffect(() => {
    // Verificar estado inicial de WhatsApp
    if (window.api && window.api.isWhatsAppConnected) {
      window.api.isWhatsAppConnected()
        .then(connected => {
          if (connected) {
            setConnectionStatus('connected');
            setStatusMessage('WhatsApp conectado correctamente');
          }
        })
        .catch(err => console.error("Error al verificar estado WhatsApp:", err));
    }

    // Listener para el código QR
    const handleQrCode = (qr) => {
      console.log(`QR Code recibido en componente React: ${qr ? qr.substring(0, 20) + '...' : 'null'}`);
      setQrCode(qr);
      setConnectionStatus('connecting');
      setStatusMessage('Escanea el código QR con WhatsApp en tu teléfono');
      
      // Generar QR usando API externa si la biblioteca no está disponible
      if (qr && qrRef.current) {
        // Si tenemos una biblioteca QR disponible, la usamos
        if (window.QRCode) {
          qrRef.current.innerHTML = '';
          try {
            new window.QRCode(qrRef.current, {
              text: qr,
              width: 256,
              height: 256,
              colorDark: "#000000",
              colorLight: "#ffffff"
            });
          } catch (error) {
            console.error("Error al generar QR con biblioteca:", error);
            // Fallback a API externa
            createQRWithExternalAPI(qr);
          }
        } else {
          // Usar API externa como respaldo
          createQRWithExternalAPI(qr);
        }
      }
    };
    
    // Función para crear QR con API externa
    const createQRWithExternalAPI = (qr) => {
      if (!qrRef.current) return;
      
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr)}`;
      qrRef.current.innerHTML = `
        <img 
          src="${qrUrl}" 
          width="256" 
          height="256" 
          style="background:white; padding:8px; border-radius:4px;" 
          alt="Código QR WhatsApp"
          onerror="this.onerror=null; this.style.display='none'; this.parentNode.innerHTML += '<div class=\\'alert alert-warning mt-2\\'>Error al cargar QR. Intenta nuevamente.</div>';"
        />
      `;
    };

    // Listener para cuando WhatsApp está listo
    const handleWhatsAppReady = () => {
      setConnectionStatus('connected');
      setStatusMessage('WhatsApp conectado correctamente');
      setQrCode('');
    };

    // Listener para error de autenticación
    const handleAuthFailure = () => {
      setConnectionStatus('disconnected');
      setStatusMessage('Error de autenticación. Intenta nuevamente.');
      setQrCode('');
    };

    // Listener para desconexión
    const handleDisconnected = () => {
      setConnectionStatus('disconnected');
      setStatusMessage('WhatsApp se ha desconectado');
      setQrCode('');
    };

    // Registrar event listeners
    if (window.api) {
      window.api.onWhatsAppQR(handleQrCode);
      window.api.onWhatsAppReady(handleWhatsAppReady);
      window.api.onWhatsAppAuthFailure(handleAuthFailure);
      window.api.onWhatsAppDisconnected(handleDisconnected);
    }

    // Limpiar event listeners al desmontar
    return () => {
      if (window.api && window.api.removeListener) {
        window.api.removeListener('whatsapp-qr', handleQrCode);
        window.api.removeListener('whatsapp-ready', handleWhatsAppReady);
        window.api.removeListener('whatsapp-auth-failure', handleAuthFailure);
        window.api.removeListener('whatsapp-disconnected', handleDisconnected);
      }
    };
  }, []);

  const handleConnect = () => {
    setConnectionStatus('connecting');
    setStatusMessage('Iniciando conexión con WhatsApp...');
    
    if (window.api && window.api.sendWhatsAppMessage) {
      window.api.sendWhatsAppMessage({ action: 'connect' })
        .catch(error => {
          console.error("Error al conectar WhatsApp:", error);
          setConnectionStatus('disconnected');
          setStatusMessage(`Error: ${error.message || 'No se pudo conectar'}`);
        });
    } else {
      console.error("API de WhatsApp no disponible");
      setStatusMessage('Error: API de WhatsApp no disponible');
    }
  };

  const handleLogout = () => {
    if (window.confirm('¿Estás seguro de que deseas cerrar la sesión de WhatsApp?')) {
      if (window.api && window.api.logoutWhatsApp) {
        window.api.logoutWhatsApp()
          .then(result => {
            if (result.success) {
              setConnectionStatus('disconnected');
              setStatusMessage('Sesión de WhatsApp cerrada correctamente');
            } else {
              window.alert(`Error: ${result.message || 'No se pudo cerrar sesión'}`);
            }
          })
          .catch(error => {
            window.alert(`Error: ${error.message || 'Error desconocido'}`);
          });
      }
    }
  };

  // Renderizado del componente
  return (
    <div className="card mb-4">
      <div className="card-header">
        <h5 className="mb-0">Conexión WhatsApp</h5>
      </div>
      <div className="card-body">
        <div className="text-center mb-3">
          <span className={`badge ${
            connectionStatus === 'connected' ? 'bg-success' : 
            connectionStatus === 'connecting' ? 'bg-warning' : 'bg-secondary'
          } mb-2`}>
            {connectionStatus === 'connected' ? 'Conectado' : 
             connectionStatus === 'connecting' ? 'Conectando...' : 'No conectado'}
          </span>
          <p className="mb-3">{statusMessage}</p>
        </div>

        {connectionStatus === 'connecting' && qrCode && (
          <div className="qr-container text-center my-3">
            <div className="d-inline-block bg-white p-3 rounded shadow-sm">
              <div ref={qrRef} style={{width: '256px', height: '256px', margin: '0 auto'}}></div>
            </div>
            <p className="text-muted mt-2 small">
              Abre WhatsApp en tu teléfono &gt; Menú &gt; Dispositivos vinculados &gt; Vincular un dispositivo
            </p>
          </div>
        )}

        {connectionStatus === 'connected' ? (
          <div className="text-center">
            <div className="alert alert-success mb-3">
              <i className="bi bi-check-circle-fill me-2"></i>
              WhatsApp conectado correctamente
            </div>
            <p className="text-muted">Ya puedes enviar notificaciones a tus clientes</p>
            <button 
              className="btn btn-outline-danger btn-sm mt-3" 
              onClick={handleLogout}
            >
              <i className="bi bi-box-arrow-right me-2"></i>
              Cerrar sesión de WhatsApp
            </button>
          </div>
        ) : (
          <div className="text-center">
            <button 
              className="btn btn-success" 
              onClick={handleConnect}
              disabled={connectionStatus === 'connecting'}
            >
              <i className="bi bi-whatsapp me-2"></i>
              {connectionStatus === 'connecting' ? 'Conectando...' : 'Conectar WhatsApp'}
            </button>
            
            {connectionStatus === 'connecting' && !qrCode && (
              <div className="mt-3">
                <div className="spinner-border spinner-border-sm text-success me-2" role="status">
                  <span className="visually-hidden">Conectando...</span>
                </div>
                <span>Generando código QR...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppQRConnector;