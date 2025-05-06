document.addEventListener('DOMContentLoaded', async () => {
  try {
    const authStatus = await window.api.checkAuth();
    
    if (!authStatus.isAuthenticated) {
      // Redirigir a la página de login
      window.location.href = 'login.html';
      return;
    }
    
    // Iniciar la aplicación si está autenticado
    initApp();
    
    // Inicializar WhatsApp DESPUÉS de que la app esté completamente iniciada
    setTimeout(async () => {
      if (window.api) {
        try {
          await initializeWhatsApp();
          console.log('✅ Integración con WhatsApp inicializada correctamente');
        } catch (error) {
          console.error('Error al inicializar WhatsApp:', error);
        }
      } else {
        console.error('❌ API de Electron no disponible');
      }
    }, 2000); // Esperar un poco para que todo se cargue bien
    
  } catch (error) {
    console.error('Error al verificar autenticación:', error);
    // En caso de error, redirigir a login por seguridad
    window.location.href = 'login.html';
  }

// Mostrar panel de administración (solo para admin)
async function showAdminPanel() {
  try {
    // Verificar si el usuario es administrador
    const userInfo = await window.api.getUserInfo();
    if (!userInfo || userInfo.role !== 'admin') {
      showAlert('danger', 'Acceso denegado');
      return;
    }
    
    // Obtener lista de usuarios
    const response = await window.api.listUsers();
    if (!response.success) {
      showAlert('danger', response.message || 'Error al obtener lista de usuarios');
      return;
    }
    
    const users = response.users;
    
    // Crear modal
    const modalHtml = `
      <div class="modal fade" id="adminPanelModal" tabindex="-1" aria-labelledby="adminPanelModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="adminPanelModalLabel">Panel de Administración</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <ul class="nav nav-tabs" id="adminTabs" role="tablist">
                <li class="nav-item" role="presentation">
                  <button class="nav-link active" id="users-tab" data-bs-toggle="tab" data-bs-target="#users-tab-pane" type="button" role="tab" aria-controls="users-tab-pane" aria-selected="true">
                    Gestión de Usuarios
                  </button>
                </li>
                <li class="nav-item" role="presentation">
                  <button class="nav-link" id="settings-tab" data-bs-toggle="tab" data-bs-target="#settings-tab-pane" type="button" role="tab" aria-controls="settings-tab-pane" aria-selected="false">
                    Configuración
                  </button>
                </li>
              </ul>
              
              <div class="tab-content p-3" id="adminTabsContent">
                <!-- Tab usuarios -->
                <div class="tab-pane fade show active" id="users-tab-pane" role="tabpanel" aria-labelledby="users-tab" tabindex="0">
                  <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="mb-0">Usuarios del Sistema</h6>
                    <button class="btn btn-primary btn-sm" id="createUserBtn">
                      <i class="bi bi-person-plus"></i> Nuevo Usuario
                    </button>
                  </div>
                  
                  <div class="table-responsive">
                    <table class="table table-hover">
                      <thead>
                        <tr>
                          <th>Usuario</th>
                          <th>Nombre</th>
                          <th>Email</th>
                          <th>Rol</th>
                          <th>Último Acceso</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody id="usersTable">
                        ${users.map(user => `
                          <tr>
                            <td>${user.username}</td>
                            <td>${user.name || '-'}</td>
                            <td>${user.email || '-'}</td>
                            <td><span class="badge ${user.role === 'admin' ? 'bg-danger' : 'bg-primary'}">${user.role}</span></td>
                            <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Nunca'}</td>
                            <td>
                              <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary edit-user-btn" data-userid="${user.id}">
                                  <i class="bi bi-pencil"></i>
                                </button>
                                ${userInfo.id !== user.id ? 
                                  `<button class="btn btn-outline-danger delete-user-btn" data-userid="${user.id}" data-username="${user.username}">
                                    <i class="bi bi-trash"></i>
                                  </button>` : ''}
                              </div>
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <!-- Tab configuración -->
                <div class="tab-pane fade" id="settings-tab-pane" role="tabpanel" aria-labelledby="settings-tab" tabindex="0">
                  <h6 class="mb-3">Configuración del Sistema</h6>
                  
                  <div class="card mb-3">
                    <div class="card-header">Respaldo y Restauración</div>
                    <div class="card-body">
                      <div class="d-grid gap-2">
                        <button class="btn btn-outline-primary" id="adminExportDbBtn">
                          <i class="bi bi-download me-2"></i> Exportar base de datos
                        </button>
                        <button class="btn btn-outline-warning" id="adminImportDbBtn">
                          <i class="bi bi-upload me-2"></i> Importar base de datos
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div class="card">
                    <div class="card-header">Información del Sistema</div>
                    <div class="card-body">
                      <p><strong>Versión:</strong> 1.0.0</p>
                      <p><strong>Fecha de Compilación:</strong> ${new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Agregar modal al DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer.firstChild);
    
    // Configurar evento para crear usuario
    document.getElementById('createUserBtn').addEventListener('click', () => {
      showCreateUserModal();
    });
    
    // Configurar eventos para los botones de editar usuario
    document.querySelectorAll('.edit-user-btn').forEach(button => {
      button.addEventListener('click', () => {
        const userId = button.getAttribute('data-userid');
        const user = users.find(u => u.id === userId);
        if (user) {
          showEditUserModal(user);
        }
      });
    });
    
    // Configurar eventos para los botones de eliminar usuario
    document.querySelectorAll('.delete-user-btn').forEach(button => {
      button.addEventListener('click', () => {
        const userId = button.getAttribute('data-userid');
        const username = button.getAttribute('data-username');
        
        if (confirm(`¿Estás seguro de que deseas eliminar el usuario ${username}?`)) {
          deleteUser(userId);
        }
      });
    });
    
    // Configurar botones de exportar e importar
    document.getElementById('adminExportDbBtn').addEventListener('click', async () => {
      try {
        showAlert('info', 'Preparando exportación de la base de datos...');
        const result = await window.api.exportDatabase();
        
        if (result.success) {
          showAlert('success', `Base de datos exportada correctamente a: ${result.filePath}`);
        } else {
          showAlert('danger', result.message);
        }
      } catch (error) {
        showAlert('danger', `Error al exportar base de datos: ${error.message}`);
      }
    });
    
    document.getElementById('adminImportDbBtn').addEventListener('click', async () => {
      try {
        showAlert('info', 'Selecciona el archivo a importar...');
        const result = await window.api.importDatabase();
        
        if (result.success) {
          showAlert('success', `Base de datos importada correctamente. Clientes: ${result.stats.clients}, Instalaciones: ${result.stats.installations}`);
        } else {
          showAlert('danger', result.message);
        }
      } catch (error) {
        showAlert('danger', `Error al importar base de datos: ${error.message}`);
      }
    });
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('adminPanelModal'));
    modal.show();
    
    // Eliminar modal al cerrarse
    document.getElementById('adminPanelModal').addEventListener('hidden.bs.modal', function () {
      this.remove();
    });
  } catch (error) {
    console.error('Error al mostrar panel de administración:', error);
    showAlert('danger', 'Error al mostrar panel de administración');
  }
}

// Mostrar modal para crear un nuevo usuario
function showCreateUserModal() {
  // Crear modal
  const modalHtml = `
    <div class="modal fade" id="createUserModal" tabindex="-1" aria-labelledby="createUserModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="createUserModalLabel">Crear Nuevo Usuario</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="createUserForm">
              <div class="mb-3">
                <label for="newUsername" class="form-label">Usuario</label>
                <input type="text" class="form-control" id="newUsername" required>
              </div>
              
              <div class="mb-3">
                <label for="newName" class="form-label">Nombre</label>
                <input type="text" class="form-control" id="newName">
              </div>
              
              <div class="mb-3">
                <label for="newEmail" class="form-label">Email</label>
                <input type="email" class="form-control" id="newEmail">
              </div>
              
              <div class="mb-3">
                <label for="newPassword" class="form-label">Contraseña</label>
                <input type="password" class="form-control" id="newPassword" required>
              </div>
              
              <div class="mb-3">
                <label for="newRole" class="form-label">Rol</label>
                <select class="form-select" id="newRole">
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" id="saveNewUserBtn">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Agregar modal al DOM
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer.firstChild);
  
  // Configurar botón guardar
  document.getElementById('saveNewUserBtn').addEventListener('click', async () => {
    try {
      const username = document.getElementById('newUsername').value.trim();
      const name = document.getElementById('newName').value.trim();
      const email = document.getElementById('newEmail').value.trim();
      const password = document.getElementById('newPassword').value;
      const role = document.getElementById('newRole').value;
      
      // Validación básica
      if (!username || !password) {
        showAlert('warning', 'Usuario y contraseña son obligatorios');
        return;
      }
      
      // Crear usuario
      const result = await window.api.createUser({
        username,
        password,
        name,
        email,
        role
      });
      
      if (result.success) {
        showAlert('success', 'Usuario creado correctamente');
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('createUserModal'));
        modal.hide();
        
        // Recargar panel de administración
        document.getElementById('adminPanelModal').remove();
        showAdminPanel();
      } else {
        showAlert('danger', result.message || 'Error al crear usuario');
      }
    } catch (error) {
      console.error('Error al crear usuario:', error);
      showAlert('danger', 'Error al crear usuario');
    }
  });
  
  // Mostrar modal
  const modal = new bootstrap.Modal(document.getElementById('createUserModal'));
  modal.show();
  
  // Eliminar modal al cerrarse
  document.getElementById('createUserModal').addEventListener('hidden.bs.modal', function() {
    this.remove();
  });
}

// Mostrar modal para editar un usuario existente
function showEditUserModal(user) {
  // Crear modal
  const modalHtml = `
    <div class="modal fade" id="editUserModal" tabindex="-1" aria-labelledby="editUserModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="editUserModalLabel">Editar Usuario</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="editUserForm">
              <input type="hidden" id="editUserId" value="${user.id}">
              
              <div class="mb-3">
                <label for="editUsername" class="form-label">Usuario</label>
                <input type="text" class="form-control" id="editUsername" value="${user.username}" readonly>
              </div>
              
              <div class="mb-3">
                <label for="editName" class="form-label">Nombre</label>
                <input type="text" class="form-control" id="editName" value="${user.name || ''}">
              </div>
              
              <div class="mb-3">
                <label for="editEmail" class="form-label">Email</label>
                <input type="email" class="form-control" id="editEmail" value="${user.email || ''}">
              </div>
              
              <div class="mb-3">
                <label for="editRole" class="form-label">Rol</label>
                <select class="form-select" id="editRole">
                  <option value="user" ${user.role === 'user' ? 'selected' : ''}>Usuario</option>
                  <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador</option>
                </select>
              </div>
              
              <div class="accordion" id="editUserAccordion">
                <div class="accordion-item">
                  <h2 class="accordion-header" id="resetPasswordHeader">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#resetPasswordCollapse" aria-expanded="false" aria-controls="resetPasswordCollapse">
                      Cambiar Contraseña
                    </button>
                  </h2>
                  <div id="resetPasswordCollapse" class="accordion-collapse collapse" aria-labelledby="resetPasswordHeader" data-bs-parent="#editUserAccordion">
                    <div class="accordion-body">
                      <div class="mb-3">
                        <label for="editPassword" class="form-label">Nueva Contraseña</label>
                        <input type="password" class="form-control" id="editPassword">
                        <div class="form-text">Dejar en blanco para mantener la contraseña actual</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" id="saveEditUserBtn">Guardar Cambios</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Agregar modal al DOM
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer.firstChild);
  
  // Configurar botón guardar
  document.getElementById('saveEditUserBtn').addEventListener('click', async () => {
    try {
      const userId = document.getElementById('editUserId').value;
      const name = document.getElementById('editName').value.trim();
      const email = document.getElementById('editEmail').value.trim();
      const role = document.getElementById('editRole').value;
      const password = document.getElementById('editPassword')?.value || null;
      
      // Actualizar usuario
      const userData = { name, email, role };
      if (password) {
        userData.password = password;
      }
      
      const result = await window.api.updateUserAdmin(userId, userData);
      
      if (result.success) {
        showAlert('success', 'Usuario actualizado correctamente');
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
        modal.hide();
        
        // Recargar panel de administración
        document.getElementById('adminPanelModal').remove();
        showAdminPanel();
      } else {
        showAlert('danger', result.message || 'Error al actualizar usuario');
      }
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      showAlert('danger', 'Error al actualizar usuario');
    }
  });
  
  // Mostrar modal
  const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
  modal.show();
  
  // Eliminar modal al cerrarse
  document.getElementById('editUserModal').addEventListener('hidden.bs.modal', function() {
    this.remove();
  });
}

