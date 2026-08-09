// Admin Dashboard JavaScript
import { db } from './firebase-config.js';
import { auth } from './firebase-config.js';
import { uploadToCloudinary, optimizeCloudinaryUrl, validateImageFile } from './cloudinary-upload.js';
import { initAuth, getCurrentUser, hasAccess, ACCESS_LEVELS, logout, createUser, onAuthResolved } from './auth.js';
import { escapeHTML, safeUrl, showNotification, DRIVE_HOSTS, FACEBOOK_HOSTS } from './utils.js';
import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    getDocs, 
    query,
    orderBy,
    serverTimestamp,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentSection = 'posts';
let editingId = null;

function getAccessLevelLabel(level) {
    switch (level) {
        case ACCESS_LEVELS.MANAGEMENT:
            return 'Management';
        case ACCESS_LEVELS.EDITOR:
            return 'Editor';
        case ACCESS_LEVELS.MEMBER:
            return 'Member';
        default:
            return 'Public';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    onAuthResolved(checkAdminAccess);
    initAdminPanel();
});

/**
 * Check admin access
 */
function checkAdminAccess() {
    const user = getCurrentUser();
    
    if (!user || user.accessLevel < ACCESS_LEVELS.EDITOR) {
        alert('Access denied. You need editor or management privileges.');
        window.location.href = 'index.html';
        return;
    }
    
    // Hide management-only sections for editors
    if (user.accessLevel < ACCESS_LEVELS.MANAGEMENT) {
        document.querySelectorAll('.management-only').forEach(el => {
            el.style.display = 'none';
        });
    } else {
        document.querySelectorAll('.management-only').forEach(el => {
            el.style.display = 'block';
        });
    }
    
    // Display user info
    const adminName = document.getElementById('admin-name');
    const adminAccessLevel = document.getElementById('admin-access-level');
    if (adminName) {
        adminName.textContent = user.name || user.email;
    }
    if (adminAccessLevel) {
        adminAccessLevel.textContent = getAccessLevelLabel(user.accessLevel);
    }
}

/**
 * Initialize admin panel
 */
function initAdminPanel() {
    initMobileSidebar();

    // Sidebar navigation
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const section = e.target.closest('.sidebar-link').dataset.section;
            if (section) {
                e.preventDefault();
                switchSection(section);
            }
        });
    });
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const shouldLogout = await showLogoutPrompt();
            if (shouldLogout) {
                await logout();
            }
        });
    }
    
    // Add buttons
    document.getElementById('add-post-btn')?.addEventListener('click', () => openModal('posts'));
    document.getElementById('add-article-btn')?.addEventListener('click', () => openModal('articles'));
    document.getElementById('add-paper-btn')?.addEventListener('click', () => openModal('papers'));
    document.getElementById('add-note-btn')?.addEventListener('click', () => openModal('notes'));
    document.getElementById('add-event-btn')?.addEventListener('click', () => openModal('events'));
    document.getElementById('add-user-btn')?.addEventListener('click', () => openModal('users'));
    
    // Modal close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    // Click outside modal to close
    document.getElementById('content-modal').addEventListener('click', (e) => {
        if (e.target.id === 'content-modal') {
            closeModal();
        }
    });
    
    // Form submit
    document.getElementById('content-form').addEventListener('submit', handleFormSubmit);
    
    // Load initial content
    loadSectionContent('posts');
}

function showLogoutPrompt() {
    return new Promise((resolve) => {
        const existingModal = document.getElementById('logout-confirm-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'logout-confirm-modal';
        modal.className = 'logout-confirm-overlay';
        modal.innerHTML = `
            <div class="logout-confirm-card">
                <div class="logout-confirm-icon">
                    <i class="fas fa-sign-out-alt"></i>
                </div>
                <h3>Log out now?</h3>
                <p>You are signed in. Do you want to log out from your account?</p>
                <div class="logout-confirm-actions">
                    <button type="button" class="btn btn-secondary" data-action="cancel">Stay signed in</button>
                    <button type="button" class="btn btn-primary" data-action="logout">
                        <i class="fas fa-check"></i> Yes, log out
                    </button>
                </div>
            </div>
        `;

        const cleanup = (result) => {
            document.removeEventListener('keydown', onKeyDown);
            modal.remove();
            resolve(result);
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                cleanup(false);
            }
        };

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                cleanup(false);
            }
        });

        modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => cleanup(false));
        modal.querySelector('[data-action="logout"]')?.addEventListener('click', () => cleanup(true));

        document.addEventListener('keydown', onKeyDown);
        document.body.appendChild(modal);
    });
}

