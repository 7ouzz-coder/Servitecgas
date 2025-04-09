// Cargar el dashboard
async function loadDashboard() {
    const dashboardSection = document.getElementById('dashboard-section');
    
    try {
      // Obtener datos necesarios para el dashboard
      const clients = await window.api.getClients();
      const installations = await window.api.getInstallations();
      const upcomingMaintenance = await window.api.getUpcomingMaintenance();
      
      // Obtener estadísticas
      const totalClients = clients.length;
      const totalInstallations = installations.length;
      const totalComponents = installations.reduce((sum, inst) => sum + inst.components.length, 0);
      const pendingMaintenance = upcomingMaintenance.length;
      
      // Obtener instalaciones agrupadas por tipo
      const installationTypes = {};
      installations.forEach(inst => {
        const type = inst.type || 'No especificado';
        installationTypes[type] = (installationTypes[type] || 0) + 1;
      });
      
      // Crear el contenido HTML del dashboard
      dashboardSection.innerHTML = `
        <h2 class="mb-4">Dashboard</h2>
        
        <!-- Tarjetas de resumen -->
        <div class="row mb-4">
          <div class="col-md-3">
            <div class="card dashboard-card">
              <div class="card-body">
                <h5 class="card-title">Clientes</h5>
                <div class="card-value">${totalClients}</div>
              </div>
            </div>
          </div>
          
          <div class="col-md-3">
            <div class="card dashboard-card">
              <div class="card-body">
                <h5 class="card-title">Instalaciones</h5>
                <div class="card-value">${totalInstallations}</div>
              </div>
            </div>
          </div>
          
          <div class="col-md-3">
            <div class="card dashboard-card">
              <div class="card-body">
                <h5 class="card-title">Componentes</h5>
                <div class="card-value">${totalComponents}</div>
              </div>
            </div>
          </div>
          
          <div class="col-md-3">
            <div class="card dashboard-card ${pendingMaintenance > 0 ? 'bg-warning bg-opacity-10' : ''}">
              <div class="card-body">
                <h5 class="card-title">Mantenciones Pendientes</h5>
                <div class="card-value ${pendingMaintenance > 0 ? 'text-warning' : ''}">${pendingMaintenance}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Mantenimientos próximos -->
        <div class="row mb-4">
          <div class="col-md-8">
            <div class="card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Mantenimientos Próximos</h5>
              </div>
              <div class="card-body">
                <div class="table-responsive">
                  <table class="table table-hover">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Componente</th>
                        <th>Dirección</th>
                        <th>Fecha</th>
                        <th>Días Restantes</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody id="maintenance-table-body">
                      ${renderMaintenanceTable(upcomingMaintenance)}
                    </tbody>
                  </table>
                </div>
                ${upcomingMaintenance.length === 0 ? '<p class="text-center text-muted">No hay mantenimientos próximos</p>' : ''}
              </div>
            </div>
          </div>
          
          <!-- Distribución de instalaciones -->
          <div class="col-md-4">
            <div class="card">
              <div class="card-header">
                <h5 class="mb-0">Tipos de Instalaciones</h5>
              </div>
              <div class="card-body">
                <div class="table-responsive">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${renderInstallationTypesTable(installationTypes)}
                    </tbody>
                  </table>
                </div>
                ${installations.length === 0 ? '<p class="text-center text-muted">No hay instalaciones registradas</p>' : ''}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Clientes recientes -->
        <div class="row">
          <div class="col-12">
            <div class="card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Clientes Recientes</h5>
                <button class="btn btn-sm btn-primary" id="add-client-btn">Agregar Cliente</button>
              </div>
              <div class="card-body">
                <div class="row" id="recent-clients-container">
                  ${renderRecentClients(clients)}
                </div>
                ${clients.length === 0 ? '<p class="text-center text-muted">No hay clientes registrados</p>' : ''}
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Configurar eventos
      setupDashboardEvents();
      
    } catch (error) {
      dashboardSection.innerHTML = `
        <div class="alert alert-danger">
          Error al cargar el dashboard: ${error.message}
        </div>
      `;
    }
  }
  
  // Renderizar tabla de mantenimientos
  function renderMaintenanceTable(maintenanceList) {
    if (maintenanceList.length === 0) {
      return '';
    }
    
    return maintenanceList.slice(0, 5).map(maint => `
      <tr class="${maint.daysLeft <= 7 ? 'table-warning' : ''}">
        <td>${maint.clientName}</td>
        <td>${maint.componentName}</td>
        <td>${maint.address}</td>
        <td>${formatDate(maint.nextMaintenanceDate)}</td>
        <td>
          <span class="badge bg-${getBadgeColor(maint.daysLeft)}">${maint.daysLeft} días</span>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary send-whatsapp-btn" 
                  data-client-id="${maint.clientId}" 
                  data-client-name="${maint.clientName}" 
                  data-client-phone="${maint.clientPhone}"
                  data-component="${maint.componentName}"
                  data-address="${maint.address}"
                  data-date="${maint.nextMaintenanceDate}">
            <i class="bi bi-whatsapp"></i> Notificar
          </button>
        </td>
      </tr>
    `).join('');
  }
  
  // Renderizar tabla de tipos de instalaciones
  function renderInstallationTypesTable(types) {
    return Object.entries(types).map(([type, count]) => `
      <tr>
        <td>${type}</td>
        <td>${count}</td>
      </tr>
    `).join('');
  }
  
  // Renderizar clientes recientes
  function renderRecentClients(clients) {
    // Ordenar por fecha de creación (más recientes primero)
    const sortedClients = [...clients].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    return sortedClients.slice(0, 6).map(client => `
      <div class="col-md-4 mb-3">
        <div class="card client-card h-100">
          <div class="card-body">
            <h5 class="card-title">${client.name}</h5>
            <p class="card-text">
              <i class="bi bi-telephone"></i> ${client.phone || 'No registrado'}<br>
              <i class="bi bi-envelope"></i> ${client.email || 'No registrado'}
            </p>
            <a href="#" class="btn btn-sm btn-outline-primary view-client-btn" data-id="${client.id}">
              Ver detalles
            </a>
          </div>
        </div>
      </div>
    `).join('');
  }
  
  // Configurar eventos del dashboard
  function setupDashboardEvents() {
    // Botón para agregar cliente
    const addClientBtn = document.getElementById('add-client-btn');
    if (addClientBtn) {
      addClientBtn.addEventListener('click', () => {
        // Limpiar formulario
        document.getElementById('clientForm').reset();
        document.getElementById('clientModalLabel').textContent = 'Agregar Cliente';
        document.getElementById('clientId').value = '';
        
        // Mostrar modal
        const clientModal = new bootstrap.Modal(document.getElementById('clientModal'));
        clientModal.show();
      });
    }
    
    // Botones para ver detalles de cliente
    const viewClientBtns = document.querySelectorAll('.view-client-btn');
    viewClientBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const clientId = btn.getAttribute('data-id');
        
        // Cambiar a la sección de clientes
        const clientsLink = document.querySelector('[data-section="clients"]');
        clientsLink.click();
        
        // Después de cargar clientes, seleccionar el cliente específico
        setTimeout(() => {
          const clientElement = document.querySelector(`.client-card[data-id="${clientId}"]`);
          if (clientElement) {
            clientElement.scrollIntoView({ behavior: 'smooth' });
            clientElement.classList.add('border-primary');
            
            // Quitar resaltado después de unos segundos
            setTimeout(() => {
              clientElement.classList.remove('border-primary');
            }, 2000);
          }
        }, 300);
      });
    });
    
    // Botones para enviar WhatsApp
    const whatsappBtns = document.querySelectorAll('.send-whatsapp-btn');
    whatsappBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const clientId = btn.getAttribute('data-client-id');
        const clientName = btn.getAttribute('data-client-name');
        const clientPhone = btn.getAttribute('data-client-phone');
        const componentName = btn.getAttribute('data-component');
        const address = btn.getAttribute('data-address');
        const date = btn.getAttribute('data-date');
        
        // Configurar modal de WhatsApp
        document.getElementById('whatsappRecipientId').value = clientId;
        document.getElementById('whatsappRecipientName').value = clientName;
        document.getElementById('whatsappRecipientPhone').value = clientPhone;
        
        // Establecer plantilla de mensaje
        document.getElementById('whatsappMessageTemplate').value = 'maintenance';
        
        // Crear mensaje
        const messageData = {
          clientName,
          componentName,
          address,
          nextMaintenanceDate: date
        };
        
        document.getElementById('whatsappMessage').value = createMessageTemplate('maintenance', messageData);
        
        // Mostrar modal
        const whatsappModal = new bootstrap.Modal(document.getElementById('whatsappModal'));
        whatsappModal.show();
      });
    });
  }
  
  // Obtener color para el badge según los días restantes
  function getBadgeColor(days) {
    if (days <= 3) return 'danger';
    if (days <= 7) return 'warning';
    if (days <= 15) return 'info';
    return 'secondary';
  }
  
  // Formatear fecha
  function formatDate(dateString) {
    if (!dateString) return '-';
    return window.api.formatDate(dateString);
  }
  
  // Exportar funciones
  window.loadDashboard = loadDashboard;