// Eliminar un usuario
async function deleteUser(userId) {
  try {
    const result = await window.api.deleteUser(userId);
    
    if (result.success) {
      showAlert('success', 'Usuario eliminado correctamente');
      
      // Recargar panel de administración
      document.getElementById('adminPanelModal').remove();
      showAdminPanel();
    } else {
      showAlert('danger', result.message || 'Error al eliminar usuario');
    }
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    showAlert('danger', 'Error al eliminar usuario');
  }
}
    //PROBLEMAS EN ESTA SECCIÓN ESTA DUPLICADA
});

// Iniciar la aplicación
function initApp() {
  // Inicializar componentes
  initNavigation();
  initAlerts();
  setupModalHandlers();
  
  // Cargar información del usuario
  loadUserInfo();
  
  // Cargar servicio de mantenimiento (NUEVO)
  loadMaintenanceService();
  
  // Registrar componentes y eventos de WhatsApp
  registerWhatsAppComponent();

  // Inicializar indicador de sincronización
  initSyncIndicator();
  
  // Inicializar indicador de conexión
  if (window.initConnectionStatus) {
    window.initConnectionStatus();
  }
  
  // Cargar dashboard al inicio
  loadDashboard();
  
  // Configurar manejadores de eventos
  setupNotificationHandlers();
  setupFileHandlers();
  setupUserMenu();
  
  // Configurar actualizador automático
  setupAutoUpdater();
  
  // Escuchar eventos de autenticación
  window.api.onAuthChanged((data) => {
    if (!data.isAuthenticated) {
      // Si se cierra la sesión, redirigir a login
      window.location.href = 'login.html';
    }
  });
}

