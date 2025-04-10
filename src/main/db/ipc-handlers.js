// src/main/db/ipc-handlers.js - Manejadores de eventos IPC
const { v4: uuidv4 } = require('uuid');

module.exports = function(ipcMain, store) {
  // Clientes
  ipcMain.handle('get-clients', () => {
    return store.get('clients') || [];
  });

  ipcMain.handle('add-client', (event, client) => {
    const clients = store.get('clients') || [];
    const newClient = {
      ...client,
      id: client.id || uuidv4(),
      createdAt: new Date().toISOString()
    };
    const updatedClients = [...clients, newClient];
    store.set('clients', updatedClients);
    return newClient;
  });

  ipcMain.handle('update-client', (event, client) => {
    const clients = store.get('clients') || [];
    const index = clients.findIndex(c => c.id === client.id);
    if (index !== -1) {
      clients[index] = client;
      store.set('clients', clients);
      return client;
    }
    return null;
  });

  ipcMain.handle('delete-client', (event, clientId) => {
    const clients = store.get('clients') || [];
    const newClients = clients.filter(c => c.id !== clientId);
    store.set('clients', newClients);
    
    // También eliminar las instalaciones asociadas
    const installations = store.get('installations') || [];
    const newInstallations = installations.filter(i => i.clientId !== clientId);
    store.set('installations', newInstallations);
    
    return true;
  });

  // Instalaciones
  ipcMain.handle('get-installations', () => {
    return store.get('installations') || [];
  });

  ipcMain.handle('add-installation', (event, installation) => {
    const installations = store.get('installations') || [];
    const newInstallation = {
      ...installation,
      id: installation.id || uuidv4(),
      createdAt: new Date().toISOString(),
      components: installation.components.map(component => ({
        ...component,
        id: component.id || uuidv4()
      }))
    };
    const updatedInstallations = [...installations, newInstallation];
    store.set('installations', updatedInstallations);
    return newInstallation;
  });

  ipcMain.handle('update-installation', (event, installation) => {
    const installations = store.get('installations') || [];
    const index = installations.findIndex(i => i.id === installation.id);
    if (index !== -1) {
      installations[index] = installation;
      store.set('installations', installations);
      return installation;
    }
    return null;
  });

  ipcMain.handle('delete-installation', (event, installationId) => {
    const installations = store.get('installations') || [];
    const newInstallations = installations.filter(i => i.id !== installationId);
    store.set('installations', newInstallations);
    return true;
  });

  // Mantenimiento
  ipcMain.handle('get-upcoming-maintenance', () => {
    const installations = store.get('installations') || [];
    const clients = store.get('clients') || [];
    const today = new Date();
    const upcomingMaintenance = [];
    
    installations.forEach(installation => {
      if (!installation.components) return;
      
      installation.components.forEach(component => {
        if (component.nextMaintenanceDate) {
          const nextMaintenance = new Date(component.nextMaintenanceDate);
          const diffDays = Math.floor((nextMaintenance - today) / (1000 * 60 * 60 * 24));
          
          // Considerar mantenimientos en los próximos 30 días
          if (diffDays <= 30 && diffDays >= 0) {
            const client = clients.find(c => c.id === installation.clientId);
            
            upcomingMaintenance.push({
              clientName: client ? client.name : 'Cliente desconocido',
              clientPhone: client ? client.phone : '',
              address: installation.address,
              componentName: component.name,
              nextMaintenanceDate: component.nextMaintenanceDate,
              daysLeft: diffDays,
              clientId: installation.clientId,
              installationId: installation.id,
              componentId: component.id
            });
          }
        }
      });
    });
    
    return upcomingMaintenance.sort((a, b) => a.daysLeft - b.daysLeft);
  });

  // WhatsApp
  ipcMain.handle('send-whatsapp-message', (event, data) => {
    const { phone, message } = data;
    
    // Este es un punto donde se integraría con el servicio de WhatsApp
    // Por ahora, solo retornamos como si hubiera sido exitoso
    return {
      success: true,
      message: `Mensaje enviado a ${phone}`
    };
  });

  // Historial de mantenimientos
  ipcMain.handle('get-maintenance-history', (event, filters = {}) => {
    const installations = store.get('installations') || [];
    const clients = store.get('clients') || [];
    const maintenanceHistory = [];
    
    // Recopilar registro histórico de mantenimientos
    installations.forEach(installation => {
      if (!installation.components) return;
      
      const client = clients.find(c => c.id === installation.clientId) || { name: 'Cliente desconocido' };
      
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
              frequency: component.frequency || 12
            });
          }
        }
      });
    });
    
    // Ordenar por fecha de mantenimiento (más recientes primero)
    return maintenanceHistory.sort((a, b) => new Date(b.maintenanceDate) - new Date(a.maintenanceDate));
  });

  // Generar reportes
  ipcMain.handle('generate-report', async (event, { reportType, options }) => {
    try {
      // Esta es una implementación simulada. En un caso real,
      // aquí deberíamos utilizar bibliotecas como pdfkit, exceljs, etc.
      // para generar reportes reales.
      
      // Simulación: Retornar detalles del reporte generado
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

  // Exportar datos
  ipcMain.handle('export-data', async (event, { dataType, format }) => {
    try {
      // Esta es una implementación simulada. En un caso real,
      // aquí deberíamos generar los archivos de exportación según el formato
      // solicitado (excel, csv, json) y guardarlos en el sistema.
      
      // Obtener datos según el tipo
      let data;
      switch (dataType) {
        case 'clients':
          data = store.get('clients') || [];
          break;
        case 'installations':
          data = store.get('installations') || [];
          break;
        case 'maintenance':
          // Obtener solo datos de mantenimientos
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
      
      // En una implementación real, aquí exportaríamos los datos al formato solicitado
      // y guardaríamos el archivo usando dialog.showSaveDialog
      
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