import { db } from './firebase-config.js';
import { initAuth, hasAccess, ACCESS_LEVELS, onAuthResolved } from './auth.js';
import { optimizeCloudinaryUrl } from './cloudinary-upload.js';
import { escapeHTML, safeUrl, DRIVE_HOSTS, FACEBOOK_HOSTS } from './utils.js';
import { 
    collection, 
    query, 
    orderBy, 
    limit, 
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initNavbar();
    loadPageContent();
});

/**
 * Initialize Navbar
 */
function initNavbar() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    const navbar = document.getElementById('navbar');
    
    // Hamburger Menu Toggle
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
        
        // Close menu when clicking a link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });
    }
    
    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

/**
 * Load content based on current page
 */
function loadPageContent() {
    const path = window.location.pathname;
    let page = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    page = page.replace('.html', '');
    
    switch (page) {
        case 'index':
        case '':
            loadLatestPosts();
            break;
        case 'papers':
            loadPapers();
            break;
        case 'notes':
            loadNotes();
            break;
        case 'events':
            loadEvents();
            break;
    }
}

/**
 * Load latest posts for homepage
 */
async function loadLatestPosts() {
    const postsGrid = document.getElementById('posts-grid');
    if (!postsGrid) return;
    
    try {
        const q = query(
            collection(db, 'posts'),
            orderBy('createdAt', 'desc'),
            limit(20)
        );
        
        const querySnapshot = await getDocs(q);
        postsGrid.innerHTML = '';

        const posts = [];
        querySnapshot.forEach((doc) => {
            const post = doc.data();
            if (post.published) {
                posts.push(post);
            }
        });
        
        if (!posts.length) {
            postsGrid.innerHTML = '<p class="no-content"><i class="fas fa-info-circle"></i> No posts available yet.</p>';
            return;
        }
        
        posts.slice(0, 6).forEach((post, index) => {
            const card = createPostCard(post);
            card.classList.add('stagger-item');
            card.style.animationDelay = `${index * 0.1}s`;
            postsGrid.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading posts:', error);
        postsGrid.innerHTML = '<p class="no-content"><i class="fas fa-exclamation-triangle"></i> Error loading posts. Please try again later.</p>';
    }
}

/**
 * Load papers (Members only)
 */
async function loadPapers() {
    const papersGrid = document.getElementById('papers-grid');
    const accessMessage = document.getElementById('access-message');
    const filtersContainer = document.getElementById('filters-container');
    
    if (!papersGrid) return;
    
    onAuthResolved(async () => {
        if (!hasAccess(ACCESS_LEVELS.MEMBER)) {
            accessMessage.innerHTML = '<i class="fas fa-lock"></i> Members-only content. Please log in with a member account.';
            accessMessage.classList.add('show');
            papersGrid.innerHTML = '';
            return;
        }
        
        filtersContainer.style.display = 'flex';
        
        try {
            const q = query(
                collection(db, 'papers'),
                orderBy('createdAt', 'desc')
            );
            
            const querySnapshot = await getDocs(q);
            papersGrid.innerHTML = '';
            
            if (querySnapshot.empty) {
                papersGrid.innerHTML = '<p class="no-content"><i class="fas fa-info-circle"></i> No papers available yet.</p>';
                return;
            }
            
            querySnapshot.forEach((doc) => {
                const paper = doc.data();
                const card = createResourceCard(paper, 'paper');
                papersGrid.appendChild(card);
            });
            
            initFilters('papers');
            
        } catch (error) {
            console.error('Error loading papers:', error);
            papersGrid.innerHTML = '<p class="no-content"><i class="fas fa-exclamation-triangle"></i> Error loading papers. Please try again later.</p>';
        }
    });
}

/**
 * Load notes (Members only)
 */
async function loadNotes() {
    const notesGrid = document.getElementById('notes-grid');
    const accessMessage = document.getElementById('access-message');
    const filtersContainer = document.getElementById('filters-container');
    
    if (!notesGrid) return;
    
    onAuthResolved(async () => {
        if (!hasAccess(ACCESS_LEVELS.MEMBER)) {
            accessMessage.innerHTML = '<i class="fas fa-lock"></i> Members-only content. Please log in with a member account.';
            accessMessage.classList.add('show');
            notesGrid.innerHTML = '';
            return;
        }
        
        filtersContainer.style.display = 'flex';
        
        try {
            const q = query(
                collection(db, 'notes'),
                orderBy('createdAt', 'desc')
            );
            
            const querySnapshot = await getDocs(q);
            notesGrid.innerHTML = '';
            
            if (querySnapshot.empty) {
                notesGrid.innerHTML = '<p class="no-content"><i class="fas fa-info-circle"></i> No notes available yet.</p>';
                return;
            }
            
            querySnapshot.forEach((doc) => {
                const note = doc.data();
                const card = createResourceCard(note, 'note');
                notesGrid.appendChild(card);
            });
            
            initFilters('notes');
            
        } catch (error) {
            console.error('Error loading notes:', error);
            notesGrid.innerHTML = '<p class="no-content"><i class="fas fa-exclamation-triangle"></i> Error loading notes. Please try again later.</p>';
        }
    });
}

/**
 * Load events
 */
async function loadEvents() {
    const eventsGrid = document.getElementById('events-grid');
    if (!eventsGrid) return;
    
    try {
        const q = query(
            collection(db, 'events'),
            orderBy('eventDate', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        eventsGrid.innerHTML = '';
        
        if (querySnapshot.empty) {
            eventsGrid.innerHTML = '<p class="no-content"><i class="fas fa-info-circle"></i> No events available yet.</p>';
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const event = doc.data();
            const card = createEventCard(event);
            eventsGrid.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading events:', error);
        eventsGrid.innerHTML = '<p class="no-content"><i class="fas fa-exclamation-triangle"></i> Error loading events. Please try again later.</p>';
    }
}

/**
 * Create post card
 */
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'card';
    
    const date = post.createdAt ? 
        new Date(post.createdAt.seconds * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) : 'N/A';
    
    const imageUrl = post.imageUrl ? 
        optimizeCloudinaryUrl(post.imageUrl, { width: 400, height: 250 }) : 
        '';
    const title = escapeHTML(post.title || 'Untitled');
    const description = escapeHTML(post.description || '');
    const author = escapeHTML(post.author || 'Admin');
    const imageSrc = imageUrl ? escapeHTML(imageUrl) : '';
    
    card.innerHTML = `
        ${imageUrl ? `<img src="${imageSrc}" alt="${title}" class="card-image" loading="lazy">` : ''}
        <div class="card-content">
            <h3 class="card-title">${title}</h3>
            <p class="card-description">${description}</p>
            <div class="card-meta">
                <span><i class="far fa-calendar"></i> ${date}</span>
                <span><i class="far fa-user"></i> ${author}</span>
            </div>
        </div>
    `;
    
    return card;
}

/**
 * Create resource card (papers/notes)
 */
function createResourceCard(resource, type) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.title = (resource.title || '').toLowerCase();
    card.dataset.category = resource.category || '';
    
    const icon = type === 'paper' ? 'fa-file-pdf' : 'fa-sticky-note';
    const title = escapeHTML(resource.title || 'Untitled');
    const description = escapeHTML(resource.description || 'No description available');
    const category = escapeHTML(resource.category || 'General');
    const driveLink = safeUrl(resource.driveLink, DRIVE_HOSTS);
    
    card.innerHTML = `
        <div class="card-badge">${category}</div>
        <div class="card-content">
            <h3 class="card-title"><i class="fas ${icon}"></i> ${title}</h3>
            <p class="card-description">${description}</p>
            <a href="${driveLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                <i class="fas fa-download"></i> Download
            </a>
        </div>
    `;
    
    return card;
}

/**
 * Create event card
 */
function createEventCard(event) {
    const card = document.createElement('div');
    card.className = 'card';
    
    const eventDate = event.eventDate ? 
        formatDate(event.eventDate) : 'N/A';
    
    const thumbnailUrl = event.thumbnailUrl ? 
        optimizeCloudinaryUrl(event.thumbnailUrl, { width: 400, height: 250 }) :
        eventPlaceholder();
    const title = escapeHTML(event.title || 'Untitled');
    const description = escapeHTML(event.description || '');
    const thumbnailSrc = escapeHTML(thumbnailUrl);
    const facebookLink = safeUrl(event.facebookLink, FACEBOOK_HOSTS);
    
    card.innerHTML = `
        <img src="${thumbnailSrc}" alt="${title}" class="card-image" loading="lazy">
        <div class="card-content">
            <h3 class="card-title">${title}</h3>
            <p class="card-description">${description}</p>
            <div class="card-meta">
                <span><i class="far fa-calendar"></i> ${eventDate}</span>
            </div>
            <a href="${facebookLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="margin-top: 1rem;">
                <i class="fab fa-facebook"></i> View on Facebook
            </a>
        </div>
    `;
    
    return card;
}

/**
 * Generate a local SVG data-URI placeholder for events without an image
 * Avoids external dependency (e.g., via.placeholder.com)
 */
function eventPlaceholder() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">
        <rect width="400" height="250" fill="#006994"/>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" fill="#ffffff"
              text-anchor="middle" dominant-baseline="middle">Event</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/**
 * Format a date string (YYYY-MM-DD) as a localized date
 * Prevents UTC timezone shift for date-only strings
 */
function formatDate(dateValue) {
    if (!dateValue) return 'N/A';
    
    try {
        // If it's a Firestore Timestamp-like object
        if (typeof dateValue === 'object' && dateValue.seconds) {
            return new Date(dateValue.seconds * 1000).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        
        // If it's a date-only string "YYYY-MM-DD", parse as local time
        if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            const [year, month, day] = dateValue.split('-').map(Number);
            return new Date(year, month - 1, day).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        
        // Otherwise, use standard parsing with fallback
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch {
        return 'N/A';
    }
}

/**
 * Initialize filters for papers/notes
 */
function initFilters(type) {
    const searchInput = document.getElementById('search-input');
    const filterCategory = document.getElementById('filter-category');
    const gridId = type === 'papers' ? 'papers-grid' : 'notes-grid';
    
    if (searchInput) {
        searchInput.addEventListener('input', () => filterContent(gridId));
    }
    
    if (filterCategory) {
        filterCategory.addEventListener('change', () => filterContent(gridId));
    }
}

/**
 * Filter content
 */
function filterContent(gridId) {
    const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
    const category = document.getElementById('filter-category')?.value || '';
    
    const cards = document.querySelectorAll(`#${gridId} .card`);
    let visibleCount = 0;
    
    cards.forEach(card => {
        const title = card.dataset.title || '';
        const cardCategory = card.dataset.category || '';
        
        const matchesSearch = title.includes(searchTerm);
        const matchesCategory = !category || cardCategory === category;
        
        if (matchesSearch && matchesCategory) {
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    // Show no results message
    const grid = document.getElementById(gridId);
    let noResults = grid.querySelector('.no-results');
    
    if (visibleCount === 0) {
        if (!noResults) {
            noResults = document.createElement('p');
            noResults.className = 'no-content no-results';
            noResults.innerHTML = '<i class="fas fa-search"></i> No results found.';
            grid.appendChild(noResults);
        }
    } else {
        if (noResults) {
            noResults.remove();
        }
    }
}