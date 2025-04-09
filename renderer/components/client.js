// Gestión de clientes

// Cargar la lista de clientes
async function loadClients() {
    const clientsSection = document.getElementById('clients-section');
    
    try {
      const clients = await window.api.getClients();
      
      clientsSection.innerHTML = `
        <h2 class="mb-4">Gestión de Clientes</h2>
        
        <div class="row mb-4">
          <div class="col-md-6">
            <input type="text" id="clientSearchInput" class="form-control" placeholder="Buscar cliente por nombre o teléfono...">
          </div>
          <div class="col-md-6 text-end">
            <button id="addClientButton" class="btn btn-primary">
              <i class="bi bi-person-plus"></i> Agregar Cliente
            </button>
          </div>
        </div>
        
        <div class="row" id="clientsContainer">
          ${renderClientsList(clients)}
        </div>
        
        ${clients.length === 0 ? 
          `<div class="alert alert-info text-center">
            No hay clientes registrados. Agrega tu primer cliente haciendo clic en "Agregar Cliente".
          </div>` : ''}
      `;
      
      setupClientsEvents();
      
    } catch (error) {
      clientsSection.innerHTML = `
        <div class="alert alert-danger">
          Error al cargar clientes: ${error.message}
        </div>
      `;
    }
  }
  
  // Renderizar lista de clientes
  function renderClientsList(clients) {
    if (clients.length === 0) {
      return '';
    }
    
    return clients.map(client => `
      <div class="col-md-4 mb-4">
        <div class="card client-card h-100" data-id="${client.id}">
          <div class="card-body">
            <h5 class="card-title">${client.name}</h5>
            <p class="card-text">
              <strong><i class="bi bi-telephone"></i> Teléfono:</strong> ${client.phone || 'No registrado'}<br>
              <strong><i class="bi bi-envelope"></i> Email:</strong> ${client.email || 'No registrado'}<br>
              ${client.notes ? `<strong><i class="bi bi-journal-text"></i> Notas:</strong> ${client.notes}` : ''}
            </p>
          </div>
          <div class="card-footer bg-transparent">
            <div class="btn-group w-100">
              <button class="btn btn-sm btn-outline-primary view-installations-btn" data-id="${client.id}" data-name="${client.name}">
                <i class="bi bi-wrench"></i> Instalaciones
              </button>
              <button class="btn btn-sm btn-outline-secondary edit-client-btn" data-id="${client.id}">
                <i class="bi bi-pencil"></i> Editar
              </button>
              <button class="btn btn-sm btn-outline-success send-whatsapp-client-btn" data-id="${client.id}" data-name="${client.name}" data-phone="${client.phone || ''}">
                <i class="bi bi-whatsapp"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger delete-client-btn" data-id="${client.id}" data-name="${client.name}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }
  
  // Configurar eventos para la sección de clientes
  function setupClientsEvents() {
    // Botón para agregar cliente
    const addClientButton = document.getElementById('addClientButton');
    if (addClientButton) {
      addClientButton.addEventListener('click', () => {
        // Limpiar formulario
        document.getElementById('clientForm').reset();
        document.getElementById('clientModalLabel').textContent = 'Agregar Cliente';
        document.getElementById('clientId').value = '';
        
        // Mostrar modal
        const clientModal = new bootstrap.Modal(document.getElementById('clientModal'));
        clientModal.show();
      });
    }
    
    // Botones de editar cliente
    const editButtons = document.querySelectorAll('.edit-client-btn');
    editButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const clientId = button.getAttribute('data-id');
        const clients = await window.api.getClients();
        const client = clients.find(c => c.id === clientId);
        
        if (client) {
          // Llenar formulario con datos del cliente
          document.getElementById('clientId').value = client.id;
          document.getElementById('clientName').value = client.name;
          document.getElementById('clientPhone').value = client.phone || '';
          document.getElementById('clientEmail').value = client.email || '';
          document.getElementById('clientNotes').value = client.notes || '';
          
          document.getElementById('clientModalLabel').textContent = 'Editar Cliente';
          
          // Mostrar modal
          const clientModal = new bootstrap.Modal(document.getElementById('clientModal'));
          clientModal.show();
        }
      });
    });
    
    // Botones de eliminar cliente
    const deleteButtons = document.querySelectorAll('.delete-client-btn');
    setupDeleteButtons(deleteButtons, 'client', async (clientId) => {
      try {
        await window.api.deleteClient(clientId);
        showAlert('success', 'Cliente eliminado correctamente');
        loadClients();
      } catch (error) {
        showAlert('danger', `Error al eliminar cliente: ${error.message}`);
      }
    });
    
    // Botones para ver instalaciones
    const viewInstallationsButtons = document.querySelectorAll('.view-installations-btn');
    viewInstallationsButtons.forEach(button => {
      button.addEventListener('click', () => {
        const clientId = button.getAttribute('data-id');
        const clientName = button.getAttribute('data-name');
        
        // Cambiar a la sección de instalaciones
        const installationsLink = document.querySelector('[data-section="installations"]');
        installationsLink.click();
        
        // Esperar a que cargue y filtrar por cliente
        setTimeout(() => {
          const clientFilterSelect = document.getElementById('installationClientFilter');
          if (clientFilterSelect) {
            clientFilterSelect.value = clientId;
            // Disparar evento de cambio para activar el filtro
            clientFilterSelect.dispatchEvent(new Event('change'));
          }
        }, 300);
      });
    });
    
    // Botones de WhatsApp
    const whatsappButtons = document.querySelectorAll('.send-whatsapp-client-btn');
    whatsappButtons.forEach(button => {
      button.addEventListener('click', () => {
        const clientId = button.getAttribute('data-id');
        const clientName = button.getAttribute('data-name');
        const clientPhone = button.getAttribute('data-phone');
        
        if (!clientPhone) {
          showAlert('warning', 'Este cliente no tiene un número de teléfono registrado');
          return;
        }
        
        // Configurar modal de WhatsApp
        document.getElementById('whatsappRecipientId').value = clientId;
        document.getElementById('whatsappRecipientName').value = clientName;
        document.getElementById('whatsappRecipientPhone').value = clientPhone;
        
        // Establecer plantilla de mensaje
        document.getElementById('whatsappMessageTemplate').value = 'followup';
        
        // Crear mensaje
        const messageData = {
          clientName
        };
        
        document.getElementById('whatsappMessage').value = createMessageTemplate('followup', messageData);
        
        // Mostrar modal
        const whatsappModal = new bootstrap.Modal(document.getElementById('whatsappModal'));
        whatsappModal.show();
      });
    });
    
    // Funcionalidad de búsqueda
    const searchInput = document.getElementById('clientSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', async () => {
        const searchTerm = searchInput.value.toLowerCase();
        const clients = await window.api.getClients();
        
        const filteredClients = clients.filter(client => 
          client.name.toLowerCase().includes(searchTerm) || 
          (client.phone && client.phone.includes(searchTerm)) ||
          (client.email && client.email.toLowerCase().includes(searchTerm))
        );
        
        const clientsContainer = document.getElementById('clientsContainer');
        clientsContainer.innerHTML = renderClientsList(filteredClients);
        
        // Reconfigurar eventos para los elementos filtrados
        setupClientsEvents();
      });
    }
    
    // Configurar guardar cliente
    const saveClientBtn = document.getElementById('saveClientBtn');
    if (saveClientBtn) {
      saveClientBtn.addEventListener('click', async () => {
        const clientForm = document.getElementById('clientForm');
        
        // Validación básica
        if (!clientForm.checkValidity()) {
          clientForm.reportValidity();
          return;
        }
        
        const clientId = document.getElementById('clientId').value;
        const client = {
          id: clientId || window.api.generateId(),
          name: document.getElementById('clientName').value,
          phone: document.getElementById('clientPhone').value,
          email: document.getElementById('clientEmail').value,
          notes: document.getElementById('clientNotes').value
        };
        
        try {
          if (clientId) {
            // Actualizar cliente existente
            await window.api.updateClient(client);
            showAlert('success', 'Cliente actualizado correctamente');
          } else {
            // Agregar nuevo cliente
            await window.api.addClient(client);
            showAlert('success', 'Cliente agregado correctamente');
          }
          
          // Cerrar modal y recargar lista
          const modal = bootstrap.Modal.getInstance(document.getElementById('clientModal'));
          modal.hide();
          loadClients();
          
        } catch (error) {
          showAlert('danger', `Error al guardar cliente: ${error.message}`);
        }
      });
    }
  }
  
  // Exportar funciones
  window.loadClients = loadClients;