// Articles Page JavaScript
import { db } from './firebase-config.js';
import { initAuth } from './auth.js';
import { optimizeCloudinaryUrl } from './cloudinary-upload.js';
import { escapeHTML, showNotification } from './utils.js';
import { 
    collection, 
    query, 
    orderBy, 
    getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initNavbar();
    loadArticles().then(scrollToHashArticle);
});

/**
 * Initialize Navbar
 */
function initNavbar() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    const navbar = document.getElementById('navbar');
    
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
        
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });
    }
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

/**
 * Load all published articles
 */
async function loadArticles() {
    const articlesContainer = document.getElementById('articles-container');
    if (!articlesContainer) return;
    
    try {
        const q = query(
            collection(db, 'articles'),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        articlesContainer.innerHTML = '';

        const articles = [];
        querySnapshot.forEach((doc) => {
            const article = doc.data();
            if (article.published) {
                articles.push({ id: doc.id, ...article });
            }
        });
        
        if (!articles.length) {
            articlesContainer.innerHTML = `
                <p class="no-content">
                    <i class="fas fa-info-circle"></i> No articles available yet.
                </p>
            `;
            return;
        }
        
        articles.forEach((article, index) => {
            const articleElement = createArticleElement(article, article.id);
            articleElement.classList.add('stagger-item');
            articleElement.style.animationDelay = `${index * 0.1}s`;
            articlesContainer.appendChild(articleElement);
        });
        
    } catch (error) {
        console.error('Error loading articles:', error);
        articlesContainer.innerHTML = `
            <p class="no-content">
                <i class="fas fa-exclamation-triangle"></i> Error loading articles. Please try again later.
            </p>
        `;
    }
}

/**
 * Create article element
 */
function createArticleElement(article, id) {
    const articleDiv = document.createElement('article');
    articleDiv.className = 'article-card';
    articleDiv.id = id;
    
    const date = article.createdAt ? 
        new Date(article.createdAt.seconds * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : 'N/A';
    
    const imageUrl = article.imageUrl ? 
        optimizeCloudinaryUrl(article.imageUrl, { width: 800, height: 400 }) : 
        '';
    const title = escapeHTML(article.title || 'Untitled');
    const author = escapeHTML(article.author || 'Admin');
    const imageSrc = imageUrl ? escapeHTML(imageUrl) : '';
    const articleTitle = article.title || 'Article';
    
    articleDiv.innerHTML = `
        <div class="article-header">
            <h2 class="article-title">${title}</h2>
            <div class="article-meta">
                <span class="article-author">
                    <i class="far fa-user"></i> ${author}
                </span>
                <span class="article-date">
                    <i class="far fa-calendar"></i> ${date}
                </span>
            </div>
        </div>
        ${imageUrl ? `<img src="${imageSrc}" alt="${title}" class="article-image" loading="lazy">` : ''}
        <div class="article-content">
            ${formatArticleContent(article.content)}
        </div>
        <div class="article-footer">
            <button class="btn btn-secondary share-btn">
                <i class="fas fa-share-alt"></i> Share
            </button>
        </div>
    `;
    
    const shareBtn = articleDiv.querySelector('.share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => shareArticle(id, articleTitle));
    }
    
    return articleDiv;
}

/**
 * Format article content (convert line breaks to paragraphs)
 */
function formatArticleContent(content) {
    if (!content) return '<p>No content available.</p>';
    
    // Sanitize content
    const sanitized = escapeHTML(content);
    
    // Convert line breaks to paragraphs
    const paragraphs = sanitized.split('\n\n').filter(p => p.trim());
    
    return paragraphs.map(p => {
        const trimmed = p.trim().replace(/\n/g, '<br>');
        return `<p>${trimmed}</p>`;
    }).join('');
}

/**
 * Share article function
 */
window.shareArticle = async function(id, title) {
    const url = `${window.location.origin}/articles.html#${id}`;
    
    // Use Web Share API if available
    if (navigator.share) {
        try {
            await navigator.share({
                title: title,
                text: `Check out this article: ${title}`,
                url: url
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error sharing:', error);
                copyToClipboard(url);
            }
        }
    } else {
        // Fallback: Copy to clipboard
        copyToClipboard(url);
    }
};

/**
 * Copy text to clipboard
 */
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Link copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy:', err);
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

/**
 * Fallback copy to clipboard
 */
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
        document.execCommand('copy');
        showNotification('Link copied to clipboard!', 'success');
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showNotification('Failed to copy link', 'error');
    }
    
    document.body.removeChild(textArea);
}

/**
 * Scroll to article if a hash is present in the URL.
 * Runs after articles finish loading (not a fixed timer) so it works
 * regardless of network speed.
 */
function scrollToHashArticle() {
    if (!window.location.hash) return;
    const element = document.querySelector(window.location.hash);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}