// Inicializar navegación entre secciones
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const contentSections = document.querySelectorAll('.content-section');
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetSection = link.getAttribute('data-section');
      
      // Actualizar enlaces activos
      navLinks.forEach(navLink => navLink.classList.remove('active'));
      link.classList.add('active');
      
      // Mostrar sección correspondiente
      contentSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === `${targetSection}-section`) {
          section.classList.add('active');
          
          // Cargar contenido de la sección
          switch (targetSection) {
            case 'dashboard':
              loadDashboard();
              break;
            case 'clients':
              loadClients();
              break;
            case 'installations':
              loadInstallations();
              break;
            case 'maintenance':
              loadMaintenance();
              break;
            case 'notifications':
              loadNotifications();
              break;
            case 'whatsapp':
              loadWhatsAppSection();
              break;
            case 'reports':
              loadReports();
              break;
            case 'backups':
              loadBackupsSection();
              break;
            case 'updates':
              loadUpdatesSection();
              break;
            case 'azure-settings':
              loadAzureSettings();
              break;
          }
        }
      });
      
      // Guardar la sección activa para recargas
      window.currentSection = targetSection;
    });
  });
}

// Cargar script del servicio de mantenimiento (NUEVO)
function loadMaintenanceService() {
  return new Promise((resolve, reject) => {
    // Crear elemento script
    const script = document.createElement('script');
    script.src = 'components/maintenance-service.js';
    script.onload = () => {
      console.log('✅ Servicio de mantenimiento cargado correctamente');
      
      // Verificar si las notificaciones automáticas están activadas
      const autoNotifyEnabled = localStorage.getItem('autoNotifyEnabled') === 'true';
      if (autoNotifyEnabled && window.maintenanceService) {
        // Inicializar notificaciones automáticas
        window.maintenanceService.setupAutomaticNotifications();
        console.log('✅ Notificaciones automáticas de mantenimiento configuradas');
      }
      
      resolve();
    };
    script.onerror = (err) => {
      console.error('❌ Error al cargar servicio de mantenimiento:', err);
      reject(err);
    };
    
    // Agregar al DOM
    document.head.appendChild(script);
  });
}

