/**
 * Componente para gestionar la conexión y envío de mensajes WhatsApp
 */
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
          <p>Verificando estado de WhatsApp...</p>
        </div>
      </div>
    `;
    
    // Verificar estado actual de WhatsApp
    const isConnected = await checkWhatsAppStatus();
    console.log(`Estado de WhatsApp: ${isConnected ? 'Conectado' : 'Desconectado'}`);
    
    // Renderizar la interfaz principal de WhatsApp
    renderWhatsAppUI(whatsappSection, isConnected);
    
    // Configurar eventos de WhatsApp
    setupWhatsAppEvents();
    
    // Cargar historial de mensajes
    loadMessageHistory();
    
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

/**
 * Verifica el estado actual de la conexión WhatsApp
 * @returns {Promise<boolean>} true si está conectado
 */
async function checkWhatsAppStatus() {
  try {
    if (window.api && window.api.isWhatsAppConnected) {
      const connected = await window.api.isWhatsAppConnected();
      return connected;
    }
    return false;
  } catch (error) {
    console.error('Error al verificar estado de WhatsApp:', error);
    return false;
  }
}

/**
 * Renderiza la interfaz principal de WhatsApp
 * @param {HTMLElement} container - Contenedor donde renderizar
 * @param {boolean} isConnected - Estado de conexión actual
 */
function renderWhatsAppUI(container, isConnected) {
  container.innerHTML = `
    <h2 class="mb-4">Conexión WhatsApp</h2>
    
    <!-- Tarjeta de estado de conexión -->
    <div class="card mb-4">
      <div class="card-header bg-primary bg-opacity-10">
        <h5 class="mb-0">
          <i class="bi bi-whatsapp me-2 text-success"></i>
          Estado de Conexión
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
        
        <!-- Contenedor para el código QR (se mostrará dinámicamente) -->
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
    
    <!-- Plantillas de mensajes -->
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
    
    <!-- Historial de mensajes enviados -->
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
                <th>Teléfono</th>
                <th>Mensaje</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody id="message-history-tbody">
              <tr>
                <td colspan="4" class="text-center">
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
  `;
}

/**
 * Configura los eventos para la sección de WhatsApp
 */
function setupWhatsAppEvents() {
  // Botón para conectar WhatsApp
  const connectBtn = document.getElementById('whatsapp-connect-btn');
  if (connectBtn) {
    connectBtn.addEventListener('click', handleConnectWhatsApp);
  }
  
  // Botón para cerrar sesión
  const logoutBtn = document.getElementById('whatsapp-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogoutWhatsApp);
  }
  
  // Botón para actualizar historial
  const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
  if (refreshHistoryBtn) {
    refreshHistoryBtn.addEventListener('click', loadMessageHistory);
  }
  
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
  
  // Configurar listeners para eventos de WhatsApp
  if (window.api) {
    // QR Code recibido
    window.api.onWhatsAppQR((qrData) => {
      console.log('Código QR recibido');
      showQRCode(qrData);
    });
    
    // WhatsApp conectado
    window.api.onWhatsAppReady(() => {
      console.log('WhatsApp conectado correctamente');
      hideQRCode();
      showAlert('success', 'WhatsApp conectado correctamente');
      loadWhatsAppSection(); // Recargar sección completa
    });
    
    // Error de autenticación
    window.api.onWhatsAppAuthFailure(() => {
      console.log('Error de autenticación en WhatsApp');
      hideQRCode();
      showAlert('danger', 'Error de autenticación en WhatsApp');
    });
    
    // WhatsApp desconectado
    window.api.onWhatsAppDisconnected(() => {
      console.log('WhatsApp desconectado');
      hideQRCode();
      showAlert('warning', 'WhatsApp se ha desconectado');
      loadWhatsAppSection(); // Recargar sección completa
    });
  }
}

/**
 * Maneja la conexión con WhatsApp
 */
async function handleConnectWhatsApp() {
  try {
    // Mostrar loading en el botón
    const connectBtn = document.getElementById('whatsapp-connect-btn');
    if (connectBtn) {
      connectBtn.disabled = true;
      connectBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Conectando...';
    }
    
    // Mostrar contenedor QR
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
    
    // Solicitar conexión con WhatsApp
    if (window.api && window.api.sendWhatsAppMessage) {
      const result = await window.api.sendWhatsAppMessage({ action: 'connect' });
      console.log('Resultado de solicitud de conexión:', result);
      
      if (!result.success) {
        throw new Error(result.message || 'Error al conectar WhatsApp');
      }
    } else {
      throw new Error('API de WhatsApp no disponible');
    }
  } catch (error) {
    console.error('Error al conectar WhatsApp:', error);
    hideQRCode();
    
    // Restaurar estado del botón
    const connectBtn = document.getElementById('whatsapp-connect-btn');
    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.innerHTML = '<i class="bi bi-whatsapp me-2"></i>Conectar WhatsApp';
    }
    
    showAlert('danger', `Error al conectar WhatsApp: ${error.message}`);
  }
}

/**
 * Maneja el cierre de sesión de WhatsApp
 */
async function handleLogoutWhatsApp() {
  if (confirm('¿Estás seguro de que deseas cerrar la sesión de WhatsApp?')) {
    try {
      // Mostrar loading en el botón
      const logoutBtn = document.getElementById('whatsapp-logout-btn');
      if (logoutBtn) {
        logoutBtn.disabled = true;
        logoutBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cerrando sesión...';
      }
      
      // Solicitar cierre de sesión
      if (window.api && window.api.logoutWhatsApp) {
        const result = await window.api.logoutWhatsApp();
        
        if (result.success) {
          showAlert('success', 'Sesión de WhatsApp cerrada correctamente');
          loadWhatsAppSection(); // Recargar sección
        } else {
          throw new Error(result.message || 'Error al cerrar sesión');
        }
      } else {
        throw new Error('API de cierre de sesión no disponible');
      }
    } catch (error) {
      console.error('Error al cerrar sesión de WhatsApp:', error);
      
      // Restaurar estado del botón
      const logoutBtn = document.getElementById('whatsapp-logout-btn');
      if (logoutBtn) {
        logoutBtn.disabled = false;
        logoutBtn.innerHTML = '<i class="bi bi-box-arrow-right me-2"></i>Cerrar sesión de WhatsApp';
      }
      
      showAlert('danger', `Error al cerrar sesión: ${error.message}`);
    }
  }
}

/**
 * Muestra el código QR en la interfaz
 * @param {Object|string} qrData - Datos del código QR
 */
function showQRCode(qrData) {
  const qrContainer = document.getElementById('qr-container');
  const qrCodeElement = document.getElementById('qr-code');
  
  if (!qrContainer || !qrCodeElement) return;
  
  // Mostrar contenedor
  qrContainer.style.display = 'block';
  
  // Limpiar contenido previo
  qrCodeElement.innerHTML = '';
  
  try {
    // Extraer texto QR según el formato recibido
    let qrText = '';
    let qrImageUrl = null;
    
    if (typeof qrData === 'object' && qrData.qrCode) {
      qrText = qrData.qrCode;
    } else if (typeof qrData === 'object' && qrData.qrImageUrl) {
      qrImageUrl = qrData.qrImageUrl;
    } else if (typeof qrData === 'string') {
      qrText = qrData;
    } else if (typeof qrData === 'object') {
      qrText = JSON.stringify(qrData);
    }
    
    // Si tenemos una URL directa, usarla
    if (qrImageUrl) {
      qrCodeElement.innerHTML = `<img src="${qrImageUrl}" width="256" height="256" alt="WhatsApp QR Code">`;
      return;
    }
    
    // Si tenemos la biblioteca QRCode disponible
    if (window.QRCode) {
      new window.QRCode(qrCodeElement, {
        text: qrText,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff"
      });
    } else {
      // Alternativa usando API externa
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrText)}`;
      qrCodeElement.innerHTML = `<img src="${qrUrl}" width="256" height="256" alt="WhatsApp QR Code">`;
    }
  } catch (error) {
    console.error('Error al generar QR:', error);
    
    // Plan de respaldo: mostrar mensaje de error
    qrCodeElement.innerHTML = `
      <div class="alert alert-danger" style="width: 256px; height: 256px; display: flex; align-items: center; justify-content: center;">
        <p class="mb-0">Error al generar código QR</p>
      </div>
    `;
  }
  
  // Restaurar botón si existe
  const connectBtn = document.getElementById('whatsapp-connect-btn');
  if (connectBtn) {
    connectBtn.disabled = false;
    connectBtn.innerHTML = '<i class="bi bi-whatsapp me-2"></i>Conectar WhatsApp';
  }
}

