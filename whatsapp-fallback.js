// whatsapp-fallback-small.js - Versión con QR pequeño
// Guardar este archivo en la raíz del proyecto y ejecutar con: node whatsapp-fallback-small.js

const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Ubicación para guardar la sesión
const SESSION_FILE_PATH = path.join(__dirname, 'whatsapp-session.json');

console.log('Iniciando cliente de WhatsApp (QR tamaño pequeño)...');

// Verificar si hay una sesión guardada
let sessionData;
if (fs.existsSync(SESSION_FILE_PATH)) {
    console.log('Cargando sesión existente...');
    try {
        sessionData = JSON.parse(fs.readFileSync(SESSION_FILE_PATH, 'utf8'));
    } catch (error) {
        console.error('Error al leer archivo de sesión:', error);
        console.log('Se creará una nueva sesión');
    }
}

// Opciones de cliente de WhatsApp
const clientOptions = {
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas'
        ]
    }
};

// Si hay datos de sesión, usarlos
if (sessionData) {
    clientOptions.session = sessionData;
}

// Crear cliente
const client = new Client(clientOptions);

// Registrar evento para código QR
client.on('qr', qr => {
    console.log('==== CÓDIGO QR (PEQUEÑO) ====');
    qrcode.generate(qr, { small: true }); // Forzar tamaño pequeño
    console.log('============================');
    console.log('Escanea este código QR con WhatsApp en tu teléfono');
    console.log('Pasos: WhatsApp > Menú > Dispositivos vinculados > Vincular un dispositivo');
});

// Evento para cuando se autentica
client.on('authenticated', (session) => {
    console.log('¡AUTENTICADO CORRECTAMENTE!');
    
    // Guardar sesión
    sessionData = session;
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session), 'utf8');
    console.log('Sesión guardada en:', SESSION_FILE_PATH);
    console.log('Puedes usar este archivo en la aplicación principal');
});

// Evento para cuando el cliente está listo
client.on('ready', () => {
    console.log('¡Cliente de WhatsApp LISTO!');
    console.log('La conexión se ha realizado correctamente');
    console.log('Ahora puedes cerrar este proceso con Ctrl+C');
    console.log('Y usar la aplicación principal');
});

// Eventos de error
client.on('auth_failure', (error) => {
    console.error('ERROR DE AUTENTICACIÓN:', error);
    if (fs.existsSync(SESSION_FILE_PATH)) {
        fs.unlinkSync(SESSION_FILE_PATH);
    }
    console.log('Archivo de sesión eliminado. Por favor, intenta nuevamente.');
});

client.on('disconnected', (reason) => {
    console.log('Cliente desconectado:', reason);
    if (fs.existsSync(SESSION_FILE_PATH)) {
        fs.unlinkSync(SESSION_FILE_PATH);
    }
    console.log('Archivo de sesión eliminado. Por favor, intenta nuevamente.');
    process.exit();
});

// Inicializar cliente
console.log('Inicializando cliente de WhatsApp...');
console.log('Por favor, espera a que aparezca el código QR...');

client.initialize().catch(error => {
    console.error('Error al inicializar cliente:', error);
});

// Manejar salida limpia
process.on('SIGINT', () => {
    console.log('Cerrando cliente de WhatsApp...');
    client.destroy().then(() => {
        console.log('Cliente cerrado correctamente');
        process.exit(0);
    }).catch(error => {
        console.error('Error al cerrar cliente:', error);
        process.exit(1);
    });
});