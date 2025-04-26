async function loadWhatsAppSection() {
  const whatsappSection = document.getElementById('whatsapp-section');
  if (!whatsappSection) {
    console.error('No se encontró el contenedor para la sección de WhatsApp');
    return;
  }
  
  try {
    // Mostrar indicador de carga mientras se inicializa
    whatsappSection.innerHTML = `
      <h2 class="mb-4">Conexión WhatsApp</h2>
      <div class="d-flex justify-content-center align-items-center" style="min-height: 300px;">
        <div class="text-center">
          <div class="spinner-border text-success mb-3" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          <p>Cargando componente de WhatsApp...</p>
        </div>
      </div>
    `;
    
    // Cargar las utilidades de WhatsApp si es necesario
    if (!window.whatsAppUtils) {
      console.log('Cargando utilidades de WhatsApp...');
      // Intentar cargar utilidades de inicialización
      await loadWhatsAppUtils();
    }
    
    // Inicializar el sistema de WhatsApp
    if (window.whatsAppUtils) {
      await window.whatsAppUtils.initialize();
    }
    
    // Verificar si estamos usando React (preferido)
    const useReact = typeof React !== 'undefined' && typeof ReactDOM !== 'undefined';
    
    if (useReact) {
      console.log('Usando React para renderizar componente WhatsApp');
      // Configuramos la estructura para el componente React
      whatsappSection.innerHTML = `
        <h2 class="mb-4">Conexión WhatsApp</h2>
        <div id="react-whatsapp-container"></div>
        <div class="row mt-4">
          <div class="col-md-12">
            <div class="card mb-4">
              <div class="card-header">
                <h5 class="mb-0">Plantillas de Mensajes</h5>
              </div>
              <div class="card-body">
                <div class="mb-3">
                  <label for="templateSelect" class="form-label">Selecciona una plantilla:</label>
                  <select id="templateSelect" class="form-select">
                    <option value="maintenance">Recordatorio de Mantenimiento</option>
                    <option value="followup">Seguimiento Post-Instalación</option>
                    <option value="custom">Mensaje Personalizado</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label for="templatePreview" class="form-label">Vista previa:</label>
                  <textarea id="templatePreview" class="form-control" rows="6" readonly></textarea>
                </div>
                <button id="editTemplateBtn" class="btn btn-outline-primary">
                  <i class="bi bi-pencil"></i> Editar Plantilla
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Historial de mensajes enviados -->
        <div class="row">
          <div class="col-md-12">
            <div class="card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Historial de Mensajes Enviados</h5>
                <button id="refreshHistoryBtn" class="btn btn-sm btn-outline-primary">
                  <i class="bi bi-arrow-clockwise"></i> Actualizar
                </button>
              </div>
              <div class="card-body">
                <div class="table-responsive">
                  <table class="table table-hover">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Destinatario</th>
                        <th>Teléfono</th>
                        <th>Mensaje</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody id="message-history-tbody">
                      <tr>
                        <td colspan="5" class="text-center">
                          <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
                            <span class="visually-hidden">Cargando...</span>
                          </div>
                          Cargando historial de mensajes...
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Renderizar el componente React
      try {
        const WhatsAppQRConnector = window.WhatsAppQRConnector;
        if (WhatsAppQRConnector) {
          ReactDOM.render(
            React.createElement(WhatsAppQRConnector),
            document.getElementById('react-whatsapp-container')
          );
        } else {
          throw new Error('Componente WhatsAppQRConnector no encontrado');
        }
      } catch (reactError) {
        console.error('Error al renderizar componente React:', reactError);
        // Fallback a la versión no-React
        renderNonReactWhatsAppUI();
      }
    } else {
      console.log('Usando versión no-React para WhatsApp');
      renderNonReactWhatsAppUI();
    }
    
    // Cargar historial de mensajes
    loadMessageHistory();
    
    // Configurar eventos
    setupWhatsAppEvents();
    
  } catch (error) {
    console.error("Error al cargar sección de WhatsApp:", error);
    whatsappSection.innerHTML = `
      <div class="alert alert-danger">
        <h4><i class="bi bi-exclamation-triangle-fill me-2"></i>Error</h4>
        <p>Error al cargar la sección de WhatsApp: ${error.message}</p>
        <button class="btn btn-outline-danger mt-2" id="retryWhatsAppBtn">
          <i class="bi bi-arrow-repeat me-1"></i> Reintentar
        </button>
      </div>
    `;
    
    // Configurar botón de reintento
    const retryBtn = document.getElementById('retryWhatsAppBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        loadWhatsAppSection();
      });
    }
  }
}

// Renderizar la interfaz de WhatsApp sin usar React
function renderNonReactWhatsAppUI() {
  const container = document.getElementById('react-whatsapp-container') || document.querySelector('#whatsapp-section');
  
  if (!container) {
    console.error('No se encontró contenedor para UI de WhatsApp');
    return;
  }
  
  // Verificar estado actual de WhatsApp
  const checkConnectionAsync = async () => {
    let isConnected = false;
    try {
      if (window.api && window.api.isWhatsAppConnected) {
        isConnected = await window.api.isWhatsAppConnected();
      }
    } catch (error) {
      console.error('Error al verificar conexión de WhatsApp:', error);
    }
    return isConnected;
  };
  
  // Renderizar UI inicial
  const renderInitialUI = async () => {
    const isConnected = await checkConnectionAsync();
    
    container.innerHTML = `
      <div class="card mb-4">
        <div class="card-header bg-primary bg-opacity-10">
          <h5 class="mb-0">
            <i class="bi bi-whatsapp me-2 text-success"></i>
            Conexión WhatsApp
          </h5>
        </div>
        <div class="card-body">
          <div class="text-center mb-3">
            <div class="mb-2">
              <span class="badge ${isConnected ? 'bg-success' : 'bg-secondary'} px-3 py-2 fs-6">
                ${isConnected ? 'Conectado' : 'No conectado'}
              </span>
            </div>
            <p class="mb-3">${isConnected ? 'WhatsApp conectado correctamente' : 'No conectado a WhatsApp'}</p>
          </div>
          
          ${isConnected ? `
            <div class="text-center">
              <div class="alert alert-success mb-4">
                <i class="bi bi-check-circle-fill me-2"></i>
                WhatsApp conectado correctamente
              </div>
              <p class="text-muted mb-4">Ya puedes enviar notificaciones a tus clientes</p>
              <button 
                class="btn btn-outline-danger"
                id="whatsapp-logout-btn"
              >
                <i class="bi bi-box-arrow-right me-2"></i>
                Cerrar sesión de WhatsApp
              </button>
            </div>
          ` : `
            <div class="text-center">
              <button 
                class="btn btn-success btn-lg"
                id="whatsapp-connect-btn"
              >
                <i class="bi bi-whatsapp me-2"></i>
                Conectar WhatsApp
              </button>
              
              <p class="text-muted small mt-3">
                Al conectar WhatsApp podrás enviar notificaciones a tus clientes
              </p>
            </div>
          `}
          
          <div id="qr-container" class="qr-container text-center my-4" style="display: none;">
            <div class="d-inline-block bg-white p-3 rounded shadow-sm mb-3">
              <div id="qr-code" style="width: 256px; height: 256px; margin: 0 auto;"></div>
            </div>
            
            <div class="alert alert-info small">
              <ol class="mb-0 ps-3 text-start">
                <li>Abre WhatsApp en tu teléfono</li>
                <li>Toca en Menú ⋮ o Ajustes ⚙️</li>
                <li>Selecciona <strong>Dispositivos vinculados</strong></li>
                <li>Toca en <strong>Vincular un dispositivo</strong></li>
                <li>Apunta la cámara al código QR</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Configurar eventos
    setupNonReactWhatsAppEvents();
  };
  
  renderInitialUI();
}

// Configurar eventos para la interfaz no-React de WhatsApp
function setupNonReactWhatsAppEvents() {
  // Botón de conexión
  const connectBtn = document.getElementById('whatsapp-connect-btn');
  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      try {
        // Mostrar indicador de carga
        connectBtn.disabled = true;
        connectBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Conectando...';
        
        // Mostrar contenedor de QR
        const qrContainer = document.getElementById('qr-container');
        if (qrContainer) {
          qrContainer.style.display = 'block';
          
          // Mostrar spinner mientras se genera el QR
          const qrCode = document.getElementById('qr-code');
          if (qrCode) {
            qrCode.innerHTML = `
              <div class="d-flex justify-content-center align-items-center" style="height: 256px;">
                <div class="spinner-border text-success" role="status">
                  <span class="visually-hidden">Generando código QR...</span>
                </div>
              </div>
            `;
          }
        }
        
        // Intentar conectar WhatsApp
        let connected = false;
        
        // Método 1: Usando utilidades
        if (window.whatsAppUtils) {
          try {
            await window.whatsAppUtils.connect();
            console.log('Conexión solicitada mediante utilidades');
          } catch (e) {
            console.warn('Error al conectar mediante utilidades:', e);
          }
        }
        
        // Método 2: Usando API directa
        if (!connected && window.api) {
          try {
            if (window.api.sendWhatsAppMessage) {
              await window.api.sendWhatsAppMessage({ action: 'connect' });
              console.log('Conexión solicitada mediante sendWhatsAppMessage');
              connected = true;
            }
          } catch (e) {
            console.warn('Error al conectar mediante sendWhatsAppMessage:', e);
          }
          
          try {
            if (!connected && window.api.initializeWhatsApp) {
              await window.api.initializeWhatsApp();
              console.log('Conexión solicitada mediante initializeWhatsApp');
              connected = true;
            }
          } catch (e) {
            console.warn('Error al conectar mediante initializeWhatsApp:', e);
          }
        }
        
        if (!connected) {
          throw new Error('No se pudo iniciar la conexión con WhatsApp');
        }
        
        // Configurar listener para el QR
        configureQRCodeListener();
        
      } catch (error) {
        console.error('Error al solicitar conexión WhatsApp:', error);
        
        // Ocultar contenedor QR y restablecer botón
        const qrContainer = document.getElementById('qr-container');
        if (qrContainer) {
          qrContainer.style.display = 'none';
        }
        
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<i class="bi bi-whatsapp me-2"></i>Conectar WhatsApp';
        
        // Mostrar mensaje de error
        showAlert('danger', `Error al conectar WhatsApp: ${error.message}`);
      }
    });
  }
  
  // Botón de cierre de sesión
  const logoutBtn = document.getElementById('whatsapp-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('¿Estás seguro de que deseas cerrar la sesión de WhatsApp?')) {
        try {
          logoutBtn.disabled = true;
          logoutBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cerrando sesión...';
          
          if (window.api && window.api.logoutWhatsApp) {
            const result = await window.api.logoutWhatsApp();
            
            if (result.success) {
              showAlert('success', 'Sesión de WhatsApp cerrada correctamente');
              // Recargar la sección
              setTimeout(() => {
                loadWhatsAppSection();
              }, 1000);
            } else {
              throw new Error(result.message || 'Error al cerrar sesión');
            }
          } else {
            throw new Error('Función de cierre de sesión no disponible');
          }
        } catch (error) {
          console.error('Error al cerrar sesión de WhatsApp:', error);
          showAlert('danger', `Error al cerrar sesión: ${error.message}`);
          
          // Restaurar botón
          logoutBtn.disabled = false;
          logoutBtn.innerHTML = '<i class="bi bi-box-arrow-right me-2"></i>Cerrar sesión de WhatsApp';
        }
      }
    });
  }
  
  // Configurar listeners para eventos de WhatsApp
  document.addEventListener('whatsapp-connected', () => {
    loadWhatsAppSection(); // Recargar la sección completa
  });
}