/**
 * Oculta el código QR
 */
function hideQRCode() {
  const qrContainer = document.getElementById('qr-container');
  if (qrContainer) {
    qrContainer.style.display = 'none';
  }
}

/**
 * Carga el historial de mensajes
 */
async function loadMessageHistory() {
  const tableBody = document.getElementById('message-history-tbody');
  if (!tableBody) return;
  
  try {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center">
          <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
          Cargando historial de mensajes...
        </td>
      </tr>
    `;
    
    // Obtener historial de mensajes
    const history = await window.api.getWhatsAppMessageHistory();
    
    if (!history || history.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-muted">
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
    
    // Mostrar solo los últimos 20 mensajes
    const recentMessages = sortedHistory.slice(0, 20);
    
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
      
      // Determinar clase para el estado
      const statusClass = msg.status === 'sent' ? 'bg-success' : 
                          msg.status === 'failed' ? 'bg-danger' : 'bg-secondary';
      
      return `
        <tr>
          <td>${formattedDate}</td>
          <td>${msg.recipient || '-'}</td>
          <td title="${msg.message ? msg.message.replace(/"/g, '&quot;') : ''}">${shortMessage || '-'}</td>
          <td>
            <span class="badge ${statusClass}">
              ${msg.status === 'sent' ? 'Enviado' : 
                msg.status === 'failed' ? 'Fallido' : 
                msg.status || 'Pendiente'}
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
        <td colspan="4" class="text-center text-danger">
          Error al cargar historial: ${error.message}
        </td>
      </tr>
    `;
  }
}

/**
 * Muestra modal para editar una plantilla
 * @param {string} templateType - Tipo de plantilla
 */
function showTemplateEditModal(templateType) {
  // Determinar nombre y contenido de la plantilla
  let templateDisplayName = '';
  
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

/**
 * Crea plantilla de mensajes
 * @param {string} type - Tipo de plantilla
 * @param {Object} data - Datos para rellenar la plantilla
 * @returns {string} - Mensaje formateado
 */
function createMessageTemplate(type, data) {
  switch (type) {
    case 'maintenance':
      return `Estimado/a ${data.clientName},

