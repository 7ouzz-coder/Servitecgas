
import React, { useState, useEffect, useRef } from 'react';

const WhatsAppQRComponent = () => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected'
  const [qrCode, setQrCode] = useState('');
  const [statusMessage, setStatusMessage] = useState('No conectado a WhatsApp');
  const [isLoading, setIsLoading] = useState(false);
  const qrRef = useRef(null);

  useEffect(() => {
    // Verificar estado inicial de WhatsApp
    checkWhatsAppStatus();

    // Configurar listeners para eventos de WhatsApp
    setupWhatsAppListeners();

    // Limpieza al desmontar
    return () => {
      removeWhatsAppListeners();
    };
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
    // Listener para el código QR
    if (window.api && window.api.onWhatsAppQR) {
      window.api.onWhatsAppQR(handleQrCode);
    }

    // Listener para cuando WhatsApp está listo
    if (window.api && window.api.onWhatsAppReady) {
      window.api.onWhatsAppReady(handleWhatsAppReady);
    }

    // Listener para error de autenticación
    if (window.api && window.api.onWhatsAppAuthFailure) {
      window.api.onWhatsAppAuthFailure(handleAuthFailure);
    }

    // Listener para desconexión
    if (window.api && window.api.onWhatsAppDisconnected) {
      window.api.onWhatsAppDisconnected(handleDisconnected);
    }
  };

  const removeWhatsAppListeners = () => {
    // En una implementación real, aquí deberías eliminar los listeners
    // Este código depende de cómo hayas implementado los listeners en tu aplicación
    console.log("Limpiando listeners de WhatsApp");
  };

  const handleQrCode = (qrData) => {
    console.log("QR Code recibido:", typeof qrData);
    setIsLoading(false);
    
    // Extraer el código QR del objeto o usar directamente si es string
    let qrText = '';
    if (typeof qrData === 'object' && qrData.qrCode) {
      qrText = qrData.qrCode;
      console.log("Usando qrCode del objeto");
    } else if (typeof qrData === 'string') {
      qrText = qrData;
      console.log("Usando QR como string");
    } else if (typeof qrData === 'object') {
      qrText = JSON.stringify(qrData);
      console.log("Convirtiendo objeto a string JSON");
    }
    
    setQrCode(qrText);
    setConnectionStatus('connecting');
    setStatusMessage('Escanea el código QR con WhatsApp en tu teléfono');
    
    renderQRCode(qrText);
  };

  const renderQRCode = (qrText) => {
    if (!qrText || !qrRef.current) return;
    
    // Limpiar contenedor previo
    qrRef.current.innerHTML = '';
    
    try {
      // Método 1: Usar la biblioteca QRCode si está disponible
      if (window.QRCode) {
        console.log("Generando QR con biblioteca QRCode");
        new window.QRCode(qrRef.current, {
          text: qrText,
          width: 256,
          height: 256,
          colorDark: "#000000",
          colorLight: "#ffffff"
        });
      } 
      // Método 2: Usar API externa de QR
      else {
        console.log("Generando QR con API externa");
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
      
      // Método alternativo como fallback
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

        {connectionStatus === 'connecting' && (
          <div className="qr-container text-center my-3">
            {isLoading ? (
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
            ) : qrCode ? (
              <div className="d-inline-block bg-white p-3 rounded shadow-sm">
                <div ref={qrRef} style={{width: '256px', height: '256px', margin: '0 auto'}}></div>
              </div>
            ) : null}
            
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
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppQRComponent;