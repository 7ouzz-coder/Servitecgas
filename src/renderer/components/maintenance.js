// Cargar la sección de mantenimientos
async function loadMaintenance() {
  const maintenanceSection = document.getElementById('maintenance-section');
  
  try {
    maintenanceSection.innerHTML = `
      <div class="text-center my-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Cargando...</span>
        </div>
        <p class="mt-2">Cargando datos de mantenimientos...</p>
      </div>
    `;
    
    // Obtener datos
    let upcomingMaintenance = [];
    let installations = [];
    let clients = [];
    
    try {
      upcomingMaintenance = await window.api.getUpcomingMaintenance() || [];
      console.log("Mantenimientos próximos cargados:", upcomingMaintenance.length);
    } catch (error) {
      console.error("Error al cargar mantenimientos:", error);
      upcomingMaintenance = [];
    }
    
    try {
      installations = await window.api.getInstallations() || [];
      console.log("Instalaciones cargadas:", installations.length);
    } catch (error) {
      console.error("Error al cargar instalaciones:", error);
      installations = [];
    }
    
    try {
      clients = await window.api.getClients() || [];
      console.log("Clientes cargados:", clients.length);
    } catch (error) {
      console.error("Error al cargar clientes:", error);
      clients = [];
    }
    
    // Agrupar mantenimientos por urgencia
    const urgentList = upcomingMaintenance.filter(m => m && m.daysLeft <= 7 && m.daysLeft >= 0);
    const overdueList = upcomingMaintenance.filter(m => m && m.daysLeft < 0);
    const upcomingList = upcomingMaintenance.filter(m => m && m.daysLeft > 7 && m.daysLeft <= 30);
    
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
          <div class="card dashboard-card bg-danger bg-opacity-10">
            <div class="card-body">
              <h5 class="card-title">Mantenciones Vencidas</h5>
              <div class="card-value text-danger">${overdueList.length}</div>
            </div>
          </div>
        </div>
        
        <div class="col-md-3">
          <div class="card dashboard-card bg-warning bg-opacity-10">
            <div class="card-body">
              <h5 class="card-title">Mantenciones Urgentes</h5>
              <div class="card-value text-warning">${urgentList.length}</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Opciones de filtrado y botón de agregar -->
      <div class="row mb-4">
        <div class="col-md-3">
          <select id="maintenanceClientFilter" class="form-select">
            <option value="">Todos los clientes</option>
            ${renderClientOptions(clients)}
          </select>
        </div>
        <div class="col-md-3">
          <select id="maintenanceUrgencyFilter" class="form-select">
            <option value="">Todos los mantenimientos</option>
            <option value="overdue">Vencidos</option>
            <option value="urgent">Urgentes (próximos 7 días)</option>
            <option value="upcoming">Próximos (8-30 días)</option>
          </select>
        </div>
        <div class="col-md-6 d-flex justify-content-end gap-2">
          <button id="scheduleMaintenanceBtn" class="btn btn-info" ${upcomingMaintenance.length === 0 ? 'disabled' : ''}>
            <i class="bi bi-calendar-check"></i> Programar Notificaciones
          </button>
          <button id="notifyAllButton" class="btn btn-success" ${upcomingMaintenance.length === 0 ? 'disabled' : ''}>
            <i class="bi bi-whatsapp"></i> Notificar a Todos
          </button>
          <button id="addMaintenanceButton" class="btn btn-primary">
            <i class="bi bi-plus-circle"></i> Agregar Mantenimiento
          </button>
        </div>
      </div>
      
      <!-- Tabla de mantenimientos -->
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h5 class="mb-0">Mantenimientos Programados</h5>
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" id="autoNotifySwitch">
            <label class="form-check-label" for="autoNotifySwitch">Notificaciones automáticas</label>
          </div>
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
    setTimeout(() => {
      const addMaintenanceButton = document.getElementById('addMaintenanceButton');
      console.log('Botón encontrado:', addMaintenanceButton);
      
      if (addMaintenanceButton) {
        // Eliminar listeners previos
        const clonedButton = addMaintenanceButton.cloneNode(true);
        addMaintenanceButton.parentNode.replaceChild(clonedButton, addMaintenanceButton);
        
        // Añadir nuevo event listener
        document.getElementById('addMaintenanceButton').onclick = async function() {
          console.log('Botón Add Maintenance clickeado');
          try {
            const clients = await window.api.getClients();
            const installations = await window.api.getInstallations();
            showAddMaintenanceModal(clients, installations);
          } catch (error) {
            console.error('Error al obtener datos:', error);
            showAlert('danger', 'Error al cargar datos: ' + error.message);
          }
        };
      }
    }, 100);

    // Configurar eventos
    setupMaintenanceEvents(clients, installations);

    // Verificar mantenimientos vencidos
    if (window.maintenanceService) {
      window.maintenanceService.checkOverdueMaintenance(false); // No silencioso
    }
    
    // Restaurar estado del interruptor de notificaciones automáticas
    const autoNotifySwitch = document.getElementById('autoNotifySwitch');
    if (autoNotifySwitch) {
      // Intentar cargar el estado guardado
      const savedState = localStorage.getItem('autoNotifyEnabled');
      autoNotifySwitch.checked = savedState === 'true';
      
      // Configurar evento para guardar estado
      autoNotifySwitch.addEventListener('change', function() {
        localStorage.setItem('autoNotifyEnabled', this.checked);
        // Si se activa, configurar notificaciones automáticas
        if (this.checked && window.maintenanceService) {
          window.maintenanceService.setupAutomaticNotifications();
          showAlert('info', 'Notificaciones automáticas activadas', 3000);
        } else {
          showAlert('info', 'Notificaciones automáticas desactivadas', 3000);
        }
      });
      
      // Si está activado, configurar notificaciones automáticas
      if (autoNotifySwitch.checked && window.maintenanceService) {
        window.maintenanceService.setupAutomaticNotifications();
      }
    }
    
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

// Renderizar tabla de mantenimientos
function renderMaintenanceTable(maintenanceList, installations) {
  if (!maintenanceList || !Array.isArray(maintenanceList) || maintenanceList.length === 0) {
    return '';
  }
  
  // Ordenar por días restantes (vencidos primero, luego urgentes, luego próximos)
  const sortedList = [...maintenanceList].sort((a, b) => {
    if (a.daysLeft < 0 && b.daysLeft >= 0) return -1; // Vencidos primero
    if (a.daysLeft >= 0 && b.daysLeft < 0) return 1;
    return a.daysLeft - b.daysLeft; // Luego por menor cantidad de días
  });
  
  return sortedList.map(maint => {
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
    
    // Determinar la clasificación del mantenimiento (vencido, urgente, próximo)
    let urgencyClass = 'upcoming';
    if (daysLeft < 0) {
      urgencyClass = 'overdue';
    } else if (daysLeft <= 7) {
      urgencyClass = 'urgent';
    }
    
    return `
      <tr class="${getRowClass(daysLeft)}" 
          data-client-id="${clientId}"
          data-urgency="${urgencyClass}">
        <td>${clientName}</td>
        <td>${componentName}</td>
        <td>${address}</td>
        <td>${lastMaintenanceDate}</td>
        <td>${nextMaintenanceDate}</td>
        <td>
          <span class="badge bg-${getBadgeColor(daysLeft)}">${daysLeft < 0 ? `${Math.abs(daysLeft)} días vencido` : `${daysLeft} días`}</span>
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
                    data-date="${maint.nextMaintenanceDate}"
                    data-days-left="${daysLeft}">
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
  if (days < 0) return 'table-danger';
  if (days <= 7) return 'table-warning';
  return '';
}

// Obtener color para el badge según los días restantes
function getBadgeColor(days) {
  if (days < 0) return 'danger';
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
  
  // Asegurarse de que clients e installations son arrays válidos
  const validClients = Array.isArray(clients) ? clients : [];
  const validInstallations = Array.isArray(installations) ? installations : [];

  // Botón para agregar mantenimiento
  const addMaintenanceButton = document.getElementById('addMaintenanceButton');
  console.log("Botón agregar mantenimiento:", addMaintenanceButton); // Para depuración
  
  if (addMaintenanceButton) {
    // Remover cualquier event listener existente
    addMaintenanceButton.replaceWith(addMaintenanceButton.cloneNode(true));
    
    // Obtener la referencia actualizada
    const refreshedButton = document.getElementById('addMaintenanceButton');
    
    // Agregar nuevo event listener
    refreshedButton.addEventListener('click', function() {
      console.log("Botón agregar mantenimiento clickeado");
      showAddMaintenanceModal(validClients, validInstallations);
    });
  }
  
  // Botón para programar notificaciones
  const scheduleMaintenanceBtn = document.getElementById('scheduleMaintenanceBtn');
  if (scheduleMaintenanceBtn) {
    scheduleMaintenanceBtn.addEventListener('click', () => {
      showScheduleNotificationsModal();
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
        const daysLeft = parseInt(button.getAttribute('data-days-left') || '0');
        
        if (!clientPhone) {
          showAlert('warning', `El cliente ${clientName} no tiene un número de teléfono registrado`);
          return;
        }
        
        // Mostrar modal de WhatsApp
        showWhatsAppModal(clientId, clientName, clientPhone, component, address, date, daysLeft);
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

// Función para mostrar el modal de programación de notificaciones
function showScheduleNotificationsModal() {
  // Verificar si ya existe el modal y eliminarlo
  const existingModal = document.getElementById('scheduleNotificationsModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Crear el modal
  const modalHtml = `
    <div class="modal fade" id="scheduleNotificationsModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Programar Notificaciones Automáticas</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>Configure cuándo enviar notificaciones automáticas a los clientes:</p>
            
            <div class="mb-3">
              <label class="form-label">Notificar mantenimientos vencidos:</label>
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="notifyOverdueCheck" checked>
                <label class="form-check-label" for="notifyOverdueCheck">
                  Enviar notificación cuando un mantenimiento esté vencido
                </label>
              </div>
            </div>
            
            <div class="mb-3">
              <label class="form-label">Notificar mantenimientos próximos:</label>
              <div class="input-group mb-3">
                <div class="form-check me-3">
                  <input class="form-check-input" type="checkbox" id="notifyUpcomingCheck" checked>
                  <label class="form-check-label" for="notifyUpcomingCheck">
                    Enviar notificación 
                  </label>
                </div>
                <input type="number" class="form-control" id="notifyDaysInput" min="1" max="30" value="7">
                <span class="input-group-text">días antes</span>
              </div>
            </div>
            
            <div class="mb-3">
              <label class="form-label">Frecuencia de verificación:</label>
              <select class="form-select" id="checkFrequencySelect">
                <option value="daily">Diaria (cada 24 horas)</option>
                <option value="weekly">Semanal</option>
              </select>
            </div>
            
            <div class="alert alert-info">
              <i class="bi bi-info-circle me-2"></i>
              Las notificaciones programadas se enviarán automáticamente si la aplicación está abierta.
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" id="saveScheduleBtn">Guardar Configuración</button>
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
  const modal = new bootstrap.Modal(document.getElementById('scheduleNotificationsModal'));
  modal.show();
  
  // Cargar configuración guardada
  try {
    const savedConfig = JSON.parse(localStorage.getItem('notificationSchedule') || '{}');
    
    if (savedConfig.notifyOverdue !== undefined) {
      document.getElementById('notifyOverdueCheck').checked = savedConfig.notifyOverdue;
    }
    
    if (savedConfig.notifyUpcoming !== undefined) {
      document.getElementById('notifyUpcomingCheck').checked = savedConfig.notifyUpcoming;
    }
    
    if (savedConfig.notifyDays !== undefined) {
      document.getElementById('notifyDaysInput').value = savedConfig.notifyDays;
    }
    
    if (savedConfig.checkFrequency) {
      document.getElementById('checkFrequencySelect').value = savedConfig.checkFrequency;
    }
  } catch (error) {
    console.error("Error al cargar configuración guardada:", error);
  }
  
  // Configurar botón de guardar
  const saveScheduleBtn = document.getElementById('saveScheduleBtn');
  if (saveScheduleBtn) {
    saveScheduleBtn.addEventListener('click', () => {
      // Guardar configuración
      const config = {
        notifyOverdue: document.getElementById('notifyOverdueCheck').checked,
        notifyUpcoming: document.getElementById('notifyUpcomingCheck').checked,
        notifyDays: parseInt(document.getElementById('notifyDaysInput').value) || 7,
        checkFrequency: document.getElementById('checkFrequencySelect').value
      };
      
      localStorage.setItem('notificationSchedule', JSON.stringify(config));
      
      // Activar notificaciones automáticas
      document.getElementById('autoNotifySwitch').checked = true;
      localStorage.setItem('autoNotifyEnabled', 'true');
      
      if (window.maintenanceService) {
        window.maintenanceService.setupAutomaticNotifications();
      }
      
      // Cerrar modal
      modal.hide();
      
      showAlert('success', 'Configuración de notificaciones guardada correctamente');
    });
  }
  
  // Eliminar modal del DOM cuando se cierre
  document.getElementById('scheduleNotificationsModal').addEventListener('hidden.bs.modal', function() {
    this.remove();
  });
}

// Función para mostrar el modal de agregar mantenimiento
function showAddMaintenanceModal(clients, installations) {
  try {
    console.log("Ejecutando showAddMaintenanceModal");
    
    // Verificar si ya existe el modal y eliminarlo
    const existingModal = document.getElementById('addMaintenanceModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Crear contenido del modal con opciones en línea para cada campo
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
                <!-- Cliente -->
                <div class="mb-3">
                  <div class="d-flex align-items-center mb-2">
                    <label class="form-label mb-0 me-auto">Cliente *</label>
                    <div class="form-check form-check-inline mb-0">
                      <input class="form-check-input" type="radio" name="clientMode" id="selectClientMode" value="select" checked>
                      <label class="form-check-label" for="selectClientMode">Seleccionar</label>
                    </div>
                    <div class="form-check form-check-inline mb-0">
                      <input class="form-check-input" type="radio" name="clientMode" id="manualClientMode" value="manual">
                      <label class="form-check-label" for="manualClientMode">Ingresar</label>
                    </div>
                  </div>
                  
                  <div id="selectClientContainer">
                    <select class="form-select" id="maintenanceClientSelect">
                      <option value="">Seleccionar cliente...</option>
                      ${clients.map(client => `
                        <option value="${client.id}">${client.name}</option>
                      `).join('')}
                    </select>
                  </div>
                  
                  <div id="manualClientContainer" style="display:none;">
                    <input type="text" class="form-control" id="manualClientName" placeholder="Nombre del cliente">
                  </div>
                </div>
                
                <!-- Instalación / Dirección -->
                <div class="mb-3">
                  <div class="d-flex align-items-center mb-2">
                    <label class="form-label mb-0 me-auto">Instalación / Dirección *</label>
                    <div class="form-check form-check-inline mb-0">
                      <input class="form-check-input" type="radio" name="addressMode" id="selectAddressMode" value="select" checked>
                      <label class="form-check-label" for="selectAddressMode">Seleccionar</label>
                    </div>
                    <div class="form-check form-check-inline mb-0">
                      <input class="form-check-input" type="radio" name="addressMode" id="manualAddressMode" value="manual">
                      <label class="form-check-label" for="manualAddressMode">Ingresar</label>
                    </div>
                  </div>
                  
                  <div id="selectAddressContainer">
                    <select class="form-select" id="maintenanceInstallationSelect" disabled>
                      <option value="">Seleccione un cliente primero</option>
                    </select>
                  </div>
                  
                  <div id="manualAddressContainer" style="display:none;">
                    <input type="text" class="form-control" id="manualAddress" placeholder="Dirección completa">
                  </div>
                </div>
                
                <!-- Componente -->
                <div class="mb-3">
                  <div class="d-flex align-items-center mb-2">
                    <label class="form-label mb-0 me-auto">Componente *</label>
                    <div class="form-check form-check-inline mb-0">
                      <input class="form-check-input" type="radio" name="componentMode" id="selectComponentMode" value="select" checked>
                      <label class="form-check-label" for="selectComponentMode">Seleccionar</label>
                    </div>
                    <div class="form-check form-check-inline mb-0">
                      <input class="form-check-input" type="radio" name="componentMode" id="manualComponentMode" value="manual">
                      <label class="form-check-label" for="manualComponentMode">Ingresar</label>
                    </div>
                  </div>
                  
                  <div id="selectComponentContainer">
                    <select class="form-select" id="maintenanceComponentSelect" disabled>
                      <option value="">Seleccione una instalación primero</option>
                    </select>
                  </div>
                  
                  <div id="manualComponentContainer" style="display:none;">
                    <div class="row">
                      <div class="col-md-6">
                        <input type="text" class="form-control" id="manualComponentName" placeholder="Nombre del componente">
                      </div>
                      <div class="col-md-6">
                        <input type="text" class="form-control" id="manualComponentModel" placeholder="Marca/Modelo">
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Detalles del componente (para modo selección) -->
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
                
                <!-- Fechas y notas (común para ambos modos) -->
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
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Esperar a que el DOM se actualice
    setTimeout(() => {
      try {
        // Obtener referencia al modal
        const modalElement = document.getElementById('addMaintenanceModal');
        if (!modalElement) {
          console.error('Modal element not found after insertion');
          return;
        }
        
        // Configurar los toggles de modo (seleccionar vs ingresar)
        // Cliente
        const selectClientMode = document.getElementById('selectClientMode');
        const manualClientMode = document.getElementById('manualClientMode');
        const selectClientContainer = document.getElementById('selectClientContainer');
        const manualClientContainer = document.getElementById('manualClientContainer');
        
        selectClientMode.addEventListener('change', function() {
          if (this.checked) {
            selectClientContainer.style.display = '';
            manualClientContainer.style.display = 'none';
            document.getElementById('maintenanceClientSelect').setAttribute('required', 'required');
            document.getElementById('manualClientName').removeAttribute('required');
          }
        });
        
        manualClientMode.addEventListener('change', function() {
          if (this.checked) {
            selectClientContainer.style.display = 'none';
            manualClientContainer.style.display = '';
            document.getElementById('maintenanceClientSelect').removeAttribute('required');
            document.getElementById('manualClientName').setAttribute('required', 'required');
          }
        });
        
        // Dirección
        const selectAddressMode = document.getElementById('selectAddressMode');
        const manualAddressMode = document.getElementById('manualAddressMode');
        const selectAddressContainer = document.getElementById('selectAddressContainer');
        const manualAddressContainer = document.getElementById('manualAddressContainer');
        
        selectAddressMode.addEventListener('change', function() {
          if (this.checked) {
            selectAddressContainer.style.display = '';
            manualAddressContainer.style.display = 'none';
            document.getElementById('maintenanceInstallationSelect').setAttribute('required', 'required');
            document.getElementById('manualAddress').removeAttribute('required');
          }
        });
        
        manualAddressMode.addEventListener('change', function() {
          if (this.checked) {
            selectAddressContainer.style.display = 'none';
            manualAddressContainer.style.display = '';
            document.getElementById('maintenanceInstallationSelect').removeAttribute('required');
            document.getElementById('manualAddress').setAttribute('required', 'required');
          }
        });
        
        // Componente
        const selectComponentMode = document.getElementById('selectComponentMode');
        const manualComponentMode = document.getElementById('manualComponentMode');
        const selectComponentContainer = document.getElementById('selectComponentContainer');
        const manualComponentContainer = document.getElementById('manualComponentContainer');
        const componentDetailsCard = document.getElementById('componentDetailsCard');
        
        selectComponentMode.addEventListener('change', function() {
          if (this.checked) {
            selectComponentContainer.style.display = '';
            manualComponentContainer.style.display = 'none';
            document.getElementById('maintenanceComponentSelect').setAttribute('required', 'required');
            document.getElementById('manualComponentName').removeAttribute('required');
          }
        });
        
        manualComponentMode.addEventListener('change', function() {
          if (this.checked) {
            selectComponentContainer.style.display = 'none';
            manualComponentContainer.style.display = '';
            document.getElementById('maintenanceComponentSelect').removeAttribute('required');
            document.getElementById('manualComponentName').setAttribute('required', 'required');
            componentDetailsCard.style.display = 'none';
          }
        });
        
        // Calcular próxima fecha de mantenimiento al cambiar fecha o frecuencia
        const maintenanceDate = document.getElementById('maintenanceDate');
        const maintenanceFrequency = document.getElementById('maintenanceFrequency');
        const nextMaintenanceDate = document.getElementById('nextMaintenanceDate');
        
        const calculateNextDate = () => {
          try {
            const date = new Date(maintenanceDate.value);
            const frequency = parseInt(maintenanceFrequency.value) || 12;
            
            const nextDate = new Date(date);
            nextDate.setMonth(nextDate.getMonth() + frequency);
            
            const year = nextDate.getFullYear();
            const month = String(nextDate.getMonth() + 1).padStart(2, '0');
            const day = String(nextDate.getDate()).padStart(2, '0');
            
            nextMaintenanceDate.value = `${year}-${month}-${day}`;
          } catch (error) {
            console.error('Error al calcular fecha:', error);
          }
        };
        
        // Recalcular al cambiar fecha o frecuencia
        maintenanceDate.addEventListener('change', calculateNextDate);
        maintenanceFrequency.addEventListener('change', calculateNextDate);
        
        // Calcular fecha inicial
        calculateNextDate();
        
        // Configurar eventos de selección
        setupAddMaintenanceModalEvents(installations);
        
        // Configurar el botón guardar para manejar todos los modos
        const saveButton = document.getElementById('saveMaintenanceBtn');
        if (saveButton) {
          saveButton.addEventListener('click', async () => {
            try {
              console.log("Guardando mantenimiento...");
              
              // Verificar que se completaron los campos obligatorios
              let isValid = true;
              let errorMessage = "";
              
              // Validar cliente
              if (selectClientMode.checked && !document.getElementById('maintenanceClientSelect').value) {
                isValid = false;
                errorMessage = "Debes seleccionar un cliente";
              }
              
              if (manualClientMode.checked && !document.getElementById('manualClientName').value.trim()) {
                isValid = false;
                errorMessage = "Debes ingresar un nombre de cliente";
              }
              
              // Validar dirección
              if (selectAddressMode.checked && !document.getElementById('maintenanceInstallationSelect').value) {
                isValid = false;
                errorMessage = "Debes seleccionar una instalación";
              }
              
              if (manualAddressMode.checked && !document.getElementById('manualAddress').value.trim()) {
                isValid = false;
                errorMessage = "Debes ingresar una dirección";
              }
              
              // Validar componente
              if (selectComponentMode.checked && !document.getElementById('maintenanceComponentSelect').value) {
                isValid = false;
                errorMessage = "Debes seleccionar un componente";
              }
              
              if (manualComponentMode.checked && !document.getElementById('manualComponentName').value.trim()) {
                isValid = false;
                errorMessage = "Debes ingresar un nombre de componente";
              }
              
              // Validar fecha
              if (!document.getElementById('maintenanceDate').value) {
                isValid = false;
                errorMessage = "Debes seleccionar una fecha de mantenimiento";
              }
              
              if (!isValid) {
                showAlert('warning', errorMessage || 'Por favor completa todos los campos obligatorios');
                return;
              }
              
              // Deshabilitar botón mientras se procesa
              saveButton.disabled = true;
              saveButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...';
              
              // Guardar según las combinaciones de modos seleccionados
              await saveMixedModeMaintenance();
              
            } catch (error) {
              console.error('Error al guardar mantenimiento:', error);
              showAlert('danger', `Error al guardar: ${error.message || 'Error desconocido'}`);
            } finally {
              // Restaurar botón
              if (saveButton) {
                saveButton.disabled = false;
                saveButton.innerHTML = 'Guardar';
              }
            }
          });
        }
        
        // Crear y mostrar el modal correctamente
        const modalInstance = new bootstrap.Modal(modalElement);
        modalInstance.show();
        
        // Eliminar modal cuando se cierre
        modalElement.addEventListener('hidden.bs.modal', function() {
          this.remove();
        });
      } catch (modalError) {
        console.error('Error initializing Bootstrap modal:', modalError);
        showAlert('danger', 'Error al mostrar el modal: ' + modalError.message);
      }
    }, 50);
  } catch (error) {
    console.error("Error en showAddMaintenanceModal:", error);
    showAlert('danger', `Error al mostrar el formulario: ${error.message}`);
  }
}

// Nueva función para manejar todas las combinaciones de modos
async function saveMixedModeMaintenance() {
  // Obtener los modos seleccionados
  const isClientManual = document.getElementById('manualClientMode').checked;
  const isAddressManual = document.getElementById('manualAddressMode').checked;
  const isComponentManual = document.getElementById('manualComponentMode').checked;
  
  // Obtener valores según los modos
  const clientValue = isClientManual
    ? document.getElementById('manualClientName').value.trim()
    : document.getElementById('maintenanceClientSelect').value;
    
  const addressValue = isAddressManual
    ? document.getElementById('manualAddress').value.trim()
    : document.getElementById('maintenanceInstallationSelect').value;
    
  const componentValue = isComponentManual
    ? document.getElementById('manualComponentName').value.trim()
    : document.getElementById('maintenanceComponentSelect').value;
  
  // Otros valores comunes
  const maintenanceDate = document.getElementById('maintenanceDate').value;
  const frequency = parseInt(document.getElementById('maintenanceFrequency').value) || 12;
  const maintenanceNotes = document.getElementById('maintenanceNotes').value;
  const nextMaintenanceDate = document.getElementById('nextMaintenanceDate').value;
  const sendNotification = document.getElementById('sendNotificationCheck').checked;
  const componentModel = isComponentManual ? document.getElementById('manualComponentModel').value.trim() : '';
  
  try {
    console.log("Procesando mantenimiento con modos:", {
      isClientManual, isAddressManual, isComponentManual,
      clientValue, addressValue, componentValue
    });
    
    // Caso 1: Todo seleccionado de existentes
    if (!isClientManual && !isAddressManual && !isComponentManual) {
      await processExistingMaintenance(clientValue, addressValue, componentValue, maintenanceDate, 
        frequency, nextMaintenanceDate, maintenanceNotes, sendNotification);
      return;
    }
    
    // Preparar para procesar combinaciones mixtas o todo manual
    let clientId, installationId, componentId;
    
    // PASO 1: Manejar cliente (existente o crear nuevo)
    if (isClientManual) {
      // Buscar si ya existe un cliente con ese nombre
      const clients = await window.api.getClients();
      let client = clients.find(c => c.name.toLowerCase() === clientValue.toLowerCase());
      
      if (!client) {
        // Crear nuevo cliente
        const newClient = {
          name: clientValue,
          phone: '',
          email: '',
          notes: 'Cliente creado automáticamente'
        };
        console.log("Creando nuevo cliente:", newClient);
        client = await window.api.addClient(newClient);
      }
      
      clientId = client.id;
    } else {
      clientId = clientValue; // Ya tenemos el ID del select
    }
    
    // PASO 2: Manejar instalación (existente o crear nueva)
    if (isAddressManual) {
      // Buscar si ya existe una instalación con esa dirección para ese cliente
      const installations = await window.api.getInstallations();
      let installation = installations.find(i => 
        i.clientId === clientId && 
        i.address.toLowerCase() === addressValue.toLowerCase()
      );
      
      if (!installation) {
        // Crear nueva instalación
        const newInstallation = {
          clientId: clientId,
          address: addressValue,
          type: 'Residencial',
          date: new Date().toISOString().split('T')[0],
          components: []
        };
        console.log("Creando nueva instalación:", newInstallation);
        installation = await window.api.addInstallation(newInstallation);
      }
      
      installationId = installation.id;
    } else {
      installationId = addressValue; // Ya tenemos el ID del select
    }
    
    // PASO 3: Manejar componente (existente o crear nuevo)
    if (isComponentManual) {
      // Obtener la instalación
      const installations = await window.api.getInstallations();
      const installation = installations.find(i => i.id === installationId);
      
      if (!installation) {
        throw new Error("No se encontró la instalación");
      }
      
      // Verificar si ya existe un componente con ese nombre
      let component = null;
      if (installation.components && Array.isArray(installation.components)) {
        component = installation.components.find(c => 
          c.name && c.name.toLowerCase() === componentValue.toLowerCase()
        );
      }
      
      if (!component) {
        // Crear nuevo componente
        componentId = await window.api.generateId();
        const newComponent = {
          id: componentId,
          name: componentValue,
          model: componentModel,
          lastMaintenanceDate: maintenanceDate,
          frequency: frequency,
          nextMaintenanceDate: nextMaintenanceDate
        };
        
        // Asegurarnos que el array de componentes existe
        if (!installation.components) {
          installation.components = [];
        }
        
        // Añadir componente
        installation.components.push(newComponent);
        
        // Actualizar instalación
        console.log("Añadiendo nuevo componente:", newComponent);
        await window.api.updateInstallation(installation);
      } else {
        // Actualizar componente existente
        componentId = component.id;
        component.lastMaintenanceDate = maintenanceDate;
        component.frequency = frequency;
        component.nextMaintenanceDate = nextMaintenanceDate;
        
        // Actualizar el modelo si se proporcionó
        if (componentModel) {
          component.model = componentModel;
        }
        
        // Actualizar instalación
        console.log("Actualizando componente existente:", component);
        await window.api.updateInstallation(installation);
      }
    } else {
      componentId = componentValue; // Ya tenemos el ID del select
    }
    
    // PASO 4: Registrar el mantenimiento
    await window.api.registerMaintenance({
      installationId: installationId,
      componentId: componentId,
      maintenanceDate: maintenanceDate,
      notes: maintenanceNotes
    });
    
    // Cerrar modal
    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('addMaintenanceModal'));
    if (modalInstance) {
      modalInstance.hide();
    }
    
    // Mostrar mensaje de éxito
    showAlert('success', 'Mantenimiento registrado correctamente');
    
    // Si se solicitó enviar notificación
    if (sendNotification) {
      handleMaintenanceNotification(clientId, installationId, componentId, maintenanceDate);
    }
    
    // Recargar la sección
    loadMaintenance();
    
  } catch (error) {
    console.error("Error en saveMixedModeMaintenance:", error);
    throw error;
  }
}

// Procesar mantenimiento para componentes existentes
async function processExistingMaintenance(clientId, installationId, componentId, maintenanceDate, 
  frequency, nextMaintenanceDate, maintenanceNotes, sendNotification) {
  
  try {
    // Obtener instalaciones
    const installations = await window.api.getInstallations();
    
    // Buscar la instalación y el componente
    const installation = installations.find(i => i.id === installationId);
    if (!installation) {
      throw new Error('Instalación no encontrada');
    }
    
    let component = null;
    if (installation.components) {
      component = installation.components.find(c => c.id === componentId);
    }
    
    if (!component) {
      throw new Error('Componente no encontrado');
    }
    
    // Actualizar datos del componente
    const updatedComponent = {
      ...component,
      lastMaintenanceDate: maintenanceDate,
      frequency: frequency,
      nextMaintenanceDate: nextMaintenanceDate
    };
    
    // Actualizar componente en la instalación
    const updatedComponents = installation.components.map(c => 
      c.id === componentId ? updatedComponent : c
    );
    
    const updatedInstallation = {
      ...installation,
      components: updatedComponents
    };
    
    // Actualizar instalación en la base de datos
    await window.api.updateInstallation(updatedInstallation);
    
    // Registrar el mantenimiento en el historial
    await window.api.registerMaintenance({
      installationId,
      componentId,
      maintenanceDate: maintenanceDate,
      notes: maintenanceNotes
    });
    
    // Cerrar modal
    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('addMaintenanceModal'));
    if (modalInstance) {
      modalInstance.hide();
    }
    
    // Mostrar mensaje de éxito
    showAlert('success', 'Mantenimiento registrado correctamente');
    
    // Si se solicitó enviar notificación
    if (sendNotification) {
      handleMaintenanceNotification(clientId, installationId, componentId, maintenanceDate);
    }
    
    // Recargar la sección
    loadMaintenance();
    
  } catch (error) {
    console.error("Error en processExistingMaintenance:", error);
    throw error;
  }
}

// Manejar la notificación de mantenimiento
async function handleMaintenanceNotification(clientId, installationId, componentId, maintenanceDate) {
  try {
    // Obtener datos del cliente y componente
    const clients = await window.api.getClients();
    const installations = await window.api.getInstallations();
    
    const client = clients.find(c => c.id === clientId);
    const installation = installations.find(i => i.id === installationId);
    
    if (!client || !installation) {
      throw new Error("Cliente o instalación no encontrados");
    }
    
    if (!client.phone) {
      showAlert('warning', `No se pudo enviar notificación: el cliente ${client.name} no tiene un número de teléfono registrado`);
      return;
    }
    
    // Buscar el componente
    let component = null;
    if (installation.components) {
      component = installation.components.find(c => c.id === componentId);
    }
    
    if (!component) {
      throw new Error("Componente no encontrado");
    }
    
    // Calcular días para la próxima mantención
    const nextDate = new Date(component.nextMaintenanceDate);
    const today = new Date();
    const daysLeft = Math.floor((nextDate - today) / (1000 * 60 * 60 * 24));
    
    // Mostrar modal de WhatsApp para notificar al cliente
    showWhatsAppModal(
      client.id,
      client.name,
      client.phone,
      component.name,
      installation.address,
      component.nextMaintenanceDate,
      daysLeft
    );
  } catch (error) {
    console.error("Error al preparar notificación:", error);
    showAlert('warning', 'No se pudo enviar notificación: ' + error.message);
  }
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
        // Usar la API para calcular
        window.api.calculateNextMaintenanceDate(maintenanceDate.value, frequencyInput.value)
          .then(nextDate => {
            nextMaintenanceDate.value = nextDate;
          })
          .catch(error => {
            console.error("Error al calcular próxima fecha:", error);
            
            // Método alternativo si falla la API
            const date = new Date(maintenanceDate.value);
            const frequency = parseInt(frequencyInput.value) || 12;
            
            const nextDate = new Date(date);
            nextDate.setMonth(nextDate.getMonth() + frequency);
            
            const year = nextDate.getFullYear();
            const month = String(nextDate.getMonth() + 1).padStart(2, '0');
            const day = String(nextDate.getDate()).padStart(2, '0');
            
            nextMaintenanceDate.value = `${year}-${month}-${day}`;
          });
      } catch (error) {
        console.error('Error al calcular próxima fecha:', error);
        nextMaintenanceDate.value = '';
      }
    }
  }
  
  // Botón de guardar
  if (saveButton) {
    saveButton.addEventListener('click', async () => {
      try {
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
        
        // Obtener datos del formulario
        const clientId = clientSelect.value;
        const installationId = installationSelect.value;
        const componentId = componentSelect.value;
        const maintenanceDateValue = document.getElementById('maintenanceDate').value;
        const maintenanceNotes = document.getElementById('maintenanceNotes').value;
        const frequency = parseInt(document.getElementById('maintenanceFrequency').value) || 12;
        const nextMaintenanceDateValue = document.getElementById('nextMaintenanceDate').value;
        const sendNotification = document.getElementById('sendNotificationCheck').checked;
        
        // Buscar la instalación y el componente
        const installation = installations.find(i => i.id === installationId);
        if (!installation) {
          throw new Error('Instalación no encontrada');
        }
        
        let component = null;
        if (installation.components) {
          component = installation.components.find(c => c.id === componentId);
        }
        
        if (!component) {
          throw new Error('Componente no encontrado');
        }
        
        // Actualizar datos del componente
        const updatedComponent = {
          ...component,
          lastMaintenanceDate: maintenanceDateValue,
          frequency: frequency,
          nextMaintenanceDate: nextMaintenanceDateValue
        };
        
        // Actualizar componente en la instalación
        const updatedComponents = installation.components.map(c => 
          c.id === componentId ? updatedComponent : c
        );
        
        const updatedInstallation = {
          ...installation,
          components: updatedComponents
        };
        
        // Actualizar instalación en la base de datos
        const result = await window.api.updateInstallation(updatedInstallation);
        
        if (result) {
          // Registrar el mantenimiento en el historial
          const maintenanceResult = await window.api.registerMaintenance({
            installationId,
            componentId,
            maintenanceDate: maintenanceDateValue,
            notes: maintenanceNotes
          });
          
          // Cerrar modal
          const modalInstance = bootstrap.Modal.getInstance(document.getElementById('addMaintenanceModal'));
          if (modalInstance) {
            modalInstance.hide();
          } else {
            document.getElementById('addMaintenanceModal').style.display = 'none';
          }
          
          // Mostrar mensaje de éxito
          showAlert('success', 'Mantenimiento registrado correctamente');
          
          // Si se solicitó enviar notificación, mostrar modal de WhatsApp
          if (sendNotification) {
            const clientName = clientSelect.options[clientSelect.selectedIndex].text;
            const componentName = componentSelect.options[componentSelect.selectedIndex].text;
            
            // Buscar teléfono del cliente
            window.api.getClients()
              .then(clients => {
                const client = clients.find(c => c.id === clientId);
                if (client && client.phone) {
                  // Mostrar modal de WhatsApp
                  showWhatsAppModal(
                    clientId,
                    clientName,
                    client.phone,
                    componentName,
                    installation.address,
                    nextMaintenanceDateValue,
                    frequency * 30 // Estimación aproximada en días
                  );
                } else {
                  showAlert('warning', `No se pudo enviar notificación: el cliente no tiene un número de teléfono registrado`);
                }
              })
              .catch(error => {
                console.error('Error al buscar cliente:', error);
                showAlert('warning', 'No se pudo obtener información del cliente para enviar notificación');
              });
          }
          
          // Recargar la sección para mostrar los cambios
          loadMaintenance();
        } else {
          throw new Error('Error al actualizar instalación');
        }
      } catch (error) {
        console.error('Error al guardar mantenimiento:', error);
        showAlert('danger', `Error al guardar mantenimiento: ${error.message || 'Error desconocido'}`);
      } finally {
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
    
    // Obtener la instalación y componente
    window.api.getInstallations()
      .then(installations => {
        const installation = installations.find(i => i.id === installationId);
        
        if (!installation) {
          throw new Error("Instalación no encontrada");
        }
        
        let component = null;
        if (installation.components) {
          component = installation.components.find(c => c.id === componentId);
        }
        
        if (!component) {
          throw new Error("Componente no encontrado");
        }
        
        // Calcular fecha sugerida para la próxima mantención
        const frequency = component.frequency || 12;
        const now = new Date();
        const nextDate = new Date(now);
        nextDate.setMonth(nextDate.getMonth() + frequency);
        const nextDateStr = nextDate.toISOString().split('T')[0];
        
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
                    
                    <div class="alert alert-info">
                      <p><strong>Componente:</strong> ${component.name || 'Sin nombre'}</p>
                      <p><strong>Dirección:</strong> ${installation.address || 'Sin dirección'}</p>
                      ${component.lastMaintenanceDate ? 
                        `<p><strong>Última mantención:</strong> ${formatDateCorrectly(component.lastMaintenanceDate)}</p>` : 
                        ''}
                    </div>
                    
                    <div class="mb-3">
                      <label for="maintenance-date" class="form-label">Fecha de mantenimiento</label>
                      <input type="date" class="form-control" id="maintenance-date" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                    
                    <div class="mb-3">
                      <label for="maintenance-frequency" class="form-label">Frecuencia (meses)</label>
                      <input type="number" class="form-control" id="maintenance-frequency" value="${frequency}" min="1" max="60">
                    </div>
                    
                    <div class="mb-3">
                      <label for="maintenance-next-date" class="form-label">Próxima mantención</label>
                      <input type="date" class="form-control" id="maintenance-next-date" value="${nextDateStr}">
                      <small class="form-text text-muted">Calculada automáticamente, pero puede modificarla</small>
                    </div>
                    
                    <div class="mb-3">
                      <label for="maintenance-notes" class="form-label">Notas</label>
                      <textarea class="form-control" id="maintenance-notes" rows="3" placeholder="Observaciones o detalles del mantenimiento realizado"></textarea>
                    </div>
                    
                    <div class="form-check mb-3">
                      <input class="form-check-input" type="checkbox" id="maintenance-notify-check">
                      <label class="form-check-label" for="maintenance-notify-check">
                        Notificar al cliente sobre la próxima mantención
                      </label>
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
        
        // Configurar eventos de cálculo automático
        const maintenanceDate = document.getElementById('maintenance-date');
        const maintenanceFrequency = document.getElementById('maintenance-frequency');
        const maintenanceNextDate = document.getElementById('maintenance-next-date');
        
        const calculateNextDate = () => {
          try {
            const date = new Date(maintenanceDate.value);
            const frequency = parseInt(maintenanceFrequency.value) || 12;
            
            const nextDate = new Date(date);
            nextDate.setMonth(nextDate.getMonth() + frequency);
            
            const year = nextDate.getFullYear();
            const month = String(nextDate.getMonth() + 1).padStart(2, '0');
            const day = String(nextDate.getDate()).padStart(2, '0');
            
            maintenanceNextDate.value = `${year}-${month}-${day}`;
          } catch (error) {
            console.error('Error al calcular fecha:', error);
          }
        };
        
        // Recalcular al cambiar fecha o frecuencia
        maintenanceDate.addEventListener('change', calculateNextDate);
        maintenanceFrequency.addEventListener('change', calculateNextDate);
        
        // Configurar botón de guardar
        const saveButton = document.getElementById('save-maintenance-btn');
        if (saveButton) {
          saveButton.addEventListener('click', async () => {
            try {
              // Validar formulario
              const form = document.getElementById('registerMaintenanceForm');
              if (!form.checkValidity()) {
                form.reportValidity();
                return;
              }
              
              // Deshabilitar botón
              saveButton.disabled = true;
              saveButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...';
              
              // Obtener datos del formulario
              const maintenanceDate = document.getElementById('maintenance-date').value;
              const notes = document.getElementById('maintenance-notes').value;
              const frequency = parseInt(document.getElementById('maintenance-frequency').value) || 12;
              const nextDate = document.getElementById('maintenance-next-date').value;
              const notify = document.getElementById('maintenance-notify-check').checked;
              
              // Actualizar el componente con las nuevas fechas
              const updatedComponent = {
                ...component,
                lastMaintenanceDate: maintenanceDate,
                nextMaintenanceDate: nextDate,
                frequency: frequency
              };
              
              // Actualizar componente en la instalación
              const updatedComponents = installation.components.map(c => 
                c.id === componentId ? updatedComponent : c
              );
              
              const updatedInstallation = {
                ...installation,
                components: updatedComponents
              };
              
              // Actualizar instalación
              await window.api.updateInstallation(updatedInstallation);
              
              // Registrar mantenimiento en historial
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
                
                // Si se solicitó notificar al cliente, buscar info de contacto
                if (notify) {
                  window.api.getClients()
                    .then(clients => {
                      const client = clients.find(c => c.id === installation.clientId);
                      if (client && client.phone) {
                        // Mostrar modal de WhatsApp para notificar la próxima mantención
                        showWhatsAppModal(
                          client.id,
                          client.name,
                          client.phone,
                          component.name,
                          installation.address,
                          nextDate,
                          frequency * 30 // Estimación aproximada en días
                        );
                      } else {
                        showAlert('warning', 'No se pudo enviar notificación: el cliente no tiene un número de teléfono registrado');
                      }
                    })
                    .catch(error => {
                      console.error('Error al obtener cliente:', error);
                      showAlert('warning', 'No se pudo enviar notificación al cliente');
                    });
                }
                
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
      })
      .catch(error => {
        console.error('Error al obtener datos:', error);
        showAlert('danger', 'Error al cargar datos de la instalación');
      });
  } catch (error) {
    console.error('Error al mostrar modal de registro:', error);
    showAlert('danger', 'Error al mostrar el formulario de registro de mantenimiento');
  }
}

// Función para mostrar el modal de WhatsApp
function showWhatsAppModal(clientId, clientName, clientPhone, component, address, date, daysLeft) {
  const isOverdue = daysLeft < 0;
  
  // Crear mensaje predeterminado según si está vencido o no
  let defaultMessage = '';
  if (isOverdue) {
    defaultMessage = `Estimado/a ${clientName},\n\nLe informamos que el mantenimiento de su ${component} en ${address} está vencido. Por favor, contáctenos lo antes posible para programar una visita técnica.\n\nGracias,\nServicio Técnico de Gas`;
  } else {
    // Mensaje para mantenimiento programado
    const formattedDate = formatDateCorrectly(date);
    defaultMessage = `Estimado/a ${clientName},\n\nLe recordamos que su ${component} en ${address} requiere mantenimiento programado para el día ${formattedDate}.\n\nPor favor, contáctenos para agendar una visita.\n\nGracias,\nServicio Técnico de Gas`;
  }
  
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
                <label class="form-label">Tipo de mensaje</label>
                <select class="form-select" id="whatsapp-message-type">
                  <option value="maintenance" ${!isOverdue ? 'selected' : ''}>Recordatorio de mantenimiento</option>
                  <option value="overdue" ${isOverdue ? 'selected' : ''}>Mantenimiento vencido</option>
                  <option value="custom">Mensaje personalizado</option>
                </select>
              </div>
              
              <div class="mb-3">
                <label for="whatsapp-message" class="form-label">Mensaje</label>
                <textarea class="form-control" id="whatsapp-message" rows="6">${defaultMessage}</textarea>
              </div>
              
              <div class="alert alert-info">
                <small><strong>Nota:</strong> El cliente recibirá una notificación desde el número de WhatsApp vinculado a esta aplicación.</small>
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
  
  // Configurar selector de tipo de mensaje
  const messageTypeSelect = document.getElementById('whatsapp-message-type');
  const messageTextarea = document.getElementById('whatsapp-message');
  
  if (messageTypeSelect && messageTextarea) {
    messageTypeSelect.addEventListener('change', () => {
      const messageType = messageTypeSelect.value;
      let messageText = '';
      
      switch(messageType) {
        case 'maintenance':
          // Mensaje para mantenimiento programado
          const formattedDate = formatDateCorrectly(date);
          messageText = `Estimado/a ${clientName},\n\nLe recordamos que su ${component} en ${address} requiere mantenimiento programado para el día ${formattedDate}.\n\nPor favor, contáctenos para agendar una visita.\n\nGracias,\nServicio Técnico de Gas`;
          break;
        case 'overdue':
          // Mensaje para mantenimiento vencido
          messageText = `Estimado/a ${clientName},\n\nLe informamos que el mantenimiento de su ${component} en ${address} está vencido. Por favor, contáctenos lo antes posible para programar una visita técnica.\n\nGracias,\nServicio Técnico de Gas`;
          break;
        case 'custom':
          // Mantener el texto actual
          return;
      }
      
      messageTextarea.value = messageText;
    });
  }
  
  // Configurar botón de enviar
  const sendButton = document.getElementById('send-whatsapp-btn');
  if (sendButton) {
    sendButton.addEventListener('click', async () => {
      try {
        // Verificar primero si WhatsApp está conectado
        const isConnected = await window.api.isWhatsAppConnected();
        if (!isConnected) {
          throw new Error('WhatsApp no está conectado. Por favor, vaya a la sección de WhatsApp para conectarse.');
        }
        
        // Deshabilitar botón
        sendButton.disabled = true;
        sendButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Enviando...';
        
        // Obtener mensaje
        const message = document.getElementById('whatsapp-message').value;
        
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
            <p>Esta acción enviará notificaciones a todos los clientes que tienen mantenimientos pendientes.</p>
            
            <div class="mb-3">
              <label for="notifyDaysFilter" class="form-label">Notificar mantenimientos:</label>
              <select class="form-select" id="notifyDaysFilter">
                <option value="overdue">Vencidos</option>
                <option value="urgent" selected>Urgentes (próximos 7 días)</option>
                <option value="all">Todos los pendientes (30 días)</option>
              </select>
            </div>
            
            <div class="form-check mb-3">
              <input class="form-check-input" type="checkbox" id="onlyWithPhoneCheck" checked>
              <label class="form-check-label" for="onlyWithPhoneCheck">
                Solo clientes con teléfono registrado
              </label>
            </div>
            
            <div class="alert alert-warning">
              <i class="bi bi-exclamation-triangle me-2"></i>
              <strong>Importante:</strong> Asegúrese de que WhatsApp esté conectado antes de enviar notificaciones masivas.
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
        // Verificar primero si WhatsApp está conectado
        const isConnected = await window.api.isWhatsAppConnected();
        if (!isConnected) {
          showAlert('danger', 'WhatsApp no está conectado. Por favor, vaya a la sección de WhatsApp para conectarse.');
          return;
        }
        
        // Deshabilitar botón
        confirmButton.disabled = true;
        confirmButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...';
        
        // Obtener filtros
        const notifyFilter = document.getElementById('notifyDaysFilter').value;
        const onlyWithPhone = document.getElementById('onlyWithPhoneCheck').checked;
        
        // Obtener mantenimientos pendientes
        const maintenanceList = await window.api.getUpcomingMaintenance();
        
        // Filtrar según los criterios
        let filteredMaintenance = [];
        switch (notifyFilter) {
          case 'overdue':
            filteredMaintenance = maintenanceList.filter(m => m.daysLeft < 0);
            break;
          case 'urgent':
            filteredMaintenance = maintenanceList.filter(m => m.daysLeft >= 0 && m.daysLeft <= 7);
            break;
          case 'all':
            filteredMaintenance = maintenanceList;
            break;
        }
        
        // Agrupar por cliente para enviar un solo mensaje por cliente
        const clientGroups = {};
        filteredMaintenance.forEach(maint => {
          if (!clientGroups[maint.clientId]) {
            clientGroups[maint.clientId] = {
              clientName: maint.clientName,
              clientPhone: maint.clientPhone,
              components: []
            };
          }
          
          clientGroups[maint.clientId].components.push({
            name: maint.componentName,
            address: maint.address,
            days: maint.daysLeft
          });
        });
        
        // Contar clientes con teléfono
        const clientsWithPhone = Object.values(clientGroups).filter(client => 
          client.clientPhone && (!onlyWithPhone || client.clientPhone.trim() !== '')
        );
        
        if (clientsWithPhone.length === 0) {
          showAlert('warning', 'No hay clientes con teléfono para notificar según los criterios seleccionados');
          confirmButton.disabled = false;
          confirmButton.innerHTML = '<i class="bi bi-whatsapp me-1"></i> Enviar Notificaciones';
          return;
        }
        
        // Confirmar el envío
        if (confirm(`¿Está seguro de enviar notificaciones a ${clientsWithPhone.length} clientes?`)) {
          // Cerrar modal
          modal.hide();
          
          // Mostrar mensaje de procesamiento
          showAlert('info', `Enviando notificaciones a ${clientsWithPhone.length} clientes...`);
          
          // Contador de éxito
          let successCount = 0;
          let errorCount = 0;
          
          // Enviar mensajes a cada cliente
          for (const client of clientsWithPhone) {
            if (!client.clientPhone) continue;
            
            try {
              // Crear mensaje según si los mantenimientos están vencidos o no
              const hasOverdue = client.components.some(c => c.days < 0);
              const message = window.maintenanceService.createMaintenanceMessage(
                client.clientName, 
                client.components, 
                hasOverdue
              );
              
              // Enviar mensaje
              const result = await window.api.sendWhatsAppMessage({
                phone: client.clientPhone,
                message: message
              });
              
              if (result.success) {
                successCount++;
              } else {
                errorCount++;
                console.error(`Error al enviar a ${client.clientName}:`, result.message);
              }
              
              // Pequeña pausa entre envíos para no saturar
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
              console.error(`Error al enviar a ${client.clientName}:`, error);
              errorCount++;
            }
          }
          
          // Mostrar resultado final
          if (successCount > 0) {
            showAlert('success', `Se enviaron ${successCount} notificaciones correctamente${errorCount > 0 ? ` (${errorCount} fallaron)` : ''}`);
          } else {
            showAlert('danger', 'No se pudo enviar ninguna notificación. Revise el estado de WhatsApp.');
          }
        } else {
          // Restaurar botón si se cancela
          confirmButton.disabled = false;
          confirmButton.innerHTML = '<i class="bi bi-whatsapp me-1"></i> Enviar Notificaciones';
        }
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
  
  let visibleCount = 0;
  
  maintenanceRows.forEach(row => {
    const clientId = row.getAttribute('data-client-id');
    const urgency = row.getAttribute('data-urgency');
    
    const clientMatch = !clientValue || clientId === clientValue;
    const urgencyMatch = !urgencyValue || urgency === urgencyValue;
    
    if (clientMatch && urgencyMatch) {
      row.style.display = '';
      visibleCount++;
    } else {
      row.style.display = 'none';
    }
  });
  
  // Mostrar mensaje si no hay resultados
  const tableBody = document.getElementById('maintenance-table-body');
  if (tableBody && visibleCount === 0) {
    const noResultsRow = document.createElement('tr');
    noResultsRow.className = 'no-results-row';
    noResultsRow.innerHTML = `
      <td colspan="7" class="text-center text-muted py-3">
        No hay mantenimientos que coincidan con los filtros seleccionados
      </td>
    `;
    tableBody.appendChild(noResultsRow);
  } else {
    // Eliminar mensaje si hay resultados
    document.querySelectorAll('.no-results-row').forEach(row => row.remove());
  }
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