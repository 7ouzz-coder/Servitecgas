// Función para formatear fechas
function formatDate(dateString) {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

// Configurar botones de eliminar
function setupDeleteButtons(buttons, type, confirmCallback) {
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-id');
      const name = button.getAttribute('data-name') || 'este elemento';
      
      // Configurar modal de confirmación
      document.getElementById('deleteConfirmMessage').textContent = `¿Estás seguro de que deseas eliminar ${type === 'client' ? 'al cliente' : 'la instalación'} "${name}"?`;
      document.getElementById('deleteItemId').value = id;
      document.getElementById('deleteItemType').value = type;
      
      // Mostrar modal
      const deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
      deleteModal.show();
      
      // Configurar botón de confirmación
      const confirmBtn = document.getElementById('confirmDeleteBtn');
      confirmBtn.onclick = () => {
        confirmCallback(id);
        deleteModal.hide();
      };
    });
  });
}

// Crear plantilla de mensajes predefinidos
function createMessageTemplate(type, data) {
  switch (type) {
    case 'maintenance':
      return `Estimado/a ${data.clientName},\n\nLe recordamos que su ${data.componentName} en ${data.address} requiere mantenimiento programado en los próximos días (${formatDate(data.nextMaintenanceDate)}).\n\nPor favor, contáctenos para agendar una visita.\n\nGracias,\nServicio Técnico de Gas`;
    
    case 'followup':
      return `Estimado/a ${data.clientName},\n\nEsperamos que su instalación de gas esté funcionando correctamente. Queremos recordarle que estamos disponibles para cualquier consulta o servicio que necesite.\n\nGracias por confiar en nosotros.\n\nSaludos cordiales,\nServicio Técnico de Gas`;
    
    default:
      return '';
  }
}

// Mostrar modal de QR para WhatsApp
function showWhatsAppQrModal(qrData) {
  // Crear modal para mostrar QR
  const modalHtml = `
    <div class="modal fade" id="whatsappQrModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Conectar WhatsApp</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body text-center">
            <p>Escanea este código QR con WhatsApp en tu teléfono:</p>
            <div id="qrcode-container" class="my-3"></div>
            <p class="small text-muted">Abre WhatsApp en tu teléfono > Menú > WhatsApp Web > Escanear código QR</p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Agregar modal al DOM si no existe
  if (!document.getElementById('whatsappQrModal')) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    document.body.appendChild(tempDiv.firstElementChild);
  }
  
  // Mostrar el QR
  const qrContainer = document.getElementById('qrcode-container');
  // Aquí se usaría una biblioteca para generar QR, pero por simplicidad:
  qrContainer.innerHTML = `<div class="alert alert-info">Código QR generado</div>`;
  
  // Mostrar modal
  const qrModal = new bootstrap.Modal(document.getElementById('whatsappQrModal'));
  qrModal.show();
}