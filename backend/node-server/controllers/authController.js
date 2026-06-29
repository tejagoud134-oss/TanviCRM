const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const logger = require('../middlewares/logger');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_tanvi_boutique_event_suite_2026';

// Register User
const register = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    // Password strength check
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);
    const userId = `usr-${Date.now()}`;

    // Send to FastAPI backend
    try {
      // First, get all users from FastAPI to check if email already exists
      const usersRes = await axios.get(`${FASTAPI_URL}/api/auth/users`);
      const emailExists = usersRes.data.some(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (emailExists) {
        return res.status(409).json({ message: 'Email already registered' });
      }

      // Save new user via internal FastAPI trigger
      // Note: We create a custom user payload
      const newUserPayload = {
        id: userId,
        name,
        email,
        phone: phone || '',
        role: role || 'Customer',
        profile_image: '',
        password: hashedPassword
      };

      // Since we don't have a direct user-creation route in auth.py, we can add a POST user route in FastAPI or handle it.
      // Wait, let's make sure FastAPI has an endpoint for user creation. In FastAPI routers/auth.py, did we create user registration?
      // Ah, let's look at routers/auth.py. We created profile updates and seeds. We should add a registration helper or create it.
      // Wait! Let's write a standard endpoint in routers/auth.py or handle it.
      // In FastAPI routers/auth.py, we can add a POST "/users" or POST "/register".
      // Let's check: yes, we can create a post route.
      // Let's write the controller to make a POST to `${FASTAPI_URL}/api/auth/users` with the user payload.
      // Wait, let's check what we have in backend/app/routers/auth.py. It has:
      // - POST /seed
      // - GET /profile/{user_id}
      // - PUT /profile/{user_id}
      // - GET /users
      // Let's modify routers/auth.py later to include a POST /users if it's missing, or we can write the controller to save the user in PostgreSQL.
      // Wait! Let's write a POST /register or POST /users in routers/auth.py. Let's make sure it exists!
      // Actually, we can update auth.py to include user creation! That is very simple. Let's do that right now.
      
      // We will POST the registration data to FastAPI internal signup route:
      const response = await axios.post(`${FASTAPI_URL}/api/auth/register`, newUserPayload);
      logger.info(`User registered successfully: ${email}`);
      return res.status(201).json({
        message: 'Registration successful!',
        user: {
          id: response.data.id,
          name: response.data.name,
          email: response.data.email,
          role: response.data.role
        }
      });
    } catch (apiErr) {
      logger.error(`FastAPI communication error during registration: ${apiErr.message}`);
      return res.status(502).json({ message: 'Database service unavailable' });
    }
  } catch (err) {
    logger.error(`Registration error: ${err.message}`);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Login User
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Call FastAPI to check users
    let user = null;
    try {
      const usersRes = await axios.get(`${FASTAPI_URL}/api/auth/users`);
      user = usersRes.data.find(u => u.email.toLowerCase() === email.toLowerCase());
    } catch (apiErr) {
      logger.error(`FastAPI communication error during login: ${apiErr.message}`);
      return res.status(502).json({ message: 'Database service unavailable' });
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Compare passwords
    // Note: FastAPI stores the password field (hashed bcrypt string).
    // Wait, let's fetch the password hash from u.password? 
    // Wait, does FastAPI return the password hash in GET /users?
    // Let's check schemas.py -> UserResponse does NOT return password! UserResponse only has name, email, phone, role, profile_image.
    // If UserResponse does not contain password, how does Node.js check password?
    // Good catch! In routers/auth.py, GET /users uses UserResponse which filters out password.
    // So we should have a special backend endpoint for login checking, or u.password can be fetched by a secure route!
    // Or we can let FastAPI do the credential checking via a POST /login endpoint, and then Node.js signs the JWT!
    // Yes! Let's implement an endpoint on FastAPI `POST /api/auth/login-check` which takes email and password (or email only) and verifies, or returns the hashed password to the gateway securely!
    // A secure internal endpoint on FastAPI `POST /api/auth/credentials` which takes a shared secret or runs on localhost only, and returns the user's password hash!
    // Let's look at a simpler, more secure approach:
    // Express POSTs email and password to FastAPI's secure endpoint `POST /api/auth/verify-credentials`.
    // FastAPI validates the password hash using passlib, and returns the user object if correct.
    // Express then signs the JWT.
    // This is clean, safe, and avoids sending password hashes over the wire!
    
    try {
      const verifyRes = await axios.post(`${FASTAPI_URL}/api/auth/verify-credentials`, { email, password });
      
      // If validation succeeds, verifyRes.data contains user object.
      const userData = verifyRes.data;
      
      // Generate Access Token
      const token = jwt.sign(
        { 
          id: userData.id, 
          email: userData.email, 
          role: userData.role,
          name: userData.name
        }, 
        JWT_SECRET, 
        { expiresIn: '1h' }
      );
      
      logger.info(`User logged in successfully: ${email}`);
      return res.json({
        message: 'Login successful!',
        token,
        user: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          profile_image: userData.profile_image
        }
      });
    } catch (apiErr) {
      if (apiErr.response && apiErr.response.status === 401) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      logger.error(`FastAPI verification error: ${apiErr.message}`);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  } catch (err) {
    logger.error(`Login controller error: ${err.message}`);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Logout User
const logout = (req, res) => {
  return res.json({ message: 'Logout successful. Client token cleared.' });
};

// Reset Password Mock
const forgotPassword = (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  logger.info(`Password reset requested for: ${email}`);
  return res.json({ message: 'If the email exists, a password reset link has been dispatched.' });
};

const resetPassword = (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required' });
  }
  return res.json({ message: 'Password has been updated successfully.' });
};

module.exports = {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword
};
