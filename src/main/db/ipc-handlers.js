const { recordChange, generateId } = require('./store');
const { checkUpcomingMaintenance, calculateNextMaintenanceDate } = require('../services/maintenance');
const { sendWhatsAppMessage } = require('../services/whatsapp');

/**
 * Configura los manejadores IPC para operaciones de base de datos
 * @param {IpcMain} ipcMain - Instancia de ipcMain
 * @param {Store} store - Instancia de la base de datos
 */
module.exports = function setupIpcHandlers(ipcMain, store) {
  // <--Clientes-->
  
  // Obtener todos los clientes
  ipcMain.handle('get-clients', () => {
    return store.get('clients') || [];
  });

  // Agregar un cliente
  ipcMain.handle('add-client', (event, client) => {
    try {
      // Verificar autenticación
      if (!authService.checkAuth().isAuthenticated) {
        return { success: false, message: 'No autenticado' };
      }
      
      const clients = store.get('clients') || [];
      
      // Crear una versión limpia del cliente que solo contenga datos serializables
      const cleanClient = {
        id: client.id || uuidv4(),
        name: client.name || '',
        phone: client.phone || '',
        email: client.email || '',
        notes: client.notes || '',
        // Añade otras propiedades que necesites
        createdAt: new Date().toISOString(),
        createdBy: authService.getCurrentUser().id,
        lastModified: new Date().toISOString()
      };
      
      const updatedClients = [...clients, cleanClient];
      store.set('clients', updatedClients);
      
      return cleanClient;
    } catch (error) {
      console.error('Error al añadir cliente:', error);
      return { success: false, message: `Error al guardar cliente: ${error.message}` };
    }
  });

  // Actualizar un cliente
  ipcMain.handle('update-client', (event, client) => {
    const clients = store.get('clients') || [];
    const index = clients.findIndex(c => c.id === client.id);
    
    if (index !== -1) {
      const updatedClient = {
        ...clients[index],
        ...client,
        lastModified: new Date().toISOString(),
        syncStatus: 'pending'
      };
      
      clients[index] = updatedClient;
      store.set('clients', clients);
      
      // Registrar cambio para sincronización
      recordChange('client', 'update', updatedClient.id, updatedClient);
      
      return updatedClient;
    }
    
    return null;
  });

  // Eliminar un cliente
  ipcMain.handle('delete-client', (event, clientId) => {
    const clients = store.get('clients') || [];
    const clientToDelete = clients.find(c => c.id === clientId);
    
    if (!clientToDelete) {
      return { success: false, message: 'Cliente no encontrado' };
    }
    
    const newClients = clients.filter(c => c.id !== clientId);
    store.set('clients', newClients);
    
    // También eliminar las instalaciones asociadas
    const installations = store.get('installations') || [];
    const installationsToDelete = installations.filter(i => i.clientId === clientId);
    const newInstallations = installations.filter(i => i.clientId !== clientId);
    store.set('installations', newInstallations);
    
    // Registrar cambio del cliente para sincronización
    recordChange('client', 'delete', clientId, clientToDelete);
    
    // Registrar cambios de instalaciones eliminadas para sincronización
    installationsToDelete.forEach(installation => {
      recordChange('installation', 'delete', installation.id, installation);
    });
    
    return { success: true };
  });

  // ============================================================
  // Instalaciones
  // ============================================================
  
  // Obtener todas las instalaciones
  ipcMain.handle('get-installations', () => {
    return store.get('installations') || [];
  });

  // Agregar una instalación
  ipcMain.handle('add-installation', (event, installation) => {
    const installations = store.get('installations') || [];
    
    // Asignar IDs a componentes si no los tienen
    const components = installation.components?.map(component => ({
      ...component,
      id: component.id || generateId()
    })) || [];
    
    const newInstallation = {
      ...installation,
      id: installation.id || generateId(),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      syncStatus: 'pending',
      components
    };
    
    const updatedInstallations = [...installations, newInstallation];
    store.set('installations', updatedInstallations);
    
    // Registrar cambio para sincronización
    recordChange('installation', 'create', newInstallation.id, newInstallation);
    
    return newInstallation;
  });

  // Actualizar una instalación
  ipcMain.handle('update-installation', (event, installation) => {
    const installations = store.get('installations') || [];
    const index = installations.findIndex(i => i.id === installation.id);
    
    if (index !== -1) {
      // Asegurarse de que los componentes tengan IDs
      const components = installation.components?.map(component => ({
        ...component,
        id: component.id || generateId()
      })) || [];
      
      const updatedInstallation = {
        ...installations[index],
        ...installation,
        components,
        lastModified: new Date().toISOString(),
        syncStatus: 'pending'
      };
      
      installations[index] = updatedInstallation;
      store.set('installations', installations);
      
      // Registrar cambio para sincronización
      recordChange('installation', 'update', updatedInstallation.id, updatedInstallation);
      
      return updatedInstallation;
    }
    
    return null;
  });

  // Eliminar una instalación
  ipcMain.handle('delete-installation', (event, installationId) => {
    const installations = store.get('installations') || [];
    const installationToDelete = installations.find(i => i.id === installationId);
    
    if (!installationToDelete) {
      return { success: false, message: 'Instalación no encontrada' };
    }
    
    const newInstallations = installations.filter(i => i.id !== installationId);
    store.set('installations', newInstallations);
    
    // Registrar cambio para sincronización
    recordChange('installation', 'delete', installationId, installationToDelete);
    
    return { success: true };
  });

  // ============================================================
  // Mantenimiento
  // ============================================================
  
  // Obtener mantenimientos próximos
  ipcMain.handle('get-upcoming-maintenance', () => {
    return checkUpcomingMaintenance(store, 30); // Próximos 30 días
  });

  // Registrar un mantenimiento completado
  ipcMain.handle('register-maintenance', (event, { installationId, componentId, maintenanceDate, notes }) => {
    const installations = store.get('installations') || [];
    const installationIndex = installations.findIndex(i => i.id === installationId);
    
    if (installationIndex === -1) {
      return { success: false, message: 'Instalación no encontrada' };
    }
    
    const installation = installations[installationIndex];
    
    if (!installation.components) {
      return { success: false, message: 'La instalación no tiene componentes' };
    }
    
    const componentIndex = installation.components.findIndex(c => c.id === componentId);
    
    if (componentIndex === -1) {
      return { success: false, message: 'Componente no encontrado' };
    }
    
    // Actualizar fechas de mantenimiento
    const component = installation.components[componentIndex];
    const lastMaintenanceDate = maintenanceDate || new Date().toISOString().split('T')[0];
    const frequency = component.frequency || 12; // Frecuencia en meses
    
    const updatedComponent = {
      ...component,
      lastMaintenanceDate,
      nextMaintenanceDate: calculateNextMaintenanceDate(lastMaintenanceDate, frequency),
      maintenanceNotes: notes ? [...(component.maintenanceNotes || []), {
        date: lastMaintenanceDate,
        notes,
        technician: 'Usuario actual' // En una implementación real, se tomaría del usuario autenticado
      }] : component.maintenanceNotes
    };
    
    // Actualizar componente en la instalación
    installation.components[componentIndex] = updatedComponent;
    
    // Actualizar instalación
    installations[installationIndex] = {
      ...installation,
      lastModified: new Date().toISOString(),
      syncStatus: 'pending'
    };
    
    store.set('installations', installations);
    
    // Registrar cambio para sincronización
    recordChange('installation', 'update', installation.id, installations[installationIndex]);
    
    return { 
      success: true,
      installation: installations[installationIndex],
      component: updatedComponent
    };
  });

  // Calcular la fecha del próximo mantenimiento
  ipcMain.handle('calculate-next-maintenance', (event, { lastMaintenanceDate, frequency }) => {
    return calculateNextMaintenanceDate(lastMaintenanceDate, frequency);
  });

  // ============================================================
  // WhatsApp
  // ============================================================
  
  // Enviar mensaje de WhatsApp
  ipcMain.handle('send-whatsapp-message', async (event, messageData) => {
    try {
      // Si es una solicitud de conexión, iniciar el proceso de autenticación
      if (messageData.action === 'connect') {
        return { success: true, message: 'Iniciando conexión con WhatsApp' };
      }
      
      // Si es un mensaje normal, enviarlo
      const result = await sendWhatsAppMessage(messageData.phone, messageData.message);
      return result;
    } catch (error) {
      console.error('Error al enviar mensaje de WhatsApp:', error);
      return { 
        success: false, 
        message: error.message 
      };
    }
  });

  // ============================================================
  // Utilidades
  // ============================================================
  
  // Generar ID único
  ipcMain.handle('generate-id', () => {
    return generateId();
  });
  
  // Formatear fecha
  ipcMain.handle('format-date', (event, dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (error) {
      console.error('Error al formatear fecha:', error);
      return dateString;
    }
  });

  // ============================================================
  // Historial de mantenimientos
  // ============================================================
  
  // Obtener historial de mantenimientos
  ipcMain.handle('get-maintenance-history', (event, filters = {}) => {
    const installations = store.get('installations') || [];
    const clients = store.get('clients') || [];
    const maintenanceHistory = [];
    
    // Recopilar registro histórico de mantenimientos
    installations.forEach(installation => {
      if (!installation.components) return;
      
      const client = clients.find(c => c.id === installation.clientId) || { 
        name: 'Cliente desconocido',
        id: installation.clientId
      };
      
      installation.components.forEach(component => {
        // Solo considerar componentes con fecha de último mantenimiento
        if (component.lastMaintenanceDate) {
          // Verificar si cumple con los filtros
          let includeRecord = true;
          
          if (filters.startDate) {
            const startDate = new Date(filters.startDate);
            const maintenanceDate = new Date(component.lastMaintenanceDate);
            if (maintenanceDate < startDate) {
              includeRecord = false;
            }
          }
          
          if (includeRecord && filters.endDate) {
            const endDate = new Date(filters.endDate);
            const maintenanceDate = new Date(component.lastMaintenanceDate);
            if (maintenanceDate > endDate) {
              includeRecord = false;
            }
          }
          
          if (includeRecord && filters.clientId) {
            if (installation.clientId !== filters.clientId) {
              includeRecord = false;
            }
          }
          
          if (includeRecord && filters.installationType) {
            if (installation.type !== filters.installationType) {
              includeRecord = false;
            }
          }
          
          if (includeRecord) {
            // Revisar el historial de notas si existe
            const maintenanceNotes = component.maintenanceNotes || [];
            
            // Si no hay notas específicas, crear un registro basado en la última fecha
            if (maintenanceNotes.length === 0) {
              maintenanceHistory.push({
                maintenanceDate: component.lastMaintenanceDate,
                nextMaintenanceDate: component.nextMaintenanceDate,
                clientId: installation.clientId,
                clientName: client.name,
                installationId: installation.id,
                installationType: installation.type || 'No especificado',
                installationAddress: installation.address,
                componentId: component.id,
                componentName: component.name,
                componentModel: component.model || '',
                frequency: component.frequency || 12,
                notes: '',
                technician: 'No especificado'
              });
            } else {
              // Si hay notas específicas, crear un registro para cada nota
              maintenanceNotes.forEach(note => {
                maintenanceHistory.push({
                  maintenanceDate: note.date || component.lastMaintenanceDate,
                  nextMaintenanceDate: component.nextMaintenanceDate,
                  clientId: installation.clientId,
                  clientName: client.name,
                  installationId: installation.id,
                  installationType: installation.type || 'No especificado',
                  installationAddress: installation.address,
                  componentId: component.id,
                  componentName: component.name,
                  componentModel: component.model || '',
                  frequency: component.frequency || 12,
                  notes: note.notes || '',
                  technician: note.technician || 'No especificado'
                });
              });
            }
          }
        }
      });
    });
    
    // Ordenar por fecha de mantenimiento (más recientes primero)
    return maintenanceHistory.sort((a, b) => new Date(b.maintenanceDate) - new Date(a.maintenanceDate));
  });

  // ============================================================
  // Reportes
  // ============================================================
  
  // Generar reporte
  ipcMain.handle('generate-report', async (event, { reportType, options }) => {
    try {
      // Esta es una implementación simulada
      // En una implementación real, aquí generarías el reporte y guardarías el archivo
      
      return {
        success: true,
        message: `Reporte ${reportType} generado correctamente`,
        details: {
          type: reportType,
          options: options,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error al generar reporte:', error);
      return {
        success: false,
        message: `Error al generar reporte: ${error.message}`
      };
    }
  });

  // ============================================================
  // Exportar/Importar datos
  // ============================================================
  
  // Exportar datos
  ipcMain.handle('export-data', async (event, { dataType, format }) => {
    try {
      // Esta es una implementación simulada
      // En una implementación real, generarías y guardarías el archivo
      
      let data;
      switch (dataType) {
        case 'clients':
          data = store.get('clients') || [];
          break;
        case 'installations':
          data = store.get('installations') || [];
          break;
        case 'maintenance':
          // Obtener datos de mantenimientos
          const installations = store.get('installations') || [];
          data = [];
          installations.forEach(installation => {
            if (installation.components) {
              installation.components.forEach(component => {
                if (component.nextMaintenanceDate) {
                  data.push({
                    installationId: installation.id,
                    address: installation.address,
                    componentId: component.id,
                    componentName: component.name,
                    lastMaintenanceDate: component.lastMaintenanceDate,
                    nextMaintenanceDate: component.nextMaintenanceDate,
                    frequency: component.frequency
                  });
                }
              });
            }
          });
          break;
        case 'all':
        default:
          data = {
            clients: store.get('clients') || [],
            installations: store.get('installations') || []
          };
          break;
      }
      
      return {
        success: true,
        message: `Datos exportados en formato ${format}`,
        details: {
          type: dataType,
          format: format,
          recordCount: Array.isArray(data) ? data.length : Object.keys(data).length,
          exportedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error al exportar datos:', error);
      return {
        success: false,
        message: `Error al exportar datos: ${error.message}`
      };
    }
  });
};