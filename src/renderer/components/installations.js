// Cargar la lista de instalaciones
async function loadInstallations() {
    const installationsSection = document.getElementById('installations-section');
    
    try {
      const installations = await window.api.getInstallations();
      const clients = await window.api.getClients();
      
      installationsSection.innerHTML = `
        <h2 class="mb-4">Gestión de Instalaciones</h2>
        
        <div class="row mb-4">
          <div class="col-md-4">
            <select id="installationClientFilter" class="form-select">
              <option value="">Todos los clientes</option>
              ${renderClientOptions(clients)}
            </select>
          </div>
          <div class="col-md-4">
            <select id="installationTypeFilter" class="form-select">
              <option value="">Todos los tipos</option>
              <option value="Residencial">Residencial</option>
              <option value="Comercial">Comercial</option>
              <option value="Industrial">Industrial</option>
            </select>
          </div>
          <div class="col-md-4 text-end">
            <button id="addInstallationButton" class="btn btn-primary">
              <i class="bi bi-plus-circle"></i> Agregar Instalación
            </button>
          </div>
        </div>
        
        <div id="installationsContainer">
          ${renderInstallationsList(installations, clients)}
        </div>
        
        ${installations.length === 0 ? 
          `<div class="alert alert-info text-center">
            No hay instalaciones registradas. Agrega tu primera instalación haciendo clic en "Agregar Instalación".
          </div>` : ''}
      `;
      
      setupInstallationsEvents();
      
    } catch (error) {
      installationsSection.innerHTML = `
        <div class="alert alert-danger">
          Error al cargar instalaciones: ${error.message}
        </div>
      `;
    }
  }
  
  // Renderizar opciones de clientes para el select
  function renderClientOptions(clients) {
    return clients.map(client => 
      `<option value="${client.id}">${client.name}</option>`
    ).join('');
  }
  
  // Renderizar lista de instalaciones
  function renderInstallationsList(installations, clients) {
    if (installations.length === 0) {
      return '';
    }
    
    return `
      <div class="row">
        ${installations.map(installation => {
          const client = clients.find(c => c.id === installation.clientId) || { name: 'Cliente no encontrado' };
          const totalComponents = installation.components ? installation.components.length : 0;
          const pendingMaintenance = installation.components ? 
            installation.components.filter(comp => {
              if (!comp.nextMaintenanceDate) return false;
              const nextDate = new Date(comp.nextMaintenanceDate);
              const today = new Date();
              return nextDate >= today && ((nextDate - today) / (1000 * 60 * 60 * 24)) <= 30;
            }).length : 0;
          
          return `
            <div class="col-md-6 mb-4 installation-item" 
                 data-client-id="${installation.clientId}" 
                 data-type="${installation.type || ''}">
              <div class="card installation-card h-100">
                <div class="card-header d-flex justify-content-between align-items-center">
                  <h5 class="mb-0">${client.name}</h5>
                  <span class="badge ${getBadgeForType(installation.type)}">${installation.type || 'No especificado'}</span>
                </div>
                <div class="card-body">
                  <p><strong>Dirección:</strong> ${installation.address}</p>
                  <p><strong>Fecha de instalación:</strong> ${formatDate(installation.date)}</p>
                  <p>
                    <strong>Componentes:</strong> ${totalComponents} 
                    ${pendingMaintenance > 0 ? 
                      `<span class="badge bg-warning ms-2">${pendingMaintenance} mantención(es) próxima(s)</span>` : 
                      ''}
                  </p>
                  ${installation.notes ? `<p><strong>Notas:</strong> ${installation.notes}</p>` : ''}
                </div>
                <div class="card-footer bg-transparent">
                  <div class="btn-group w-100">
                    <button class="btn btn-sm btn-outline-primary view-installation-btn" data-id="${installation.id}">
                      <i class="bi bi-eye"></i> Detalles
                    </button>
                    <button class="btn btn-sm btn-outline-secondary edit-installation-btn" data-id="${installation.id}">
                      <i class="bi bi-pencil"></i> Editar
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-installation-btn" data-id="${installation.id}" data-address="${installation.address}">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
  
  // Obtener clase de badge según el tipo de instalación
  function getBadgeForType(type) {
    switch (type) {
      case 'Residencial': return 'bg-info';
      case 'Comercial': return 'bg-primary';
      case 'Industrial': return 'bg-secondary';
      default: return 'bg-light text-dark';
    }
  }
  
  // Configurar eventos para la sección de instalaciones
  function setupInstallationsEvents() {
    // Filtro por cliente
    const clientFilter = document.getElementById('installationClientFilter');
    if (clientFilter) {
      clientFilter.addEventListener('change', filterInstallations);
    }
    
    // Filtro por tipo
    const typeFilter = document.getElementById('installationTypeFilter');
    if (typeFilter) {
      typeFilter.addEventListener('change', filterInstallations);
    }
    
    // Botón para agregar instalación
    const addInstallationButton = document.getElementById('addInstallationButton');
    if (addInstallationButton) {
      addInstallationButton.addEventListener('click', async () => {
        // Limpiar formulario
        document.getElementById('installationForm').reset();
        document.getElementById('installationModalLabel').textContent = 'Agregar Instalación';
        document.getElementById('installationId').value = '';
        
        // Limpiar contenedor de componentes
        const componentsContainer = document.getElementById('componentsContainer');
        componentsContainer.innerHTML = '';
        
        // Cargar lista de clientes en el select
        await populateClientSelect();
        
        // Mostrar modal
        const installationModal = new bootstrap.Modal(document.getElementById('installationModal'));
        installationModal.show();
      });
    }
  }
  
  // Filtrar instalaciones según los criterios seleccionados
  function filterInstallations() {
    const clientFilter = document.getElementById('installationClientFilter').value;
    const typeFilter = document.getElementById('installationTypeFilter').value;
    
    const installationItems = document.querySelectorAll('.installation-item');
    
    installationItems.forEach(item => {
      const clientId = item.getAttribute('data-client-id');
      const type = item.getAttribute('data-type');
      
      const clientMatch = !clientFilter || clientId === clientFilter;
      const typeMatch = !typeFilter || type === typeFilter;
      
      if (clientMatch && typeMatch) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  }
  
  // Cargar la lista de clientes en el select
  async function populateClientSelect(selectedClientId = null) {
    const clientSelect = document.getElementById('installationClient');
    if (!clientSelect) return;
    
    try {
      const clients = await window.api.getClients();
      
      // Limpiar opciones actuales
      clientSelect.innerHTML = '<option value="">Seleccionar cliente...</option>';
      
      // Agregar opciones de clientes
      clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = client.name;
        clientSelect.appendChild(option);
      });
      
      // Seleccionar cliente si se proporciona
      if (selectedClientId) {
        clientSelect.value = selectedClientId;
      }
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    }
  }
  
  // Agregar componente al formulario
  function addComponentToForm(componentData = null) {
    const componentsContainer = document.getElementById('componentsContainer');
    const componentTemplate = document.getElementById('componentTemplate');
    const clone = document.importNode(componentTemplate.content, true);
    
    // Si hay datos, llenar el formulario
    if (componentData) {
      clone.querySelector('.component-id').value = componentData.id;
      clone.querySelector('.component-name').value = componentData.name || '';
      clone.querySelector('.component-model').value = componentData.model || '';
      clone.querySelector('.component-last-maintenance').value = componentData.lastMaintenanceDate || '';
      clone.querySelector('.component-frequency').value = componentData.frequency || '12';
      clone.querySelector('.component-next-maintenance').value = componentData.nextMaintenanceDate || '';
      clone.querySelector('.component-notes').value = componentData.notes || '';
    }
    
    // Evento para calcular próxima mantención
    const lastMaintenanceInput = clone.querySelector('.component-last-maintenance');
    const frequencyInput = clone.querySelector('.component-frequency');
    const nextMaintenanceInput = clone.querySelector('.component-next-maintenance');
    
    const calculateNextMaintenance = () => {
      if (lastMaintenanceInput.value && frequencyInput.value) {
        nextMaintenanceInput.value = window.api.calculateNextMaintenanceDate(
          lastMaintenanceInput.value, 
          frequencyInput.value
        );
      }
    };
    
    lastMaintenanceInput.addEventListener('change', calculateNextMaintenance);
    frequencyInput.addEventListener('change', calculateNextMaintenance);
    
    if (componentData && componentData.lastMaintenanceDate && componentData.frequency) {
      calculateNextMaintenance();
    }
    
    // Evento para eliminar componente
    const removeBtn = clone.querySelector('.remove-component-btn');
    removeBtn.addEventListener('click', function() {
      this.closest('.component-item').remove();
    });
    
    // Agregar al contenedor
    componentsContainer.appendChild(clone);
  }
  
  // Formatear fecha
  function formatDate(dateString) {
    if (!dateString) return '-';
    return window.api.formatDate(dateString);
  }
  
  // Exportar funciones
  window.loadInstallations = loadInstallations;
    
    // Botones de editar instalación
    const editButtons = document.querySelectorAll('.edit-installation-btn');
    editButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const installationId = button.getAttribute('data-id');
        const installations = await window.api.getInstallations();
        const installation = installations.find(i => i.id === installationId);
        
        if (installation) {
          // Llenar formulario con datos de la instalación
          document.getElementById('installationId').value = installation.id;
          document.getElementById('installationAddress').value = installation.address;
          document.getElementById('installationType').value = installation.type || 'Residencial';
          document.getElementById('installationDate').value = installation.date || '';
          document.getElementById('installationNotes').value = installation.notes || '';
          
          // Cargar lista de clientes y seleccionar el cliente
          await populateClientSelect(installation.clientId);
          
          // Cargar componentes
          const componentsContainer = document.getElementById('componentsContainer');
          componentsContainer.innerHTML = '';
          
          if (installation.components && installation.components.length > 0) {
            installation.components.forEach(component => {
              addComponentToForm(component);
            });
          }
          
          document.getElementById('installationModalLabel').textContent = 'Editar Instalación';
          
          // Mostrar modal
          const installationModal = new bootstrap.Modal(document.getElementById('installationModal'));
          installationModal.show();
        }
      });
    });
    
    // Botones de eliminar instalación
    const deleteButtons = document.querySelectorAll('.delete-installation-btn');
    setupDeleteButtons(deleteButtons, 'installation', async (installationId) => {
      try {
        await window.api.deleteInstallation(installationId);
        showAlert('success', 'Instalación eliminada correctamente');
        loadInstallations();
      } catch (error) {
        showAlert('danger', `Error al eliminar instalación: ${error.message}`);
      }
    });
    
    // Botones de ver detalles de instalación
    const viewButtons = document.querySelectorAll('.view-installation-btn');
    viewButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const installationId = button.getAttribute('data-id');
        const installations = await window.api.getInstallations();
        const clients = await window.api.getClients();
        
        const installation = installations.find(i => i.id === installationId);
        if (!installation) return;
        
        const client = clients.find(c => c.id === installation.clientId) || { name: 'Cliente no encontrado' };
        
        // Crear modal para visualizar detalles
        const detailsModal = document.createElement('div');
        detailsModal.innerHTML = `
          <div class="modal fade" id="installationDetailsModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-lg">
              <div class="modal-content">
                <div class="modal-header">
                  <h5 class="modal-title">Detalles de Instalación</h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                  <div class="row mb-3">
                    <div class="col-md-6">
                      <p><strong>Cliente:</strong> ${client.name}</p>
                      <p><strong>Dirección:</strong> ${installation.address}</p>
                      <p><strong>Tipo:</strong> ${installation.type || 'No especificado'}</p>
                      <p><strong>Fecha de Instalación:</strong> ${formatDate(installation.date)}</p>
                    </div>
                    <div class="col-md-6">
                      <p><strong>Teléfono:</strong> ${client.phone || 'No registrado'}</p>
                      <p><strong>Email:</strong> ${client.email || 'No registrado'}</p>
                      ${installation.notes ? `<p><strong>Notas:</strong> ${installation.notes}</p>` : ''}
                    </div>
                  </div>
                  
                  <h6 class="mb-3">Componentes</h6>
                  ${installation.components && installation.components.length > 0 ? `
                    <div class="table-responsive">
                      <table class="table table-bordered">
                        <thead>
                          <tr>
                            <th>Componente</th>
                            <th>Marca/Modelo</th>
                            <th>Última Mantención</th>
                            <th>Frecuencia (meses)</th>
                            <th>Próxima Mantención</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${installation.components.map(component => {
                            const today = new Date();
                            const nextMaintenance = component.nextMaintenanceDate ? new Date(component.nextMaintenanceDate) : null;
                            let status = '';
                            let statusClass = '';
                            
                            if (nextMaintenance) {
                              const diffDays = Math.floor((nextMaintenance - today) / (1000 * 60 * 60 * 24));
                              if (diffDays < 0) {
                                status = 'Vencido';
                                statusClass = 'text-danger';
                              } else if (diffDays <= 7) {
                                status = 'Urgente';
                                statusClass = 'text-danger';
                              } else if (diffDays <= 30) {
                                status = 'Próximo';
                                statusClass = 'text-warning';
                              } else {
                                status = 'Al día';
                                statusClass = 'text-success';
                              }
                            } else {
                              status = 'No programado';
                              statusClass = 'text-secondary';
                            }
                            
                            return `
                              <tr>
                                <td>${component.name}</td>
                                <td>${component.model || '-'}</td>
                                <td>${formatDate(component.lastMaintenanceDate)}</td>
                                <td>${component.frequency || 12}</td>
                                <td>${formatDate(component.nextMaintenanceDate)}</td>
                                <td class="${statusClass}">${status}</td>
                              </tr>
                            `;
                          }).join('')}
                        </tbody>
                      </table>
                    </div>
                  ` : '<p class="text-muted">No hay componentes registrados</p>'}
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        `;
        
        // Agregar modal al DOM y mostrarlo
        document.body.appendChild(detailsModal.firstElementChild);
        const modal = new bootstrap.Modal(document.getElementById('installationDetailsModal'));
        modal.show();
        
        // Eliminar del DOM cuando se cierre
        document.getElementById('installationDetailsModal').addEventListener('hidden.bs.modal', function () {
          this.remove();
        });
      });
    });
    
    // Configurar botón para agregar componente
    const addComponentBtn = document.getElementById('addComponentBtn');
    if (addComponentBtn) {
      addComponentBtn.addEventListener('click', () => {
        addComponentToForm();
      });
    }
    
    // Configurar guardar instalación
    const saveInstallationBtn = document.getElementById('saveInstallationBtn');
    if (saveInstallationBtn) {
      saveInstallationBtn.addEventListener('click', async () => {
        const installationForm = document.getElementById('installationForm');
        
        // Validación básica
        if (!installationForm.checkValidity()) {
          installationForm.reportValidity();
          return;
        }
        
        // Recopilar datos de la instalación
        const installationId = document.getElementById('installationId').value;
        const clientId = document.getElementById('installationClient').value;
        const address = document.getElementById('installationAddress').value;
        const type = document.getElementById('installationType').value;
        const date = document.getElementById('installationDate').value;
        const notes = document.getElementById('installationNotes').value;
        
        // Recopilar componentes
        const components = [];
        const componentItems = document.querySelectorAll('.component-item');
        componentItems.forEach(item => {
          const component = {
            id: item.querySelector('.component-id').value || window.api.generateId(),
            name: item.querySelector('.component-name').value,
            model: item.querySelector('.component-model').value,
            lastMaintenanceDate: item.querySelector('.component-last-maintenance').value,
            frequency: item.querySelector('.component-frequency').value,
            nextMaintenanceDate: item.querySelector('.component-next-maintenance').value,
            notes: item.querySelector('.component-notes').value
          };
          components.push(component);
        });
        
        const installation = {
          id: installationId || window.api.generateId(),
          clientId,
          address,
          type,
          date,
          notes,
          components
        };
        
        try {
          if (installationId) {
            // Actualizar instalación existente
            await window.api.updateInstallation(installation);
            showAlert('success', 'Instalación actualizada correctamente');
          } else {
            // Agregar nueva instalación
            await window.api.addInstallation(installation);
            showAlert('success', 'Instalación agregada correctamente');
          }
          
          // Cerrar modal y recargar lista
          const modal = bootstrap.Modal.getInstance(document.getElementById('installationModal'));
          modal.hide();
          loadInstallations();
          
        } catch (error) {
          showAlert('danger', `Error al guardar instalación: ${error.message}`);
        }
      });
    }