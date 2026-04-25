let isSignUp = false;

function showAuthError(errorMsg, message) {
  errorMsg.textContent = message;
  errorMsg.classList.add('show');
}

// Wait for DOM to be ready
function initLoginForm() {
  const form = document.getElementById('auth-form');
  const submitBtn = document.getElementById('submit-btn');
  const toggleLink = document.getElementById('toggle-link');
  const toggleText = document.getElementById('toggle-text');
  const errorMsg = document.getElementById('error-msg');
  const title = document.querySelector('.login-title');
  const isFilePage = window.location.protocol === 'file:';

  if (!form || !submitBtn || !toggleLink) {
    console.error('Login form elements not found');
    return;
  }

  toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isSignUp = !isSignUp;
    
    if (isSignUp) {
      title.textContent = 'Create account';
      submitBtn.textContent = 'Sign Up';
      toggleText.textContent = 'Already have an account?';
      toggleLink.textContent = 'Sign In';
    } else {
      title.textContent = 'Welcome back';
      submitBtn.textContent = 'Sign In';
      toggleText.textContent = "Don't have an account?";
      toggleLink.textContent = 'Sign Up';
    }
    errorMsg.classList.remove('show');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (isFilePage) {
      showAuthError(
        errorMsg,
        'Login needs the local server. Run "npm start" and open http://127.0.0.1:3000'
      );
      return;
    }
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const endpoint = isSignUp ? '/api/register' : '/api/login';
    
    // Disable button and show loading state
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Please wait...';
    errorMsg.classList.remove('show');
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Check if we're in modal or standalone page
        if (typeof closeLoginModal === 'function' && typeof goToChat === 'function') {
          closeLoginModal();
          goToChat();
        } else {
          // Redirect to main page
          window.location.href = '/index.html';
        }
      } else {
        showAuthError(errorMsg, data.error || 'Authentication failed');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    } catch (err) {
      console.error('Login error:', err);
      showAuthError(errorMsg, 'Connection error. Make sure the server is running with npm start.');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLoginForm);
} else {
  initLoginForm();
}
