// Cargar la sección de WhatsApp
async function loadWhatsAppSection() {
  const whatsappSection = document.getElementById('whatsapp-section');
  
  try {
    // Cargar la biblioteca QRCode primero para asegurar disponibilidad
    try {
      await window.loadQRCodeLibrary();
      console.log('Biblioteca QR cargada correctamente');
    } catch (qrError) {
      console.warn('No se pudo cargar la biblioteca QRCode.js, se usará método alternativo:', qrError);
    }
    
    // Verificar estado actual de WhatsApp
    const isWhatsAppConnected = await window.api.isWhatsAppConnected().catch(() => false);
    console.log('Estado de conexión WhatsApp:', isWhatsAppConnected);
    
    // Configuramos un contenedor para el componente React
    whatsappSection.innerHTML = `
      <h2 class="mb-4">Conexión WhatsApp</h2>
      
      <div class="row">
        <div class="col-md-6">
          <!-- Contenedor para el componente React -->
          <div id="whatsapp-qr-component-container"></div>
        </div>
        
        <div class="col-md-6">
          <!-- Tarjeta de configuración de mensajes -->
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
      <div class="row mt-4">
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
      
      <!-- Modal para editar plantillas -->
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
                <input type="text" class="form-control" id="templateName" readonly>
              </div>
              <div class="mb-3">
                <label for="templateContent" class="form-label">Contenido</label>
                <textarea class="form-control" id="templateContent" rows="8"></textarea>
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
    
    // Renderizar el componente React
    renderWhatsAppQRComponent();
    
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

// Función para renderizar el componente React de WhatsApp QR
function renderWhatsAppQRComponent() {
  // Verificar si React y ReactDOM están disponibles
  if (!window.React || !window.ReactDOM) {
    console.error("React o ReactDOM no están disponibles");
    
    // Alternativa: Mostrar interfaz básica no-React
    const container = document.getElementById('whatsapp-qr-component-container');
    if (container) {
      container.innerHTML = `
        <div class="card mb-4">
          <div class="card-header">
            <h5 class="mb-0">Conexión WhatsApp (Modo Básico)</h5>
          </div>
          <div class="card-body text-center">
            <p class="alert alert-warning">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>
              No se pudo cargar el componente React. Usando modo alternativo.
            </p>
            <button id="connect-whatsapp-basic-btn" class="btn btn-success">
              <i class="bi bi-whatsapp me-2"></i> Conectar WhatsApp
            </button>
            <div id="qr-container-basic" class="d-none mt-3">
              <div class="spinner-border text-success" role="status">
                <span class="visually-hidden">Generando código QR...</span>
              </div>
              <p>Generando código QR...</p>
              <div id="qr-code-basic" class="mt-3 p-3 bg-white d-inline-block rounded"></div>
            </div>
          </div>
        </div>
      `;
      
      // Configurar evento básico para conectar
      const connectBtn = document.getElementById('connect-whatsapp-basic-btn');
      if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
          try {
            // Mostrar contenedor QR
            const qrContainer = document.getElementById('qr-container-basic');
            if (qrContainer) {
              qrContainer.classList.remove('d-none');
            }
            
            // Solicitar conexión
            await window.api.sendWhatsAppMessage({ action: 'connect' });
            
            // Configurar un listener básico para el código QR
            if (window.api.onWhatsAppQR) {
              window.api.onWhatsAppQR((qrData) => {
                const qrCodeDiv = document.getElementById('qr-code-basic');
                if (qrCodeDiv) {
                  let qrText = '';
                  if (typeof qrData === 'object' && qrData.qrCode) {
                    qrText = qrData.qrCode;
                  } else if (typeof qrData === 'string') {
                    qrText = qrData;
                  } else {
                    qrText = JSON.stringify(qrData);
                  }
                  
                  // Usar API externa para generar QR
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrText)}`;
                  qrCodeDiv.innerHTML = `<img src="${qrUrl}" alt="QR Code" width="256" height="256">`;
                }
              });
            }
          } catch (error) {
            console.error("Error al conectar WhatsApp (modo básico):", error);
            showAlert('danger', `Error al conectar: ${error.message}`);
          }
        });
      }
    }
    
    return;
  }
  
  try {
    // Importar el componente (asumiendo que está disponible globalmente)
    // Esta parte dependerá de cómo hayas configurado tu empaquetador (webpack, etc.)
    const WhatsAppQRComponent = window.WhatsAppQRComponent;
    if (!WhatsAppQRComponent) {
      throw new Error("Componente WhatsAppQRComponent no encontrado en el ámbito global");
    }
    
    // Renderizar el componente
    const container = document.getElementById('whatsapp-qr-component-container');
    if (container) {
      window.ReactDOM.render(
        window.React.createElement(WhatsAppQRComponent),
        container
      );
    } else {
      console.error("Contenedor para componente React no encontrado");
    }
  } catch (error) {
    console.error("Error al renderizar componente React:", error);
    showAlert('warning', 'No se pudo cargar el componente interactivo de WhatsApp');
  }
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
      if (shortMessage.length > 50) {
        shortMessage = shortMessage.substring(0, 47) + '...';
      }
      
      return `
        <tr>
          <td>${formattedDate}</td>
          <td>${msg.recipient || '-'}</td>
          <td>${msg.recipientPhone || msg.recipient || '-'}</td>
          <td title="${msg.message.replace(/"/g, '&quot;')}">${shortMessage}</td>
          <td>
            <span class="badge bg-${msg.status === 'sent' ? 'success' : 'warning'}">
              ${msg.status === 'sent' ? 'Enviado' : msg.status}
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
      const templateName = document.getElementById('templateName');
      const templateContent = document.getElementById('templateContent');
      
      // Determinar nombre legible según tipo
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
      
      // Cargar contenido actual
      templateName.value = templateDisplayName;
      templateContent.value = document.getElementById('templatePreview').value;
      
      // Mostrar modal
      const modal = new bootstrap.Modal(document.getElementById('editTemplateModal'));
      modal.show();
    });
  }
  
  // Botón para guardar plantilla
  const saveTemplateBtn = document.getElementById('saveTemplateBtn');
  if (saveTemplateBtn) {
    saveTemplateBtn.addEventListener('click', () => {
      const templateContent = document.getElementById('templateContent').value;
      
      // En una implementación real, aquí guardarías la plantilla en algún lugar persistente
      // Por ahora, solo actualizamos la vista previa
      document.getElementById('templatePreview').value = templateContent;
      
      // Cerrar el modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('editTemplateModal'));
      modal.hide();
      
      showAlert('success', 'Plantilla actualizada correctamente', 3000);
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