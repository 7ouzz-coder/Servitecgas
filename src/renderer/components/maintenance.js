async function loadMaintenance() {
  const maintenanceSection = document.getElementById('maintenance-section');
  
  try {
    // Obtener datos
    let upcomingMaintenance = [];
    let installations = [];
    let clients = [];
    
    try {
      upcomingMaintenance = await window.api.getUpcomingMaintenance() || [];
      console.log("Mantenimientos próximos cargados:", upcomingMaintenance);
    } catch (error) {
      console.error("Error al cargar mantenimientos:", error);
      upcomingMaintenance = [];
    }
    
    try {
      installations = await window.api.getInstallations() || [];
      console.log("Instalaciones cargadas:", installations);
    } catch (error) {
      console.error("Error al cargar instalaciones:", error);
      installations = [];
    }
    
    try {
      clients = await window.api.getClients() || [];
      console.log("Clientes cargados:", clients);
    } catch (error) {
      console.error("Error al cargar clientes:", error);
      clients = [];
    }
    
    // Agrupar mantenimientos por urgencia
    const urgent = upcomingMaintenance.filter(m => m && m.daysLeft <= 7);
    const upcoming = upcomingMaintenance.filter(m => m && m.daysLeft > 7 && m.daysLeft <= 30);
    
    // Obtener estadísticas
    const totalInstallations = installations.length;
    const totalComponents = installations.reduce((sum, inst) => {
      return sum + (inst && inst.components ? inst.components.length : 0);
    }, 0);
    const componentsWithMaintenance = installations.reduce((sum, inst) => {
      if (!inst || !inst.components) return sum;
      return sum + inst.components.filter(c => c && c.nextMaintenanceDate).length;
    }, 0);
    
    // Crear contenido HTML
    maintenanceSection.innerHTML = `
      <h2 class="mb-4">Gestión de Mantenimientos</h2>
      
      <!-- Tarjetas de resumen -->
      <div class="row mb-4">
        <div class="col-md-3">
          <div class="card dashboard-card">
            <div class="card-body">
              <h5 class="card-title">Total Componentes</h5>
              <div class="card-value">${totalComponents}</div>
            </div>
          </div>
        </div>
        
        <div class="col-md-3">
          <div class="card dashboard-card">
            <div class="card-body">
              <h5 class="card-title">Con Mantención Programada</h5>
              <div class="card-value">${componentsWithMaintenance}</div>
            </div>
          </div>
        </div>
        
        <div class="col-md-3">
          <div class="card dashboard-card bg-warning bg-opacity-10">
            <div class="card-body">
              <h5 class="card-title">Mantenciones Urgentes</h5>
              <div class="card-value text-warning">${urgent.length}</div>
            </div>
          </div>
        </div>
        
        <div class="col-md-3">
          <div class="card dashboard-card bg-info bg-opacity-10">
            <div class="card-body">
              <h5 class="card-title">Mantenciones Próximas</h5>
              <div class="card-value text-info">${upcoming.length}</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Opciones de filtrado y botón de agregar -->
      <div class="row mb-4">
        <div class="col-md-4">
          <select id="maintenanceClientFilter" class="form-select">
            <option value="">Todos los clientes</option>
            ${renderClientOptions(clients)}
          </select>
        </div>
        <div class="col-md-4">
          <select id="maintenanceUrgencyFilter" class="form-select">
            <option value="">Todos los mantenimientos</option>
            <option value="urgent">Urgentes (próximos 7 días)</option>
            <option value="upcoming">Próximos (8-30 días)</option>
          </select>
        </div>
        <div class="col-md-4 d-flex justify-content-between">
          <button id="notifyAllButton" class="btn btn-success" ${upcomingMaintenance.length === 0 ? 'disabled' : ''}>
            <i class="bi bi-whatsapp"></i> Notificar a Todos
          </button>
          <!-- Nuevo botón para agregar mantenimiento -->
          <button id="addMaintenanceButton" class="btn btn-primary">
            <i class="bi bi-plus-circle"></i> Agregar Mantenimiento
          </button>
        </div>
      </div>
      
      <!-- Tabla de mantenimientos -->
      <div class="card">
        <div class="card-header">
          <h5 class="mb-0">Mantenimientos Programados</h5>
        </div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-hover">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Componente</th>
                  <th>Dirección</th>
                  <th>Última Mantención</th>
                  <th>Próxima Mantención</th>
                  <th>Días Restantes</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="maintenance-table-body">
                ${renderMaintenanceTable(upcomingMaintenance, installations)}
              </tbody>
            </table>
          </div>
          ${upcomingMaintenance.length === 0 ? 
            '<p class="text-center text-muted">No hay mantenimientos programados para los próximos 30 días</p>' : ''}
        </div>
      </div>
    `;
    
    // Configurar eventos
    setupMaintenanceEvents(clients, installations);
    
  } catch (error) {
    console.error("Error crítico en mantenimientos:", error);
    maintenanceSection.innerHTML = `
      <div class="alert alert-danger">
        <h4>Error al cargar mantenimientos</h4>
        <p>${error.message}</p>
        <hr>
        <p class="mb-0">Verifica la consola para más detalles.</p>
      </div>
    `;
  }
}

