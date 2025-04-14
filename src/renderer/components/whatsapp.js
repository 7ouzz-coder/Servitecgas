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
        
        <!-- Nueva sección de chats -->
        <div class="row mt-4">
          <div class="col-md-12">
            <div id="whatsapp-chats-container">
              <!-- Los chats se cargarán aquí -->
              <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                  <h5 class="mb-0">Conversaciones Recientes</h5>
                  <div>
                    <span class="badge bg-${isWhatsAppConnected ? 'success' : 'secondary'} me-2">
                      ${isWhatsAppConnected ? 'Conectado' : 'Desconectado'}
                    </span>
                    <button class="btn btn-sm btn-outline-primary refresh-chats-btn" ${!isWhatsAppConnected ? 'disabled' : ''}>
                      <i class="bi bi-arrow-clockwise"></i> Actualizar
                    </button>
                  </div>
                </div>
                
                ${isWhatsAppConnected ? `
                  <div class="list-group list-group-flush">
                    <a href="#" class="list-group-item list-group-item-action">
                      <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">Juan Pérez</h6>
                        <small class="text-muted">Hace 3 días</small>
                      </div>
                      <p class="mb-1 text-truncate">Gracias por la información sobre el mantenimiento...</p>
                    </a>
                    <a href="#" class="list-group-item list-group-item-action">
                      <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">María González</h6>
                        <small class="text-muted">Ayer</small>
                      </div>
                      <p class="mb-1 text-truncate">Confirmo la visita para el día 15 a las 10am...</p>
                    </a>
                    <a href="#" class="list-group-item list-group-item-action">
                      <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">Carlos Rodríguez</h6>
                        <small class="text-muted">Hace 5 horas</small>
                      </div>
                      <p class="mb-1 text-truncate">¿Cuándo podrían venir a revisar mi caldera?</p>
                    </a>
                  </div>
                ` : `
                  <div class="card-body text-center py-5">
                    <div class="text-muted mb-3">
                      <i class="bi bi-whatsapp" style="font-size: 48px;"></i>
                    </div>
                    <h6>WhatsApp no está conectado</h6>
                    <p class="text-muted">Conecta WhatsApp para ver tus conversaciones recientes</p>
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>
        
        <div class="row mt-4">
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
        
        <!-- Modal de chat de WhatsApp -->
        <div class="modal fade" id="chatDetailModal" tabindex="-1" aria-labelledby="chatDetailModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="chatDetailModalLabel">Conversación con Juan Pérez</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body chat-container" style="height: 400px; overflow-y: auto;">
                <div class="d-flex flex-column">
                  <!-- Mensaje recibido -->
                  <div class="chat-message received mb-3">
                    <div class="chat-bubble p-2 bg-light rounded">
                      Hola, quisiera consultar por el mantenimiento de mi caldera.
                    </div>
                    <small class="text-muted">10:30 AM</small>
                  </div>
                  
                  <!-- Mensaje enviado -->
                  <div class="chat-message sent mb-3 align-self-end">
                    <div class="chat-bubble p-2 bg-primary text-white rounded">
                      ¡Hola! Claro, podemos programar una visita técnica para revisar su caldera. ¿Qué día le vendría bien?
                    </div>
                    <small class="text-muted">10:32 AM</small>
                  </div>
                  
                  <!-- Mensaje recibido -->
                  <div class="chat-message received mb-3">
                    <div class="chat-bubble p-2 bg-light rounded">
                      ¿Podría ser el próximo lunes en la mañana?
                    </div>
                    <small class="text-muted">10:35 AM</small>
                  </div>
                  
                  <!-- Mensaje enviado -->
                  <div class="chat-message sent mb-3 align-self-end">
                    <div class="chat-bubble p-2 bg-primary text-white rounded">
                      Perfecto, lo agendaré para el lunes a las 10:00 AM. ¿Le parece bien esa hora?
                    </div>
                    <small class="text-muted">10:36 AM</small>
                  </div>
                  
                  <!-- Mensaje recibido -->
                  <div class="chat-message received mb-3">
                    <div class="chat-bubble p-2 bg-light rounded">
                      Sí, perfecto. ¿Cuánto cuesta el servicio?
                    </div>
                    <small class="text-muted">10:38 AM</small>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <div class="input-group">
                  <input type="text" class="form-control" placeholder="Escribe un mensaje...">
                  <button class="btn btn-success" type="button">
                    <i class="bi bi-send"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Configurar eventos
      setupWhatsAppEvents();
      
      // Inicializar también la visualización de chats
      loadWhatsAppChats();
      
      // Agregar área de depuración
      setupDebugLogViewer();
      
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
          const originalText = connectWhatsAppBtn.innerHTML;
          connectWhatsAppBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Conectando...';
          
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
          
          console.log("Solicitando conexión a WhatsApp...");
          
          // Mostrar mensaje de depuración en el contenedor QR
          if (qrCodeDiv) {
            qrCodeDiv.innerHTML = `
              <div class="alert alert-info">
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Iniciando cliente de WhatsApp... Por favor espera.
              </div>
            `;
          }
          
          // Primero intentamos inicializar explícitamente WhatsApp si existe ese método
          if (window.api.initializeWhatsApp) {
            try {
              await window.api.initializeWhatsApp();
            } catch (initError) {
              console.log("Error al inicializar explícitamente:", initError);
              // Continuamos con el método tradicional
            }
          }
          
          // Solicitar conexión a WhatsApp
          const result = await window.api.sendWhatsAppMessage({ action: 'connect' });
          console.log("Resultado de la solicitud de conexión:", result);
          
          if (result.success) {
            showAlert('info', 'Iniciando conexión con WhatsApp. Escanea el código QR cuando aparezca.', 5000);
            
            // Mostrar mensaje informativo mientras esperamos el QR
            if (qrCodeDiv) {
              qrCodeDiv.innerHTML = `
                <div class="alert alert-info">
                  <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  Generando código QR... Esto puede tardar unos momentos.
                </div>
              `;
            }
          } else {
            showAlert('danger', `Error al iniciar conexión: ${result.message}`, 5000);
            
            // Restaurar botón
            connectWhatsAppBtn.disabled = false;
            connectWhatsAppBtn.innerHTML = originalText;
            
            if (connectingDiv) {
              connectingDiv.style.display = 'none';
            }
            
            // Mostrar error en contenedor QR
            if (qrCodeDiv) {
              qrCodeDiv.innerHTML = `
                <div class="alert alert-danger">
                  <i class="bi bi-exclamation-triangle-fill me-2"></i>
                  Error al iniciar la conexión con WhatsApp: ${result.message}
                </div>
              `;
            }
          }
        } catch (error) {
          console.error("Error completo al iniciar conexión WhatsApp:", error);
          showAlert('danger', `Error al iniciar conexión: ${error.message}`, 5000);
          
          // Restaurar botón
          connectWhatsAppBtn.disabled = false;
          connectWhatsAppBtn.innerHTML = '<i class="bi bi-whatsapp me-2"></i> Conectar WhatsApp';
          
          const connectingDiv = document.getElementById('whatsapp-connecting');
          if (connectingDiv) {
            connectingDiv.style.display = 'none';
          }
          
          // Mostrar error en contenedor QR
          const qrCodeDiv = document.getElementById('qr-code');
          if (qrCodeDiv) {
            qrCodeDiv.innerHTML = `
              <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                Error al iniciar la conexión con WhatsApp: ${error.message}
              </div>
            `;
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
    
    // Configurar botón de actualizar chats
    const refreshChatsBtn = document.querySelector('.refresh-chats-btn');
    if (refreshChatsBtn) {
      refreshChatsBtn.addEventListener('click', () => {
        loadWhatsAppChats();
      });
    }
    
    // Configurar listeners para los ítems de chat
    setupChatItemListeners();
  }
  
  // Configurar listener para recibir código QR
  function setupQRCodeListener() {
    // Eliminar listeners anteriores
    if (window.whatsAppQRListener) {
      try {
        window.api.removeListener('whatsapp-qr', window.whatsAppQRListener);
      } catch (error) {
        console.log("Error al quitar listener anterior:", error);
      }
    }
    
    // Nuevo listener
    window.whatsAppQRListener = (qrData) => {
      console.log("Datos QR recibidos en el renderer:", typeof qrData);
      
      const qrContainer = document.getElementById('qr-container');
      const qrCode = document.getElementById('qr-code');
      const connectingDiv = document.getElementById('whatsapp-connecting');
      
      if (qrContainer && qrCode) {
        // Mostrar contenedor QR
        qrContainer.style.display = 'block';
        
        // Ocultar indicador de conectando
        if (connectingDiv) connectingDiv.style.display = 'none';
        
        // Verificar si recibimos un objeto con URL o el código directo
        let qrImageUrl;
        
        if (typeof qrData === 'object' && qrData.qrImageUrl) {
          // Nuevo formato: objeto con URL
          qrImageUrl = qrData.qrImageUrl;
          console.log('Usando URL de imagen QR proporcionada por el servidor');
        } else if (typeof qrData === 'object' && qrData.qrCode) {
          // Formato alternativo: objeto con qrCode
          qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrData.qrCode)}`;
          console.log('Generando URL de imagen QR a partir de datos QR en objeto');
        } else if (typeof qrData === 'string') {
          // Formato antiguo: string directo del código QR
          qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrData)}`;
          console.log('Generando URL de imagen QR a partir de string QR');
        } else {
          console.error('Formato de datos QR no reconocido', typeof qrData);
          qrContainer.style.display = 'none';
          showAlert('danger', 'Error al generar código QR. Formato no válido.', 5000);
          return;
        }
        
        console.log('URL de imagen QR generada');
        
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
        
        console.log('Código QR insertado en el DOM');
        
        // También mostrar alerta 
        showAlert('info', 'Código QR generado. Escanea con WhatsApp en tu teléfono.', 8000);
      } else {
        console.error("No se pudo mostrar el QR: contenedor no encontrado");
        showAlert('danger', 'Error: No se pudo encontrar el contenedor para el código QR.', 5000);
      }
    };
    
    // Registrar listener
    console.log('Registrando listener para eventos whatsapp-qr');
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
    
    // Listener para fase de carga
  if (window.api.onWhatsAppLoading) {
    window.api.onWhatsAppLoading((data) => {
      console.log(`Cargando WhatsApp: ${data.percent}% - ${data.message}`);
      
      // Actualizar mensaje de carga si existe
      const qrCodeDiv = document.getElementById('qr-code');
      if (qrCodeDiv) {
        qrCodeDiv.innerHTML = `
          <div class="alert alert-info">
            <div class="progress mb-2">
              <div class="progress-bar progress-bar-striped progress-bar-animated" 
                  role="progressbar" style="width: ${data.percent}%" 
                  aria-valuenow="${data.percent}" aria-valuemin="0" aria-valuemax="100"></div>
            </div>
            <strong>Cargando WhatsApp: ${data.percent}%</strong><br>
            ${data.message}
          </div>
        `;
      }
    });
  }
  
  // Listener para autenticado
  if (window.api.onWhatsAppAuthenticated) {
    window.api.onWhatsAppAuthenticated(() => {
      console.log("WhatsApp autenticado");
      showAlert('info', 'WhatsApp autenticado correctamente. Cargando...', 5000);
      
      // Actualizar mensaje si existe
      const qrCodeDiv = document.getElementById('qr-code');
      if (qrCodeDiv) {
        qrCodeDiv.innerHTML = `
          <div class="alert alert-success">
            <i class="bi bi-check-circle-fill me-2"></i>
            <strong>Autenticado correctamente</strong><br>
            Cargando WhatsApp, por favor espera...
          </div>
        `;
      }
    });
  }
  
  // Listener para fallo de inicialización
  if (window.api.onWhatsAppInitializationFailed) {
    window.api.onWhatsAppInitializationFailed((data) => {
      console.log("Fallo en la inicialización de WhatsApp:", data.error);
      showAlert('danger', `Error al inicializar WhatsApp: ${data.error}`, 5000);
      
      // Restaurar botón conectar
      const connectBtn = document.getElementById('connect-whatsapp-btn');
      if (connectBtn) {
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<i class="bi bi-whatsapp me-2"></i> Reintentar conexión';
      }
      
      // Ocultar indicador de conectando
      const connectingDiv = document.getElementById('whatsapp-connecting');
      if (connectingDiv) {
        connectingDiv.style.display = 'none';
      }
      
      // Mostrar error en contenedor QR
      const qrCodeDiv = document.getElementById('qr-code');
      if (qrCodeDiv) {
        qrCodeDiv.innerHTML = `
          <div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            <strong>Error al inicializar WhatsApp</strong><br>
            ${data.error}
          </div>
        `;
      }
    });
  }
}

// Configurar listeners para ítems de chat
function setupChatItemListeners() {
  // Agregar listeners a elementos de chat cuando estén presentes
  const chatItems = document.querySelectorAll('.list-group-item-action');
  chatItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      // Mostrar modal con la conversación
      const chatModal = new bootstrap.Modal(document.getElementById('chatDetailModal'));
      chatModal.show();
    });
  });
}

// Cargar los chats de WhatsApp
function loadWhatsAppChats() {
  const chatsContainer = document.getElementById('whatsapp-chats-container');
  if (!chatsContainer) return;
  
  // Verificar si WhatsApp está conectado
  window.api.isWhatsAppConnected().then(isConnected => {
    if (!isConnected) {
      // Ya manejado en la carga inicial de la sección
      return;
    }
    
    // Si existe el método para obtener chats, usarlo
    if (window.api.getWhatsAppChats) {
      try {
        // Mostrar indicador de carga
        chatsContainer.innerHTML = `
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0">Conversaciones Recientes</h5>
              <div>
                <span class="badge bg-success me-2">Conectado</span>
                <button class="btn btn-sm btn-outline-primary refresh-chats-btn" disabled>
                  <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  Cargando...
                </button>
              </div>
            </div>
            <div class="card-body text-center py-4">
              <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Cargando...</span>
              </div>
              <p>Cargando conversaciones...</p>
            </div>
          </div>
        `;
        
        // Obtener chats
        window.api.getWhatsAppChats().then(result => {
          if (result.success && result.chats && result.chats.length > 0) {
            // Renderizar chats reales
            const chatsList = result.chats.map(chat => `
              <a href="#" class="list-group-item list-group-item-action">
                <div class="d-flex w-100 justify-content-between">
                  <h6 class="mb-1">${chat.name || 'Chat ' + chat.id.substring(0, 8)}</h6>
                  <small class="text-muted">${formatTimeAgo(chat.timestamp)}</small>
                </div>
                <p class="mb-1 text-truncate">
                  ${chat.unreadCount > 0 ? 
                    `<span class="badge bg-primary me-1">${chat.unreadCount}</span>` : 
                    ''}
                  ${chat.isGroup ? '<i class="bi bi-people-fill me-1"></i>' : ''}
                  ${chat.lastMessage || 'Sin mensajes recientes'}
                </p>
              </a>
            `).join('');
            
            chatsContainer.innerHTML = `
              <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                  <h5 class="mb-0">Conversaciones Recientes</h5>
                  <div>
                    <span class="badge bg-success me-2">Conectado</span>
                    <button class="btn btn-sm btn-outline-primary refresh-chats-btn">
                      <i class="bi bi-arrow-clockwise"></i> Actualizar
                    </button>
                  </div>
                </div>
                <div class="list-group list-group-flush">
                  ${chatsList}
                </div>
              </div>
            `;
            
            // Reconfigurar botón de actualizar
            setupChatItemListeners();
            
            const refreshBtn = document.querySelector('.refresh-chats-btn');
            if (refreshBtn) {
              refreshBtn.addEventListener('click', () => {
                loadWhatsAppChats();
              });
            }
          } else {
            // No hay chats o hubo error
            chatsContainer.innerHTML = `
              <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                  <h5 class="mb-0">Conversaciones Recientes</h5>
                  <div>
                    <span class="badge bg-success me-2">Conectado</span>
                    <button class="btn btn-sm btn-outline-primary refresh-chats-btn">
                      <i class="bi bi-arrow-clockwise"></i> Actualizar
                    </button>
                  </div>
                </div>
                <div class="card-body text-center py-4">
                  <div class="text-muted mb-3">
                    <i class="bi bi-chat-dots" style="font-size: 48px;"></i>
                  </div>
                  <h6>No se encontraron conversaciones</h6>
                  <p class="text-muted">No hay chats recientes o hubo un error al cargarlos</p>
                </div>
              </div>
            `;
            
            // Reconfigurar botón de actualizar
            const refreshBtn = document.querySelector('.refresh-chats-btn');
            if (refreshBtn) {
              refreshBtn.addEventListener('click', () => {
                loadWhatsAppChats();
              });
            }
          }
        }).catch(error => {
          console.error('Error al obtener chats:', error);
          chatsContainer.innerHTML = `
            <div class="card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Conversaciones Recientes</h5>
                <div>
                  <span class="badge bg-success me-2">Conectado</span>
                  <button class="btn btn-sm btn-outline-primary refresh-chats-btn">
                    <i class="bi bi-arrow-clockwise"></i> Reintentar
                  </button>
                </div>
              </div>
              <div class="card-body text-center py-4">
                <div class="alert alert-danger">
                  <i class="bi bi-exclamation-triangle-fill me-2"></i>
                  Error al cargar conversaciones: ${error.message}
                </div>
              </div>
            </div>
          `;
          
          // Reconfigurar botón de actualizar
          const refreshBtn = document.querySelector('.refresh-chats-btn');
          if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
              loadWhatsAppChats();
            });
          }
        });
      } catch (error) {
        console.error('Error al configurar carga de chats:', error);
      }
    } else {
      // No hay método de API para obtener chats, mostrar datos de ejemplo
      console.log('API para obtener chats no disponible, mostrando datos de ejemplo');
    }
  }).catch(error => {
    console.error('Error al verificar estado de WhatsApp:', error);
    chatsContainer.innerHTML = `
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h5 class="mb-0">Conversaciones Recientes</h5>
          <span class="badge bg-danger me-2">Error</span>
        </div>
        <div class="card-body text-center py-4">
          <div class="alert alert-danger">
            <i class="bi bi-exclamation-circle-fill me-2"></i>
            Error al verificar estado de WhatsApp: ${error.message}
          </div>
        </div>
      </div>
    `;
  });
}

// Helper para formatear tiempo relativo
function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Desconocido';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) {
    return 'Ahora mismo';
  } else if (diffMin < 60) {
    return `Hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`;
  } else if (diffHour < 24) {
    return `Hace ${diffHour} ${diffHour === 1 ? 'hora' : 'horas'}`;
  } else if (diffDay < 30) {
    return `Hace ${diffDay} ${diffDay === 1 ? 'día' : 'días'}`;
  } else {
    return date.toLocaleDateString();
  }
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

// Área de depuración para ayudar a diagnosticar problemas
function setupDebugLogViewer() {
  // Crear un área para mostrar los logs de depuración
  const debugLogContainer = document.createElement('div');
  debugLogContainer.className = 'card mt-4 debug-log-container';
  debugLogContainer.innerHTML = `
    <div class="card-header d-flex justify-content-between align-items-center">
      <h5 class="mb-0">Logs de Depuración</h5>
      <button class="btn btn-sm btn-outline-secondary clear-logs-btn">
        <i class="bi bi-trash"></i> Limpiar
      </button>
    </div>
    <div class="card-body">
      <pre class="debug-log-content" style="height: 200px; overflow-y: auto; font-size: 12px;"></pre>
    </div>
  `;
  
  // Insertar después de la última fila en la sección
  const whatsappSection = document.getElementById('whatsapp-section');
  if (whatsappSection) {
    whatsappSection.appendChild(debugLogContainer);
  }
  
  // Configurar botón de limpiar logs
  const clearLogsBtn = document.querySelector('.clear-logs-btn');
  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', () => {
      const logContent = document.querySelector('.debug-log-content');
      if (logContent) {
        logContent.innerHTML = '';
      }
    });
  }
  
  // Sobrescribir console.log para mostrar también en nuestra área de logs
  const originalConsoleLog = console.log;
  console.log = function() {
    // Llamar a la implementación original
    originalConsoleLog.apply(console, arguments);
    
    // También mostrar en nuestra área de logs
    const logContent = document.querySelector('.debug-log-content');
    if (logContent) {
      const args = Array.from(arguments);
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      const logMessage = `[${timestamp}] ${args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ')}`;
      
      const logEntry = document.createElement('div');
      logEntry.textContent = logMessage;
      logContent.appendChild(logEntry);
      
      // Auto-scroll al final
      logContent.scrollTop = logContent.scrollHeight;
    }
  };
}

// Exportar funciones
window.loadWhatsAppSection = loadWhatsAppSection;