// Inicializar sistema de alertas
function initAlerts() {
  // Escuchar eventos de alerta desde el proceso principal
  window.api.onAlert((data) => {
    showAlert(data.type, data.message);
  });
}

// Mostrar una alerta en la interfaz
function showAlert(type, message, duration = 5000) {
  const alertContainer = document.getElementById('alert-container');
  
  if (!alertContainer) {
    // Crear contenedor de alertas si no existe
    const container = document.createElement('div');
    container.id = 'alert-container';
    container.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }
  
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.role = 'alert';
  
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  const container = document.getElementById('alert-container');
  container.appendChild(alertDiv);
  
  // Cerrar automáticamente después de la duración
  setTimeout(() => {
    if (alertDiv.parentNode) {
      try {
        const bsAlert = new bootstrap.Alert(alertDiv);
        bsAlert.close();
      } catch (e) {
        // Si falla, eliminar manualmente
        alertDiv.remove();
      }
    }
  }, duration);
}

function registerWhatsAppComponent() {
  // Asegurarse de que el evento sendWhatsAppMessage está correctamente configurado
  const whatsappModal = document.getElementById('whatsappModal');
  if (whatsappModal) {
    const sendWhatsappBtn = document.getElementById('sendWhatsappBtn');
    if (sendWhatsappBtn) {
      sendWhatsappBtn.addEventListener('click', async () => {
        try {
          const phone = document.getElementById('whatsappRecipientPhone').value;
          const message = document.getElementById('whatsappMessage').value;
          
          if (!phone || !message) {
            showAlert('warning', 'El teléfono y el mensaje son obligatorios');
            return;
          }
          
          sendWhatsappBtn.disabled = true;
          sendWhatsappBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Enviando...';
          
          const result = await window.api.sendWhatsAppMessage({
            phone,
            message
          });
          
          if (result.success) {
            showAlert('success', 'Mensaje enviado correctamente');
            
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('whatsappModal'));
            if (modal) modal.hide();
          } else {
            showAlert('danger', `Error al enviar mensaje: ${result.message}`);
          }
        } catch (error) {
          console.error('Error al enviar mensaje:', error);
          showAlert('danger', `Error al enviar mensaje: ${error.message}`);
        } finally {
          sendWhatsappBtn.disabled = false;
          sendWhatsappBtn.innerHTML = '<i class="bi bi-whatsapp"></i> Enviar';
        }
      });
    }
  }
  
  // Escuchar eventos de WhatsApp
  window.api.onWhatsAppQR((qr) => {
    console.log('QR recibido de WhatsApp');
    
    // Mostrar el código QR en un modal si no estamos usando el componente React
    if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
      showWhatsAppQrModal(qr);
    }
  });
  
  window.api.onWhatsAppReady(() => {
    console.log('WhatsApp listo');
    showAlert('success', 'WhatsApp conectado correctamente');
  });
  
  window.api.onWhatsAppAuthFailure(() => {
    console.log('Error de autenticación de WhatsApp');
    showAlert('danger', 'Error de autenticación en WhatsApp');
  });
  
  window.api.onWhatsAppDisconnected(() => {
    console.log('WhatsApp desconectado');
    showAlert('warning', 'WhatsApp se ha desconectado');
  });
}

