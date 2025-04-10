document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos del DOM
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    const errorMessage = document.getElementById('errorMessage');
    const togglePasswordButton = document.getElementById('togglePassword');
    const rememberMeCheckbox = document.getElementById('rememberMe');
  
    // Función para mostrar mensaje de error
    function showError(message) {
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
      
      // Ocultar el mensaje después de 5 segundos
      setTimeout(() => {
        errorMessage.style.display = 'none';
      }, 5000);
    }
    
    // Cargar usuario guardado si existe
    if (localStorage.getItem('rememberedUser')) {
      usernameInput.value = localStorage.getItem('rememberedUser');
      rememberMeCheckbox.checked = true;
    }
    
    // Función para intentar hacer login
    async function attemptLogin() {
      loginButton.disabled = true;
      const originalText = loginButton.innerHTML;
      loginButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Iniciando sesión...';
      
      try {
        const result = await window.api.login({
          username: usernameInput.value,
          password: passwordInput.value
        });
        
        if (result.success) {
          // Guardar usuario si "recordar" está marcado
          if (rememberMeCheckbox.checked) {
            localStorage.setItem('rememberedUser', usernameInput.value);
          } else {
            localStorage.removeItem('rememberedUser');
          }
          
          // Redirigir a la página principal
          window.location.href = 'index.html';
        } else {
          showError(result.message || 'Usuario o contraseña incorrectos');
          loginButton.disabled = false;
          loginButton.innerHTML = originalText;
        }
      } catch (error) {
        console.error('Error al intentar iniciar sesión:', error);
        showError('Error al intentar iniciar sesión. Inténtelo de nuevo más tarde.');
        loginButton.disabled = false;
        loginButton.innerHTML = originalText;
      }
    }
  
    // Manejar envío del formulario
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Validación básica
      if (!usernameInput.value || !passwordInput.value) {
        showError('Por favor complete todos los campos');
        return;
      }
      
      attemptLogin();
    });
    
    // Botón para mostrar/ocultar contraseña
    togglePasswordButton.addEventListener('click', () => {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        togglePasswordButton.innerHTML = '<i class="bi bi-eye-slash"></i>';
      } else {
        passwordInput.type = 'password';
        togglePasswordButton.innerHTML = '<i class="bi bi-eye"></i>';
      }
    });
    
    // Verificar si ya hay una sesión activa
    window.api.checkAuth().then(result => {
      if (result.isAuthenticated) {
        // Si ya hay sesión, redirigir a la página principal
        window.location.href = 'index.html';
      }
    }).catch(error => {
      console.error('Error al verificar autenticación:', error);
    });
  });