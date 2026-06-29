const express = require('express');
const multer = require('multer');
const path = require('path');
const uploadController = require('../controllers/uploadController');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// Setup disk storage for local temp files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save to the absolute/relative upload directory
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Image file validation filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format Error: Only JPEG, PNG, WEBP, and GIF images are supported'), false);
  }
};

// Initialize multer upload middleware (max 5MB limit)
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.post('/', authenticateToken, upload.single('image'), uploadController.uploadImage);

// Error handling middleware for upload errors (like size limit)
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Upload Error: File size exceeds the maximum 5MB limit' });
    }
    return res.status(400).json({ message: `Multer Error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
});

module.exports = router;