function showWhatsAppQrModal(qrData) {
  const existingModal = document.getElementById('whatsappQrModal');
  
  if (existingModal) {
    existingModal.remove();
  }
  
  // Crear modal
  const modalHtml = `
    <div class="modal fade" id="whatsappQrModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Conectar a WhatsApp Web</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body text-center">
            <p>Escanea este código QR con WhatsApp en tu teléfono:</p>
            <div id="qrcode-container" class="my-3 d-flex justify-content-center">
              <div class="bg-white p-3 rounded">
                <!-- El QR se insertará aquí -->
              </div>
            </div>
            <p class="small text-muted">Abre WhatsApp en tu teléfono > Menú > WhatsApp Web > Escanear código QR</p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Agregar modal al DOM
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = modalHtml;
  document.body.appendChild(tempDiv.firstElementChild);
  
  // Generar QR
  const qrContainer = document.getElementById('qrcode-container').querySelector('div');
  try {
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
      showAlert('danger', 'Error al generar código QR. Formato no válido.');
      return;
    }
    
    // Insertar imagen del QR
    qrContainer.innerHTML = `
      <img 
        src="${qrImageUrl}" 
        alt="WhatsApp QR Code" 
        style="width: 256px; height: 256px; display: block;"
        onerror="this.onerror=null; this.src=''; this.insertAdjacentHTML('afterend', '<div class=\\'alert alert-danger\\'>Error al cargar QR</div>');"
      />
    `;
    
    console.log('Código QR insertado en el DOM');
  } catch (error) {
    console.error("Error al generar QR:", error);
    qrContainer.innerHTML = `<div class="alert alert-danger">Error al generar QR</div>`;
  }
  
  // Mostrar modal
  const qrModal = new bootstrap.Modal(document.getElementById('whatsappQrModal'));
  qrModal.show();
}

// Inicializar indicador de estado de sincronización
function initSyncIndicator() {
  const syncIndicator = document.getElementById('sync-status-indicator');
  if (!syncIndicator) return;
  
  // Configurar estado inicial
  updateSyncIndicator('unknown');
  
  // Escuchar cambios en el estado de sincronización
  window.api.onSyncStatusChanged((data) => {
    updateSyncIndicator(data.status, data.message);
  });
  
  // Verificar estado actual de sincronización
  window.api.getSyncStatus().then(status => {
    const lastSync = status.lastSync ? new Date(status.lastSync) : null;
    const now = new Date();
    
    if (!lastSync) {
      updateSyncIndicator('never', 'Nunca sincronizado');
    } else {
      const diffHours = (now - lastSync) / (1000 * 60 * 60);
      
      if (diffHours < 1) {
        updateSyncIndicator('synced', `Última sincronización: ${formatTimeAgo(lastSync)}`);
      } else if (diffHours < 24) {
        updateSyncIndicator('warning', `Última sincronización: ${formatTimeAgo(lastSync)}`);
      } else {
        updateSyncIndicator('outdated', `Última sincronización: ${formatTimeAgo(lastSync)}`);
      }
    }
  }).catch(error => {
    console.error('Error al obtener estado de sincronización:', error);
    updateSyncIndicator('error', 'Error de sincronización');
  });
}

// Actualizar indicador de sincronización
function updateSyncIndicator(status, message = '') {
  const syncIndicator = document.getElementById('sync-status-indicator');
  if (!syncIndicator) return;
  
  const statusBadge = syncIndicator.querySelector('.badge');
  const statusText = syncIndicator.querySelector('small');
  
  if (statusBadge && statusText) {
    // Configurar según estado
    switch (status) {
      case 'in-progress':
        statusBadge.className = 'badge bg-primary me-1';
        statusBadge.textContent = 'Sincronizando';
        statusText.textContent = message || 'Sincronización en progreso...';
        break;
      case 'completed':
      case 'synced':
        statusBadge.className = 'badge bg-success me-1';
        statusBadge.textContent = 'Sincronizado';
        statusText.textContent = message || 'Datos actualizados';
        break;
      case 'error':
        statusBadge.className = 'badge bg-danger me-1';
        statusBadge.textContent = 'Error';
        statusText.textContent = message || 'Error de sincronización';
        break;
      case 'warning':
        statusBadge.className = 'badge bg-warning text-dark me-1';
        statusBadge.textContent = 'Atención';
        statusText.textContent = message || 'Sincronización pendiente';
        break;
      case 'offline':
        statusBadge.className = 'badge bg-secondary me-1';
        statusBadge.textContent = 'Offline';
        statusText.textContent = message || 'Trabajando sin conexión';
        break;
      case 'outdated':
        statusBadge.className = 'badge bg-warning text-dark me-1';
        statusBadge.textContent = 'Desactualizado';
        statusText.textContent = message || 'Sincronización necesaria';
        break;
      case 'never':
        statusBadge.className = 'badge bg-danger me-1';
        statusBadge.textContent = 'No sincronizado';
        statusText.textContent = message || 'Nunca sincronizado';
        break;
      case 'uploading':
        statusBadge.className = 'badge bg-info me-1';
        statusBadge.textContent = 'Subiendo';
        statusText.textContent = message || 'Subiendo datos...';
        break;
      case 'downloading':
        statusBadge.className = 'badge bg-info me-1';
        statusBadge.textContent = 'Descargando';
        statusText.textContent = message || 'Descargando datos...';
        break;
      default:
        statusBadge.className = 'badge bg-secondary me-1';
        statusBadge.textContent = 'Desconocido';
        statusText.textContent = message || 'Estado de sincronización desconocido';
    }
  }
}

// Formatear tiempo relativo (ej: "hace 5 minutos")
function formatTimeAgo(date) {
  if (!date) return 'Desconocido';
  
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) {
    return 'hace unos segundos';
  } else if (diffMin < 60) {
    return `hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`;
  } else if (diffHour < 24) {
    return `hace ${diffHour} ${diffHour === 1 ? 'hora' : 'horas'}`;
  } else if (diffDay < 30) {
    return `hace ${diffDay} ${diffDay === 1 ? 'día' : 'días'}`;
  } else {
    return new Date(date).toLocaleDateString();
  }
}

// Configurar manejadores para modales
function setupModalHandlers() {
  // Modal de sincronización
  window.api.onSyncStatusChanged((data) => {
    const syncModal = document.getElementById('syncModal');
    const syncModalInstance = bootstrap.Modal.getInstance(syncModal);
    const statusMessage = document.getElementById('syncStatusMessage');
    const progressBar = document.getElementById('syncProgressBar');
    
    // Si hay un cambio de estado, actualizar el modal según corresponda
    if (data.status === 'in-progress' || data.status === 'uploading' || data.status === 'downloading') {
      // Mostrar modal si no está visible
      if (!syncModalInstance) {
        const modal = new bootstrap.Modal(syncModal);
        modal.show();
      }
      
      // Actualizar mensaje
      if (statusMessage) {
        statusMessage.textContent = data.message || 'Sincronizando...';
      }
      
      // Simular progreso
      if (progressBar) {
        let currentWidth = parseInt(progressBar.style.width) || 0;
        if (currentWidth < 90) {
          progressBar.style.width = `${currentWidth + 10}%`;
          progressBar.setAttribute('aria-valuenow', currentWidth + 10);
        }
      }
    } else if (data.status === 'completed' || data.status === 'error') {
      // Completar barra de progreso
      if (progressBar) {
        progressBar.style.width = '100%';
        progressBar.setAttribute('aria-valuenow', 100);
      }
      
      // Actualizar mensaje
      if (statusMessage) {
        statusMessage.textContent = data.message || (data.status === 'completed' ? 'Sincronización completada' : 'Error en la sincronización');
      }
      
      // Cerrar modal después de un tiempo
      setTimeout(() => {
        if (syncModalInstance) {
          syncModalInstance.hide();
        }
      }, 1500);
    }
  });
}

// Configurar sistema de actualizaciones automáticas
function setupAutoUpdater() {
  // Verificar actualizaciones al iniciar
  if (window.api.checkUpdates) {
    window.api.checkUpdates().catch(error => {
      console.error('Error al verificar actualizaciones:', error);
    });
    
    // Escuchar eventos de actualización disponible
    window.api.onUpdateAvailable((updateInfo) => {
      // Mostrar notificación en el sistema
      showUpdateNotification(updateInfo);
    });
  }
}

// Mostrar notificación de actualización disponible
function showUpdateNotification(updateInfo) {
  // Crear notificación en barra superior
  const alertHtml = `
    <div class="alert alert-info alert-dismissible fade show" role="alert">
      <strong><i class="bi bi-arrow-up-circle me-1"></i> Nueva versión disponible:</strong> 
      La versión ${updateInfo.version} está lista para descargar.
      <button class="btn btn-sm btn-primary ms-2" id="goToUpdatesBtn">Ver detalles</button>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
  
  const alertContainer = document.getElementById('alert-container');
  if (alertContainer) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = alertHtml;
    alertContainer.appendChild(tempDiv.firstChild);
    
    // Configurar botón para ir a la sección de actualizaciones
    const goToUpdatesBtn = document.getElementById('goToUpdatesBtn');
    if (goToUpdatesBtn) {
      goToUpdatesBtn.addEventListener('click', () => {
        // Buscar enlace de actualización en el menú
        const updatesNavLink = document.querySelector('[data-section="updates"]');
        if (updatesNavLink) {
          updatesNavLink.click();
        }
      });
    }
  }
}

