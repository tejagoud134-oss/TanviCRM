const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const logger = require('../middlewares/logger');

// Configure Cloudinary if keys exist
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Cloudinary upload
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'tanvi_boutique'
        });
        
        // Remove temp file from local uploads folder
        fs.unlinkSync(req.file.path);
        
        logger.info(`Image uploaded to Cloudinary: ${result.secure_url}`);
        return res.json({ imageUrl: result.secure_url });
      } catch (cloudErr) {
        logger.error(`Cloudinary upload failed: ${cloudErr.message}. Falling back to local storage.`);
      }
    }

    // Local file fallback
    const host = req.get('host');
    const protocol = req.protocol;
    const localUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    
    logger.info(`Image saved locally: ${localUrl}`);
    return res.json({ imageUrl: localUrl });

  } catch (err) {
    logger.error(`Upload controller error: ${err.message}`);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  uploadImage
};