function initMobileSidebar() {
    const container = document.querySelector('.admin-container');
    const sidebar = document.querySelector('.admin-sidebar');
    const main = document.querySelector('.admin-main');
    if (!container || !sidebar || !main) return;

    const topbar = document.createElement('div');
    topbar.className = 'admin-mobile-topbar';
    topbar.innerHTML = `
        <button class="admin-menu-toggle" type="button" aria-label="Toggle admin menu" aria-expanded="false">
            <i class="fas fa-bars"></i>
        </button>
        <div class="admin-mobile-title">Admin Dashboard</div>
    `;

    const backdrop = document.createElement('div');
    backdrop.className = 'admin-sidebar-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    main.prepend(topbar);
    container.appendChild(backdrop);

    const toggleBtn = topbar.querySelector('.admin-menu-toggle');

    const closeSidebar = () => {
        container.classList.remove('sidebar-open');
        toggleBtn?.setAttribute('aria-expanded', 'false');
    };

    const openSidebar = () => {
        container.classList.add('sidebar-open');
        toggleBtn?.setAttribute('aria-expanded', 'true');
    };

    toggleBtn?.addEventListener('click', () => {
        if (container.classList.contains('sidebar-open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    backdrop.addEventListener('click', closeSidebar);

    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.matchMedia('(max-width: 768px)').matches) {
                closeSidebar();
            }
        });
    });

    window.addEventListener('resize', () => {
        if (!window.matchMedia('(max-width: 768px)').matches) {
            closeSidebar();
        }
    });
}

/**
 * Switch section
 */
function switchSection(section) {
    currentSection = section;
    
    // Update active link
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === section) {
            link.classList.add('active');
        }
    });
    
    // Update active section
    document.querySelectorAll('.admin-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}-section`)?.classList.add('active');
    
    // Load content
    loadSectionContent(section);
}

/**
 * Load section content
 */