// Configurar listener específico para el código QR
function configureQRCodeListener() {
  const handleQRCode = (qrData) => {
    console.log('QR Code recibido', typeof qrData);
    const qrCodeContainer = document.getElementById('qr-code');
    
    if (!qrCodeContainer) {
      console.error('Contenedor QR no encontrado');
      return;
    }
    
    try {
      qrCodeContainer.innerHTML = '';
      
      // Extraer datos del QR
      let qrText = '';
      if (typeof qrData === 'object' && qrData.qrCode) {
        qrText = qrData.qrCode;
      } else if (typeof qrData === 'object' && qrData.qrImageUrl) {
        // Si recibimos una URL de imagen directamente
        qrCodeContainer.innerHTML = `<img src="${qrData.qrImageUrl}" width="256" height="256" alt="WhatsApp QR Code">`;
        return;
      } else if (typeof qrData === 'string') {
        qrText = qrData;
      } else if (typeof qrData === 'object') {
        qrText = JSON.stringify(qrData);
      }
      
      // Intentar generar QR
      if (window.QRCode) {
        console.log('Generando QR con biblioteca QRCode.js');
        new window.QRCode(qrCodeContainer, {
          text: qrText,
          width: 256,
          height: 256,
          colorDark: "#000000",
          colorLight: "#ffffff"
        });
      } else {
        // Alternativa: usar API externa
        console.log('Generando QR con API externa');
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrText)}`;
        qrCodeContainer.innerHTML = `<img src="${qrUrl}" width="256" height="256" alt="WhatsApp QR Code">`;
      }
    } catch (error) {
      console.error('Error al generar QR:', error);
      // Plan de respaldo
      try {
        const qrText = typeof qrData === 'string' ? qrData : JSON.stringify(qrData);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrText)}`;
        qrCodeContainer.innerHTML = `<img src="${qrUrl}" width="256" height="256" alt="WhatsApp QR Code">`;
      } catch (e) {
        qrCodeContainer.innerHTML = '<div class="alert alert-danger">Error al generar QR</div>';
      }
    }
  };
  
  // Registrar el listener si la API está disponible
  if (window.api && window.api.onWhatsAppQR) {
    window.api.onWhatsAppQR(handleQRCode);
  }
  
  // También registrar un listener para eventos personalizados
  document.addEventListener('whatsapp-qr-received', (event) => {
    if (event.detail) {
      handleQRCode(event.detail);
    }
  });
}