Le recordamos que su ${data.componentName} en ${data.address} requiere mantenimiento programado para el día ${data.nextMaintenanceDate}.

Por favor, contáctenos para agendar una visita.

Gracias,
Servicio Técnico de Gas`;
    
    case 'followup':
      return `Estimado/a ${data.clientName},

Esperamos que su instalación de gas esté funcionando correctamente. Queremos recordarle que estamos disponibles para cualquier consulta o servicio que necesite.

Gracias por confiar en nosotros.

Saludos cordiales,
Servicio Técnico de Gas`;
    
    case 'custom':
      return 'Escriba su mensaje personalizado aquí...';
    
    default:
      return '';
  }
}

/**
 * Formatea fecha para mostrar
 * @param {Date} date - Fecha a formatear
 * @returns {string} - Fecha formateada
 */
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

/**
 * Muestra una alerta en la interfaz
 * @param {string} type - Tipo de alerta (success, danger, warning, info)
 * @param {string} message - Mensaje a mostrar
 * @param {number} duration - Duración en milisegundos
 */
function showAlert(type, message, duration = 5000) {
  // Verificar si existe una función global
  if (typeof window.showAlert === 'function') {
    window.showAlert(type, message, duration);
    return;
  }
  
  // Implementación alternativa
  let alertContainer = document.getElementById('alert-container');
  
  if (!alertContainer) {
    // Crear contenedor de alertas si no existe
    alertContainer = document.createElement('div');
    alertContainer.id = 'alert-container';
    alertContainer.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
    alertContainer.style.zIndex = '9999';
    document.body.appendChild(alertContainer);
  }
  
  const alertElement = document.createElement('div');
  alertElement.className = `alert alert-${type} alert-dismissible fade show`;
  alertElement.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  alertContainer.appendChild(alertElement);
  
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