// Manejar notificaciones y otros eventos
function setupNotificationHandlers() {
  // Escuchar cuando hay mantenimientos próximos
  window.api.onMaintenanceDue((maintenanceData) => {
    // Mostrar alerta para cada mantenimiento próximo
    if (Array.isArray(maintenanceData) && maintenanceData.length > 0) {
      showAlert('warning', `Hay ${maintenanceData.length} mantenimientos próximos. Revisa la sección de mantenimientos.`);
    }
    
    // Actualizar la sección de notificaciones si está visible
    const notificationsSection = document.getElementById('notifications-section');
    if (notificationsSection && notificationsSection.classList.contains('active')) {
      loadNotifications();
    }
  });
  
  // Escuchar cuando se importa la base de datos
  window.api.onDatabaseImported(() => {
    showAlert('success', 'Base de datos importada correctamente');
    
    // Recargar la sección actual
    reloadCurrentSection();
  });
  
  // Escuchar cuando se completa una sincronización
  window.api.onSyncCompleted((data) => {
    if (data.success) {
      showAlert('success', 'Sincronización completada correctamente');
      
      // Recargar la sección actual si hubo cambios
      if (data.stats && (data.stats.sent > 0 || data.stats.received > 0)) {
        reloadCurrentSection();
      }
    }
  });
  
  // Escuchar cambios en el estado de conexión
  if (window.api.onConnectionStatusChanged) {
    window.api.onConnectionStatusChanged((status) => {
      // Mostrar alerta solo cuando se pierde o se recupera la conexión
      if (status.isOnline === false) {
        showAlert('warning', 'Se ha perdido la conexión a Internet. Trabajando en modo offline.', 3000);
      } else if (status.isOnline === true) {
        showAlert('success', 'Conexión a Internet restablecida.', 3000);
        
        // Intentar sincronizar datos cuando se recupera la conexión
        window.api.syncData().catch(error => {
          console.error('Error al sincronizar después de reconexión:', error);
        });
      }
    });
  }
}

// Recargar la sección actual
window.reloadCurrentSection = function() {
  reloadCurrentSection();
};

function reloadCurrentSection() {
  const activeSection = document.querySelector('.content-section.active');
  if (!activeSection) return;
  
  const sectionId = activeSection.id.replace('-section', '');
  
  switch (sectionId) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'clients':
      loadClients();
      break;
    case 'installations':
      loadInstallations();
      break;
    case 'maintenance':
      loadMaintenance();
      break;
    case 'whatsapp':
      loadWhatsAppSection();
      break;
    case 'reports':
      loadReports();
      break;
    case 'backups':
      loadBackupsSection();
      break;
    case 'updates':
      loadUpdatesSection();
      break;
    case 'azure-settings':
      loadAzureSettings();
      break;
  }
}