async function loadSectionContent(section) {
    const listContainer = document.getElementById(`admin-${section}-list`);
    if (!listContainer) return;
    
    listContainer.innerHTML = '<div class="spinner"></div>';
    
    try {
        const q = query(collection(db, section), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        listContainer.innerHTML = '';
        
        if (querySnapshot.empty) {
            listContainer.innerHTML = '<p class="no-content">No items found. Click "Add" to create one.</p>';
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const item = doc.data();
            const card = createAdminCard(section, doc.id, item);
            listContainer.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading content:', error);
        listContainer.innerHTML = '<p class="no-content" style="color: red;">Error loading content. Please refresh the page.</p>';
    }
}

/**
 * Create admin card
 */
function createAdminCard(section, id, item) {
    const card = document.createElement('div');
    card.className = 'admin-card';
    
    const user = getCurrentUser();
    const canEdit = user && (user.accessLevel === ACCESS_LEVELS.MANAGEMENT || item.authorId === user.uid);
    const title = escapeHTML(item.title || item.name || item.email || 'Untitled');
    
    card.innerHTML = `
        <div class="admin-card-header">
            <h3>${title}</h3>
            <div class="admin-card-actions">
                ${canEdit ? `
                    <button class="btn-icon edit-btn" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete-btn" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : '<span style="color: #999;">Read-only</span>'}
            </div>
        </div>
        <div class="admin-card-body">
            ${getCardBody(section, item)}
        </div>
    `;
    
    if (canEdit) {
        const editBtn = card.querySelector('.edit-btn');
        const deleteBtn = card.querySelector('.delete-btn');
        if (editBtn) editBtn.addEventListener('click', () => editItem(section, id));
        if (deleteBtn) deleteBtn.addEventListener('click', () => deleteItem(section, id));
    }
    
    return card;
}

/**
 * Get card body content
 */
function getCardBody(section, item) {
    const createdAt = item.createdAt ? 
        new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 
        'N/A';
    
    switch (section) {
        case 'posts':
            return `
                <p><strong>Description:</strong> ${escapeHTML(item.description || 'No description')}</p>
                <p><strong>Status:</strong> <span style="color: ${item.published ? 'green' : 'orange'}">${item.published ? 'Published' : 'Draft'}</span></p>
                <p><strong>Created:</strong> ${createdAt}</p>
            `;
        case 'articles':
            return `
                <p><strong>Author:</strong> ${escapeHTML(item.author || 'N/A')}</p>
                <p><strong>Status:</strong> <span style="color: ${item.published ? 'green' : 'orange'}">${item.published ? 'Published' : 'Draft'}</span></p>
                <p><strong>Created:</strong> ${createdAt}</p>
            `;
        case 'papers':
        case 'notes':
            return `
                <p><strong>Category:</strong> ${escapeHTML(item.category || 'N/A')}</p>
                <p><strong>Link:</strong> <a href="${safeUrl(item.driveLink, DRIVE_HOSTS)}" target="_blank" rel="noopener">View File</a></p>
                <p><strong>Created:</strong> ${createdAt}</p>
            `;
        case 'events':
            return `
                <p><strong>Date:</strong> ${escapeHTML(item.eventDate || 'N/A')}</p>
                <p><strong>Facebook:</strong> <a href="${safeUrl(item.facebookLink, FACEBOOK_HOSTS)}" target="_blank" rel="noopener">View Post</a></p>
                <p><strong>Created:</strong> ${createdAt}</p>
            `;
        case 'users':
            return `
                <p><strong>Email:</strong> ${escapeHTML(item.email)}</p>
                <p><strong>Access Level:</strong> ${getAccessLevelName(item.accessLevel)}</p>
                <p><strong>Created:</strong> ${createdAt}</p>
            `;
        default:
            return '<p>No additional information</p>';
    }
}

/**
 * Get access level name
 */
function getAccessLevelName(level) {
    const levels = ['Public', 'Member', 'Editor', 'Management'];
    return levels[level] || 'Unknown';
}

/**
 * Open modal
 */
async function openModal(section, id = null) {
    editingId = id;
    const modal = document.getElementById('content-modal');
    const modalTitle = document.getElementById('modal-title');
    const formFields = document.getElementById('form-fields');
    
    let data = null;
    
    if (id) {
        try {
            const docRef = doc(db, section, id);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                data = docSnap.data();
            }
        } catch (error) {
            console.error('Error loading document:', error);
            alert('Error loading item data');
            return;
        }
    }
    
    modalTitle.textContent = `${editingId ? 'Edit' : 'Add'} ${capitalize(section.slice(0, -1))}`;
    formFields.innerHTML = getFormFields(section, data);
    
    modal.classList.add('show');
}

/**
 * Close modal
 */
function closeModal() {
    const modal = document.getElementById('content-modal');
    modal.classList.remove('show');
    document.getElementById('content-form').reset();
    editingId = null;
    
    // Clear upload progress
    const uploadProgress = document.getElementById('upload-progress');
    if (uploadProgress) {
        uploadProgress.innerHTML = '';
        uploadProgress.classList.remove('show');
    }
}

/**
 * Get form fields
 */
function getFormFields(section, data = null) {
    const safe = (value) => escapeHTML(value || '');
    const fields = {
        posts: `
            <div class="form-group">
                <label for="title">Title *</label>
                <input type="text" id="title" name="title" value="${safe(data?.title)}" required>
            </div>
            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" rows="3">${safe(data?.description)}</textarea>
            </div>
            <div class="form-group">
                <label for="image">Image (Max 10MB)</label>
                <input type="file" id="image" name="image" accept="image/*">
                <div class="upload-progress" id="upload-progress"></div>
                ${data?.imageUrl ? `
                    <div class="current-image">
                        <img src="${escapeHTML(optimizeCloudinaryUrl(data.imageUrl, {width: 300, height: 200}))}" alt="Current image">
                        <p><small>Current image (leave empty to keep)</small></p>
                    </div>
                ` : ''}
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" name="published" ${data?.published ? 'checked' : ''}>
                    Published
                </label>
            </div>
        `,
        articles: `
            <div class="form-group">
                <label for="title">Title *</label>
                <input type="text" id="title" name="title" value="${safe(data?.title)}" required>
            </div>
            <div class="form-group">
                <label for="author">Author</label>
                <input type="text" id="author" name="author" value="${safe(data?.author)}">
                <small>Leave empty to use your name</small>
            </div>
            <div class="form-group">
                <label for="content">Content *</label>
                <textarea id="content" name="content" rows="10" required placeholder="Write your article here... Use double line breaks for paragraphs.">${safe(data?.content)}</textarea>
            </div>
            <div class="form-group">
                <label for="image">Featured Image (Max 10MB)</label>
                <input type="file" id="image" name="image" accept="image/*">
                <div class="upload-progress" id="upload-progress"></div>
                ${data?.imageUrl ? `
                    <div class="current-image">
                        <img src="${escapeHTML(optimizeCloudinaryUrl(data.imageUrl, {width: 300, height: 200}))}" alt="Current image">
                        <p><small>Current image (leave empty to keep)</small></p>
                    </div>
                ` : ''}
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" name="published" ${data?.published ? 'checked' : ''}>
                    Published
                </label>
            </div>
        `,
        papers: `
            <div class="form-group">
                <label for="title">Title *</label>
                <input type="text" id="title" name="title" value="${safe(data?.title)}" required>
            </div>
            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" rows="3">${safe(data?.description)}</textarea>
            </div>
            <div class="form-group">
                <label for="category">Category *</label>
                <select id="category" name="category" required>
                    <option value="">Select Category</option>
                    <option value="supply-chain" ${data?.category === 'supply-chain' ? 'selected' : ''}>Supply Chain</option>
                    <option value="logistics" ${data?.category === 'logistics' ? 'selected' : ''}>Logistics</option>
                    <option value="operations" ${data?.category === 'operations' ? 'selected' : ''}>Operations</option>
                    <option value="management" ${data?.category === 'management' ? 'selected' : ''}>Management</option>
                </select>
            </div>
            <div class="form-group">
                <label for="driveLink">Google Drive Link *</label>
                <input type="url" id="driveLink" name="driveLink" value="${safe(data?.driveLink)}" required 
                       placeholder="https://drive.google.com/file/d/...">
                <small>
                    1. Upload file to Google Drive<br>
                    2. Right-click → Share → "Anyone with the link"<br>
                    3. Copy link and paste here
                </small>
            </div>
        `,
        notes: `
            <div class="form-group">
                <label for="title">Title *</label>
                <input type="text" id="title" name="title" value="${safe(data?.title)}" required>
            </div>
            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" rows="3">${safe(data?.description)}</textarea>
            </div>
            <div class="form-group">
                <label for="category">Category *</label>
                <select id="category" name="category" required>
                    <option value="">Select Category</option>
                    <option value="supply-chain" ${data?.category === 'supply-chain' ? 'selected' : ''}>Supply Chain</option>
                    <option value="logistics" ${data?.category === 'logistics' ? 'selected' : ''}>Logistics</option>
                    <option value="operations" ${data?.category === 'operations' ? 'selected' : ''}>Operations</option>
                    <option value="management" ${data?.category === 'management' ? 'selected' : ''}>Management</option>
                </select>
            </div>
            <div class="form-group">
                <label for="driveLink">Google Drive Link *</label>
                <input type="url" id="driveLink" name="driveLink" value="${safe(data?.driveLink)}" required 
                       placeholder="https://drive.google.com/file/d/...">
                <small>
                    1. Upload file to Google Drive<br>
                    2. Right-click → Share → "Anyone with the link"<br>
                    3. Copy link and paste here
                </small>
            </div>
        `,
        events: `
            <div class="form-group">
                <label for="title">Event Title *</label>
                <input type="text" id="title" name="title" value="${safe(data?.title)}" required>
            </div>
            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" rows="3">${safe(data?.description)}</textarea>
            </div>
            <div class="form-group">
                <label for="eventDate">Event Date *</label>
                <input type="date" id="eventDate" name="eventDate" value="${safe(data?.eventDate)}" required>
            </div>
            <div class="form-group">
                <label for="thumbnail">Event Thumbnail (Max 10MB)</label>
                <input type="file" id="thumbnail" name="thumbnail" accept="image/*">
                <div class="upload-progress" id="upload-progress"></div>
                ${data?.thumbnailUrl ? `
                    <div class="current-image">
                        <img src="${escapeHTML(optimizeCloudinaryUrl(data.thumbnailUrl, {width: 300, height: 200}))}" alt="Current thumbnail">
                        <p><small>Current thumbnail (leave empty to keep)</small></p>
                    </div>
                ` : ''}
            </div>
            <div class="form-group">
                <label for="facebookLink">Facebook Post Link *</label>
                <input type="url" id="facebookLink" name="facebookLink" value="${safe(data?.facebookLink)}" required 
                       placeholder="https://www.facebook.com/...">
                <small>Link to the Facebook post with event photos</small>
            </div>
        `,
        users: `
            <div class="form-group">
                <label for="name">Full Name *</label>
                <input type="text" id="name" name="name" value="${safe(data?.name)}" required>
            </div>
            <div class="form-group">
                <label for="email">Email *</label>
                <input type="email" id="email" name="email" value="${safe(data?.email)}" 
                       ${editingId ? 'readonly' : ''} required>
                ${editingId ? '<small>Email cannot be changed</small>' : ''}
            </div>
            <div class="form-group">
                <label for="accessLevel">Access Level *</label>
                <select id="accessLevel" name="accessLevel" required>
                    <option value="1" ${data?.accessLevel === 1 ? 'selected' : ''}>Member (Can view papers/notes)</option>
                    <option value="2" ${data?.accessLevel === 2 ? 'selected' : ''}>Editor (Can post content)</option>
                    <option value="3" ${data?.accessLevel === 3 ? 'selected' : ''}>Management (Full access)</option>
                </select>
            </div>
            ${!editingId ? `
                <div class="form-group">
                    <label for="password">Password *</label>
                    <input type="password" id="password" name="password" minlength="6" required>
                    <small>Minimum 6 characters</small>
                </div>
            ` : '<small>Note: Password cannot be changed from admin panel for security reasons.</small>'}
        `
    };
    
    return fields[section] || '<p>Unknown section</p>';
}

/**
 * Handle form submit
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    try {
        const formData = new FormData(e.target);
        const data = {};
        
        // Process form data
        for (let [key, value] of formData.entries()) {
            if (key === 'accessLevel') {
                data[key] = parseInt(value);
            } else if (key !== 'image' && key !== 'thumbnail' && key !== 'published') {
                data[key] = value.trim();
            }
        }
        
        if (currentSection === 'posts' || currentSection === 'articles') {
            data.published = e.target.querySelector('input[name="published"]')?.checked || false;
        }
        
        // Handle image upload
        const imageFile = formData.get('image') || formData.get('thumbnail');
        if (imageFile && imageFile.size > 0) {
            // Validate file
            const validation = validateImageFile(imageFile);
            if (!validation.valid) {
                alert(validation.error);
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
                return;
            }
            
            // Show upload progress
            const progressDiv = document.getElementById('upload-progress');
            if (progressDiv) {
                progressDiv.classList.add('show');
                progressDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Uploading image...</p>';
            }
            
            try {
                const imageUrl = await uploadToCloudinary(imageFile, (percent) => {
                    if (progressDiv) {
                        progressDiv.innerHTML = `<p>Uploading: ${Math.round(percent)}%</p>`;
                    }
                });
                
                if (currentSection === 'events') {
                    data.thumbnailUrl = imageUrl;
                } else {
                    data.imageUrl = imageUrl;
                }
                
                if (progressDiv) {
                    progressDiv.innerHTML = '<p style="color: green;"><i class="fas fa-check-circle"></i> Upload complete!</p>';
                }
            } catch (uploadError) {
                console.error('Upload error:', uploadError);
                alert('Failed to upload image. Please try again.');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
                return;
            }
        }
        
        // Add metadata
        const user = getCurrentUser();
        data.authorId = user.uid;
        
        if (currentSection === 'articles' && !data.author) {
            data.author = user.name || user.email;
        } else if (currentSection === 'posts' || currentSection === 'events') {
            data.author = user.name || user.email;
        }
        
        // Save to Firestore
        if (currentSection === 'users') {
            // Handle user creation/update differently
            if (editingId) {
                // Update existing user
                await updateDoc(doc(db, 'users', editingId), {
                    name: data.name,
                    accessLevel: data.accessLevel,
                    updatedAt: serverTimestamp()
                });
            } else {
                // Create new user
                const result = await createUser(data);
                if (!result.success) {
                    alert(result.error);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                    return;
                }
            }
        } else {
            // Handle other content types
            if (editingId) {
                await updateDoc(doc(db, currentSection, editingId), {
                    ...data,
                    updatedAt: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, currentSection), {
                    ...data,
                    createdAt: serverTimestamp(),
                    published: data.published || false
                });
            }
        }
        
        closeModal();
        loadSectionContent(currentSection);
        showNotification('Saved successfully!', 'success');
        
    } catch (error) {
        console.error('Error saving:', error);
        alert('Error saving data: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

/**
 * Edit item
 */
window.editItem = async function(section, id) {
    await openModal(section, id);
};

/**
 * Delete item
 */
window.deleteItem = async function(section, id) {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, section, id));
        loadSectionContent(section);
        showNotification('Deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting item:', error);
        alert('Error deleting item: ' + error.message);
    }
};

/**
 * Capitalize first letter
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}