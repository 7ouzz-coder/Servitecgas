// Función para cargar la biblioteca QRCode desde CDN
function loadQRCodeLibrary() {
    return new Promise((resolve, reject) => {
      // Verificar si ya está cargada
      if (window.QRCode) {
        console.log('QRCode.js ya está cargado');
        return resolve(window.QRCode);
      }
      
      console.log('Cargando biblioteca QRCode.js...');
      
      // Crear elemento script
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.async = true;
      
      // Manejar eventos de carga y error
      script.onload = () => {
        console.log('QRCode.js cargado correctamente');
        resolve(window.QRCode);
      };
      
      script.onerror = (err) => {
        console.error('Error al cargar QRCode.js:', err);
        reject(new Error('No se pudo cargar la biblioteca QRCode.js'));
      };
      
      // Agregar script al documento
      document.head.appendChild(script);
    });
  }
  
  // Exportar función
  window.loadQRCodeLibrary = loadQRCodeLibrary;