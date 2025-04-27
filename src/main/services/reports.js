const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');
const xlsx = require('xlsx'); // Asegúrate de tener esta dependencia instalada

/**
 * Genera reportes y estadísticas
 * @param {Object} store - Instancia del almacén de datos
 */
class ReportService {
  constructor(store) {
    this.store = store;
  }

  /**
   * Exporta datos de la aplicación
   * @param {Object} options - Opciones de exportación
   * @returns {Promise<Object>} - Resultado de la exportación
   */
  async exportData(options = {}) {
    try {
      const { dataType = 'all', format = 'excel', selectFolder = true } = options;
      
      // Obtener los datos según el tipo
      let dataToExport = {};
      
      switch (dataType) {
        case 'clients':
          dataToExport = { clients: this.store.get('clients') || [] };
          break;
        case 'installations':
          dataToExport = { installations: this.store.get('installations') || [] };
          break;
        case 'maintenance':
          dataToExport = { 
            maintenanceHistory: this.store.get('maintenanceHistory') || [],
            upcomingMaintenance: this._getUpcomingMaintenance()
          };
          break;
        case 'all':
        default:
          dataToExport = {
            clients: this.store.get('clients') || [],
            installations: this.store.get('installations') || [],
            maintenanceHistory: this.store.get('maintenanceHistory') || []
          };
      }
      
      // Determinar la ruta de destino
      let filePath;
      if (selectFolder) {
        const defaultName = `servitecgas-export-${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}`;
        const defaultExt = format === 'excel' ? 'xlsx' : format === 'csv' ? 'csv' : 'json';
        
        const { filePath: selectedPath, canceled } = await dialog.showSaveDialog({
          title: 'Exportar datos',
          defaultPath: path.join(app.getPath('documents'), `${defaultName}.${defaultExt}`),
          filters: [
            { name: 'Archivos Excel', extensions: ['xlsx'] },
            { name: 'Archivos CSV', extensions: ['csv'] },
            { name: 'Archivos JSON', extensions: ['json'] }
          ],
          properties: ['createDirectory']
        });
        
        if (canceled || !selectedPath) {
          return { success: false, message: 'Exportación cancelada por el usuario' };
        }
        
        filePath = selectedPath;
      } else {
        // Si no se selecciona carpeta, exportar al directorio de datos de la aplicación
        const exportDir = path.join(app.getPath('userData'), 'exports');
        if (!fs.existsSync(exportDir)) {
          fs.mkdirSync(exportDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const ext = format === 'excel' ? 'xlsx' : format === 'csv' ? 'csv' : 'json';
        filePath = path.join(exportDir, `servitecgas-export-${dataType}-${timestamp}.${ext}`);
      }
      
      // Exportar según el formato
      switch (format) {
        case 'excel':
          await this._exportToExcel(dataToExport, filePath);
          break;
        case 'csv':
          await this._exportToCSV(dataToExport, filePath);
          break;
        case 'json':
        default:
          await this._exportToJSON(dataToExport, filePath);
      }
      
      return {
        success: true,
        message: `Datos exportados correctamente a: ${filePath}`,
        filePath,
        dataType,
        format
      };
    } catch (error) {
      console.error('Error al exportar datos:', error);
      return {
        success: false,
        message: `Error al exportar datos: ${error.message}`
      };
    }
  }
  
  /**
   * Genera un reporte según el tipo y opciones
   * @param {Object} options - Opciones del reporte
   * @returns {Promise<Object>} - Resultado de la generación
   */
  async generateReport(options = {}) {
    try {
      const { 
        reportType = 'maintenance',
        options: reportOptions = {}
      } = options;
      
      // Opciones de formato
      const { 
        format = 'pdf', 
        selectFolder = true,
        includeCharts = true
      } = reportOptions;
      
      // Preparar datos del reporte según el tipo
      let reportData = {};
      
      switch (reportType) {
        case 'maintenance':
          reportData = this._prepareMaintenanceReport(reportOptions);
          break;
        case 'clients':
          reportData = this._prepareClientsReport(reportOptions);
          break;
        case 'installation-type':
          reportData = this._prepareInstallationTypeReport(reportOptions);
          break;
        case 'components':
          reportData = this._prepareComponentsReport(reportOptions);
          break;
        default:
          throw new Error(`Tipo de reporte no soportado: ${reportType}`);
      }
      
      // Determinar la ruta de destino
      let filePath;
      if (selectFolder) {
        const defaultName = `servitecgas-reporte-${reportType}-${new Date().toISOString().split('T')[0]}`;
        const defaultExt = format;
        
        const { filePath: selectedPath, canceled } = await dialog.showSaveDialog({
          title: 'Guardar reporte',
          defaultPath: path.join(app.getPath('documents'), `${defaultName}.${defaultExt}`),
          filters: [
            { name: 'Documentos PDF', extensions: ['pdf'] },
            { name: 'Archivos Excel', extensions: ['xlsx'] },
            { name: 'Archivos CSV', extensions: ['csv'] },
            { name: 'Archivos JSON', extensions: ['json'] }
          ],
          properties: ['createDirectory']
        });
        
        if (canceled || !selectedPath) {
          return { success: false, message: 'Generación cancelada por el usuario' };
        }
        
        filePath = selectedPath;
      } else {
        // Si no se selecciona carpeta, exportar al directorio de reportes
        const reportDir = path.join(app.getPath('userData'), 'reports');
        if (!fs.existsSync(reportDir)) {
          fs.mkdirSync(reportDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        filePath = path.join(reportDir, `servitecgas-reporte-${reportType}-${timestamp}.${format}`);
      }
      
      // Generar el reporte según el formato
      switch (format) {
        case 'pdf':
          // En una implementación real, aquí usarías una biblioteca para generar PDFs
          // Como puppeteer o pdfkit. Por simplicidad, generamos un JSON en su lugar.
          await this._exportToJSON({
            reportType,
            generatedAt: new Date().toISOString(),
            data: reportData
          }, filePath.replace('.pdf', '.json'));
          break;
        case 'excel':
          await this._exportReportToExcel(reportData, reportType, filePath);
          break;
        case 'csv':
          await this._exportReportToCSV(reportData, reportType, filePath);
          break;
        case 'json':
        default:
          await this._exportToJSON({
            reportType,
            generatedAt: new Date().toISOString(),
            data: reportData
          }, filePath);
      }
      
      return {
        success: true,
        message: `Reporte generado correctamente: ${filePath}`,
        filePath,
        reportType
      };
    } catch (error) {
      console.error('Error al generar reporte:', error);
      return {
        success: false,
        message: `Error al generar reporte: ${error.message}`
      };
    }
  }
  
  /**
   * Exporta datos a formato Excel
   * @param {Object} data - Datos a exportar
   * @param {string} filePath - Ruta del archivo
   * @private
   */
  async _exportToExcel(data, filePath) {
    const workbook = xlsx.utils.book_new();
    
    // Crear hoja para cada tipo de datos
    Object.entries(data).forEach(([key, value]) => {
      if (!Array.isArray(value) || value.length === 0) return;
      
      const worksheet = xlsx.utils.json_to_sheet(value);
      xlsx.utils.book_append_sheet(workbook, worksheet, key);
    });
    
    // Guardar archivo
    xlsx.writeFile(workbook, filePath);
  }
  
  /**
   * Exporta un reporte a formato Excel
   * @param {Object} data - Datos del reporte
   * @param {string} reportType - Tipo de reporte
   * @param {string} filePath - Ruta del archivo
   * @private
   */
  async _exportReportToExcel(data, reportType, filePath) {
    const workbook = xlsx.utils.book_new();
    
    // Hoja principal del reporte
    if (data.mainData && Array.isArray(data.mainData)) {
      const worksheet = xlsx.utils.json_to_sheet(data.mainData);
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Reporte Principal');
    }
    
    // Hojas adicionales si hay datos detallados
    if (data.details && typeof data.details === 'object') {
      Object.entries(data.details).forEach(([key, value]) => {
        if (!Array.isArray(value) || value.length === 0) return;
        
        const worksheet = xlsx.utils.json_to_sheet(value);
        xlsx.utils.book_append_sheet(workbook, worksheet, key);
      });
    }
    
    // Si no hay datos específicos, usar todo el objeto
    if (!data.mainData && !data.details) {
      const worksheet = xlsx.utils.json_to_sheet([data]);
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Reporte');
    }
    
    // Guardar archivo
    xlsx.writeFile(workbook, filePath);
  }
  
  /**
   * Exporta datos a formato CSV
   * @param {Object} data - Datos a exportar
   * @param {string} filePath - Ruta del archivo
   * @private
   */
  async _exportToCSV(data, filePath) {
    // Para CSV, seleccionamos solo el primer conjunto de datos
    // ya que un CSV solo puede representar una tabla
    let csvData = [];
    let key = '';
    
    for (const [dataKey, value] of Object.entries(data)) {
      if (Array.isArray(value) && value.length > 0) {
        csvData = value;
        key = dataKey;
        break;
      }
    }
    
    if (csvData.length === 0) {
      fs.writeFileSync(filePath, '');
      return;
    }
    
    const worksheet = xlsx.utils.json_to_sheet(csvData);
    const csv = xlsx.utils.sheet_to_csv(worksheet);
    fs.writeFileSync(filePath, csv);
    
    // Si hay más conjuntos de datos, crear archivos adicionales
    let fileIndex = 1;
    for (const [dataKey, value] of Object.entries(data)) {
      if (dataKey === key || !Array.isArray(value) || value.length === 0) continue;
      
      const additionalPath = filePath.replace('.csv', `-${dataKey}.csv`);
      const additionalWorksheet = xlsx.utils.json_to_sheet(value);
      const additionalCsv = xlsx.utils.sheet_to_csv(additionalWorksheet);
      fs.writeFileSync(additionalPath, additionalCsv);
      fileIndex++;
    }
  }
  
  /**
   * Exporta un reporte a formato CSV
   * @param {Object} data - Datos del reporte
   * @param {string} reportType - Tipo de reporte
   * @param {string} filePath - Ruta del archivo
   * @private
   */
  async _exportReportToCSV(data, reportType, filePath) {
    // Para CSV, usamos los datos principales
    let csvData = data.mainData || [];
    
    if (!Array.isArray(csvData) || csvData.length === 0) {
      // Si no hay datos principales, usar el primer conjunto de detalles
      if (data.details && typeof data.details === 'object') {
        for (const [key, value] of Object.entries(data.details)) {
          if (Array.isArray(value) && value.length > 0) {
            csvData = value;
            break;
          }
        }
      }
    }
    
    if (csvData.length === 0) {
      // Si no hay datos estructurados, usar todo el objeto
      csvData = [data];
    }
    
    const worksheet = xlsx.utils.json_to_sheet(csvData);
    const csv = xlsx.utils.sheet_to_csv(worksheet);
    fs.writeFileSync(filePath, csv);
  }
  
  /**
   * Exporta datos a formato JSON
   * @param {Object} data - Datos a exportar
   * @param {string} filePath - Ruta del archivo
   * @private
   */
  async _exportToJSON(data, filePath) {
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonData);
  }
  
  /**
   * Prepara datos para un reporte de mantenimientos
   * @param {Object} options - Opciones del reporte
   * @returns {Object} - Datos del reporte
   * @private
   */
  _prepareMaintenanceReport(options) {
    const { 
      startDate, 
      endDate, 
      statuses = ['pending', 'completed', 'urgent'] 
    } = options;
    
    const installations = this.store.get('installations') || [];
    const clients = this.store.get('clients') || [];
    const maintenanceHistory = this.store.get('maintenanceHistory') || [];
    
    // Filtrar por fecha si se proporcionan
    let filteredHistory = [...maintenanceHistory];
    if (startDate) {
      const startDateObj = new Date(startDate);
      filteredHistory = filteredHistory.filter(m => {
        const mDate = new Date(m.date);
        return mDate >= startDateObj;
      });
    }
    
    if (endDate) {
      const endDateObj = new Date(endDate);
      filteredHistory = filteredHistory.filter(m => {
        const mDate = new Date(m.date);
        return mDate <= endDateObj;
      });
    }
    
    // Obtener mantenimientos pendientes
    const upcomingMaintenance = this._getUpcomingMaintenance();
    
    // Filtrar por estado
    let maintenanceData = [];
    
    if (statuses.includes('completed')) {
      // Agregar mantenimientos completados
      filteredHistory.forEach(m => {
        const installation = installations.find(i => i.id === m.installationId);
        const client = installation 
          ? clients.find(c => c.id === installation.clientId) 
          : null;
        
        maintenanceData.push({
          id: m.id,
          fecha: m.date,
          componente: m.componentName || 'Desconocido',
          direccion: installation ? installation.address : 'Desconocida',
          cliente: client ? client.name : 'Desconocido',
          estado: 'Completado',
          notas: m.notes || ''
        });
      });
    }
    
    if (statuses.includes('pending') || statuses.includes('urgent')) {
      // Agregar mantenimientos pendientes
      upcomingMaintenance.forEach(m => {
        if ((statuses.includes('urgent') && m.daysLeft <= 7) || 
            (statuses.includes('pending') && m.daysLeft > 7)) {
          maintenanceData.push({
            id: m.componentId,
            fecha: m.nextMaintenanceDate,
            componente: m.componentName,
            direccion: m.address,
            cliente: m.clientName,
            estado: m.daysLeft <= 0 ? 'Vencido' : m.daysLeft <= 7 ? 'Urgente' : 'Pendiente',
            diasRestantes: m.daysLeft
          });
        }
      });
    }
    
    // Ordenar por fecha
    maintenanceData.sort((a, b) => {
      const dateA = new Date(a.fecha);
      const dateB = new Date(b.fecha);
      return dateA - dateB;
    });
    
    // Calcular estadísticas
    const stats = {
      totalMantenimientos: maintenanceData.length,
      completados: maintenanceData.filter(m => m.estado === 'Completado').length,
      pendientes: maintenanceData.filter(m => m.estado === 'Pendiente').length,
      urgentes: maintenanceData.filter(m => m.estado === 'Urgente' || m.estado === 'Vencido').length
    };
    
    return {
      mainData: maintenanceData,
      stats,
      options
    };
  }
  
  /**
   * Prepara datos para un reporte de clientes
   * @param {Object} options - Opciones del reporte
   * @returns {Object} - Datos del reporte
   * @private
   */
  _prepareClientsReport(options) {
    const { 
      includeInstallations = true,
      includeComponents = true,
      includeContactInfo = true
    } = options;
    
    const clients = this.store.get('clients') || [];
    const installations = this.store.get('installations') || [];
    
    // Datos principales: clientes
    const clientsData = clients.map(client => {
      const clientData = {
        id: client.id,
        nombre: client.name,
        cantidadInstalaciones: installations.filter(i => i.clientId === client.id).length
      };
      
      if (includeContactInfo) {
        clientData.telefono = client.phone || '';
        clientData.email = client.email || '';
      }
      
      if (client.notes) {
        clientData.notas = client.notes;
      }
      
      return clientData;
    });
    
    // Datos adicionales si se solicitan
    const details = {};
    
    if (includeInstallations) {
      details.instalaciones = [];
      
      clients.forEach(client => {
        const clientInstallations = installations.filter(i => i.clientId === client.id);
        
        clientInstallations.forEach(installation => {
          const installationData = {
            idCliente: client.id,
            nombreCliente: client.name,
            idInstalacion: installation.id,
            direccion: installation.address,
            tipo: installation.type || 'No especificado',
            fecha: installation.date || ''
          };
          
          details.instalaciones.push(installationData);
          
          if (includeComponents && installation.components) {
            if (!details.componentes) {
              details.componentes = [];
            }
            
            installation.components.forEach(component => {
              details.componentes.push({
                idInstalacion: installation.id,
                direccion: installation.address,
                nombreCliente: client.name,
                idComponente: component.id,
                componente: component.name,
                modelo: component.model || '',
                ultimaMantencion: component.lastMaintenanceDate || '',
                proximaMantencion: component.nextMaintenanceDate || '',
                frecuencia: component.frequency || 12
              });
            });
          }
        });
      });
    }
    
    return {
      mainData: clientsData,
      details,
      options
    };
  }
  
  /**
   * Prepara datos para un reporte por tipo de instalación
   * @param {Object} options - Opciones del reporte
   * @returns {Object} - Datos del reporte
   * @private
   */
  _prepareInstallationTypeReport(options) {
    const { 
      types = ['Residencial', 'Comercial', 'Industrial'],
      groupBy = 'client'
    } = options;
    
    const installations = this.store.get('installations') || [];
    const clients = this.store.get('clients') || [];
    
    // Filtrar instalaciones por tipo
    const filteredInstallations = installations.filter(
      i => types.includes(i.type)
    );
    
    // Datos según agrupación
    let mainData = [];
    
    switch (groupBy) {
      case 'client':
        // Agrupar por cliente
        clients.forEach(client => {
          const clientInstallations = filteredInstallations.filter(
            i => i.clientId === client.id
          );
          
          if (clientInstallations.length === 0) return;
          
          // Contar por tipo
          const typeCounts = {};
          types.forEach(type => {
            typeCounts[type] = clientInstallations.filter(i => i.type === type).length;
          });
          
          // Crear entrada por cliente
          const entry = {
            cliente: client.name,
            total: clientInstallations.length
          };
          
          // Agregar conteos por tipo
          types.forEach(type => {
            entry[type] = typeCounts[type];
          });
          
          mainData.push(entry);
        });
        break;
        
      case 'component':
        // Agrupar por componente
        const componentTypes = new Set();
        
        // Obtener todos los tipos de componentes
        filteredInstallations.forEach(installation => {
          if (!installation.components) return;
          
          installation.components.forEach(component => {
            if (component.name) {
              componentTypes.add(component.name);
            }
          });
        });
    // Para cada tipo de componente, contar instalaciones por tipo
    Array.from(componentTypes).forEach(componentName => {
        const entry = {
          componente: componentName,
          total: 0
        };
        
        // Inicializar contadores por tipo
        types.forEach(type => {
          entry[type] = 0;
        });
        
        // Contar por tipo de instalación
        filteredInstallations.forEach(installation => {
          if (!installation.components) return;
          
          const hasComponent = installation.components.some(
            c => c.name === componentName
          );
          
          if (hasComponent && types.includes(installation.type)) {
            entry[installation.type]++;
            entry.total++;
          }
        });
        
        if (entry.total > 0) {
          mainData.push(entry);
        }
      });
      break;
      
    case 'date':
      // Agrupar por fecha (año-mes)
      const dateMap = new Map();
      
      filteredInstallations.forEach(installation => {
        if (!installation.date) return;
        
        const date = new Date(installation.date);
        const yearMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        if (!dateMap.has(yearMonth)) {
          const entry = {
            fecha: yearMonth,
            total: 0
          };
          
          // Inicializar contadores por tipo
          types.forEach(type => {
            entry[type] = 0;
          });
          
          dateMap.set(yearMonth, entry);
        }
        
        const entry = dateMap.get(yearMonth);
        entry.total++;
        
        if (types.includes(installation.type)) {
          entry[installation.type]++;
        }
      });
      
      // Convertir mapa a array y ordenar por fecha
      mainData = Array.from(dateMap.values()).sort((a, b) => {
        return a.fecha.localeCompare(b.fecha);
      });
      break;
  }
  
  // Detalles por tipo
  const details = {};
  types.forEach(type => {
    const typeInstallations = filteredInstallations.filter(i => i.type === type);
    
    details[type] = typeInstallations.map(installation => {
      const client = clients.find(c => c.id === installation.clientId);
      
      return {
        id: installation.id,
        direccion: installation.address,
        cliente: client ? client.name : 'Desconocido',
        fecha: installation.date || '',
        componentes: installation.components ? installation.components.length : 0
      };
    });
  });
  
  // Agregar estadísticas
  const stats = {
    totalInstalaciones: filteredInstallations.length
  };
  
  types.forEach(type => {
    stats[type] = filteredInstallations.filter(i => i.type === type).length;
  });
  
  return {
    mainData,
    details,
    stats,
    options
  };
}

/**
 * Prepara datos para un reporte de componentes
 * @param {Object} options - Opciones del reporte
 * @returns {Object} - Datos del reporte
 * @private
 */
_prepareComponentsReport(options) {
  const { 
    componentType = '',
    sortBy = 'name'
  } = options;
  
  const installations = this.store.get('installations') || [];
  const clients = this.store.get('clients') || [];
  
  // Extraer todos los componentes
  let allComponents = [];
  
  installations.forEach(installation => {
    const client = clients.find(c => c.id === installation.clientId);
    
    if (!installation.components) return;
    
    installation.components.forEach(component => {
      // Filtrar por tipo si se especifica
      if (componentType && component.name && 
          !component.name.toLowerCase().includes(componentType.toLowerCase())) {
        return;
      }
      
      allComponents.push({
        id: component.id,
        nombre: component.name || 'Sin nombre',
        modelo: component.model || '',
        instalacion: installation.id,
        direccion: installation.address,
        cliente: client ? client.name : 'Desconocido',
        tipoInstalacion: installation.type || 'No especificado',
        fechaInstalacion: installation.date || '',
        ultimaMantencion: component.lastMaintenanceDate || '',
        proximaMantencion: component.nextMaintenanceDate || '',
        frecuencia: component.frequency || 12,
        notas: component.notes || ''
      });
    });
  });
  
  // Ordenar según criterio
  switch (sortBy) {
    case 'name':
      allComponents.sort((a, b) => a.nombre.localeCompare(b.nombre));
      break;
    case 'installation_date':
      allComponents.sort((a, b) => {
        if (!a.fechaInstalacion) return 1;
        if (!b.fechaInstalacion) return -1;
        return new Date(a.fechaInstalacion) - new Date(b.fechaInstalacion);
      });
      break;
    case 'next_maintenance':
      allComponents.sort((a, b) => {
        if (!a.proximaMantencion) return 1;
        if (!b.proximaMantencion) return -1;
        return new Date(a.proximaMantencion) - new Date(b.proximaMantencion);
      });
      break;
    case 'client':
      allComponents.sort((a, b) => a.cliente.localeCompare(b.cliente));
      break;
  }
  
  // Agrupar por tipo de componente para estadísticas
  const componentsByType = {};
  allComponents.forEach(component => {
    if (!componentsByType[component.nombre]) {
      componentsByType[component.nombre] = [];
    }
    componentsByType[component.nombre].push(component);
  });
  
  // Crear estadísticas
  const stats = {
    totalComponentes: allComponents.length,
    tiposDeComponentes: Object.keys(componentsByType).length
  };
  
  // Detalles por tipo de componente
  const details = {
    componentesPorTipo: Object.entries(componentsByType).map(([tipo, componentes]) => ({
      tipo,
      cantidad: componentes.length,
      pendienteMantenimiento: componentes.filter(c => c.proximaMantencion).length
    }))
  };
  
  return {
    mainData: allComponents,
    details,
    stats,
    options
  };
}

/**
 * Obtiene los mantenimientos próximos
 * @param {number} daysThreshold - Días de umbral
 * @returns {Array} - Lista de mantenimientos próximos
 * @private
 */
_getUpcomingMaintenance(daysThreshold = 30) {
  const installations = this.store.get('installations') || [];
  const clients = this.store.get('clients') || [];
  const today = new Date();
  const upcomingMaintenance = [];
  
  installations.forEach(installation => {
    if (!installation.components) return;
    
    installation.components.forEach(component => {
      if (component.nextMaintenanceDate) {
        const nextMaintenance = new Date(component.nextMaintenanceDate);
        const diffDays = Math.floor((nextMaintenance - today) / (1000 * 60 * 60 * 24));
        
        // Incluir también mantenimientos vencidos (días negativos)
        if (diffDays <= daysThreshold) {
          const client = clients.find(c => c.id === installation.clientId);
          
          upcomingMaintenance.push({
            clientId: installation.clientId,
            clientName: client ? client.name : 'Cliente desconocido',
            clientPhone: client ? client.phone : '',
            installationId: installation.id,
            address: installation.address,
            componentId: component.id,
            componentName: component.name,
            lastMaintenanceDate: component.lastMaintenanceDate,
            nextMaintenanceDate: component.nextMaintenanceDate,
            daysLeft: diffDays
          });
        }
      }
    });
  });
  
  return upcomingMaintenance;
}
}

module.exports = ReportService;