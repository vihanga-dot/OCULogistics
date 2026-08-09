// Cloudinary Upload Functions
import { CLOUDINARY_CONFIG } from './firebase-config.js';

/**
 * Upload image to Cloudinary
 * @param {File} file - Image file to upload
 * @param {Function} progressCallback - Optional progress callback
 * @returns {Promise<string>} - URL of uploaded image
 */
export async function uploadToCloudinary(file, progressCallback = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    formData.append('folder', 'logistics-club');
    
    try {
        const xhr = new XMLHttpRequest();
        
        return new Promise((resolve, reject) => {
            // Progress tracking
            if (progressCallback) {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        progressCallback(percentComplete);
                    }
                });
            }
            
            // Success handler
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response.secure_url);
                } else {
                    reject(new Error('Upload failed: ' + xhr.statusText));
                }
            });
            
            // Error handler
            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed'));
            });
            
            // Send request
            xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`);
            xhr.send(formData);
        });
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
}

/**
 * Optimize Cloudinary image URL
 * @param {string} url - Cloudinary image URL
 * @param {object} options - Transformation options
 * @returns {string} - Optimized URL
 */
export function optimizeCloudinaryUrl(url, options = {}) {
    const {
        width = 800,
        height = 600,
        quality = 'auto',
        format = 'auto'
    } = options;
    
    if (!url || !url.includes('cloudinary.com')) {
        return url;
    }
    
    // Insert transformations into URL
    const parts = url.split('/upload/');
    if (parts.length === 2) {
        return `${parts[0]}/upload/w_${width},h_${height},c_fill,q_${quality},f_${format}/${parts[1]}`;
    }
    
    return url;
}

/**
 * Validate image file
 * @param {File} file - File to validate
 * @returns {object} - Validation result
 */
export function validateImageFile(file) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!file) {
        return { valid: false, error: 'No file selected' };
    }
    
    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: 'Invalid file type. Please upload JPG, PNG, GIF, or WebP' };
    }
    
    if (file.size > maxSize) {
        return { valid: false, error: 'File size must be less than 10MB' };
    }
    
    return { valid: true };
}