// Renderizar opciones de clientes para el select
function renderClientOptions(clients) {
  if (!clients || !Array.isArray(clients) || clients.length === 0) {
    return '';
  }
  
  return clients.map(client => {
    if (!client || !client.id || !client.name) return '';
    return `<option value="${client.id}">${client.name}</option>`;
  }).join('');
}

// Renderizar tabla de mantenimientos - Versión corregida para mostrar fechas correctamente
function renderMaintenanceTable(maintenanceList, installations) {
  if (!maintenanceList || !Array.isArray(maintenanceList) || maintenanceList.length === 0) {
    return '';
  }
  
  return maintenanceList.map(maint => {
    if (!maint) return '';
    
    // Buscar la instalación para obtener la última fecha de mantenimiento
    let lastMaintenanceDate = '-';
    
    if (installations && Array.isArray(installations)) {
      const installation = installations.find(i => i && i.id === maint.installationId);
      
      if (installation && installation.components && Array.isArray(installation.components)) {
        const component = installation.components.find(c => c && c.id === maint.componentId);
        if (component && component.lastMaintenanceDate) {
          lastMaintenanceDate = formatDateCorrectly(component.lastMaintenanceDate);
        }
      }
    }
    
    const clientName = maint.clientName || 'Cliente no encontrado';
    const componentName = maint.componentName || 'Componente no encontrado';
    const address = maint.address || 'Sin dirección';
    const nextMaintenanceDate = formatDateCorrectly(maint.nextMaintenanceDate);
    const daysLeft = maint.daysLeft || 0;
    const clientId = maint.clientId || '';
    const installationId = maint.installationId || '';
    const componentId = maint.componentId || '';
    const clientPhone = maint.clientPhone || '';
    
    return `
      <tr class="${getRowClass(daysLeft)}" 
          data-client-id="${clientId}"
          data-urgency="${daysLeft <= 7 ? 'urgent' : 'upcoming'}">
        <td>${clientName}</td>
        <td>${componentName}</td>
        <td>${address}</td>
        <td>${lastMaintenanceDate}</td>
        <td>${nextMaintenanceDate}</td>
        <td>
          <span class="badge bg-${getBadgeColor(daysLeft)}">${daysLeft} días</span>
        </td>
        <td>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-primary register-maintenance-btn" 
                    data-installation-id="${installationId}"
                    data-component-id="${componentId}">
              <i class="bi bi-check-circle"></i> Registrar
            </button>
            <button class="btn btn-sm btn-outline-success send-maintenance-whatsapp-btn" 
                    data-client-id="${clientId}" 
                    data-client-name="${clientName}" 
                    data-client-phone="${clientPhone}"
                    data-component="${componentName}"
                    data-address="${address}"
                    data-date="${maint.nextMaintenanceDate}">
              <i class="bi bi-whatsapp"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Obtener clase para la fila según los días restantes
function getRowClass(days) {
  if (days <= 3) return 'table-danger';
  if (days <= 7) return 'table-warning';
  return '';
}

// Obtener color para el badge según los días restantes
function getBadgeColor(days) {
  if (days <= 3) return 'danger';
  if (days <= 7) return 'warning';
  if (days <= 15) return 'info';
  return 'secondary';
}

// Función mejorada para formatear fechas correctamente
function formatDateCorrectly(dateString) {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    // Formatear como DD/MM/YYYY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses en JS son 0-11
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error("Error al formatear fecha:", error);
    return '-';
  }
}

// Configurar eventos para la sección de mantenimientos
function setupMaintenanceEvents(clients, installations) {
  // Filtro por cliente
  const clientFilter = document.getElementById('maintenanceClientFilter');
  if (clientFilter) {
    clientFilter.addEventListener('change', filterMaintenance);
  }
  
  // Filtro por urgencia
  const urgencyFilter = document.getElementById('maintenanceUrgencyFilter');
  if (urgencyFilter) {
    urgencyFilter.addEventListener('change', filterMaintenance);
  }
  
  // Botón para agregar mantenimiento (NUEVO)
  const addMaintenanceButton = document.getElementById('addMaintenanceButton');
  if (addMaintenanceButton) {
    addMaintenanceButton.addEventListener('click', () => {
      showAddMaintenanceModal(clients, installations);
    });
  }
  
  // Botones para registrar mantenimiento
  const registerButtons = document.querySelectorAll('.register-maintenance-btn');
  if (registerButtons && registerButtons.length > 0) {
    registerButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const installationId = button.getAttribute('data-installation-id');
        const componentId = button.getAttribute('data-component-id');
        
        // Mostrar modal de registro de mantenimiento
        showMaintenanceRegistrationModal(installationId, componentId);
      });
    });
  }
  
  // Botones para enviar WhatsApp
  const whatsappButtons = document.querySelectorAll('.send-maintenance-whatsapp-btn');
  if (whatsappButtons && whatsappButtons.length > 0) {
    whatsappButtons.forEach(button => {
      button.addEventListener('click', () => {
        const clientId = button.getAttribute('data-client-id');
        const clientName = button.getAttribute('data-client-name');
        const clientPhone = button.getAttribute('data-client-phone');
        const component = button.getAttribute('data-component');
        const address = button.getAttribute('data-address');
        const date = button.getAttribute('data-date');
        
        if (!clientPhone) {
          showAlert('warning', `El cliente ${clientName} no tiene un número de teléfono registrado`);
          return;
        }
        
        // Mostrar modal de WhatsApp
        showWhatsAppModal(clientId, clientName, clientPhone, component, address, date);
      });
    });
  }
  
  // Botón para notificar a todos
  const notifyAllButton = document.getElementById('notifyAllButton');
  if (notifyAllButton) {
    notifyAllButton.addEventListener('click', () => {
      showNotifyAllModal();
    });
  }
}

// Función para mostrar el modal de agregar mantenimiento
function showAddMaintenanceModal(clients, installations) {
  // Verificar si ya existe el modal y eliminarlo
  const existingModal = document.getElementById('addMaintenanceModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Crear contenido del modal
  const modalHtml = `
    <div class="modal fade" id="addMaintenanceModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Agregar Mantenimiento</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="addMaintenanceForm">
              <!-- Selección de cliente -->
              <div class="mb-3">
                <label for="maintenanceClientSelect" class="form-label">Cliente *</label>
                <select class="form-select" id="maintenanceClientSelect" required>
                  <option value="">Seleccionar cliente...</option>
                  ${clients.map(client => `
                    <option value="${client.id}">${client.name}</option>
                  `).join('')}
                </select>
              </div>
              
              <!-- Selección de instalación -->
              <div class="mb-3">
                <label for="maintenanceInstallationSelect" class="form-label">Instalación / Dirección *</label>
                <select class="form-select" id="maintenanceInstallationSelect" required disabled>
                  <option value="">Seleccione un cliente primero</option>
                </select>
              </div>
              
              <!-- Selección de componente -->
              <div class="mb-3">
                <label for="maintenanceComponentSelect" class="form-label">Componente *</label>
                <select class="form-select" id="maintenanceComponentSelect" required disabled>
                  <option value="">Seleccione una instalación primero</option>
                </select>
              </div>
              
              <!-- Detalles del componente -->
              <div class="component-details card p-3 mb-3" style="display: none;" id="componentDetailsCard">
                <h6 class="card-subtitle mb-2 text-muted">Detalles del componente</h6>
                <div class="row">
                  <div class="col-md-6">
                    <p><strong>Marca/Modelo:</strong> <span id="componentModelDisplay">-</span></p>
                  </div>
                  <div class="col-md-6">
                    <p><strong>Última mantención:</strong> <span id="componentLastMaintenanceDisplay">-</span></p>
                  </div>
                </div>
              </div>
              
              <!-- Fechas y notas -->
              <div class="row">
                <div class="col-md-6">
                  <div class="mb-3">
                    <label for="maintenanceDate" class="form-label">Fecha de mantención *</label>
                    <input type="date" class="form-control" id="maintenanceDate" required value="${new Date().toISOString().split('T')[0]}">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="mb-3">
                    <label for="maintenanceFrequency" class="form-label">Frecuencia de mantención (meses)</label>
                    <input type="number" class="form-control" id="maintenanceFrequency" min="1" max="60" value="12">
                    <small class="form-text text-muted">La próxima mantención se calculará automáticamente</small>
                  </div>
                </div>
              </div>
              
              <div class="mb-3">
                <label for="maintenanceNotes" class="form-label">Notas / Observaciones</label>
                <textarea class="form-control" id="maintenanceNotes" rows="3" placeholder="Observaciones o detalles del mantenimiento"></textarea>
              </div>
              
              <div class="mb-3">
                <label for="nextMaintenanceDate" class="form-label">Próxima mantención (calculada)</label>
                <input type="date" class="form-control" id="nextMaintenanceDate" readonly>
              </div>
              
              <div class="form-check mb-3">
                <input class="form-check-input" type="checkbox" id="sendNotificationCheck">
                <label class="form-check-label" for="sendNotificationCheck">
                  Enviar notificación al cliente
                </label>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" id="saveMaintenanceBtn">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Agregar al DOM
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = modalHtml;
  document.body.appendChild(tempDiv.firstChild);
  
  // Mostrar modal
  const modal = new bootstrap.Modal(document.getElementById('addMaintenanceModal'));
  modal.show();
  
  // Configurar eventos
  setupAddMaintenanceModalEvents(installations);
  
  // Eliminar modal del DOM cuando se cierre
  document.getElementById('addMaintenanceModal').addEventListener('hidden.bs.modal', function() {
    this.remove();
  });
}

// Función para configurar eventos del modal de agregar mantenimiento
function setupAddMaintenanceModalEvents(installations) {
  const clientSelect = document.getElementById('maintenanceClientSelect');
  const installationSelect = document.getElementById('maintenanceInstallationSelect');
  const componentSelect = document.getElementById('maintenanceComponentSelect');
  const maintenanceDate = document.getElementById('maintenanceDate');
  const frequencyInput = document.getElementById('maintenanceFrequency');
  const nextMaintenanceDate = document.getElementById('nextMaintenanceDate');
  const componentDetailsCard = document.getElementById('componentDetailsCard');
  const saveButton = document.getElementById('saveMaintenanceBtn');
  
  // Al seleccionar un cliente, cargar sus instalaciones
  if (clientSelect) {
    clientSelect.addEventListener('change', () => {
      const clientId = clientSelect.value;
      installationSelect.innerHTML = '<option value="">Seleccionar instalación...</option>';
      componentSelect.innerHTML = '<option value="">Seleccione una instalación primero</option>';
      componentDetailsCard.style.display = 'none';
      
      if (clientId) {
        // Habilitar select de instalación
        installationSelect.disabled = false;
        
        // Filtrar instalaciones del cliente
        const clientInstallations = installations.filter(inst => inst.clientId === clientId);
        
        // Agregar opciones
        clientInstallations.forEach(installation => {
          const option = document.createElement('option');
          option.value = installation.id;
          option.textContent = installation.address || 'Sin dirección';
          installationSelect.appendChild(option);
        });
      } else {
        installationSelect.disabled = true;
        componentSelect.disabled = true;
      }
    });
  }
  
  // Al seleccionar una instalación, cargar sus componentes
  if (installationSelect) {
    installationSelect.addEventListener('change', () => {
      const installationId = installationSelect.value;
      componentSelect.innerHTML = '<option value="">Seleccionar componente...</option>';
      componentDetailsCard.style.display = 'none';
      
      if (installationId) {
        // Habilitar select de componente
        componentSelect.disabled = false;
        
        // Encontrar la instalación seleccionada
        const installation = installations.find(inst => inst.id === installationId);
        
        if (installation && installation.components && installation.components.length > 0) {
          // Agregar opciones de componentes
          installation.components.forEach(component => {
            const option = document.createElement('option');
            option.value = component.id;
            option.textContent = component.name || 'Componente sin nombre';
            // Guardar datos del componente como atributos del option
            option.setAttribute('data-model', component.model || '-');
            option.setAttribute('data-last-maintenance', component.lastMaintenanceDate || '');
            option.setAttribute('data-frequency', component.frequency || '12');
            componentSelect.appendChild(option);
          });
        }
      } else {
        componentSelect.disabled = true;
      }
    });
  }
  
  // Al seleccionar un componente, mostrar sus detalles
  if (componentSelect) {
    componentSelect.addEventListener('change', () => {
      const selectedOption = componentSelect.options[componentSelect.selectedIndex];
      
      if (componentSelect.value) {
        // Mostrar detalles del componente
        document.getElementById('componentModelDisplay').textContent = 
          selectedOption.getAttribute('data-model');
        
        const lastMaintenance = selectedOption.getAttribute('data-last-maintenance');
        document.getElementById('componentLastMaintenanceDisplay').textContent = 
          lastMaintenance ? formatDateCorrectly(lastMaintenance) : 'Sin registro previo';
        
        // Establecer frecuencia según el componente
        const frequency = selectedOption.getAttribute('data-frequency');
        if (frequency) {
          frequencyInput.value = frequency;
        }
        
        // Mostrar la tarjeta de detalles
        componentDetailsCard.style.display = 'block';
        
        // Calcular próxima fecha de mantenimiento
        calculateNextMaintenanceDate();
      } else {
        componentDetailsCard.style.display = 'none';
      }
    });
  }
  
  // Calcular próxima fecha de mantenimiento al cambiar fecha o frecuencia
  if (maintenanceDate && frequencyInput) {
    maintenanceDate.addEventListener('change', calculateNextMaintenanceDate);
    frequencyInput.addEventListener('change', calculateNextMaintenanceDate);
  }
  
  // Función para calcular la próxima fecha de mantenimiento
  function calculateNextMaintenanceDate() {
    if (maintenanceDate.value) {
      try {
        const date = new Date(maintenanceDate.value);
        const frequency = parseInt(frequencyInput.value) || 12;
        
        // Clonar la fecha y agregar los meses de frecuencia
        const nextDate = new Date(date);
        nextDate.setMonth(nextDate.getMonth() + frequency);
        
        // Formatear para input date (YYYY-MM-DD)
        const year = nextDate.getFullYear();
        const month = String(nextDate.getMonth() + 1).padStart(2, '0');
        const day = String(nextDate.getDate()).padStart(2, '0');
        
        nextMaintenanceDate.value = `${year}-${month}-${day}`;
      } catch (error) {
        console.error('Error al calcular próxima fecha:', error);
        nextMaintenanceDate.value = '';
      }
    }
  }
  
  // Botón de guardar
  if (saveButton) {
    saveButton.addEventListener('click', async () => {
      // Validar formulario
      const form = document.getElementById('addMaintenanceForm');
      if (!form.checkValidity()) {
        // Mostrar validación del navegador
        form.reportValidity();
        return;
      }
      
      // Deshabilitar botón mientras se procesa
      saveButton.disabled = true;
      saveButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...';
      
      try {
        // Obtener datos del formulario
        const installationId = installationSelect.value;
        const componentId = componentSelect.value;
        const maintenanceDate = document.getElementById('maintenanceDate').value;
        const maintenanceNotes = document.getElementById('maintenanceNotes').value;
        const sendNotification = document.getElementById('sendNotificationCheck').checked;
        
        // Crear objeto de datos para la API
        const maintenanceData = {
          installationId,
          componentId,
          maintenanceDate,
          notes: maintenanceNotes
        };
        
        // Registrar mantenimiento
        const result = await window.api.registerMaintenance(maintenanceData);
        
        if (result.success) {
          // Cerrar modal
          const modalInstance = bootstrap.Modal.getInstance(document.getElementById('addMaintenanceModal'));
          modalInstance.hide();
          
          // Mostrar mensaje de éxito
          showAlert('success', 'Mantenimiento registrado correctamente');
          
          // Si se solicitó enviar notificación, mostrar modal de WhatsApp
          if (sendNotification) {
            // Buscar datos del cliente para la notificación
            const clientId = clientSelect.value;
            const clientName = clientSelect.options[clientSelect.selectedIndex].text;
            
            // Buscar instalación y componente para el mensaje
            const installation = installations.find(i => i.id === installationId);
            const component = installation?.components?.find(c => c.id === componentId);
            
            // Buscar teléfono del cliente en la lista completa de clientes
            const client = window.api.getClients()
              .then(clients => clients.find(c => c.id === clientId))
              .catch(() => null);
              
            if (client && client.phone) {
              // Mostrar modal de WhatsApp con los datos
              showWhatsAppModal(
                clientId, 
                clientName, 
                client.phone, 
                component?.name || 'Componente', 
                installation?.address || 'Dirección', 
                maintenanceDate
              );
            } else {
              showAlert('warning', `No se pudo enviar notificación: el cliente no tiene un número de teléfono registrado`);
            }
          }
          
          // Recargar la sección para mostrar los cambios
          loadMaintenance();
        } else {
          throw new Error(result.message || 'Error al registrar mantenimiento');
        }
      } catch (error) {
        console.error('Error al guardar mantenimiento:', error);
        showAlert('danger', `Error al guardar mantenimiento: ${error.message}`);
        
        // Restaurar botón
        saveButton.disabled = false;
        saveButton.innerHTML = 'Guardar';
      }
    });
  }
}

// Función para mostrar el modal de registro de mantenimiento
function showMaintenanceRegistrationModal(installationId, componentId) {
  try {
    // Verificar si ya existe el modal y eliminarlo
    const existingModal = document.getElementById('registerMaintenanceModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Crear modal HTML
    const modalHtml = `
      <div class="modal fade" id="registerMaintenanceModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Registrar Mantenimiento</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <form id="registerMaintenanceForm">
                <input type="hidden" id="maintenance-installation-id" value="${installationId}">
                <input type="hidden" id="maintenance-component-id" value="${componentId}">
                
                <div class="mb-3">
                  <label for="maintenance-date" class="form-label">Fecha de mantenimiento</label>
                  <input type="date" class="form-control" id="maintenance-date" value="${new Date().toISOString().split('T')[0]}" required>
                </div>
                
                <div class="mb-3">
                  <label for="maintenance-notes" class="form-label">Notas</label>
                  <textarea class="form-control" id="maintenance-notes" rows="3" placeholder="Observaciones o detalles del mantenimiento realizado"></textarea>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-primary" id="save-maintenance-btn">Registrar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Agregar al DOM
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    document.body.appendChild(tempDiv.firstChild);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('registerMaintenanceModal'));
    modal.show();
    
    // Configurar botón de guardar
    const saveButton = document.getElementById('save-maintenance-btn');
    if (saveButton) {
      saveButton.addEventListener('click', async () => {
        try {
          // Deshabilitar botón
          saveButton.disabled = true;
          saveButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...';
          
          // Obtener datos del formulario
          const maintenanceDate = document.getElementById('maintenance-date').value;
          const notes = document.getElementById('maintenance-notes').value;
          
          // Enviar al backend
          const result = await window.api.registerMaintenance({
            installationId: installationId,
            componentId: componentId,
            maintenanceDate: maintenanceDate,
            notes: notes
          });
          
          if (result.success) {
            // Cerrar modal
            modal.hide();
            
            // Mostrar mensaje de éxito
            showAlert('success', 'Mantenimiento registrado correctamente');
            
            // Recargar lista de mantenimientos
            loadMaintenance();
          } else {
            throw new Error(result.message || 'Error al registrar mantenimiento');
          }
        } catch (error) {
          console.error('Error al registrar mantenimiento:', error);
          showAlert('danger', `Error al registrar mantenimiento: ${error.message || 'Error desconocido'}`);
          
          // Restaurar botón
          saveButton.disabled = false;
          saveButton.innerHTML = 'Registrar';
        }
      });
    }
    
    // Eliminar modal del DOM cuando se cierre
    document.getElementById('registerMaintenanceModal').addEventListener('hidden.bs.modal', function() {
      this.remove();
    });
  } catch (error) {
    console.error('Error al mostrar modal de registro:', error);
    showAlert('danger', 'Error al mostrar el formulario de registro de mantenimiento');
  }
}

// Función para mostrar el modal de WhatsApp
function showWhatsAppModal(clientId, clientName, clientPhone, component, address, date) {
  // Crear mensaje predeterminado
  const formattedDate = formatDateCorrectly(date);
  const defaultMessage = `Estimado/a ${clientName},\n\nLe recordamos que su ${component} en ${address} requiere mantenimiento programado para el día ${formattedDate}.\n\nPor favor, contáctenos para agendar una visita.\n\nGracias,\nServicio Técnico`;
  
  // Verificar si ya existe el modal y eliminarlo
  const existingModal = document.getElementById('whatsAppModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Crear modal HTML
  const modalHtml = `
    <div class="modal fade" id="whatsAppModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Enviar Notificación por WhatsApp</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="whatsAppForm">
              <div class="mb-3">
                <label class="form-label">Cliente</label>
                <input type="text" class="form-control" value="${clientName}" readonly>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Teléfono</label>
                <input type="text" class="form-control" value="${clientPhone}" readonly>
              </div>
              
              <div class="mb-3">
                <label for="whatsapp-message" class="form-label">Mensaje</label>
                <textarea class="form-control" id="whatsapp-message" rows="6">${defaultMessage}</textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-success" id="send-whatsapp-btn">
              <i class="bi bi-whatsapp me-1"></i> Enviar Mensaje
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Agregar al DOM
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = modalHtml;
  document.body.appendChild(tempDiv.firstChild);
  
  // Mostrar modal
  const modal = new bootstrap.Modal(document.getElementById('whatsAppModal'));
  modal.show();
  
  // Configurar botón de enviar
  const sendButton = document.getElementById('send-whatsapp-btn');
  if (sendButton) {
    sendButton.addEventListener('click', async () => {
      try {
        // Deshabilitar botón
        sendButton.disabled = true;
        sendButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Enviando...';
        
        // Obtener mensaje
        const message = document.getElementById('whatsapp-message').value;
        
        // Verificar si WhatsApp está conectado
        const isConnected = await window.api.isWhatsAppConnected();
        
        if (!isConnected) {
          throw new Error('WhatsApp no está conectado. Por favor, conecte WhatsApp primero.');
        }
        
        // Enviar mensaje
        const result = await window.api.sendWhatsAppMessage({
          phone: clientPhone,
          message: message
        });
        
        if (result.success) {
          // Cerrar modal
          modal.hide();
          
          // Mostrar mensaje de éxito
          showAlert('success', 'Mensaje enviado correctamente');
        } else {
          throw new Error(result.message || 'Error al enviar mensaje');
        }
      } catch (error) {
        console.error('Error al enviar mensaje WhatsApp:', error);
        showAlert('danger', `Error al enviar mensaje: ${error.message || 'Error desconocido'}`);
        
        // Restaurar botón
        sendButton.disabled = false;
        sendButton.innerHTML = '<i class="bi bi-whatsapp me-1"></i> Enviar Mensaje';
      }
    });
  }
  
  // Eliminar modal del DOM cuando se cierre
  document.getElementById('whatsAppModal').addEventListener('hidden.bs.modal', function() {
    this.remove();
  });
}

// Función para mostrar modal de notificación a todos
function showNotifyAllModal() {
  // Crear modal para notificar a todos los clientes
  const modalHtml = `
    <div class="modal fade" id="notifyAllModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Notificar a todos los clientes</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>Esta acción enviará notificaciones a todos los clientes que tienen mantenimientos pendientes en los próximos días.</p>
            
            <div class="mb-3">
              <label for="notifyDaysFilter" class="form-label">Notificar mantenimientos en los próximos:</label>
              <select class="form-select" id="notifyDaysFilter">
                <option value="7">7 días</option>
                <option value="15">15 días</option>
                <option value="30" selected>30 días</option>
              </select>
            </div>
            
            <div class="form-check mb-3">
              <input class="form-check-input" type="checkbox" id="onlyWithPhoneCheck" checked>
              <label class="form-check-label" for="onlyWithPhoneCheck">
                Solo clientes con teléfono registrado
              </label>
            </div>
            
            <div class="alert alert-info">
              <i class="bi bi-info-circle me-2"></i>
              Solo se enviará un mensaje por cliente, incluso si tienen varios mantenimientos pendientes.
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-success" id="confirmNotifyAllBtn">
              <i class="bi bi-whatsapp me-1"></i> Enviar Notificaciones
            </button>
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
  const modal = new bootstrap.Modal(document.getElementById('notifyAllModal'));
  modal.show();
  
  // Configurar botón de confirmar
  const confirmButton = document.getElementById('confirmNotifyAllBtn');
  if (confirmButton) {
    confirmButton.addEventListener('click', async () => {
      try {
        // Deshabilitar botón
        confirmButton.disabled = true;
        confirmButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...';
        
        // Obtener filtros
        const daysFilter = parseInt(document.getElementById('notifyDaysFilter').value);
        const onlyWithPhone = document.getElementById('onlyWithPhoneCheck').checked;
        
        // Aquí implementaríamos la lógica para enviar notificaciones a todos
        // Por ahora, mostramos un mensaje informativo
        setTimeout(() => {
          // Cerrar modal
          modal.hide();
          
          // Mostrar mensaje de éxito
          showAlert('success', 'Funcionalidad en desarrollo. Se implementará la notificación masiva pronto.');
          
          // Eliminar modal del DOM
          document.getElementById('notifyAllModal').remove();
        }, 1500);
        
      } catch (error) {
        console.error('Error al preparar notificaciones masivas:', error);
        showAlert('danger', `Error: ${error.message || 'Error desconocido'}`);
        
        // Restaurar botón
        confirmButton.disabled = false;
        confirmButton.innerHTML = '<i class="bi bi-whatsapp me-1"></i> Enviar Notificaciones';
      }
    });
  }
  
  // Eliminar modal del DOM cuando se cierre
  document.getElementById('notifyAllModal').addEventListener('hidden.bs.modal', function() {
    this.remove();
  });
}

// Filtrar mantenimientos según los criterios seleccionados
function filterMaintenance() {
  const clientFilter = document.getElementById('maintenanceClientFilter');
  const urgencyFilter = document.getElementById('maintenanceUrgencyFilter');
  
  if (!clientFilter || !urgencyFilter) return;
  
  const clientValue = clientFilter.value;
  const urgencyValue = urgencyFilter.value;
  
  const maintenanceRows = document.querySelectorAll('#maintenance-table-body tr');
  if (!maintenanceRows || maintenanceRows.length === 0) return;
  
  maintenanceRows.forEach(row => {
    const clientId = row.getAttribute('data-client-id');
    const urgency = row.getAttribute('data-urgency');
    
    const clientMatch = !clientValue || clientId === clientValue;
    const urgencyMatch = !urgencyValue || urgency === urgencyValue;
    
    if (clientMatch && urgencyMatch) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// Función para mostrar alertas
function showAlert(type, message, duration = 5000) {
  if (typeof window.showAlert === 'function') {
    window.showAlert(type, message, duration);
    return;
  }
  
  // Implementación alternativa si la función global no existe
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
  alertElement.role = 'alert';
  alertElement.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  const container = document.getElementById('alert-container') || document.body;
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

// Exportar funciones
window.loadMaintenance = loadMaintenance;