// Configurar manejadores para exportar/importar base de datos
function setupFileHandlers() {
  // Botón de sincronización manual (puede estar en cualquier parte de la interfaz)
  document.addEventListener('click', (e) => {
    if (e.target.id === 'syncNowBtn' || e.target.closest('#syncNowBtn')) {
      e.preventDefault();
      syncNow();
    }
  });
}

// Función para iniciar sincronización manual
async function syncNow() {
  try {
    // Mostrar indicador
    updateSyncIndicator('in-progress', 'Iniciando sincronización...');
    
    // Intentar sincronizar
    const result = await window.api.syncData();
    
    if (result.success) {
      showAlert('success', 'Sincronización completada correctamente');
    } else {
      showAlert('warning', `No se pudo sincronizar: ${result.message}`);
    }
  } catch (error) {
    console.error('Error al sincronizar:', error);
    showAlert('danger', `Error al sincronizar: ${error.message}`);
    updateSyncIndicator('error', 'Error de sincronización');
  }
}

// Cargar información del usuario y configurar menú
function loadUserInfo() {
  window.api.getUserInfo().then(userInfo => {
    if (!userInfo) return;
    
    // Añadir nombre de usuario y menú
    const sidebarHeader = document.querySelector('.sidebar-header');
    if (!sidebarHeader) return;
    
    // Crear menú de usuario si no existe
    if (!document.querySelector('.user-info')) {
      const userInfoHtml = `
        <div class="user-info mt-3">
          <div class="dropdown">
            <a href="#" class="d-flex align-items-center text-decoration-none dropdown-toggle text-light" id="userDropdown" data-bs-toggle="dropdown" aria-expanded="false">
              <div class="user-avatar rounded-circle bg-primary me-2 d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                <span>${userInfo.name ? userInfo.name.substring(0, 1).toUpperCase() : 'U'}</span>
              </div>
              <span class="user-name">${userInfo.name || userInfo.username || 'Usuario'}</span>
            </a>
            <ul class="dropdown-menu dropdown-menu-dark text-small shadow user-menu" aria-labelledby="userDropdown">
              <li><a class="dropdown-item" href="#" id="userProfileMenuItem"><i class="bi bi-person me-2"></i> Perfil</a></li>
              ${userInfo.role === 'admin' ? '<li><a class="dropdown-item" href="#" id="adminMenuItem"><i class="bi bi-shield-lock me-2"></i> Administración</a></li>' : ''}
              <li><hr class="dropdown-divider"></li>
              <li><a class="dropdown-item" href="#" id="syncNowMenuItem"><i class="bi bi-cloud-arrow-up-fill me-2"></i> Sincronizar ahora</a></li>
              <li><a class="dropdown-item" href="#" id="backupsMenuItem"><i class="bi bi-archive me-2"></i> Respaldos</a></li>
              <li><a class="dropdown-item" href="#" id="updatesMenuItem"><i class="bi bi-arrow-up-circle me-2"></i> Actualizaciones</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><a class="dropdown-item" href="#" id="logoutMenuItem"><i class="bi bi-box-arrow-right me-2"></i> Cerrar sesión</a></li>
            </ul>
          </div>
        </div>
      `;
      
      sidebarHeader.innerHTML += userInfoHtml;
      
      // Configurar eventos del menú
      setupUserMenu();
    }
  }).catch(error => {
    console.error('Error al cargar información del usuario:', error);
  });
}

// Configurar eventos para el menú de usuario
function setupUserMenu() {
  // Perfil de usuario
  const userProfileMenuItem = document.getElementById('userProfileMenuItem');
  if (userProfileMenuItem) {
    userProfileMenuItem.addEventListener('click', (e) => {
      e.preventDefault();
      showUserProfileModal();
    });
  }
  
  // Panel de administración (solo para admin)
  const adminMenuItem = document.getElementById('adminMenuItem');
  if (adminMenuItem) {
    adminMenuItem.addEventListener('click', (e) => {
      e.preventDefault();
      showAdminPanel();
    });
  }
  
  // Sincronización manual
  const syncNowMenuItem = document.getElementById('syncNowMenuItem');
  if (syncNowMenuItem) {
    syncNowMenuItem.addEventListener('click', (e) => {
      e.preventDefault();
      syncNow();
    });
  }
  
  // Ir a respaldos
  const backupsMenuItem = document.getElementById('backupsMenuItem');
  if (backupsMenuItem) {
    backupsMenuItem.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Buscar enlace de respaldos en el menú
      const backupsNavLink = document.querySelector('[data-section="backups"]');
      if (backupsNavLink) {
        backupsNavLink.click();
      }
    });
  }
  
  // Ir a actualizaciones
  const updatesMenuItem = document.getElementById('updatesMenuItem');
  if (updatesMenuItem) {
    updatesMenuItem.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Buscar enlace de actualizaciones en el menú
      const updatesNavLink = document.querySelector('[data-section="updates"]');
      if (updatesNavLink) {
        updatesNavLink.click();
      }
    });
  }
  
  // Cerrar sesión
  const logoutMenuItem = document.getElementById('logoutMenuItem');
  if (logoutMenuItem) {
    logoutMenuItem.addEventListener('click', async (e) => {
      e.preventDefault();
      
      if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        try {
          await window.api.logout();
          // La redirección se maneja a través del evento onAuthChanged
        } catch (error) {
          showAlert('danger', `Error al cerrar sesión: ${error.message}`);
        }
      }
    });
  }
}

