/**
 * Carga la sección de configuración de Azure
 */
async function loadAzureSettings() {
    const azureSettingsSection = document.getElementById('azure-settings-section');
    
    try {
      // Obtener configuración actual de Azure
      const azureConfig = await window.api.getAzureConfig();
      const connectionStatus = await window.api.checkAzureConnection();
      
      // Preparar HTML para la sección
      azureSettingsSection.innerHTML = `
        <h2 class="mb-4">Configuración de Azure</h2>
        
        <div class="alert ${connectionStatus.success ? 'alert-success' : 'alert-warning'} mb-4">
          <h5><i class="bi ${connectionStatus.success ? 'bi-cloud-check' : 'bi-cloud-slash'}"></i> 
            Estado de conexión: ${connectionStatus.success ? 'Conectado' : 'Desconectado'}</h5>
          <p>${connectionStatus.message}</p>
          ${connectionStatus.success ? 
            `<p class="mb-0"><small>Última sincronización exitosa: ${formatDateTime(azureConfig.lastSync)}</small></p>` : ''}
        </div>
        
        <div class="card mb-4">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Configuración de conexión</h5>
            <button id="testConnectionBtn" class="btn btn-sm btn-outline-primary">
              <i class="bi bi-speedometer2"></i> Probar Conexión
            </button>
          </div>
          <div class="card-body">
            <form id="azureConfigForm">
              <div class="mb-3">
                <label for="connectionString" class="form-label">Cadena de conexión de Azure Storage</label>
                <div class="input-group">
                  <input type="password" class="form-control" id="connectionString" 
                         value="${azureConfig.connectionString || ''}" 
                         placeholder="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net">
                  <button class="btn btn-outline-secondary toggle-password" type="button" data-target="connectionString">
                    <i class="bi bi-eye"></i>
                  </button>
                </div>
                <div class="form-text">La cadena de conexión se encuentra en el portal de Azure, en la sección "Claves de acceso" de tu cuenta de almacenamiento.</div>
              </div>
              
              <div class="mb-3">
                <label for="containerName" class="form-label">Nombre del contenedor</label>
                <input type="text" class="form-control" id="containerName" 
                       value="${azureConfig.containerName || 'servitecgas-data'}" 
                       placeholder="servitecgas-data">
              </div>
              
              <div class="mb-3">
                <label for="tableName" class="form-label">Nombre de la tabla para logs</label>
                <input type="text" class="form-control" id="tableName" 
                       value="${azureConfig.tableName || 'servitecgassynclog'}" 
                       placeholder="servitecgassynclog">
              </div>
              
              <div class="mb-3">
                <label for="maxRetries" class="form-label">Número máximo de reintentos</label>
                <input type="number" class="form-control" id="maxRetries" min="1" max="10"
                       value="${azureConfig.maxRetries || 3}">
              </div>
              
              <div class="mb-3">
                <label for="syncIntervalMinutes" class="form-label">Intervalo de sincronización automática (minutos)</label>
                <input type="number" class="form-control" id="syncIntervalMinutes" min="5" max="1440"
                       value="${azureConfig.syncIntervalMinutes || 10}">
              </div>
            </form>
            
            <div class="d-grid gap-2 d-md-flex justify-content-md-end">
              <button class="btn btn-primary" id="saveAzureConfigBtn">
                <i class="bi bi-save"></i> Guardar Configuración
              </button>
            </div>
          </div>
        </div>
        
        <div class="card mb-4">
          <div class="card-header">
            <h5 class="mb-0">Sincronización de datos</h5>
          </div>
          <div class="card-body">
            <p>Gestiona la sincronización de tus datos con Azure. Puedes sincronizar manualmente o configurar la sincronización automática.</p>
            
            <div class="d-flex mb-3 gap-2">
              <button id="syncNowBtn" class="btn btn-primary">
                <i class="bi bi-cloud-upload"></i> Sincronizar Ahora
              </button>
              
              <button id="forceDownloadBtn" class="btn btn-outline-warning">
                <i class="bi bi-cloud-download"></i> Forzar Descarga
              </button>
              
              <button id="forceUploadBtn" class="btn btn-outline-secondary">
                <i class="bi bi-cloud-arrow-up"></i> Forzar Subida
              </button>
            </div>
            
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="enableAutoSync" 
                     ${azureConfig.autoSyncEnabled ? 'checked' : ''}>
              <label class="form-check-label" for="enableAutoSync">
                Habilitar sincronización automática
              </label>
            </div>
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Resolución de problemas</h5>
          </div>
          <div class="card-body">
            <div class="mb-3">
              <p>Si estás experimentando problemas con la sincronización, intenta estas soluciones:</p>
              <ol>
                <li>Verifica que la cadena de conexión sea correcta</li>
                <li>Asegúrate de que tienes conexión a Internet</li>
                <li>Comprueba que el contenedor y la tabla existen en tu cuenta de Azure</li>
                <li>Reinicia la aplicación después de guardar la configuración</li>
              </ol>
            </div>
            
            <div class="d-grid gap-2">
              <button id="resetSyncBtn" class="btn btn-outline-danger">
                <i class="bi bi-arrow-counterclockwise"></i> Restablecer estado de sincronización
              </button>
            </div>
          </div>
        </div>
      `;
      
      // Configurar eventos
      setupAzureSettingsEvents();
      
    } catch (error) {
      console.error('Error al cargar configuración de Azure:', error);
      azureSettingsSection.innerHTML = `
        <div class="alert alert-danger">
          <h4>Error al cargar la configuración de Azure</h4>
          <p>${error.message || 'Error desconocido'}</p>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Configuración de Azure</h5>
          </div>
          <div class="card-body">
            <p>No se pudo cargar la configuración actual. Intenta lo siguiente:</p>
            
            <form id="azureConfigForm">
              <div class="mb-3">
                <label for="connectionString" class="form-label">Cadena de conexión de Azure Storage</label>
                <div class="input-group">
                  <input type="password" class="form-control" id="connectionString" 
                         placeholder="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net">
                  <button class="btn btn-outline-secondary toggle-password" type="button" data-target="connectionString">
                    <i class="bi bi-eye"></i>
                  </button>
                </div>
              </div>
              
              <div class="mb-3">
                <label for="containerName" class="form-label">Nombre del contenedor</label>
                <input type="text" class="form-control" id="containerName" 
                       value="servitecgas-data" 
                       placeholder="servitecgas-data">
              </div>
              
              <div class="mb-3">
                <label for="tableName" class="form-label">Nombre de la tabla para logs</label>
                <input type="text" class="form-control" id="tableName" 
                       value="servitecgassynclog" 
                       placeholder="servitecgassynclog">
              </div>
            </form>
            
            <div class="d-grid gap-2">
              <button class="btn btn-primary" id="saveAzureConfigBtn">
                <i class="bi bi-save"></i> Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      `;
      
      // Configurar eventos básicos
      setupBasicAzureEvents();
    }
  }
  
  /**
   * Configura los eventos para la sección de Azure Settings
   */
  function setupAzureSettingsEvents() {
    // Configurar botones para mostrar/ocultar contraseñas
    const toggleButtons = document.querySelectorAll('.toggle-password');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const inputField = document.getElementById(targetId);
        
        if (inputField.type === 'password') {
          inputField.type = 'text';
          btn.innerHTML = '<i class="bi bi-eye-slash"></i>';
        } else {
          inputField.type = 'password';
          btn.innerHTML = '<i class="bi bi-eye"></i>';
        }
      });
    });
    
    // Botón para guardar configuración
    const saveBtn = document.getElementById('saveAzureConfigBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        try {
          const newConfig = {
            connectionString: document.getElementById('connectionString').value,
            containerName: document.getElementById('containerName').value,
            tableName: document.getElementById('tableName').value,
            maxRetries: parseInt(document.getElementById('maxRetries').value) || 3,
            syncIntervalMinutes: parseInt(document.getElementById('syncIntervalMinutes').value) || 10,
            autoSyncEnabled: document.getElementById('enableAutoSync')?.checked || false
          };
          
          saveBtn.disabled = true;
          saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';
          
          const result = await window.api.updateAzureConfig(newConfig);
          
          if (result.success) {
            showAlert('success', 'Configuración de Azure guardada correctamente');
          } else {
            showAlert('danger', `Error al guardar configuración: ${result.message}`);
          }
        } catch (error) {
          console.error('Error al guardar configuración de Azure:', error);
          showAlert('danger', `Error al guardar configuración: ${error.message || 'Error desconocido'}`);
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="bi bi-save"></i> Guardar Configuración';
        }
      });
    }
    
    // Botón para probar conexión
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    if (testConnectionBtn) {
      testConnectionBtn.addEventListener('click', async () => {
        try {
          testConnectionBtn.disabled = true;
          testConnectionBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Probando...';
          
          const result = await window.api.checkAzureConnection();
          
          if (result.success) {
            showAlert('success', `Conexión exitosa: ${result.message}`);
          } else {
            showAlert('warning', `No se pudo conectar: ${result.message}`);
          }
        } catch (error) {
          console.error('Error al probar conexión con Azure:', error);
          showAlert('danger', `Error al probar conexión: ${error.message || 'Error desconocido'}`);
        } finally {
          testConnectionBtn.disabled = false;
          testConnectionBtn.innerHTML = '<i class="bi bi-speedometer2"></i> Probar Conexión';
        }
      });
    }
    
    // Botón para sincronizar ahora
    const syncNowBtn = document.getElementById('syncNowBtn');
    if (syncNowBtn) {
      syncNowBtn.addEventListener('click', async () => {
        try {
          syncNowBtn.disabled = true;
          syncNowBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Sincronizando...';
          
          const result = await window.api.syncData();
          
          if (result.success) {
            showAlert('success', `Sincronización completada: ${result.message}`);
            
            // Actualizar la interfaz para mostrar la última sincronización
            loadAzureSettings();
          } else {
            showAlert('warning', `Sincronización no completada: ${result.message}`);
          }
        } catch (error) {
          console.error('Error al sincronizar con Azure:', error);
          showAlert('danger', `Error al sincronizar: ${error.message || 'Error desconocido'}`);
        } finally {
          syncNowBtn.disabled = false;
          syncNowBtn.innerHTML = '<i class="bi bi-cloud-upload"></i> Sincronizar Ahora';
        }
      });
    }
    
    // Botón para forzar descarga
    const forceDownloadBtn = document.getElementById('forceDownloadBtn');
    if (forceDownloadBtn) {
      forceDownloadBtn.addEventListener('click', async () => {
        if (confirm('¿Estás seguro de que deseas forzar la descarga desde Azure? Esto sobrescribirá los datos locales.')) {
          try {
            forceDownloadBtn.disabled = true;
            forceDownloadBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Descargando...';
            
            const result = await window.api.forceDownloadFromAzure();
            
            if (result.success) {
              showAlert('success', `Descarga completada: ${result.message}`);
              
              // Notificar a la interfaz para que se actualice
              if (window.reloadCurrentSection) {
                window.reloadCurrentSection();
              }
            } else {
              showAlert('warning', `Descarga no completada: ${result.message}`);
            }
          } catch (error) {
            console.error('Error al descargar de Azure:', error);
            showAlert('danger', `Error al descargar: ${error.message || 'Error desconocido'}`);
          } finally {
            forceDownloadBtn.disabled = false;
            forceDownloadBtn.innerHTML = '<i class="bi bi-cloud-download"></i> Forzar Descarga';
          }
        }
      });
    }
    
    // Botón para forzar subida
    const forceUploadBtn = document.getElementById('forceUploadBtn');
    if (forceUploadBtn) {
      forceUploadBtn.addEventListener('click', async () => {
        if (confirm('¿Estás seguro de que deseas forzar la subida a Azure? Esto sobrescribirá los datos en la nube.')) {
          try {
            forceUploadBtn.disabled = true;
            forceUploadBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Subiendo...';
            
            const result = await window.api.forceUploadToAzure();
            
            if (result.success) {
              showAlert('success', `Subida completada: ${result.message}`);
            } else {
              showAlert('warning', `Subida no completada: ${result.message}`);
            }
          } catch (error) {
            console.error('Error al subir a Azure:', error);
            showAlert('danger', `Error al subir: ${error.message || 'Error desconocido'}`);
          } finally {
            forceUploadBtn.disabled = false;
            forceUploadBtn.innerHTML = '<i class="bi bi-cloud-arrow-up"></i> Forzar Subida';
          }
        }
      });
    }
    
    // Interruptor de sincronización automática
    const autoSyncSwitch = document.getElementById('enableAutoSync');
    if (autoSyncSwitch) {
      autoSyncSwitch.addEventListener('change', async () => {
        try {
          const result = await window.api.setAutoSync(autoSyncSwitch.checked);
          
          if (!result.success) {
            showAlert('warning', `No se pudo ${autoSyncSwitch.checked ? 'habilitar' : 'deshabilitar'} la sincronización automática: ${result.message}`);
            // Revertir el cambio en la interfaz si hay error
            autoSyncSwitch.checked = !autoSyncSwitch.checked;
          }
        } catch (error) {
          console.error('Error al cambiar configuración de sincronización automática:', error);
          showAlert('danger', `Error: ${error.message || 'Error desconocido'}`);
          // Revertir el cambio en la interfaz
          autoSyncSwitch.checked = !autoSyncSwitch.checked;
        }
      });
    }
    
    // Botón para restablecer estado de sincronización
    const resetSyncBtn = document.getElementById('resetSyncBtn');
    if (resetSyncBtn) {
      resetSyncBtn.addEventListener('click', async () => {
        if (confirm('¿Estás seguro de que deseas restablecer el estado de sincronización? Esto eliminará el registro de la última sincronización.')) {
          try {
            resetSyncBtn.disabled = true;
            
            const result = await window.api.resetSyncState();
            
            if (result.success) {
              showAlert('success', 'Estado de sincronización restablecido correctamente');
              loadAzureSettings();
            } else {
              showAlert('warning', `No se pudo restablecer el estado: ${result.message}`);
            }
          } catch (error) {
            console.error('Error al restablecer estado de sincronización:', error);
            showAlert('danger', `Error: ${error.message || 'Error desconocido'}`);
          } finally {
            resetSyncBtn.disabled = false;
          }
        }
      });
    }
  }
  
  /**
   * Configura eventos básicos para el formulario de Azure en caso de error
   */
  function setupBasicAzureEvents() {
    // Configurar botones para mostrar/ocultar contraseñas
    const toggleButtons = document.querySelectorAll('.toggle-password');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const inputField = document.getElementById(targetId);
        
        if (inputField.type === 'password') {
          inputField.type = 'text';
          btn.innerHTML = '<i class="bi bi-eye-slash"></i>';
        } else {
          inputField.type = 'password';
          btn.innerHTML = '<i class="bi bi-eye"></i>';
        }
      });
    });
    
    // Botón para guardar configuración
    const saveBtn = document.getElementById('saveAzureConfigBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        try {
          const newConfig = {
            connectionString: document.getElementById('connectionString').value,
            containerName: document.getElementById('containerName').value,
            tableName: document.getElementById('tableName').value,
            maxRetries: 3,
            syncIntervalMinutes: 10,
            autoSyncEnabled: false
          };
          
          saveBtn.disabled = true;
          saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';
          
          const result = await window.api.updateAzureConfig(newConfig);
          
          if (result.success) {
            showAlert('success', 'Configuración de Azure guardada correctamente');
            // Recargar la sección
            loadAzureSettings();
          } else {
            showAlert('danger', `Error al guardar configuración: ${result.message}`);
          }
        } catch (error) {
          console.error('Error al guardar configuración de Azure:', error);
          showAlert('danger', `Error al guardar configuración: ${error.message || 'Error desconocido'}`);
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="bi bi-save"></i> Guardar Configuración';
        }
      });
    }
  }
  
  /**
   * Formatea una fecha ISO como fecha y hora legible
   * @param {string} isoString - Fecha en formato ISO
   * @returns {string} - Fecha formateada
   */
  function formatDateTime(isoString) {
    if (!isoString) return 'Nunca';
    
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch (error) {
      return isoString || 'Fecha desconocida';
    }
  }
  
  // Exportar función para cargar la sección
  window.loadAzureSettings = loadAzureSettings;