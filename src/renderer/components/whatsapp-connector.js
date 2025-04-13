// Componente para gestionar la conexión con WhatsApp
const React = require('react');
const { useState, useEffect } = require('react');

function WhatsAppConnector() {
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected'
  const [qrCode, setQrCode] = useState('');
  const [statusMessage, setStatusMessage] = useState('No conectado a WhatsApp');

  useEffect(() => {
    // Verificar estado inicial
    window.api.isWhatsAppConnected && window.api.isWhatsAppConnected().then(connected => {
      if (connected) {
        setConnectionStatus('connected');
        setStatusMessage('WhatsApp conectado correctamente');
      }
    }).catch(error => {
      console.error("Error al verificar estado de WhatsApp:", error);
    });

    // Función para manejar eventos de WhatsApp
    const handleWhatsAppQR = (qr) => {
      console.log("QR recibido:", qr ? "sí" : "no");
      setQrCode(qr);
      setConnectionStatus('connecting');
      setStatusMessage('Escanea el código QR con WhatsApp en tu teléfono');
    };

    const handleWhatsAppReady = () => {
      console.log("WhatsApp listo");
      setConnectionStatus('connected');
      setStatusMessage('WhatsApp conectado correctamente');
      setQrCode('');
    };

    const handleAuthFailure = () => {
      console.log("Error de autenticación");
      setConnectionStatus('disconnected');
      setStatusMessage('Error de autenticación. Intenta nuevamente.');
      setQrCode('');
    };

    const handleDisconnected = () => {
      console.log("WhatsApp desconectado");
      setConnectionStatus('disconnected');
      setStatusMessage('WhatsApp se ha desconectado');
      setQrCode('');
    };

    // Agregar listeners
    if (window.api.onWhatsAppQR) {
      window.api.onWhatsAppQR(handleWhatsAppQR);
    }
    if (window.api.onWhatsAppReady) {
      window.api.onWhatsAppReady(handleWhatsAppReady);
    }
    if (window.api.onWhatsAppAuthFailure) {
      window.api.onWhatsAppAuthFailure(handleAuthFailure);
    }
    if (window.api.onWhatsAppDisconnected) {
      window.api.onWhatsAppDisconnected(handleDisconnected);
    }

    // Limpiar listeners al desmontar
    return () => {
      if (window.api.removeListener) {
        window.api.removeListener('whatsapp-qr', handleWhatsAppQR);
        window.api.removeListener('whatsapp-ready', handleWhatsAppReady);
        window.api.removeListener('whatsapp-auth-failure', handleAuthFailure);
        window.api.removeListener('whatsapp-disconnected', handleDisconnected);
      }
    };
  }, []);

  const handleConnect = () => {
    setConnectionStatus('connecting');
    setStatusMessage('Iniciando conexión con WhatsApp...');
    
    if (window.api.sendWhatsAppMessage) {
      window.api.sendWhatsAppMessage({ action: 'connect' })
        .catch(error => {
          console.error("Error al conectar:", error);
          setConnectionStatus('disconnected');
          setStatusMessage(`Error: ${error.message}`);
        });
    } else {
      console.error("API de WhatsApp no disponible");
      setStatusMessage('Error: API de WhatsApp no disponible');
    }
  };

  const handleDisconnect = () => {
    if (window.confirm('¿Estás seguro de que deseas cerrar la sesión de WhatsApp?')) {
      if (window.api.logoutWhatsApp) {
        window.api.logoutWhatsApp()
          .then(result => {
            if (result.success) {
              setConnectionStatus('disconnected');
              setStatusMessage('Sesión de WhatsApp cerrada correctamente');
            } else {
              window.alert(`Error: ${result.message}`);
            }
          })
          .catch(error => {
            window.alert(`Error: ${error.message}`);
          });
      }
    }
  };

  // En vez de intentar renderizar el QR de manera compleja,
  // simplemente mostraremos un mensaje indicando que se debe
  // verificar la consola o usar el QR en terminal
  return (
    <div className="card mb-4">
      <div className="card-header">
        <h5 className="mb-0">Conexión WhatsApp</h5>
      </div>
      <div className="card-body text-center">
        <div className="mb-3">
          <span className={`badge ${connectionStatus === 'connected' ? 'bg-success' : connectionStatus === 'connecting' ? 'bg-warning' : 'bg-secondary'} mb-2`}>
            {connectionStatus === 'connected' ? 'Conectado' : connectionStatus === 'connecting' ? 'Conectando...' : 'No conectado'}
          </span>
          <p className="mb-3">{statusMessage}</p>
        </div>

        {qrCode && connectionStatus === 'connecting' && (
          <div className="alert alert-info">
            <p><strong>Código QR generado</strong></p>
            <p>Por favor escanea el código QR que aparece en la terminal de la aplicación.</p>
            <p className="mb-0"><small>El código también se muestra en la consola de desarrollador.</small></p>
          </div>
        )}

        {connectionStatus === 'connected' ? (
          <div className="text-center">
            <div className="alert alert-success">
              <i className="bi bi-check-circle-fill me-2"></i>
              WhatsApp conectado correctamente
            </div>
            <p className="text-muted">Ya puedes enviar notificaciones a tus clientes</p>
            <button 
              className="btn btn-outline-danger btn-sm mt-3" 
              onClick={handleDisconnect}
            >
              <i className="bi bi-box-arrow-right me-2"></i>
              Cerrar sesión de WhatsApp
            </button>
          </div>
        ) : (
          <button 
            className="btn btn-success"
            onClick={handleConnect}
            disabled={connectionStatus === 'connecting'}
          >
            <i className="bi bi-whatsapp me-2"></i>
            {connectionStatus === 'connecting' ? 'Conectando...' : 'Conectar WhatsApp'}
          </button>
        )}
        
        {connectionStatus === 'connecting' && (
          <div className="mt-3">
            <small className="text-muted">
              Abre WhatsApp en tu teléfono &gt; Menú &gt; Dispositivos vinculados &gt; Vincular un dispositivo
            </small>
          </div>
        )}
      </div>
    </div>
  );
}

// Exportar componente
module.exports = {
  default: WhatsAppConnector
};