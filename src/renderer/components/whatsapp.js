// Gestión de la integración con WhatsApp

// Cargar la sección de WhatsApp
async function loadWhatsAppSection() {
    const whatsappSection = document.getElementById('whatsapp-section');
    
    try {
      // Verificar estado actual de WhatsApp
      const isWhatsAppConnected = await window.api.isWhatsAppConnected().catch(() => false);
      
      // Crear HTML con estructura base
      whatsappSection.innerHTML = `
        <h2 class="mb-4">Conexión WhatsApp</h2>
        
        <div class="row">
          <div class="col-md-6">
            <!-- Tarjeta de conexión de WhatsApp -->
            <div class="card mb-4">
              <div class="card-header">
                <h5 class="mb-0">Estado de conexión</h5>
              </div>
              <div class="card-body">
                <div class="text-center mb-3">
                  <span class="badge ${isWhatsAppConnected ? 'bg-success' : 'bg-secondary'} mb-2">
                    ${isWhatsAppConnected ? 'Conectado' : 'No conectado'}
                  </span>
                  <p class="mb-3">${isWhatsAppConnected ? 'WhatsApp conectado correctamente' : 'No conectado a WhatsApp'}</p>
                </div>
                
                <div id="qr-container" class="text-center my-3" style="display: none;">
                  <div class="d-inline-block bg-white p-3 rounded shadow-sm">
                    <div id="qr-code" style="width: 256px; height: 256px; margin: 0 auto;"></div>
                  </div>
                  <p class="text-muted mt-2 small">
                    Abre WhatsApp en tu teléfono &gt; Menú &gt; Dispositivos vinculados &gt; Vincular un dispositivo
                  </p>
                </div>
                
                ${isWhatsAppConnected ? `
                  <div class="text-center">
                    <div class="alert alert-success mb-3">
                      <i class="bi bi-check-circle-fill me-2"></i>
                      WhatsApp conectado correctamente
                    </div>
                    <p class="text-muted">Ya puedes enviar notificaciones a tus clientes</p>
                    <button id="logout-whatsapp-btn" class="btn btn-outline-danger mt-3">
                      <i class="bi bi-box-arrow-right me-2"></i>
                      Cerrar sesión de WhatsApp
                    </button>
                  </div>
                ` : `
                  <div class="text-center">
                    <button id="connect-whatsapp-btn" class="btn btn-success">
                      <i class="bi bi-whatsapp me-2"></i>
                      Conectar WhatsApp
                    </button>
                    <div id="whatsapp-connecting" style="display: none;" class="mt-3">
                      <div class="spinner-border spinner-border-sm text-success me-2" role="status">
                        <span class="visually-hidden">Conectando...</span>
                      </div>
                      <span>Generando código QR...</span>
                    </div>
                  </div>
                `}
              </div>
            </div>
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
        
        <div class="row">
          <div class="col-md-12">
            <!-- Tarjeta de historial de mensajes -->
            <div class="card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Historial de Mensajes Enviados</h5>
                <button id="clearHistoryBtn" class="btn btn-sm btn-outline-secondary" ${isWhatsAppConnected ? '' : 'disabled'}>
                  <i class="bi bi-trash"></i> Limpiar Historial
                </button>
              </div>
              <div class="card-body">
                <div class="table-responsive">
                  <table class="table table-hover">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Teléfono</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody id="message-history-body">
                      <tr>
                        <td colspan="6" class="text-center text-muted">No hay mensajes enviados recientemente</td>
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
      
      // Configurar eventos para esta sección
      setupWhatsAppEvents();
      
    } catch (error) {
      console.error("Error al cargar sección de WhatsApp:", error);
      whatsappSection.innerHTML = `
        <div class="alert alert-danger">
          Error al cargar la sección de WhatsApp: ${error.message}
        </div>
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
          nextMaintenanceDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
        
        templatePreview.value = createMessageTemplate(templateType, exampleData);
      });
      
      // Trigger inicial
      templateSelect.dispatchEvent(new Event('change'));
    }
    
    // Botón para conectar WhatsApp
    const connectWhatsAppBtn = document.getElementById('connect-whatsapp-btn');
    if (connectWhatsAppBtn) {
      connectWhatsAppBtn.addEventListener('click', async () => {
        try {
          // Mostrar spinner y deshabilitar botón
          connectWhatsAppBtn.disabled = true;
          
          // Mostrar estado conectando
          const connectingDiv = document.getElementById('whatsapp-connecting');
          if (connectingDiv) {
            connectingDiv.style.display = 'block';
          }
          
          // Limpiar cualquier QR anterior
          const qrCodeDiv = document.getElementById('qr-code');
          if (qrCodeDiv) {
            qrCodeDiv.innerHTML = '';
          }
          
          // Mostrar contenedor del QR
          const qrContainer = document.getElementById('qr-container');
          if (qrContainer) {
            qrContainer.style.display = 'block';
          }
          
          // Solicitar conexión a WhatsApp
          await window.api.sendWhatsAppMessage({ action: 'connect' });
          showAlert('info', 'Iniciando conexión con WhatsApp. Escanea el código QR cuando aparezca.', 5000);
        } catch (error) {
          console.error("Error al iniciar conexión WhatsApp:", error);
          showAlert('danger', `Error al iniciar conexión: ${error.message}`, 5000);
          
          // Restaurar botón
          connectWhatsAppBtn.disabled = false;
          const connectingDiv = document.getElementById('whatsapp-connecting');
          if (connectingDiv) {
            connectingDiv.style.display = 'none';
          }
        }
      });
    }
    
    // Botón para cerrar sesión de WhatsApp
    const logoutWhatsAppBtn = document.getElementById('logout-whatsapp-btn');
    if (logoutWhatsAppBtn) {
      logoutWhatsAppBtn.addEventListener('click', async () => {
        if (confirm('¿Estás seguro de que deseas cerrar la sesión de WhatsApp?')) {
          try {
            logoutWhatsAppBtn.disabled = true;
            logoutWhatsAppBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cerrando sesión...';
            
            const result = await window.api.logoutWhatsApp();
            
            if (result.success) {
              showAlert('success', 'Sesión de WhatsApp cerrada correctamente', 5000);
              // Recargar la sección para mostrar los cambios
              loadWhatsAppSection();
            } else {
              showAlert('danger', `Error: ${result.message}`, 5000);
              logoutWhatsAppBtn.disabled = false;
              logoutWhatsAppBtn.innerHTML = '<i class="bi bi-box-arrow-right me-2"></i> Cerrar sesión';
            }
          } catch (error) {
            showAlert('danger', `Error: ${error.message}`, 5000);
            logoutWhatsAppBtn.disabled = false;
            logoutWhatsAppBtn.innerHTML = '<i class="bi bi-box-arrow-right me-2"></i> Cerrar sesión';
          }
        }
      });
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
    
    // Botón para limpiar historial
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que deseas limpiar el historial de mensajes?')) {
          // En una implementación real, aquí limpiarías el historial
          document.getElementById('message-history-body').innerHTML = `
            <tr>
              <td colspan="6" class="text-center text-muted">No hay mensajes enviados recientemente</td>
            </tr>
          `;
          
          showAlert('success', 'Historial de mensajes limpiado correctamente', 3000);
        }
      });
    }
    
    // Configurar listener para recibir código QR
    setupQRCodeListener();
    
    // Configurar listener para cambios de estado de WhatsApp
    setupWhatsAppStatusListeners();
  }
  
  // Configurar listener para recibir código QR
  function setupQRCodeListener() {
    // Eliminar listeners anteriores
    if (window.whatsAppQRListener) {
      window.api.removeListener('whatsapp-qr', window.whatsAppQRListener);
    }
    
    // Nuevo listener
    window.whatsAppQRListener = (qr) => {
      console.log("Código QR recibido en el renderer:", qr ? "String de " + qr.length + " caracteres" : "null");
      
      const qrContainer = document.getElementById('qr-container');
      const qrCode = document.getElementById('qr-code');
      const connectingDiv = document.getElementById('whatsapp-connecting');
      
      if (qrContainer && qrCode && qr) {
        // Mostrar contenedor QR
        qrContainer.style.display = 'block';
        
        // Ocultar indicador de conectando
        if (connectingDiv) connectingDiv.style.display = 'none';
        
        // Usar servicio API externo para generar imagen QR
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qr)}`;
        
        qrCode.innerHTML = `
          <div style="padding: 15px; background-color: white; border-radius: 4px; display: inline-block; margin: 0 auto;">
            <img 
              src="${qrImageUrl}" 
              alt="WhatsApp QR Code" 
              style="width: 256px; height: 256px; display: block;"
              onerror="this.onerror=null; this.src=''; this.insertAdjacentHTML('afterend', '<div class=\\'alert alert-danger\\'>Error al cargar QR</div>');"
            />
          </div>
        `;
        
        // También mostrar alerta 
        showAlert('info', 'Código QR generado. Escanea con WhatsApp en tu teléfono.', 8000);
      } else {
        console.error("No se pudo mostrar el QR: contenedor no encontrado o QR no válido");
        if (qrCode) {
          qrCode.innerHTML = `<div class="alert alert-danger">No se pudo generar el código QR. Intenta nuevamente.</div>`;
        }
      }
    };
    
    // Registrar listener
    window.api.onWhatsAppQR(window.whatsAppQRListener);
  }
  
  // Configurar listeners para cambios de estado de WhatsApp
  function setupWhatsAppStatusListeners() {
    // Listener para cuando WhatsApp está listo
    window.api.onWhatsAppReady(() => {
      console.log("WhatsApp listo");
      showAlert('success', 'WhatsApp conectado correctamente', 5000);
      // Recargar sección para mostrar estado conectado
      loadWhatsAppSection();
    });
    
    // Listener para fallos de autenticación
    window.api.onWhatsAppAuthFailure(() => {
      console.log("Error de autenticación de WhatsApp");
      showAlert('danger', 'Error de autenticación en WhatsApp', 5000);
      
      // Restaurar botón conectar
      const connectBtn = document.getElementById('connect-whatsapp-btn');
      const connectingDiv = document.getElementById('whatsapp-connecting');
      
      if (connectBtn) {
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<i class="bi bi-whatsapp me-2"></i> Reintentar conexión';
      }
      
      if (connectingDiv) {
        connectingDiv.style.display = 'none';
      }
    });
    
    // Listener para desconexiones
    window.api.onWhatsAppDisconnected(() => {
      console.log("WhatsApp desconectado");
      showAlert('warning', 'WhatsApp se ha desconectado', 5000);
      // Recargar sección para mostrar estado desconectado
      loadWhatsAppSection();
    });
  }
  
  // Crear plantilla de mensajes
  function createMessageTemplate(type, data) {
    switch (type) {
      case 'maintenance':
        return `Estimado/a ${data.clientName},\n\nLe recordamos que su ${data.componentName} en ${data.address} requiere mantenimiento programado en los próximos días (${formatDate(data.nextMaintenanceDate)}).\n\nPor favor, contáctenos para agendar una visita.\n\nGracias,\nServicio Técnico de Gas`;
      
      case 'followup':
        return `Estimado/a ${data.clientName},\n\nEsperamos que su instalación de gas esté funcionando correctamente. Queremos recordarle que estamos disponibles para cualquier consulta o servicio que necesite.\n\nGracias por confiar en nosotros.\n\nSaludos cordiales,\nServicio Técnico de Gas`;
      
      case 'custom':
        return 'Escriba su mensaje personalizado aquí...';
      
      default:
        return '';
    }
  }
  
  // Formatear fecha
  function formatDate(dateString) {
    if (!dateString) return '-';
    return window.api.formatDate ? window.api.formatDate(dateString) : new Date(dateString).toLocaleDateString();
  }
  
  // Exportar funciones
  window.loadWhatsAppSection = loadWhatsAppSection;