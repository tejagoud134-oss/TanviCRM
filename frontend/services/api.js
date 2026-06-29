// Base Axios Service configuration for Tanvi Boutique Full Stack API client

const API_BASE_URL = '/api'; // Proxied locally or via Nginx

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Inject JWT token into headers if logged in
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('tb_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    // Track user identity header context
    const user = JSON.parse(localStorage.getItem('tb_user') || '{}');
    if (user && user.name) {
      config.headers['X-User-Name'] = user.name;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Catch authorization and network gateway issues
apiClient.interceptors.response.use(
  response => response,
  error => {
    const status = error.response ? error.response.status : null;
    
    if (status === 401 || status === 403) {
      console.warn('Authentication failure or session timeout. Logging out.');
      // Auto Sign out client
      localStorage.removeItem('tb_token');
      localStorage.removeItem('tb_user');
      const loginOverlay = document.getElementById('loginOverlay');
      if (loginOverlay) {
        loginOverlay.style.display = 'flex';
      }
    }
    
    // Format error message
    let errorMsg = 'Network request failed. Please verify connection.';
    if (error.response && error.response.data && error.response.data.detail) {
      errorMsg = error.response.data.detail;
    } else if (error.response && error.response.data && error.response.data.message) {
      errorMsg = error.response.data.message;
    }
    
    error.formattedMessage = errorMsg;
    return Promise.reject(error);
  }
);
