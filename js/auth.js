// Authentication Management
import { auth, db, firebaseConfig } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    getAuth,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    doc, 
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Access Levels
export const ACCESS_LEVELS = {
    PUBLIC: 0,
    MEMBER: 1,
    EDITOR: 2,
    MANAGEMENT: 3
};

// Current User Data
let currentUser = { accessLevel: ACCESS_LEVELS.PUBLIC };
let isAuthResolved = false;
const authCallbacks = [];

const managementApp = initializeApp(firebaseConfig, 'user-management');
const managementAuth = getAuth(managementApp);

async function getUserProfileDoc(user, retryOnPermission = true) {
    try {
        return await getDoc(doc(db, 'users', user.uid));
    } catch (error) {
        if (retryOnPermission && error?.code === 'permission-denied') {
            await user.getIdToken(true);
            return await getDoc(doc(db, 'users', user.uid));
        }
        throw error;
    }
}

/**
 * Register callback to run when auth resolution is complete
 */
export function onAuthResolved(callback) {
    if (isAuthResolved) {
        callback(currentUser);
    } else {
        authCallbacks.push(callback);
    }
}

function notifyAuthResolved(user) {
    isAuthResolved = true;
    authCallbacks.forEach(cb => cb(user));
}

/**
 * Initialize authentication state listener
 */
export function initAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userDoc = await getUserProfileDoc(user);
                if (userDoc.exists()) {
                    currentUser = {
                        uid: user.uid,
                        email: user.email,
                        ...userDoc.data()
                    };
                    updateUIForUser(currentUser);
                } else {
                    console.error('User document not found');
                    currentUser = { accessLevel: ACCESS_LEVELS.PUBLIC };
                    await signOut(auth);
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
                currentUser = { accessLevel: ACCESS_LEVELS.PUBLIC };
            }
        } else {
            currentUser = { accessLevel: ACCESS_LEVELS.PUBLIC };
            updateUIForGuest();
        }
        
        notifyAuthResolved(currentUser);
        
        // If user is logged in and on login.html, auto-redirect
        if (window.location.pathname.endsWith('login.html')) {
            if (currentUser.accessLevel >= ACCESS_LEVELS.EDITOR) {
                window.location.href = 'admin.html';
            } else if (currentUser.accessLevel >= ACCESS_LEVELS.MEMBER) {
                window.location.href = 'index.html';
            }
        }
    });
}

/**
 * Login user
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<object>}
 */
export async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        const userDoc = await getUserProfileDoc(user);
        if (userDoc.exists()) {
            const userData = userDoc.data();
            currentUser = {
                uid: user.uid,
                email: user.email,
                ...userData
            };
            
            // Redirect based on role
            if (userData.accessLevel >= ACCESS_LEVELS.EDITOR) {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'index.html';
            }
            
            return { success: true };
        } else {
            throw new Error('User data not found');
        }
    } catch (error) {
        let errorMessage = 'Login failed';
        
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled';
                break;
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password';
                break;
            case 'auth/invalid-credential':
                errorMessage = 'Invalid email or password';
                break;
            case 'permission-denied':
                errorMessage = 'Missing or insufficient permissions for your user profile. Contact an admin.';
                break;
            default:
                errorMessage = error.message;
        }
        
        return { success: false, error: errorMessage };
    }
}

/**
 * Send password reset email
 * @param {string} email
 * @returns {Promise<object>}
 */
export async function forgotPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error) {
        let errorMessage = 'Failed to send reset email';

        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address';
                break;
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many requests. Please try again later';
                break;
            default:
                errorMessage = error.message;
        }

        return { success: false, error: errorMessage };
    }
}

/**
 * Logout user
 */
export async function logout() {
    try {
        await signOut(auth);
        currentUser = { accessLevel: ACCESS_LEVELS.PUBLIC };
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
    }
}

/**
 * Get current user
 * @returns {object|null}
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Check if user has required access level
 * @param {number} requiredLevel 
 * @returns {boolean}
 */
export function hasAccess(requiredLevel) {
    if (!currentUser) return requiredLevel === ACCESS_LEVELS.PUBLIC;
    return currentUser.accessLevel >= requiredLevel;
}

/**
 * Create new user (Management only)
 * @param {object} userData 
 * @returns {Promise<object>}
 */
export async function createUser(userData) {
    try {
        const userCredential = await createUserWithEmailAndPassword(
            managementAuth, 
            userData.email, 
            userData.password
        );
        
        const uid = userCredential.user.uid;
        
        // Store user data in Firestore
        await setDoc(doc(db, 'users', uid), {
            name: userData.name,
            email: userData.email,
            accessLevel: parseInt(userData.accessLevel),
            createdAt: serverTimestamp()
        });
        
        return { success: true, uid };
    } catch (error) {
        let errorMessage = 'Failed to create user';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Email already in use';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password should be at least 6 characters';
                break;
            default:
                errorMessage = error.message;
        }
        
        return { success: false, error: errorMessage };
    }
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

/**
 * Update UI for authenticated user
 */
function updateUIForUser(user) {
    const authBtn = document.getElementById('auth-btn');
    if (authBtn) {
        const displayName = user.name || user.email.split('@')[0];
        authBtn.innerHTML = `<i class="fas fa-user-circle"></i> ${displayName}`;

        if (user.accessLevel >= ACCESS_LEVELS.EDITOR) {
            authBtn.href = 'admin.html';
            authBtn.onclick = null;
        } else {
            authBtn.href = '#';
            authBtn.onclick = async (e) => {
                e.preventDefault();
                const shouldLogout = await showLogoutPrompt();
                if (shouldLogout) {
                    await logout();
                }
            };
        }
    }
}

/**
 * Update UI for guest
 */
function updateUIForGuest() {
    const authBtn = document.getElementById('auth-btn');
    if (authBtn) {
        authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        authBtn.href = 'login.html';
        authBtn.onclick = null;
    }
}

// Login Form Handler & Page Auth Init
if (document.getElementById('login-form')) {
    initAuth();
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');
    const forgotPasswordBtn = document.getElementById('forgot-password-btn');

    const clearMessages = () => {
        errorMessage.textContent = '';
        successMessage.textContent = '';
        errorMessage.classList.remove('show');
        successMessage.classList.remove('show');
    };

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        clearMessages();
        const email = emailInput.value.trim();
        const password = document.getElementById('password').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        // Disable button
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        
        const result = await login(email, password);
        
        if (!result.success) {
            errorMessage.textContent = result.error;
            errorMessage.classList.add('show');
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        }
    });

    forgotPasswordBtn?.addEventListener('click', async () => {
        clearMessages();
        const email = emailInput.value.trim();
        if (!email) {
            errorMessage.textContent = 'Enter your email first, then click "Forgot password?"';
            errorMessage.classList.add('show');
            emailInput.focus();
            return;
        }

        forgotPasswordBtn.disabled = true;
        forgotPasswordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending reset email...';

        const result = await forgotPassword(email);
        if (result.success) {
            successMessage.textContent = 'Password reset email sent. Check your inbox (and spam folder).';
            successMessage.classList.add('show');
        } else {
            errorMessage.textContent = result.error;
            errorMessage.classList.add('show');
        }

        forgotPasswordBtn.disabled = false;
        forgotPasswordBtn.innerHTML = '<i class="fas fa-key"></i> Forgot password?';
    });
}