// Mostrar modal de perfil de usuario
async function showUserProfileModal() {
  try {
    // Obtener información del usuario
    const userInfo = await window.api.getUserInfo();
    if (!userInfo) {
      showAlert('warning', 'No se pudo obtener información del usuario');
      return;
    }
    
    // Crear modal
    const modalHtml = `
      <div class="modal fade" id="userProfileModal" tabindex="-1" aria-labelledby="userProfileModalLabel" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="userProfileModalLabel">Perfil de Usuario</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <form id="userProfileForm">
                <div class="mb-3">
                  <label for="profileUsername" class="form-label">Usuario</label>
                  <input type="text" class="form-control" id="profileUsername" value="${userInfo.username || ''}" readonly>
                </div>
                
                <div class="mb-3">
                  <label for="profileName" class="form-label">Nombre</label>
                  <input type="text" class="form-control" id="profileName" value="${userInfo.name || ''}">
                </div>
                
                <div class="mb-3">
                  <label for="profileEmail" class="form-label">Email</label>
                  <input type="email" class="form-control" id="profileEmail" value="${userInfo.email || ''}">
                </div>
                
                <div class="mb-3">
                  <label for="profileRole" class="form-label">Rol</label>
                  <input type="text" class="form-control" id="profileRole" value="${userInfo.role || 'Usuario'}" readonly>
                </div>
              </form>
              
              <div class="accordion mt-4" id="profileAccordion">
                <div class="accordion-item">
                  <h2 class="accordion-header" id="changePasswordHeader">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#changePasswordCollapse" aria-expanded="false" aria-controls="changePasswordCollapse">
                      Cambiar Contraseña
                    </button>
                  </h2>
                  <div id="changePasswordCollapse" class="accordion-collapse collapse" aria-labelledby="changePasswordHeader" data-bs-parent="#profileAccordion">
                    <div class="accordion-body">
                      <form id="changePasswordForm">
                        <div class="mb-3">
                          <label for="currentPassword" class="form-label">Contraseña Actual</label>
                          <input type="password" class="form-control" id="currentPassword" required>
                        </div>
                        
                        <div class="mb-3">
                          <label for="newPassword" class="form-label">Nueva Contraseña</label>
                          <input type="password" class="form-control" id="newPassword" required>
                        </div>
                        
                        <div class="mb-3">
                          <label for="confirmPassword" class="form-label">Confirmar Contraseña</label>
                          <input type="password" class="form-control" id="confirmPassword" required>
                        </div>
                        
                        <button type="submit" class="btn btn-primary">Cambiar Contraseña</button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-primary" id="saveProfileBtn">Guardar Cambios</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Agregar modal al DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer.firstChild);
    
    // Configurar envío del formulario de cambio de contraseña
    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      // Validar contraseñas
      if (newPassword !== confirmPassword) {
        showAlert('danger', 'Las contraseñas no coinciden');
        return;
      }
      
      try {
        const result = await window.api.changePassword({
          currentPassword,
          newPassword
        });
        
        if (result.success) {
          showAlert('success', 'Contraseña actualizada correctamente');
          document.getElementById('changePasswordForm').reset();
          
          // Cerrar el collapse
          const collapse = bootstrap.Collapse.getInstance(document.getElementById('changePasswordCollapse'));
          if (collapse) {
            collapse.hide();
          }
        } else {
          showAlert('danger', result.message || 'Error al cambiar contraseña');
        }
      } catch (error) {
        showAlert('danger', 'Error al cambiar contraseña');
      }
    });
    
    // Configurar botón guardar cambios del perfil
    document.getElementById('saveProfileBtn').addEventListener('click', async () => {
      const name = document.getElementById('profileName').value;
      const email = document.getElementById('profileEmail').value;
      
      try {
        const result = await window.api.updateUser({
          name,
          email
        });
        
        if (result.success) {
          showAlert('success', 'Perfil actualizado correctamente');
          
          // Actualizar el nombre mostrado en el menú
          const userNameElement = document.querySelector('.user-name');
          if (userNameElement) {
            userNameElement.textContent = result.user.name || result.user.username;
          }
          
          // Actualizar la inicial en el avatar
          const userAvatarElement = document.querySelector('.user-avatar span');
          if (userAvatarElement && result.user.name) {
            userAvatarElement.textContent = result.user.name.substring(0, 1).toUpperCase();
          }
          
          // Cerrar modal
          const modal = bootstrap.Modal.getInstance(document.getElementById('userProfileModal'));
          modal.hide();
        } else {
          showAlert('danger', result.message || 'Error al actualizar perfil');
        }
      } catch (error) {
        showAlert('danger', 'Error al actualizar perfil');
      }
    });
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('userProfileModal'));
    modal.show();
    
    // Eliminar modal al cerrarse
    document.getElementById('userProfileModal').addEventListener('hidden.bs.modal', function() {
      this.remove();
    });
  } catch (error) {
    console.error('Error al mostrar modal de perfil:', error);
    showAlert('danger', 'Error al mostrar perfil de usuario');
  }
}