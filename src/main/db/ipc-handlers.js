const { recordChange, generateId } = require('./store');
const { checkUpcomingMaintenance, calculateNextMaintenanceDate } = require('../services/maintenance');
const whatsappService = require('../services/whatsapp');

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
  // Verificar conexión de WhatsApp
  ipcMain.handle('is-whatsapp-connected', () => {
    console.log('IPC: Verificando estado de WhatsApp');
    return whatsappService.isConnected();
  });
  
  // Inicializar WhatsApp
  ipcMain.handle('initialize-whatsapp', () => {
    console.log('IPC: Iniciando WhatsApp');
    whatsappService.initializeClient();
    return { success: true, message: 'Inicialización de WhatsApp iniciada' };
  });
  
  // Enviar mensaje de WhatsApp
  ipcMain.handle('send-whatsapp-message', async (event, messageData) => {
    // Si es una solicitud de conexión, iniciar el proceso de autenticación
    if (messageData.action === 'connect') {
      console.log('IPC: Solicitud para iniciar conexión de WhatsApp');
      whatsappService.initializeClient();
      return { success: true, message: 'Iniciando conexión con WhatsApp' };
    }
    
    // Para enviar un mensaje normal
    if (!messageData.phone || !messageData.message) {
      return { success: false, message: 'Número de teléfono y mensaje son obligatorios' };
    }
    
    return await whatsappService.sendMessage(messageData.phone, messageData.message);
  });
  
  // Cerrar sesión de WhatsApp
  ipcMain.handle('logout-whatsapp', async () => {
    console.log('IPC: Solicitud para cerrar sesión de WhatsApp');
    return await whatsappService.logout();
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
      console.log(`Generando reporte: ${reportType}`, options);
      
      // Determinar extensión según formato
      let extension;
      switch (options.format) {
        case 'excel':
          extension = '.xlsx';
          break;
        case 'csv':
          extension = '.csv';
          break;
        case 'json':
          extension = '.json';
          break;
        case 'pdf':
        default:
          extension = '.pdf';
          break;
      }
      
      // Obtener datos necesarios según el tipo de reporte
      const data = await getReportData(reportType, options);
      
      // Nombre de archivo base
      const fileName = `reporte-${reportType}-${new Date().toISOString().split('T')[0]}${extension}`;
      
      // Determinar la ruta de guardado
      let filePath;
      
      if (options.selectFolder) {
        // Permitir al usuario seleccionar la carpeta donde guardar
        const result = await dialog.showSaveDialog({
          title: 'Guardar reporte',
          defaultPath: path.join(app.getPath('documents'), fileName),
          filters: getReportFileFilters(options.format)
        });
        
        if (result.canceled || !result.filePath) {
          return { success: false, message: 'Operación cancelada por el usuario' };
        }
        
        filePath = result.filePath;
      } else {
        // Guardar en la carpeta de documentos por defecto
        filePath = path.join(app.getPath('documents'), fileName);
      }
      
      // Generar el reporte según el formato
      switch (options.format) {
        case 'excel':
          await generateExcelReport(data, filePath, reportType, options);
          break;
        case 'csv':
          await generateCsvReport(data, filePath, reportType, options);
          break;
        case 'json':
          await generateJsonReport(data, filePath, reportType, options);
          break;
        case 'pdf':
        default:
          await generatePdfReport(data, filePath, reportType, options);
          break;
      }
      
      return {
        success: true,
        message: `Reporte ${reportType} generado correctamente`,
        filePath: filePath,
        details: {
          type: reportType,
          format: options.format,
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
  
  // Función auxiliar para obtener filtros de archivo según el formato
  function getReportFileFilters(format) {
    switch (format) {
      case 'excel':
        return [{ name: 'Archivos Excel', extensions: ['xlsx'] }];
      case 'csv':
        return [{ name: 'Archivos CSV', extensions: ['csv'] }];
      case 'json':
        return [{ name: 'Archivos JSON', extensions: ['json'] }];
      case 'pdf':
      default:
        return [{ name: 'Archivos PDF', extensions: ['pdf'] }];
    }
  }
  
  // Función para obtener los datos necesarios según el tipo de reporte
  async function getReportData(reportType, options) {
    const store = setupStore();
    const clients = store.get('clients') || [];
    const installations = store.get('installations') || [];
    
    switch (reportType) {
      case 'maintenance':
        // Obtener datos de mantenimientos con filtros
        const allMaintenance = [];
        
        // Fechas de inicio y fin para filtrar
        const startDate = options.startDate ? new Date(options.startDate) : null;
        const endDate = options.endDate ? new Date(options.endDate) : null;
        
        installations.forEach(installation => {
          if (!installation.components) return;
          
          const client = clients.find(c => c.id === installation.clientId) || { 
            name: 'Cliente desconocido', 
            id: installation.clientId 
          };
          
          installation.components.forEach(component => {
            if (!component.nextMaintenanceDate) return;
            
            const nextMaintenance = new Date(component.nextMaintenanceDate);
            const lastMaintenance = component.lastMaintenanceDate ? new Date(component.lastMaintenanceDate) : null;
            
            // Verificar filtros de fecha
            let includeByDate = true;
            if (startDate && nextMaintenance < startDate) includeByDate = false;
            if (endDate && nextMaintenance > endDate) includeByDate = false;
            
            // Verificar filtros de estado
            const today = new Date();
            const diffDays = Math.floor((nextMaintenance - today) / (1000 * 60 * 60 * 24));
            
            let status = '';
            if (diffDays < 0) status = 'overdue';
            else if (diffDays <= 7) status = 'urgent';
            else if (diffDays <= 30) status = 'upcoming';
            else status = 'scheduled';
            
            // Verificar si el estado está incluido en los filtros
            let includeByStatus = true;
            if (options.statuses && options.statuses.length > 0) {
              includeByStatus = options.statuses.some(s => {
                if (s === 'pending') return diffDays >= 0;
                if (s === 'urgent') return diffDays >= 0 && diffDays <= 7;
                if (s === 'completed') return component.lastMaintenanceDate != null;
                return false;
              });
            }
            
            if (includeByDate && includeByStatus) {
              allMaintenance.push({
                clientId: installation.clientId,
                clientName: client.name,
                installationId: installation.id,
                address: installation.address,
                componentId: component.id,
                componentName: component.name,
                componentModel: component.model || '',
                lastMaintenanceDate: component.lastMaintenanceDate,
                nextMaintenanceDate: component.nextMaintenanceDate,
                frequency: component.frequency || 12,
                daysLeft: diffDays,
                status: status,
                notes: component.notes || ''
              });
            }
          });
        });
        
        return { 
          maintenance: allMaintenance,
          clients,
          installations
        };
        
      case 'clients':
        // Filtrar solo la información necesaria para el reporte
        const clientsData = clients.map(client => {
          const clientInstallations = installations.filter(inst => inst.clientId === client.id);
          
          // Contar componentes totales
          let totalComponents = 0;
          clientInstallations.forEach(inst => {
            if (inst.components) totalComponents += inst.components.length;
          });
          
          const result = {
            id: client.id,
            name: client.name,
            installationCount: clientInstallations.length,
            componentCount: totalComponents
          };
          
          // Incluir información de contacto si se solicita
          if (options.includeContactInfo) {
            result.phone = client.phone || '';
            result.email = client.email || '';
          }
          
          // Incluir instalaciones si se solicita
          if (options.includeInstallations) {
            result.installations = clientInstallations.map(inst => {
              const instData = {
                id: inst.id,
                address: inst.address,
                type: inst.type || 'No especificado',
                date: inst.date
              };
              
              // Incluir componentes si se solicita
              if (options.includeComponents && inst.components) {
                instData.components = inst.components.map(comp => ({
                  id: comp.id,
                  name: comp.name,
                  model: comp.model,
                  lastMaintenanceDate: comp.lastMaintenanceDate,
                  nextMaintenanceDate: comp.nextMaintenanceDate,
                  frequency: comp.frequency
                }));
              } else {
                instData.componentCount = inst.components ? inst.components.length : 0;
              }
              
              return instData;
            });
          }
          
          return result;
        });
        
        return { clients: clientsData };
        
      case 'installation-type':
        // Filtrar instalaciones por tipo
        let filteredInstallations = installations;
        
        if (options.types && options.types.length > 0) {
          filteredInstallations = installations.filter(inst => 
            options.types.includes(inst.type)
          );
        }
        
        // Agrupar según la opción seleccionada
        let groupedData = {};
        
        switch (options.groupBy) {
          case 'client':
            // Agrupar por cliente
            groupedData = filteredInstallations.reduce((result, inst) => {
              const client = clients.find(c => c.id === inst.clientId) || { name: 'Cliente desconocido', id: inst.clientId };
              const key = client.id;
              
              if (!result[key]) {
                result[key] = {
                  clientId: client.id,
                  clientName: client.name,
                  installations: []
                };
              }
              
              result[key].installations.push({
                id: inst.id,
                address: inst.address,
                type: inst.type,
                date: inst.date,
                componentCount: inst.components ? inst.components.length : 0
              });
              
              return result;
            }, {});
            break;
            
          case 'component':
            // Agrupar por componente
            const componentTypes = {};
            
            filteredInstallations.forEach(inst => {
              if (!inst.components) return;
              
              inst.components.forEach(comp => {
                const key = comp.name || 'Sin nombre';
                
                if (!componentTypes[key]) {
                  componentTypes[key] = {
                    componentName: key,
                    count: 0,
                    installations: []
                  };
                }
                
                componentTypes[key].count++;
                componentTypes[key].installations.push({
                  id: inst.id,
                  clientId: inst.clientId,
                  address: inst.address,
                  type: inst.type,
                  date: inst.date
                });
              });
            });
            
            groupedData = componentTypes;
            break;
            
          case 'date':
            // Agrupar por año de instalación
            filteredInstallations.forEach(inst => {
              let year = 'Sin fecha';
              
              if (inst.date) {
                try {
                  year = new Date(inst.date).getFullYear().toString();
                } catch (e) {
                  year = 'Sin fecha';
                }
              }
              
              if (!groupedData[year]) {
                groupedData[year] = {
                  year,
                  count: 0,
                  installations: []
                };
              }
              
              groupedData[year].count++;
              groupedData[year].installations.push({
                id: inst.id,
                clientId: inst.clientId,
                address: inst.address,
                type: inst.type,
                date: inst.date,
                componentCount: inst.components ? inst.components.length : 0
              });
            });
            break;
            
          default:
            // Sin agrupar, solo filtrar por tipo
            groupedData = { all: { installations: filteredInstallations } };
        }
        
        return { 
          installationsByType: groupedData,
          typeCount: options.types.reduce((result, type) => {
            result[type] = filteredInstallations.filter(inst => inst.type === type).length;
            return result;
          }, {})
        };
        
      case 'components':
        // Extraer todos los componentes con información adicional
        const allComponents = [];
        const componentFilter = options.componentType ? options.componentType.toLowerCase() : '';
        
        installations.forEach(inst => {
          if (!inst.components) return;
          
          const client = clients.find(c => c.id === inst.clientId) || { name: 'Cliente desconocido', id: inst.clientId };
          
          inst.components.forEach(comp => {
            // Filtrar por tipo de componente si es necesario
            if (componentFilter && !comp.name.toLowerCase().includes(componentFilter)) {
              return;
            }
            
            allComponents.push({
              id: comp.id,
              name: comp.name,
              model: comp.model || '',
              installationId: inst.id,
              installationAddress: inst.address,
              installationType: inst.type || 'No especificado',
              installationDate: inst.date,
              clientId: client.id,
              clientName: client.name,
              lastMaintenanceDate: comp.lastMaintenanceDate,
              nextMaintenanceDate: comp.nextMaintenanceDate,
              frequency: comp.frequency || 12,
              notes: comp.notes || ''
            });
          });
        });
        
        // Ordenar según la opción seleccionada
        if (options.sortBy) {
          allComponents.sort((a, b) => {
            switch (options.sortBy) {
              case 'name':
                return a.name.localeCompare(b.name);
              case 'installation_date':
                return new Date(a.installationDate || 0) - new Date(b.installationDate || 0);
              case 'next_maintenance':
                return new Date(a.nextMaintenanceDate || 0) - new Date(b.nextMaintenanceDate || 0);
              case 'client':
                return a.clientName.localeCompare(b.clientName);
              default:
                return 0;
            }
          });
        }
        
        return { components: allComponents };
        
      default:
        // Si no es un tipo de reporte reconocido, devolver datos básicos
        return { clients, installations };
    }
  }
  
  // Función para generar reporte en Excel
  async function generateExcelReport(data, filePath, reportType, options) {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    switch (reportType) {
      case 'maintenance':
        // Hoja para mantenimientos
        const maintenanceSheet = workbook.addWorksheet('Mantenimientos');
        maintenanceSheet.columns = [
          { header: 'Cliente', key: 'clientName', width: 30 },
          { header: 'Componente', key: 'componentName', width: 25 },
          { header: 'Modelo', key: 'componentModel', width: 20 },
          { header: 'Dirección', key: 'address', width: 40 },
          { header: 'Última Mantención', key: 'lastMaintenanceDate', width: 20 },
          { header: 'Próxima Mantención', key: 'nextMaintenanceDate', width: 20 },
          { header: 'Días Restantes', key: 'daysLeft', width: 15 },
          { header: 'Estado', key: 'status', width: 15 },
          { header: 'Frecuencia (meses)', key: 'frequency', width: 20 },
          { header: 'Notas', key: 'notes', width: 40 }
        ];
        
        maintenanceSheet.addRows(data.maintenance);
        
        // Dar formato a las fechas
        data.maintenance.forEach((_, rowIndex) => {
          ['lastMaintenanceDate', 'nextMaintenanceDate'].forEach(dateColumn => {
            const cell = maintenanceSheet.getCell(rowIndex + 2, maintenanceSheet.getColumn(dateColumn).number);
            if (cell.value) {
              cell.value = new Date(cell.value);
              cell.numFmt = 'dd/mm/yyyy';
            }
          });
          
          // Formato condicional para estado
          const statusCell = maintenanceSheet.getCell(rowIndex + 2, maintenanceSheet.getColumn('status').number);
          const daysLeftCell = maintenanceSheet.getCell(rowIndex + 2, maintenanceSheet.getColumn('daysLeft').number);
          
          if (daysLeftCell.value < 0) {
            statusCell.value = 'Vencido';
            statusCell.font = { color: { argb: 'FFFF0000' } }; // Rojo
            daysLeftCell.font = { color: { argb: 'FFFF0000' } };
          } else if (daysLeftCell.value <= 7) {
            statusCell.value = 'Urgente';
            statusCell.font = { color: { argb: 'FFFF9900' } }; // Naranja
            daysLeftCell.font = { color: { argb: 'FFFF9900' } };
          } else if (daysLeftCell.value <= 30) {
            statusCell.value = 'Próximo';
            statusCell.font = { color: { argb: 'FF0000FF' } }; // Azul
            daysLeftCell.font = { color: { argb: 'FF0000FF' } };
          } else {
            statusCell.value = 'Programado';
            statusCell.font = { color: { argb: 'FF008000' } }; // Verde
            daysLeftCell.font = { color: { argb: 'FF008000' } };
          }
        });
        
        // Agregar estadísticas
        maintenanceSheet.addRow([]);
        maintenanceSheet.addRow(['Estadísticas']);
        
        const overdueCount = data.maintenance.filter(m => m.daysLeft < 0).length;
        const urgentCount = data.maintenance.filter(m => m.daysLeft >= 0 && m.daysLeft <= 7).length;
        const upcomingCount = data.maintenance.filter(m => m.daysLeft > 7 && m.daysLeft <= 30).length;
        const scheduledCount = data.maintenance.filter(m => m.daysLeft > 30).length;
        
        maintenanceSheet.addRow(['Vencidos', overdueCount]);
        maintenanceSheet.addRow(['Urgentes (7 días)', urgentCount]);
        maintenanceSheet.addRow(['Próximos (30 días)', upcomingCount]);
        maintenanceSheet.addRow(['Programados', scheduledCount]);
        maintenanceSheet.addRow(['Total', data.maintenance.length]);
        break;
        
      case 'clients':
        const clientsSheet = workbook.addWorksheet('Clientes');
        
        // Definir columnas básicas
        let columns = [
          { header: 'ID', key: 'id', width: 36 },
          { header: 'Nombre', key: 'name', width: 30 },
          { header: 'Instalaciones', key: 'installationCount', width: 15 },
          { header: 'Componentes', key: 'componentCount', width: 15 }
        ];
        
        // Añadir columnas de contacto si se incluyen
        if (options.includeContactInfo) {
          columns.push(
            { header: 'Teléfono', key: 'phone', width: 15 },
            { header: 'Email', key: 'email', width: 30 }
          );
        }
        
        clientsSheet.columns = columns;
        clientsSheet.addRows(data.clients);
        
        // Si se incluyen instalaciones, crear hojas adicionales
        if (options.includeInstallations) {
          const installationsSheet = workbook.addWorksheet('Instalaciones');
          
          // Columnas para instalaciones
          let installationColumns = [
            { header: 'ID', key: 'id', width: 36 },
            { header: 'Cliente', key: 'clientName', width: 30 },
            { header: 'Dirección', key: 'address', width: 40 },
            { header: 'Tipo', key: 'type', width: 15 },
            { header: 'Fecha', key: 'date', width: 15 }
          ];
          
          if (!options.includeComponents) {
            installationColumns.push({ header: 'Componentes', key: 'componentCount', width: 15 });
          }
          
          installationsSheet.columns = installationColumns;
          
          // Preparar filas para instalaciones
          const installationRows = [];
          data.clients.forEach(client => {
            if (client.installations) {
              client.installations.forEach(inst => {
                installationRows.push({
                  id: inst.id,
                  clientName: client.name,
                  address: inst.address,
                  type: inst.type,
                  date: inst.date,
                  componentCount: inst.componentCount || 0
                });
              });
            }
          });
          
          installationsSheet.addRows(installationRows);
          
          // Dar formato a las fechas
          installationRows.forEach((_, rowIndex) => {
            const cell = installationsSheet.getCell(rowIndex + 2, installationsSheet.getColumn('date').number);
            if (cell.value) {
              cell.value = new Date(cell.value);
              cell.numFmt = 'dd/mm/yyyy';
            }
          });
          
          // Si se incluyen componentes, crear hoja adicional
          if (options.includeComponents) {
            const componentsSheet = workbook.addWorksheet('Componentes');
            componentsSheet.columns = [
              { header: 'ID', key: 'id', width: 36 },
              { header: 'Instalación', key: 'installationId', width: 36 },
              { header: 'Cliente', key: 'clientName', width: 30 },
              { header: 'Dirección', key: 'address', width: 40 },
              { header: 'Nombre', key: 'name', width: 25 },
              { header: 'Modelo', key: 'model', width: 25 },
              { header: 'Última Mantención', key: 'lastMaintenanceDate', width: 20 },
              { header: 'Próxima Mantención', key: 'nextMaintenanceDate', width: 20 }
            ];
            
            // Preparar filas para componentes
            const componentRows = [];
            data.clients.forEach(client => {
              if (client.installations) {
                client.installations.forEach(inst => {
                  if (inst.components) {
                    inst.components.forEach(comp => {
                      componentRows.push({
                        id: comp.id,
                        installationId: inst.id,
                        clientName: client.name,
                        address: inst.address,
                        name: comp.name,
                        model: comp.model,
                        lastMaintenanceDate: comp.lastMaintenanceDate,
                        nextMaintenanceDate: comp.nextMaintenanceDate
                      });
                    });
                  }
                });
              }
            });
            
            componentsSheet.addRows(componentRows);
            
            // Dar formato a las fechas
            componentRows.forEach((_, rowIndex) => {
              ['lastMaintenanceDate', 'nextMaintenanceDate'].forEach(dateColumn => {
                const cell = componentsSheet.getCell(rowIndex + 2, componentsSheet.getColumn(dateColumn).number);
                if (cell.value) {
                  cell.value = new Date(cell.value);
                  cell.numFmt = 'dd/mm/yyyy';
                }
              });
            });
          }
        }
        break;
        
      case 'installation-type':
        // Hoja principal para tipos
        const typesSheet = workbook.addWorksheet('Tipos de Instalación');
        typesSheet.columns = [
          { header: 'Tipo', key: 'type', width: 15 },
          { header: 'Cantidad', key: 'count', width: 10 }
        ];
        
        // Añadir filas con recuento por tipo
        const typeCounts = [];
        for (const type in data.typeCount) {
          typeCounts.push({
            type,
            count: data.typeCount[type]
          });
        }
        
        typesSheet.addRows(typeCounts);
        
        // Hoja para datos agrupados
        const groupSheet = workbook.addWorksheet('Datos Agrupados');
        
        // Columnas dependen del tipo de agrupación
        switch (options.groupBy) {
          case 'client':
            groupSheet.columns = [
              { header: 'Cliente', key: 'clientName', width: 30 },
              { header: 'Cantidad de Instalaciones', key: 'count', width: 20 }
            ];
            
            // Añadir filas
            const clientRows = [];
            for (const key in data.installationsByType) {
              const group = data.installationsByType[key];
              clientRows.push({
                clientName: group.clientName,
                count: group.installations.length
              });
            }
            
            groupSheet.addRows(clientRows);
            break;
            
          case 'component':
            groupSheet.columns = [
              { header: 'Componente', key: 'componentName', width: 25 },
              { header: 'Cantidad', key: 'count', width: 10 }
            ];
            
            // Añadir filas
            const componentRows = [];
            for (const key in data.installationsByType) {
              const group = data.installationsByType[key];
              componentRows.push({
                componentName: group.componentName,
                count: group.count
              });
            }
            
            groupSheet.addRows(componentRows);
            break;
            
          case 'date':
            groupSheet.columns = [
              { header: 'Año', key: 'year', width: 10 },
              { header: 'Cantidad', key: 'count', width: 10 }
            ];
            
            // Añadir filas
            const yearRows = [];
            for (const key in data.installationsByType) {
              const group = data.installationsByType[key];
              yearRows.push({
                year: group.year,
                count: group.count
              });
            }
            
            groupSheet.addRows(yearRows);
            break;
        }
        
        // Hoja con todas las instalaciones filtradas
        const detailSheet = workbook.addWorksheet('Detalles');
        detailSheet.columns = [
          { header: 'Cliente', key: 'clientName', width: 30 },
          { header: 'Dirección', key: 'address', width: 40 },
          { header: 'Tipo', key: 'type', width: 15 },
          { header: 'Fecha', key: 'date', width: 15 },
          { header: 'Componentes', key: 'componentCount', width: 15 }
        ];
        
        // Obtener todas las instalaciones
        const allInstallations = [];
        for (const key in data.installationsByType) {
          const group = data.installationsByType[key];
          if (group.installations) {
            group.installations.forEach(inst => {
              const client = data.clients && data.clients.find(c => c.id === inst.clientId);
              allInstallations.push({
                clientName: client ? client.name : 'Cliente desconocido',
                address: inst.address,
                type: inst.type,
                date: inst.date,
                componentCount: inst.componentCount || 0
              });
            });
          }
        }
        
        detailSheet.addRows(allInstallations);
        
        // Dar formato a las fechas
        allInstallations.forEach((_, rowIndex) => {
          const cell = detailSheet.getCell(rowIndex + 2, detailSheet.getColumn('date').number);
          if (cell.value) {
            cell.value = new Date(cell.value);
            cell.numFmt = 'dd/mm/yyyy';
          }
        });
        break;
        
      case 'components':
        // Hoja única con todos los componentes
        const componentsSheet = workbook.addWorksheet('Componentes');
        componentsSheet.columns = [
          { header: 'Nombre', key: 'name', width: 25 },
          { header: 'Modelo', key: 'model', width: 25 },
          { header: 'Cliente', key: 'clientName', width: 30 },
          { header: 'Dirección', key: 'installationAddress', width: 40 },
          { header: 'Tipo de Instalación', key: 'installationType', width: 15 },
          { header: 'Fecha de Instalación', key: 'installationDate', width: 20 },
          { header: 'Última Mantención', key: 'lastMaintenanceDate', width: 20 },
          { header: 'Próxima Mantención', key: 'nextMaintenanceDate', width: 20 },
          { header: 'Frecuencia (meses)', key: 'frequency', width: 15 },
          { header: 'Notas', key: 'notes', width: 30 }
        ];
        
        componentsSheet.addRows(data.components);
        
        // Dar formato a las fechas
        data.components.forEach((_, rowIndex) => {
          ['installationDate', 'lastMaintenanceDate', 'nextMaintenanceDate'].forEach(dateColumn => {
            const cell = componentsSheet.getCell(rowIndex + 2, componentsSheet.getColumn(dateColumn).number);
            if (cell.value) {
              cell.value = new Date(cell.value);
              cell.numFmt = 'dd/mm/yyyy';
            }
          });
        });
        
        // Agregar hoja de resumen
        const summarySheet = workbook.addWorksheet('Resumen');
        summarySheet.columns = [
          { header: 'Categoría', key: 'category', width: 30 },
          { header: 'Cantidad', key: 'count', width: 10 }
        ];
        
        // Contar componentes por modelo
        const modelCount = {};
        data.components.forEach(comp => {
          const model = comp.model || 'Sin especificar';
          modelCount[model] = (modelCount[model] || 0) + 1;
        });
        
        summarySheet.addRow(['Total de Componentes', data.components.length]);
        summarySheet.addRow(['']);
        summarySheet.addRow(['Distribución por Modelo']);
        
        for (const model in modelCount) {
          summarySheet.addRow([model, modelCount[model]]);
        }
        break;
        
      default:
        // Si no es un tipo de reporte reconocido, crear una hoja con datos básicos
        const defaultSheet = workbook.addWorksheet('Datos');
        defaultSheet.columns = [
          { header: 'Reporte', key: 'type', width: 20 },
          { header: 'Fecha', key: 'date', width: 20 }
        ];
        
        defaultSheet.addRow({
          type: reportType,
          date: new Date()
        });
    }
    
    // Guardar el archivo
    await workbook.xlsx.writeFile(filePath);
  }
  
  // Función para generar reporte en CSV
  async function generateCsvReport(data, filePath, reportType, options) {
    const stringify = require('csv-stringify/sync').stringify;
    
    // Función para formatear fechas en el CSV
    const formatDateForCsv = (dateString) => {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
      } catch {
        return '';
      }
    };
    
    let csvContent;
    
    switch (reportType) {
      case 'maintenance':
        // Preparar datos para CSV
        const maintenanceForCsv = data.maintenance.map(item => ({
          Cliente: item.clientName,
          Componente: item.componentName,
          Modelo: item.componentModel,
          Dirección: item.address,
          'Última Mantención': formatDateForCsv(item.lastMaintenanceDate),
          'Próxima Mantención': formatDateForCsv(item.nextMaintenanceDate),
          'Días Restantes': item.daysLeft,
          Estado: item.daysLeft < 0 ? 'Vencido' : 
                 item.daysLeft <= 7 ? 'Urgente' : 
                 item.daysLeft <= 30 ? 'Próximo' : 'Programado',
          'Frecuencia (meses)': item.frequency,
          Notas: item.notes
        }));
        
        csvContent = stringify(maintenanceForCsv, { header: true });
        break;
        
      // Implementar otros casos (clients, installation-type, components) aquí
      // siguiendo un patrón similar al de maintenance
      
      default:
        // Si no es un tipo reconocido, exportar datos básicos
        csvContent = stringify([{
          Reporte: reportType,
          Fecha: new Date().toLocaleDateString()
        }], { header: true });
    }
    
    // Guardar el archivo CSV
  fs.writeFileSync(filePath, csvContent);
}

// Función para generar reporte en JSON
async function generateJsonReport(data, filePath, reportType, options) {
  // Simplemente exportamos los datos en formato JSON bien formateado
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Función para generar reporte en PDF
async function generatePdfReport(data, filePath, reportType, options) {
  const PDFDocument = require('pdfkit');
  
  // Crear un nuevo documento PDF
  const doc = new PDFDocument({
    margin: 50,
    size: 'A4'
  });
  
  // Pipe el PDF a un archivo
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);
  
  // Función auxiliar para formatear fechas
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch {
      return '-';
    }
  };
  
  // Añadir logo e información básica
  doc.image(path.join(__dirname, '../../assets/logo.png'), 50, 45, { width: 50 })
     .fillColor('#444444')
     .fontSize(20)
     .text('ServitecGas', 110, 57)
     .fontSize(10)
     .text('Gestión de Mantenimientos', 110, 80)
     .moveDown();
  
  // Línea separadora
  doc.strokeColor('#aaaaaa')
     .lineWidth(1)
     .moveTo(50, 90)
     .lineTo(550, 90)
     .stroke();
  
  // Información del reporte
  doc.fillColor('#444444')
     .fontSize(14)
     .text(`Reporte de ${getTitleForReportType(reportType)}`, 50, 110)
     .fontSize(10)
     .text(`Generado el: ${new Date().toLocaleDateString()}`, 50, 130)
     .moveDown();
  
  // Contenido específico según el tipo de reporte
  switch (reportType) {
    case 'maintenance':
      generateMaintenanceReportContent(doc, data, formatDate);
      break;
    case 'clients':
      generateClientsReportContent(doc, data, formatDate, options);
      break;
    case 'installation-type':
      generateInstallationTypeReportContent(doc, data, formatDate, options);
      break;
    case 'components':
      generateComponentsReportContent(doc, data, formatDate, options);
      break;
    default:
      doc.text('No hay datos específicos para este tipo de reporte.', 50, 160);
  }
  
  // Finalizar PDF
  doc.end();
  
  // Devolver una promesa que se resuelve cuando el stream se cierra
  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

// Función auxiliar para obtener el título según el tipo de reporte
function getTitleForReportType(reportType) {
  switch (reportType) {
    case 'maintenance':
      return 'Mantenimientos';
    case 'clients':
      return 'Clientes';
    case 'installation-type':
      return 'Tipos de Instalación';
    case 'components':
      return 'Componentes';
    default:
      return reportType;
  }
}

// Función para generar contenido del reporte de mantenimientos
function generateMaintenanceReportContent(doc, data, formatDate) {
  // Agregar tablas con datos
  doc.fontSize(12)
     .text('Mantenimientos Programados', { underline: true })
     .moveDown();
  
  // Estadísticas
  const overdueCount = data.maintenance.filter(m => m.daysLeft < 0).length;
  const urgentCount = data.maintenance.filter(m => m.daysLeft >= 0 && m.daysLeft <= 7).length;
  const upcomingCount = data.maintenance.filter(m => m.daysLeft > 7 && m.daysLeft <= 30).length;
  const scheduledCount = data.maintenance.filter(m => m.daysLeft > 30).length;
  
  doc.fontSize(10)
     .text(`Vencidos: ${overdueCount}`, 50, doc.y + 5)
     .text(`Urgentes (7 días): ${urgentCount}`, 50, doc.y + 5)
     .text(`Próximos (30 días): ${upcomingCount}`, 50, doc.y + 5)
     .text(`Programados: ${scheduledCount}`, 50, doc.y + 5)
     .text(`Total: ${data.maintenance.length}`, 50, doc.y + 5)
     .moveDown();
  
  // Tabla de mantenimientos
  doc.fontSize(10)
     .text('Detalles de Mantenimientos', { underline: true })
     .moveDown();
  
  // Encabezados de tabla
  const tableTop = doc.y;
  const tableHeaders = ['Cliente', 'Componente', 'Dirección', 'Próxima Mantención', 'Días'];
  const columnWidths = [120, 100, 150, 80, 40];
  let currX = 50;
  
  // Dibujar encabezados
  doc.font('Helvetica-Bold');
  tableHeaders.forEach((header, i) => {
    doc.text(header, currX, tableTop);
    currX += columnWidths[i];
  });
  doc.font('Helvetica');
  
  // Línea después de encabezados
  doc.moveDown();
  let tableY = doc.y;
  doc.strokeColor('#aaaaaa')
     .lineWidth(0.5)
     .moveTo(50, tableY)
     .lineTo(550, tableY)
     .stroke();
  
  // Dibujar filas (limitar a 20 filas para evitar sobrecarga)
  const rowsToShow = Math.min(data.maintenance.length, 20);
  for (let i = 0; i < rowsToShow; i++) {
    const item = data.maintenance[i];
    tableY = doc.y + 5;
    currX = 50;
    
    // Verificar si necesitamos una nueva página
    if (tableY > 700) {
      doc.addPage();
      tableY = 50;
      doc.y = tableY;
    }
    
    // Cliente
    doc.text(item.clientName.substring(0, 20), currX, tableY, { width: columnWidths[0] - 10 });
    currX += columnWidths[0];
    
    // Componente
    doc.text(item.componentName.substring(0, 15), currX, tableY, { width: columnWidths[1] - 10 });
    currX += columnWidths[1];
    
    // Dirección
    doc.text(item.address.substring(0, 25), currX, tableY, { width: columnWidths[2] - 10 });
    currX += columnWidths[2];
    
    // Próxima mantención
    doc.text(formatDate(item.nextMaintenanceDate), currX, tableY);
    currX += columnWidths[3];
    
    // Días restantes con color según urgencia
    if (item.daysLeft < 0) {
      doc.fillColor('red').text(item.daysLeft.toString(), currX, tableY);
    } else if (item.daysLeft <= 7) {
      doc.fillColor('orange').text(item.daysLeft.toString(), currX, tableY);
    } else {
      doc.fillColor('black').text(item.daysLeft.toString(), currX, tableY);
    }
    doc.fillColor('black');
    
    doc.moveDown();
  }
  
  // Si hay más filas de las que se muestran
  if (data.maintenance.length > rowsToShow) {
    doc.text(`... y ${data.maintenance.length - rowsToShow} más.`, 50, doc.y + 10);
  }
}

// Función para generar contenido del reporte de clientes
function generateClientsReportContent(doc, data, formatDate, options) {
  doc.fontSize(12)
     .text('Listado de Clientes', { underline: true })
     .moveDown();
  
  // Estadísticas básicas
  doc.fontSize(10)
     .text(`Total de clientes: ${data.clients.length}`)
     .moveDown();
  
  // Tabla de clientes
  const tableTop = doc.y;
  const tableHeaders = ['Nombre', 'Instalaciones', 'Componentes'];
  const columnWidths = [200, 90, 90];
  let currX = 50;
  
  // Dibujar encabezados
  doc.font('Helvetica-Bold');
  tableHeaders.forEach((header, i) => {
    doc.text(header, currX, tableTop);
    currX += columnWidths[i];
  });
  doc.font('Helvetica');
  
  // Línea después de encabezados
  doc.moveDown();
  let tableY = doc.y;
  doc.strokeColor('#aaaaaa')
     .lineWidth(0.5)
     .moveTo(50, tableY)
     .lineTo(550, tableY)
     .stroke();
  
  // Dibujar filas
  const rowsToShow = Math.min(data.clients.length, 30);
  for (let i = 0; i < rowsToShow; i++) {
    const client = data.clients[i];
    tableY = doc.y + 5;
    currX = 50;
    
    // Verificar si necesitamos una nueva página
    if (tableY > 700) {
      doc.addPage();
      tableY = 50;
      doc.y = tableY;
    }
    
    // Nombre
    doc.text(client.name.substring(0, 30), currX, tableY, { width: columnWidths[0] - 10 });
    currX += columnWidths[0];
    
    // Instalaciones
    doc.text(client.installationCount.toString(), currX, tableY);
    currX += columnWidths[1];
    
    // Componentes
    doc.text(client.componentCount.toString(), currX, tableY);
    
    doc.moveDown();
  }
  
  // Si hay más clientes de los que se muestran
  if (data.clients.length > rowsToShow) {
    doc.text(`... y ${data.clients.length - rowsToShow} más.`, 50, doc.y + 10);
  }
}

// Función para generar contenido del reporte de tipos de instalación
function generateInstallationTypeReportContent(doc, data, formatDate, options) {
  doc.fontSize(12)
     .text('Análisis por Tipo de Instalación', { underline: true })
     .moveDown();
  
  // Estadísticas por tipo
  doc.fontSize(10);
  for (const type in data.typeCount) {
    doc.text(`${type}: ${data.typeCount[type]} instalaciones`);
  }
  doc.moveDown();
  
  // Información de agrupación
  doc.fontSize(12)
     .text(`Agrupación por: ${options.groupBy}`, { underline: true })
     .moveDown();
  
  // Mostrar diferentes tablas según el tipo de agrupación
  switch (options.groupBy) {
    case 'client':
      // Tabla por cliente
      const clientKeys = Object.keys(data.installationsByType);
      for (let i = 0; i < Math.min(clientKeys.length, 20); i++) {
        const group = data.installationsByType[clientKeys[i]];
        doc.fontSize(10)
           .text(`Cliente: ${group.clientName}`, 50, doc.y)
           .text(`Instalaciones: ${group.installations.length}`, 50, doc.y + 5)
           .moveDown();
      }
      break;
      
    case 'component':
      // Tabla por componente
      const componentKeys = Object.keys(data.installationsByType);
      for (let i = 0; i < Math.min(componentKeys.length, 20); i++) {
        const group = data.installationsByType[componentKeys[i]];
        doc.fontSize(10)
           .text(`Componente: ${group.componentName}`, 50, doc.y)
           .text(`Cantidad: ${group.count}`, 50, doc.y + 5)
           .moveDown();
      }
      break;
      
    case 'date':
      // Tabla por año
      const yearKeys = Object.keys(data.installationsByType);
      for (let i = 0; i < Math.min(yearKeys.length, 20); i++) {
        const group = data.installationsByType[yearKeys[i]];
        doc.fontSize(10)
           .text(`Año: ${group.year}`, 50, doc.y)
           .text(`Instalaciones: ${group.count}`, 50, doc.y + 5)
           .moveDown();
      }
      break;
  }
}

// Función para generar contenido del reporte de componentes
function generateComponentsReportContent(doc, data, formatDate, options) {
  doc.fontSize(12)
     .text('Inventario de Componentes', { underline: true })
     .moveDown();
  
  // Estadísticas básicas
  doc.fontSize(10)
     .text(`Total de componentes: ${data.components.length}`)
     .moveDown();
  
  // Tabla de componentes
  const tableTop = doc.y;
  const tableHeaders = ['Componente', 'Modelo', 'Cliente', 'Próx. Mantención'];
  const columnWidths = [120, 100, 150, 80];
  let currX = 50;
  
  // Dibujar encabezados
  doc.font('Helvetica-Bold');
  tableHeaders.forEach((header, i) => {
    doc.text(header, currX, tableTop);
    currX += columnWidths[i];
  });
  doc.font('Helvetica');
  
  // Línea después de encabezados
  doc.moveDown();
  let tableY = doc.y;
  doc.strokeColor('#aaaaaa')
     .lineWidth(0.5)
     .moveTo(50, tableY)
     .lineTo(550, tableY)
     .stroke();
  
  // Dibujar filas
  const rowsToShow = Math.min(data.components.length, 25);
  for (let i = 0; i < rowsToShow; i++) {
    const component = data.components[i];
    tableY = doc.y + 5;
    currX = 50;
    
    // Verificar si necesitamos una nueva página
    if (tableY > 700) {
      doc.addPage();
      tableY = 50;
      doc.y = tableY;
    }
    
    // Nombre del componente
    doc.text(component.name.substring(0, 18), currX, tableY, { width: columnWidths[0] - 10 });
    currX += columnWidths[0];
    
    // Modelo
    doc.text(component.model.substring(0, 15), currX, tableY, { width: columnWidths[1] - 10 });
    currX += columnWidths[1];
    
    // Cliente
    doc.text(component.clientName.substring(0, 25), currX, tableY, { width: columnWidths[2] - 10 });
    currX += columnWidths[2];
    
    // Próxima mantención
    doc.text(formatDate(component.nextMaintenanceDate), currX, tableY);
    
    doc.moveDown();
  }
  
  // Si hay más componentes de los que se muestran
  if (data.components.length > rowsToShow) {
    doc.text(`... y ${data.components.length - rowsToShow} más.`, 50, doc.y + 10);
  }
}

  // ============================================================
  // Exportar/Importar datos
  // ============================================================
  
  // Exportar datos
  ipcMain.handle('export-data', async (event, { dataType, format, selectFolder = false }) => {
    try {
      // Obtener datos según el tipo seleccionado
      let data;
      let fileName;
      
      switch (dataType) {
        case 'clients':
          data = store.get('clients') || [];
          fileName = `clientes-${new Date().toISOString().split('T')[0]}`;
          break;
        case 'installations':
          data = store.get('installations') || [];
          fileName = `instalaciones-${new Date().toISOString().split('T')[0]}`;
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
          fileName = `mantenimientos-${new Date().toISOString().split('T')[0]}`;
          break;
        case 'all':
        default:
          data = {
            clients: store.get('clients') || [],
            installations: store.get('installations') || [],
            maintenanceHistory: store.get('maintenanceHistory') || []
          };
          fileName = `todos-datos-${new Date().toISOString().split('T')[0]}`;
          break;
      }
      
      // Determinar extensión según formato
      let extension;
      switch (format) {
        case 'excel':
          extension = '.xlsx';
          break;
        case 'csv':
          extension = '.csv';
          break;
        case 'json':
        default:
          extension = '.json';
          break;
      }
      
      // Nombre de archivo completo
      const defaultFilename = fileName + extension;
      
      // Determinar la ruta de guardado
      let filePath;
      
      if (selectFolder) {
        // Permitir al usuario seleccionar la carpeta donde guardar
        const result = await dialog.showSaveDialog({
          title: 'Guardar exportación',
          defaultPath: path.join(app.getPath('documents'), defaultFilename),
          filters: getFileFilters(format)
        });
        
        if (result.canceled || !result.filePath) {
          return { success: false, message: 'Operación cancelada por el usuario' };
        }
        
        filePath = result.filePath;
      } else {
        // Guardar en la carpeta de documentos por defecto
        filePath = path.join(app.getPath('documents'), defaultFilename);
      }
      
      // Guardar según el formato seleccionado
      switch (format) {
        case 'excel':
          // Para Excel usamos ExcelJS
          await saveAsExcel(data, filePath, dataType);
          break;
        case 'csv':
          // Para CSV el enfoque depende del tipo de datos
          await saveAsCsv(data, filePath, dataType);
          break;
        case 'json':
        default:
          // Para JSON simplemente guardamos el objeto
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          break;
      }
      
      return {
        success: true,
        message: `Datos exportados en formato ${format}`,
        filePath: filePath,
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

  // Función para obtener los filtros de archivos según el formato
  function getFileFilters(format) {
    switch (format) {
      case 'excel':
        return [{ name: 'Archivos Excel', extensions: ['xlsx'] }];
      case 'csv':
        return [{ name: 'Archivos CSV', extensions: ['csv'] }];
      case 'json':
      default:
        return [{ name: 'Archivos JSON', extensions: ['json'] }];
    }
  }

  // Función para guardar datos en formato Excel
  async function saveAsExcel(data, filePath, dataType) {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    switch (dataType) {
      case 'clients':
        // Hoja para clientes
        const clientsSheet = workbook.addWorksheet('Clientes');
        clientsSheet.columns = [
          { header: 'ID', key: 'id', width: 36 },
          { header: 'Nombre', key: 'name', width: 30 },
          { header: 'Teléfono', key: 'phone', width: 15 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Notas', key: 'notes', width: 40 },
          { header: 'Fecha Creación', key: 'createdAt', width: 20 },
          { header: 'Última Modificación', key: 'lastModified', width: 20 }
        ];
        
        // Agregar datos
        clientsSheet.addRows(data);
        
        // Dar formato a las fechas
        data.forEach((_, rowIndex) => {
          ['createdAt', 'lastModified'].forEach(dateColumn => {
            const cell = clientsSheet.getCell(rowIndex + 2, clientsSheet.getColumn(dateColumn).number);
            if (cell.value) {
              cell.value = new Date(cell.value);
              cell.numFmt = 'dd/mm/yyyy';
            }
          });
        });
        break;
        
      case 'installations':
        // Hoja para instalaciones
        const installationsSheet = workbook.addWorksheet('Instalaciones');
        installationsSheet.columns = [
          { header: 'ID', key: 'id', width: 36 },
          { header: 'Cliente ID', key: 'clientId', width: 36 },
          { header: 'Dirección', key: 'address', width: 40 },
          { header: 'Tipo', key: 'type', width: 15 },
          { header: 'Fecha Instalación', key: 'date', width: 20 },
          { header: 'Notas', key: 'notes', width: 40 },
          { header: 'Fecha Creación', key: 'createdAt', width: 20 },
          { header: 'Última Modificación', key: 'lastModified', width: 20 }
        ];
        
        // Agregar datos simplificados (sin componentes)
        const simplifiedInstallations = data.map(inst => ({
          id: inst.id,
          clientId: inst.clientId,
          address: inst.address,
          type: inst.type,
          date: inst.date,
          notes: inst.notes,
          createdAt: inst.createdAt,
          lastModified: inst.lastModified,
          componentCount: inst.components ? inst.components.length : 0
        }));
        
        installationsSheet.addRows(simplifiedInstallations);
        
        // Dar formato a las fechas
        simplifiedInstallations.forEach((_, rowIndex) => {
          ['date', 'createdAt', 'lastModified'].forEach(dateColumn => {
            const cell = installationsSheet.getCell(rowIndex + 2, installationsSheet.getColumn(dateColumn).number);
            if (cell.value) {
              cell.value = new Date(cell.value);
              cell.numFmt = 'dd/mm/yyyy';
            }
          });
        });
        
        // Hoja adicional para componentes
        const componentsSheet = workbook.addWorksheet('Componentes');
        componentsSheet.columns = [
          { header: 'ID', key: 'id', width: 36 },
          { header: 'Instalación ID', key: 'installationId', width: 36 },
          { header: 'Nombre', key: 'name', width: 30 },
          { header: 'Modelo', key: 'model', width: 20 },
          { header: 'Última Mantención', key: 'lastMaintenanceDate', width: 20 },
          { header: 'Próxima Mantención', key: 'nextMaintenanceDate', width: 20 },
          { header: 'Frecuencia (meses)', key: 'frequency', width: 15 },
          { header: 'Notas', key: 'notes', width: 40 }
        ];
        
        // Agregar componentes
        const components = [];
        data.forEach(installation => {
          if (installation.components) {
            installation.components.forEach(component => {
              components.push({
                id: component.id,
                installationId: installation.id,
                name: component.name,
                model: component.model,
                lastMaintenanceDate: component.lastMaintenanceDate,
                nextMaintenanceDate: component.nextMaintenanceDate,
                frequency: component.frequency,
                notes: component.notes
              });
            });
          }
        });
        
        componentsSheet.addRows(components);
        
        // Dar formato a las fechas de componentes
        components.forEach((_, rowIndex) => {
          ['lastMaintenanceDate', 'nextMaintenanceDate'].forEach(dateColumn => {
            const cell = componentsSheet.getCell(rowIndex + 2, componentsSheet.getColumn(dateColumn).number);
            if (cell.value) {
              cell.value = new Date(cell.value);
              cell.numFmt = 'dd/mm/yyyy';
            }
          });
        });
        break;
        
      case 'maintenance':
        // Hoja para mantenimientos
        const maintenanceSheet = workbook.addWorksheet('Mantenimientos');
        maintenanceSheet.columns = [
          { header: 'Instalación ID', key: 'installationId', width: 36 },
          { header: 'Dirección', key: 'address', width: 40 },
          { header: 'Componente ID', key: 'componentId', width: 36 },
          { header: 'Componente', key: 'componentName', width: 30 },
          { header: 'Última Mantención', key: 'lastMaintenanceDate', width: 20 },
          { header: 'Próxima Mantención', key: 'nextMaintenanceDate', width: 20 },
          { header: 'Frecuencia (meses)', key: 'frequency', width: 15 }
        ];
        
        maintenanceSheet.addRows(data);
        
        // Dar formato a las fechas
        data.forEach((_, rowIndex) => {
          ['lastMaintenanceDate', 'nextMaintenanceDate'].forEach(dateColumn => {
            const cell = maintenanceSheet.getCell(rowIndex + 2, maintenanceSheet.getColumn(dateColumn).number);
            if (cell.value) {
              cell.value = new Date(cell.value);
              cell.numFmt = 'dd/mm/yyyy';
            }
          });
        });
        break;
        
      case 'all':
      default:
        // Hoja para clientes
        const allClientsSheet = workbook.addWorksheet('Clientes');
        allClientsSheet.columns = [
          { header: 'ID', key: 'id', width: 36 },
          { header: 'Nombre', key: 'name', width: 30 },
          { header: 'Teléfono', key: 'phone', width: 15 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Notas', key: 'notes', width: 40 }
        ];
        
        // Agregar datos de clientes
        allClientsSheet.addRows(data.clients);
        
        // Hoja para instalaciones
        const allInstallationsSheet = workbook.addWorksheet('Instalaciones');
        allInstallationsSheet.columns = [
          { header: 'ID', key: 'id', width: 36 },
          { header: 'Cliente ID', key: 'clientId', width: 36 },
          { header: 'Dirección', key: 'address', width: 40 },
          { header: 'Tipo', key: 'type', width: 15 },
          { header: 'Fecha Instalación', key: 'date', width: 20 },
          { header: 'Notas', key: 'notes', width: 40 }
        ];
        
        // Agregar datos simplificados (sin componentes)
        const allSimplifiedInstallations = data.installations.map(inst => ({
          id: inst.id,
          clientId: inst.clientId,
          address: inst.address,
          type: inst.type,
          date: inst.date,
          notes: inst.notes
        }));
        
        allInstallationsSheet.addRows(allSimplifiedInstallations);
        
        // Hoja para componentes
        const allComponentsSheet = workbook.addWorksheet('Componentes');
        allComponentsSheet.columns = [
          { header: 'ID', key: 'id', width: 36 },
          { header: 'Instalación ID', key: 'installationId', width: 36 },
          { header: 'Nombre', key: 'name', width: 30 },
          { header: 'Modelo', key: 'model', width: 20 },
          { header: 'Última Mantención', key: 'lastMaintenanceDate', width: 20 },
          { header: 'Próxima Mantención', key: 'nextMaintenanceDate', width: 20 },
          { header: 'Frecuencia (meses)', key: 'frequency', width: 15 }
        ];
        
        // Agregar componentes
        const allComponents = [];
        data.installations.forEach(installation => {
          if (installation.components) {
            installation.components.forEach(component => {
              allComponents.push({
                id: component.id,
                installationId: installation.id,
                name: component.name,
                model: component.model,
                lastMaintenanceDate: component.lastMaintenanceDate,
                nextMaintenanceDate: component.nextMaintenanceDate,
                frequency: component.frequency
              });
            });
          }
        });
        
        allComponentsSheet.addRows(allComponents);
        
        // Historial de mantenimientos
        if (data.maintenanceHistory && data.maintenanceHistory.length > 0) {
          const historySheet = workbook.addWorksheet('Historial Mantenimientos');
          historySheet.columns = [
            { header: 'ID', key: 'id', width: 36 },
            { header: 'Fecha', key: 'date', width: 20 },
            { header: 'Componente ID', key: 'componentId', width: 36 },
            { header: 'Instalación ID', key: 'installationId', width: 36 },
            { header: 'Técnico', key: 'technicianName', width: 30 },
            { header: 'Notas', key: 'notes', width: 40 }
          ];
          
          historySheet.addRows(data.maintenanceHistory);
        }
        break;
    }
    
    // Guardar el archivo
    await workbook.xlsx.writeFile(filePath);
  }

  // Función para guardar datos en formato CSV
  async function saveAsCsv(data, filePath, dataType) {
    const stringify = require('csv-stringify/sync').stringify;
    
    // Función para formatear fechas en el CSV
    const formatDateForCsv = (dateString) => {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString();
      } catch {
        return '';
      }
    };
    
    let csvContent;
    
    switch (dataType) {
      case 'clients':
        // Preparar datos de clientes para CSV
        const clientsForCsv = data.map(client => ({
          ID: client.id,
          Nombre: client.name,
          Teléfono: client.phone,
          Email: client.email,
          Notas: client.notes,
          FechaCreación: formatDateForCsv(client.createdAt),
          ÚltimaModificación: formatDateForCsv(client.lastModified)
        }));
        
        csvContent = stringify(clientsForCsv, { header: true });
        break;
        
      case 'installations':
        // Para instalaciones, creamos múltiples archivos CSV
        // Primero las instalaciones
        const installationsForCsv = data.map(inst => ({
          ID: inst.id,
          ClienteID: inst.clientId,
          Dirección: inst.address,
          Tipo: inst.type,
          FechaInstalación: formatDateForCsv(inst.date),
          Notas: inst.notes,
          CantidadComponentes: inst.components ? inst.components.length : 0
        }));
        
        csvContent = stringify(installationsForCsv, { header: true });
        
        // También creamos un CSV adicional para componentes
        const componentsForCsv = [];
        data.forEach(installation => {
          if (installation.components) {
            installation.components.forEach(component => {
              componentsForCsv.push({
                ID: component.id,
                InstalaciónID: installation.id,
                Nombre: component.name,
                Modelo: component.model,
                ÚltimaMantención: formatDateForCsv(component.lastMaintenanceDate),
                PróximaMantención: formatDateForCsv(component.nextMaintenanceDate),
                Frecuencia: component.frequency,
                Notas: component.notes
              });
            });
          }
        });
        
        // Guardar componentes en un archivo separado
        if (componentsForCsv.length > 0) {
          const componentsFilePath = filePath.replace(/\.csv$/, '-componentes.csv');
          const componentsCsvContent = stringify(componentsForCsv, { header: true });
          fs.writeFileSync(componentsFilePath, componentsCsvContent);
        }
        break;
        
      case 'maintenance':
        // Preparar datos de mantenimientos para CSV
        const maintenanceForCsv = data.map(item => ({
          InstalaciónID: item.installationId,
          Dirección: item.address,
          ComponenteID: item.componentId,
          Componente: item.componentName,
          ÚltimaMantención: formatDateForCsv(item.lastMaintenanceDate),
          PróximaMantención: formatDateForCsv(item.nextMaintenanceDate),
          Frecuencia: item.frequency
        }));
        
        csvContent = stringify(maintenanceForCsv, { header: true });
        break;
        
      case 'all':
      default:
        // Para todos los datos, creamos múltiples archivos CSV
        // Primero los clientes
        const allClientsForCsv = data.clients.map(client => ({
          ID: client.id,
          Nombre: client.name,
          Teléfono: client.phone,
          Email: client.email,
          Notas: client.notes
        }));
        
        csvContent = stringify(allClientsForCsv, { header: true });
        
        // Guardar instalaciones en un archivo separado
        const allInstallationsForCsv = data.installations.map(inst => ({
          ID: inst.id,
          ClienteID: inst.clientId,
          Dirección: inst.address,
          Tipo: inst.type,
          FechaInstalación: formatDateForCsv(inst.date),
          Notas: inst.notes
        }));
        
        const installationsFilePath = filePath.replace(/\.csv$/, '-instalaciones.csv');
        const installationsCsvContent = stringify(allInstallationsForCsv, { header: true });
        fs.writeFileSync(installationsFilePath, installationsCsvContent);
        
        // Guardar componentes en un archivo separado
        const allComponentsForCsv = [];
        data.installations.forEach(installation => {
          if (installation.components) {
            installation.components.forEach(component => {
              allComponentsForCsv.push({
                ID: component.id,
                InstalaciónID: installation.id,
                Nombre: component.name,
                Modelo: component.model,
                ÚltimaMantención: formatDateForCsv(component.lastMaintenanceDate),
                PróximaMantención: formatDateForCsv(component.nextMaintenanceDate),
                Frecuencia: component.frequency
              });
            });
          }
        });
        
        if (allComponentsForCsv.length > 0) {
          const componentsFilePath = filePath.replace(/\.csv$/, '-componentes.csv');
          const componentsCsvContent = stringify(allComponentsForCsv, { header: true });
          fs.writeFileSync(componentsFilePath, componentsCsvContent);
        }
        
        // Guardar historial de mantenimientos en un archivo separado
        if (data.maintenanceHistory && data.maintenanceHistory.length > 0) {
          const historyForCsv = data.maintenanceHistory.map(item => ({
            ID: item.id,
            Fecha: formatDateForCsv(item.date),
            ComponenteID: item.componentId,
            InstalaciónID: item.installationId,
            Técnico: item.technicianName || '',
            Notas: item.notes || ''
          }));
          
          const historyFilePath = filePath.replace(/\.csv$/, '-historial.csv');
          const historyCsvContent = stringify(historyForCsv, { header: true });
          fs.writeFileSync(historyFilePath, historyCsvContent);
        }
        break;
    }
    
    // Guardar el archivo CSV principal
    fs.writeFileSync(filePath, csvContent);
  }
};