// Cargar historial de mensajes
async function loadMessageHistory() {
  const tableBody = document.getElementById('message-history-tbody');
  if (!tableBody) return;
  
  try {
    // Obtener historial de mensajes
    const history = await window.api.getWhatsAppMessageHistory();
    
    if (!history || history.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted">
            No hay mensajes enviados recientemente
          </td>
        </tr>
      `;
      return;
    }
    
    // Ordenar por fecha (más recientes primero)
    const sortedHistory = [...history].sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    // Mostrar solo los últimos 10 mensajes
    const recentMessages = sortedHistory.slice(0, 10);
    
    // Generar filas de la tabla
    const rows = recentMessages.map(msg => {
      // Formatear fecha
      const date = new Date(msg.timestamp);
      const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      
      // Acortar mensaje para la tabla
      let shortMessage = msg.message;
      if (shortMessage && shortMessage.length > 50) {
        shortMessage = shortMessage.substring(0, 47) + '...';
      }
      
      return `
        <tr>
          <td>${formattedDate}</td>
          <td>${msg.recipient || '-'}</td>
          <td>${msg.recipientPhone || msg.recipient || '-'}</td>
          <td title="${msg.message ? msg.message.replace(/"/g, '&quot;') : ''}">${shortMessage || '-'}</td>
          <td>
            <span class="badge bg-${msg.status === 'sent' ? 'success' : 'warning'}">
              ${msg.status === 'sent' ? 'Enviado' : msg.status || 'Desconocido'}
            </span>
          </td>
        </tr>
      `;
    }).join('');
    
    tableBody.innerHTML = rows;
  } catch (error) {
    console.error("Error al cargar historial de mensajes:", error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-danger">
          Error al cargar historial: ${error.message}
        </td>
      </tr>
    `;
  }
}

// Configurar eventos para la sección WhatsApp
function setupWhatsAppEvents() {
  // Selector de plantilla
  const templateSelect = document.getElementById('templateSelect');
  const templatePreview = document.getElementById('templatePreview');
  
  if (templateSelect && templatePreview) {
    templateSelect.addEventListener('change', () => {
      const templateType = templateSelect.value;
      const exampleData = {
        clientName: 'Juan Pérez',
        componentName: 'Caldera',
        address: 'Av. Principal 123',
        nextMaintenanceDate: formatDateForDisplay(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
      };
      
      templatePreview.value = createMessageTemplate(templateType, exampleData);
    });
    
    // Trigger inicial
    templateSelect.dispatchEvent(new Event('change'));
  }
  
  // Botón para editar plantilla
  const editTemplateBtn = document.getElementById('editTemplateBtn');
  if (editTemplateBtn) {
    editTemplateBtn.addEventListener('click', () => {
      const templateType = document.getElementById('templateSelect').value;
      showTemplateEditModal(templateType);
    });
  }
  
  // Botón para actualizar historial
  const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
  if (refreshHistoryBtn) {
    refreshHistoryBtn.addEventListener('click', () => {
      loadMessageHistory();
    });
  }
}

// Mostrar modal para editar plantilla
function showTemplateEditModal(templateType) {
  // Determinar nombre y contenido de la plantilla
  let templateDisplayName = '';
  let templateContent = '';
  
  switch (templateType) {
    case 'maintenance':
      templateDisplayName = 'Recordatorio de Mantenimiento';
      break;
    case 'followup':
      templateDisplayName = 'Seguimiento Post-Instalación';
      break;
    case 'custom':
      templateDisplayName = 'Mensaje Personalizado';
      break;
  }
  
  // Obtener contenido actual
  const currentContent = document.getElementById('templatePreview').value;
  
  // Crear y mostrar modal
  const modalHtml = `
    <div class="modal fade" id="editTemplateModal" tabindex="-1" aria-labelledby="editTemplateModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="editTemplateModalLabel">Editar Plantilla</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label for="templateName" class="form-label">Nombre de la plantilla</label>
              <input type="text" class="form-control" id="templateName" value="${templateDisplayName}" readonly>
            </div>
            <div class="mb-3">
              <label for="templateContent" class="form-label">Contenido</label>
              <textarea class="form-control" id="templateContent" rows="8">${currentContent}</textarea>
            </div>
            <div class="mb-3">
              <p class="text-muted small">Variables disponibles:</p>
              <div class="d-flex flex-wrap gap-1">
                <span class="badge bg-primary">{clientName}</span>
                <span class="badge bg-primary">{componentName}</span>
                <span class="badge bg-primary">{address}</span>
                <span class="badge bg-primary">{nextMaintenanceDate}</span>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" id="saveTemplateBtn">Guardar Plantilla</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Agregar modal al DOM
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = modalHtml;
  document.body.appendChild(tempDiv.firstChild);
  
  // Mostrar modal
  const modal = new bootstrap.Modal(document.getElementById('editTemplateModal'));
  modal.show();
  
  // Configurar botón de guardar
  const saveTemplateBtn = document.getElementById('saveTemplateBtn');
  if (saveTemplateBtn) {
    saveTemplateBtn.addEventListener('click', () => {
      // Obtener contenido actualizado
      const updatedContent = document.getElementById('templateContent').value;
      
      // Actualizar la vista previa
      document.getElementById('templatePreview').value = updatedContent;
      
      // Cerrar modal
      modal.hide();
      
      // Mostrar mensaje de éxito
      showAlert('success', 'Plantilla actualizada correctamente');
    });
  }
  
  // Eliminar modal del DOM cuando se cierre
  document.getElementById('editTemplateModal').addEventListener('hidden.bs.modal', function() {
    this.remove();
  });
}

// Crear plantilla de mensajes
function createMessageTemplate(type, data) {
  switch (type) {
    case 'maintenance':
      return `Estimado/a ${data.clientName},\n\nLe recordamos que su ${data.componentName} en ${data.address} requiere mantenimiento programado para el día ${data.nextMaintenanceDate}.\n\nPor favor, contáctenos para agendar una visita.\n\nGracias,\nServicio Técnico de Gas`;
    
    case 'followup':
      return `Estimado/a ${data.clientName},\n\nEsperamos que su instalación de gas esté funcionando correctamente. Queremos recordarle que estamos disponibles para cualquier consulta o servicio que necesite.\n\nGracias por confiar en nosotros.\n\nSaludos cordiales,\nServicio Técnico de Gas`;
    
    case 'custom':
      return 'Escriba su mensaje personalizado aquí...';
    
    default:
      return '';
  }
}

// Formatear fecha para mostrar
function formatDateForDisplay(date) {
  if (!date) return '';
  
  try {
    if (typeof date === 'string') {
      date = new Date(date);
    }
    
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // Formatear como DD/MM/YYYY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error("Error al formatear fecha:", error);
    return '';
  }
}

// Función para mostrar alertas
function showAlert(type, message, duration = 5000) {
  // Verificar si existe una función global
  if (typeof window.showAlert === 'function') {
    window.showAlert(type, message, duration);
    return;
  }
  
  // Implementación alternativa
  const alertContainer = document.getElementById('alert-container');
  if (!alertContainer) {
    // Crear contenedor de alertas si no existe
    const container = document.createElement('div');
    container.id = 'alert-container';
    container.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }
  
  const alertElement = document.createElement('div');
  alertElement.className = `alert alert-${type} alert-dismissible fade show`;
  alertElement.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  const container = document.getElementById('alert-container');
  container.appendChild(alertElement);
  
  // Auto-eliminar después de la duración especificada
  setTimeout(() => {
    if (alertElement.parentNode) {
      try {
        // Intentar usar bootstrap para cerrar
        const bsAlert = new bootstrap.Alert(alertElement);
        bsAlert.close();
      } catch (e) {
        // Si falla, eliminar manualmente
        alertElement.remove();
      }
    }
  }, duration);
}

// Cargar las utilidades de WhatsApp
async function loadWhatsAppUtils() {
  return new Promise((resolve, reject) => {
    // Verificar si ya está cargado
    if (window.whatsAppUtils) {
      console.log('Utilidades de WhatsApp ya cargadas');
      return resolve(window.whatsAppUtils);
    }

    // Intentar cargar mediante script
    try {
      const script = document.createElement('script');
      script.text = `
        // Código básico para inicializar WhatsApp si no se pudo cargar el script completo
        window.whatsAppUtils = {
          initialize: async function() {
            console.log('Inicializando sistema básico de WhatsApp');
            return true;
          },
          connect: async function() {
            console.log('Conectando WhatsApp con método básico');
            if (window.api && window.api.sendWhatsAppMessage) {
              return window.api.sendWhatsAppMessage({ action: 'connect' });
            }
            throw new Error('API de WhatsApp no disponible');
          },
          checkStatus: async function() {
            if (window.api && window.api.isWhatsAppConnected) {
              return window.api.isWhatsAppConnected();
            }
            return false;
          }
        };
      `;
      document.head.appendChild(script);
      
      console.log('Utilidades básicas de WhatsApp cargadas');
      resolve(window.whatsAppUtils);
    } catch (error) {
      console.error('Error al cargar utilidades de WhatsApp:', error);
      reject(error);
    }
  });
}