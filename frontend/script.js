const API_URL = window.location.protocol === "file:"
    ? "http://localhost:5000/api"
    : "/api";
let contacts = [];
let showFavoritesOnly = false;
let isRegisterMode = false;
let token = localStorage.getItem("connectBookToken");

const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const authMessage = document.getElementById("authMessage");
const switchAuth = document.getElementById("switchAuth");

const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");
const logoutBtn = document.getElementById("logoutBtn");

const contactForm = document.getElementById("contactForm");
const contactsContainer = document.getElementById("contactsContainer");
const searchInput = document.getElementById("search");
const categoryFilter = document.getElementById("categoryFilter");
const allContactsBtn = document.getElementById("allContactsBtn");
const favoritesBtn = document.getElementById("favoritesBtn");

// Switch between Login and Register
switchAuth.addEventListener("click", function() {
    isRegisterMode = !isRegisterMode;

    authTitle.textContent = isRegisterMode ? "Register" : "Login";
    authSubmit.textContent = isRegisterMode ? "Create Account" : "Login";
    authName.style.display = isRegisterMode ? "block" : "none";
    authName.required = isRegisterMode;

    document.getElementById("authSwitch").innerHTML =
        isRegisterMode
            ? 'Already have an account? <button type="button" id="switchAuth">Login</button>'
            : 'Don\'t have an account? <button type="button" id="switchAuth">Register</button>';

    document.getElementById("switchAuth").addEventListener("click", () => {
        switchAuth.click();
    });


    authMessage.textContent = "";
});

// Login or Register
authForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = authEmail.value.trim();
    const password = authPassword.value;

    const endpoint = isRegisterMode ? "register" : "login";

    const userData = {
        email,
        password
    };

    if (isRegisterMode) {
        userData.name = authName.value.trim();
    }

    try {
        const response = await fetch(`${API_URL}/auth/${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(userData)
        });

        const result = await response.json();

        if (!response.ok) {
            authMessage.textContent = result.message;
            return;
        }

        token = result.token;

        localStorage.setItem("connectBookToken", token);

        authForm.reset();
        authMessage.textContent = "";

        showApplication(result.user);

    } catch (error) {
        authMessage.textContent = "Unable to connect to the server.";
        console.error(error);
    }
});

// Show application after login
function showApplication(user) {
    authSection.style.display = "none";
    appSection.style.display = "block";

    document.getElementById("welcomeMessage").textContent =
        "Welcome, " + user.name + "!";

    loadContacts();
}

// Logout
logoutBtn.addEventListener("click", function() {
    localStorage.removeItem("connectBookToken");
    token = null;
    contacts = [];

    appSection.style.display = "none";
    authSection.style.display = "block";

    isRegisterMode = false;
    authTitle.textContent = "Login";
    authSubmit.textContent = "Login";
    authName.style.display = "none";
    authName.required = false;

    document.getElementById("authSwitch").innerHTML =
        'Don\'t have an account? <button type="button" id="switchAuth">Register</button>';

    document.getElementById("switchAuth").addEventListener("click", () => {
        switchAuth.click();
    });
});

// Common authenticated request headers
function getHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

// Handle expired login
function handleUnauthorized() {
    localStorage.removeItem("connectBookToken");
    token = null;
    contacts = [];

    appSection.style.display = "none";
    authSection.style.display = "block";

    authMessage.textContent = "Your session expired. Please log in again.";
}

// Update dashboard
function updateDashboard() {
    // Dashboard Statistics
    document.getElementById("totalContacts").textContent =
        contacts.length;

    document.getElementById("personalContacts").textContent =
        contacts.filter(c => c.category === "Personal").length;

    document.getElementById("workContacts").textContent =
        contacts.filter(c => c.category === "Work").length;

    document.getElementById("favoriteContacts").textContent =
        contacts.filter(c => Boolean(c.is_favorite)).length;

    // Category Analytics
    const categories = ["Personal", "Work", "Family", "Friends", "Other"];

    const chart = document.getElementById("categoryChart");
    chart.replaceChildren();

    categories.forEach(category => {
        const count = contacts.filter(
            c => c.category === category
        ).length;

        const percentage = contacts.length > 0
            ? (count / contacts.length) * 100
            : 0;

        const row = document.createElement("div");
        row.className = "chart-row";

        const label = document.createElement("div");
        label.className = "chart-label";
        label.textContent = category;

        const countLabel = document.createElement("span");
        countLabel.textContent = count;

        const barBackground = document.createElement("div");
        barBackground.className = "chart-bar-background";

        const bar = document.createElement("div");
        bar.className = "chart-bar";
        bar.style.width = percentage + "%";

        barBackground.appendChild(bar);
        row.append(label, barBackground, countLabel);
        chart.appendChild(row);
    });

    // Recent Contacts
    const recentList = document.getElementById("recentContactsList");
    recentList.replaceChildren();

    const recentContacts = [...contacts]
        .sort((a, b) => {
            return new Date(b.created_at) - new Date(a.created_at);
        })
        .slice(0, 5);

    if (recentContacts.length === 0) {
        const message = document.createElement("p");
        message.textContent = "No contacts added yet.";
        message.className = "empty-message";
        recentList.appendChild(message);
    }

    recentContacts.forEach(contact => {
        const item = document.createElement("div");
        item.className = "recent-contact-item";

        const name = document.createElement("h4");
        name.textContent = contact.name;

        const category = document.createElement("span");
        category.className = "category-badge";
        category.textContent = contact.category;

        const date = document.createElement("p");
        date.textContent = contact.created_at
            ? new Date(contact.created_at).toLocaleDateString()
            : "Date unavailable";

        item.append(name, category, date);
        recentList.appendChild(item);
    });
}
// Load contacts
async function loadContacts() {
    try {
        const response = await fetch(`${API_URL}/contacts`, {
            headers: getHeaders()
        });

        if (response.status === 401 || response.status === 403) {
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load contacts");
        }

        contacts = await response.json();

        updateDashboard();
        displayContacts(getFilteredContacts());

    } catch (error) {
        contactsContainer.textContent =
            "Unable to load contacts. Please check the backend.";
        console.error(error);
    }
}

// Add contact
// ADD CONTACT WITH VALIDATION
contactForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const contact = {
        name: document.getElementById("name").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        email: document.getElementById("email").value.trim(),
        category: document.getElementById("category").value
    };

    // Name validation
    if (contact.name.length < 2) {
        showToast("Name must contain at least 2 characters.", "error");
        return;
    }

    // Phone validation
    if (!/^[0-9]{10,15}$/.test(contact.phone)) {
        showToast("Enter a valid phone number (10–15 digits).", "error");
        return;
    }

    // Email validation
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
        showToast("Enter a valid email address.", "error");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/contacts`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(contact)
        });

        const result = await response.json();

        if (response.status === 401 || response.status === 403) {
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            showToast(result.message || "Could not add contact.", "error");
            return;
        }

        showToast("Contact added successfully!");
        contactForm.reset();

        await loadContacts();

    } catch (error) {
        showToast("Backend connection error.", "error");
        console.error(error);
    }
});
// Filter contacts
function getFilteredContacts() {
    const searchText = searchInput.value.toLowerCase().trim();
    const selectedCategory = categoryFilter.value;

    return contacts.filter(function(contact) {
        const matchesSearch =
            contact.name.toLowerCase().includes(searchText) ||
            contact.phone.includes(searchText) ||
            (contact.email || "").toLowerCase().includes(searchText);

        const matchesCategory =
            selectedCategory === "all" ||
            selectedCategory === "All" ||
            contact.category === selectedCategory;

        const matchesFavorite =
            !showFavoritesOnly || Boolean(contact.is_favorite);

        return matchesSearch && matchesCategory && matchesFavorite;
    });
}

// Display contact cards

function displayContacts(list) {
    contactsContainer.replaceChildren();

    if (list.length === 0) {

    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";

    const icon = document.createElement("div");
    icon.className = "empty-state-icon";
    icon.textContent = "♧";

    const heading = document.createElement("h3");
    heading.textContent = "No Contacts Found";

    const description = document.createElement("p");
    description.textContent =
        "Your contact list is looking a little empty. Add contacts to keep your connections organized!";

    emptyState.append(icon, heading, description);

    contactsContainer.appendChild(emptyState);

    return;
}
    list.forEach(function(contact) {
        const card = document.createElement("div");
        card.className = "contact-card";

        // Contact initials
        const avatar = document.createElement("div");
        avatar.className = "contact-avatar";

        const initials = contact.name
            .trim()
            .split(/\s+/)
            .map(word => word[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();

        // Display uploaded photo or initials
        if (contact.profile_image) {
            const image = document.createElement("img");

            image.src = API_URL.replace(/\/api$/, "") + contact.profile_image;
            image.alt = contact.name;
            image.className = "contact-avatar-image";

            image.onerror = function() {
                image.remove();
                avatar.textContent = initials;
            };

            avatar.appendChild(image);
        } else {
            avatar.textContent = initials;
        }

        // Contact information
        const info = document.createElement("div");
        info.className = "contact-info";

        const name = document.createElement("h3");
        name.className = "contact-name";
        name.textContent = contact.name;

        const phone = document.createElement("p");
        phone.textContent = "☎ " + contact.phone;

        const email = document.createElement("p");
        email.textContent = "✉ " + (contact.email || "Not provided");

        info.append(name, phone, email);

        // Category badge
        const category = document.createElement("span");
        category.className = "category-badge";
        category.textContent = contact.category;

        // Action buttons
        const actions = document.createElement("div");
        actions.className = "contact-actions";

        const favoriteBtn = document.createElement("button");
        favoriteBtn.className = "favorite-btn";
        favoriteBtn.textContent = contact.is_favorite
            ? "★ Favorited"
            : "☆ Favorite";

        favoriteBtn.addEventListener("click", () => {
            updateFavorite(contact.id);
        });

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn";
        editBtn.textContent = "Edit";

        editBtn.addEventListener("click", () => {
            editContact(contact);
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn";
        deleteBtn.textContent = "Delete";

        deleteBtn.addEventListener("click", () => {
            deleteContact(contact.id, contact.name);
        });

        // View Details Button
        const viewBtn = document.createElement("button");
        viewBtn.className = "view-btn";
        viewBtn.textContent = "View Details";

        viewBtn.addEventListener("click", () => {
            showContactDetails(contact);
        });

        actions.append(favoriteBtn, viewBtn, editBtn, deleteBtn);

        // Assemble card
        const header = document.createElement("div");
        header.className = "contact-card-header";
        header.append(avatar, info);

        card.append(header, category, actions);
        contactsContainer.appendChild(card);
    });
}
// Update favorite
async function updateFavorite(id) {
    try {
        const response = await fetch(
            `${API_URL}/contacts/${id}/favorite`,
            {
                method: "PATCH",
                headers: getHeaders()
            }
        );

        if (response.status === 401 || response.status === 403) {
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            throw new Error("Favorite update failed");
        }

        await loadContacts();

    } catch (error) {
        alert("Could not update favorite.");
        console.error(error);
    }
}

// Edit contact
// EDIT CONTACT - OPEN POPUP
let currentEditingContactId = null;

function editContact(contact) {
    currentEditingContactId = contact.id;

    document.getElementById("editName").value = contact.name;
    document.getElementById("editPhone").value = contact.phone;
    document.getElementById("editEmail").value = contact.email || "";
    document.getElementById("editCategory").value = contact.category;

    document.getElementById("editContactModal").style.display = "flex";
}
// DELETE CONTACT - OPEN CONFIRMATION POPUP
let currentDeletingContactId = null;

function deleteContact(id, name) {
    currentDeletingContactId = id;

    document.getElementById("deleteContactName").textContent = name;

    document.getElementById("deleteContactModal").style.display = "flex";
}

// CONFIRM DELETE
document.getElementById("confirmDeleteBtn").addEventListener("click", async function() {

    if (!currentDeletingContactId) return;

    try {
        const response = await fetch(
            `${API_URL}/contacts/${currentDeletingContactId}`,
            {
                method: "DELETE",
                headers: getHeaders()
            }
        );

        const result = await response.json();

        if (response.status === 401 || response.status === 403) {
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            showToast(result.message || "Could not delete contact.", "error");
            return;
        }

        closeDeleteModal();

        showToast("Contact deleted successfully!", "success");

        await loadContacts();

    } catch (error) {
        showToast("Could not delete contact.", "error");
        console.error(error);
    }
});

// CLOSE DELETE POPUP
function closeDeleteModal() {
    document.getElementById("deleteContactModal").style.display = "none";
    currentDeletingContactId = null;
}

document.getElementById("cancelDeleteBtn").addEventListener("click", closeDeleteModal);
// Search
searchInput.addEventListener("input", () => {
    displayContacts(getFilteredContacts());
});

// Category filter
categoryFilter.addEventListener("change", () => {
    displayContacts(getFilteredContacts());
});

// All contacts
allContactsBtn.addEventListener("click", () => {
    showFavoritesOnly = false;
    displayContacts(getFilteredContacts());
});

// Favorites
favoritesBtn.addEventListener("click", () => {
    showFavoritesOnly = true;
    displayContacts(getFilteredContacts());
});

// Check existing login
async function checkLogin() {
    if (!token) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/contacts`, {
            headers: getHeaders()
        });

        if (response.status === 401 || response.status === 403) {
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to verify login");
        }

        // The user is authenticated.
        const userResponse = await fetch(`${API_URL}/auth/me`, {
            headers: getHeaders()
        });

        if (!userResponse.ok) {
            handleUnauthorized();
            return;
        }

        const result = await userResponse.json();
        showApplication(result.user);

    } catch (error) {
        console.error(error);
        authMessage.textContent =
            "Unable to connect. Please check the backend.";
    }
}

checkLogin();
// SIDEBAR NAVIGATION

const sidebarLinks = document.querySelectorAll(".nav-link");

sidebarLinks.forEach(link => {

    link.addEventListener("click", function(event) {

        event.preventDefault();

        // Update active sidebar item
        sidebarLinks.forEach(item => {
            item.classList.remove("active");
        });

        this.classList.add("active");

        const linkText = this.textContent.trim();

        if (linkText.includes("Dashboard")) {

            document.getElementById("dashboardSection")
                .scrollIntoView({ behavior: "smooth" });

        }

        else if (linkText.includes("All Contacts")) {

            showFavoritesOnly = false;
            categoryFilter.value = "all";

            displayContacts(getFilteredContacts());

            document.getElementById("contactsSection")
                .scrollIntoView({ behavior: "smooth" });

        }

        else if (linkText.includes("Favorites")) {

            showFavoritesOnly = true;
            categoryFilter.value = "all";

            displayContacts(getFilteredContacts());

            document.getElementById("contactsSection")
                .scrollIntoView({ behavior: "smooth" });

        }

        else if (linkText.includes("Categories")) {

            showFavoritesOnly = false;

            document.getElementById("contactsSection")
                .scrollIntoView({ behavior: "smooth" });

            categoryFilter.focus();

        }

    });

});
// SHOW CONTACT DETAILS
function showContactDetails(contact) {
    document.getElementById("modalName").textContent = contact.name;

    document.getElementById("modalPhone").textContent =
        contact.phone;

    document.getElementById("modalEmail").textContent =
        contact.email || "Not provided";

    document.getElementById("modalCategory").textContent =
        contact.category;

    document.getElementById("modalFavorite").textContent =
        contact.is_favorite ? "Yes ★" : "No";

    document.getElementById("modalDate").textContent =
        contact.created_at
            ? new Date(contact.created_at).toLocaleDateString()
            : "Date unavailable";

    const initials = contact.name
        .trim()
        .split(/\s+/)
        .map(word => word[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

    const modalAvatar = document.getElementById("modalAvatar");

    modalAvatar.replaceChildren();

    if (contact.profile_image) {
        const image = document.createElement("img");

        image.src = API_URL.replace(/\/api$/, "") + contact.profile_image;
        image.alt = contact.name;

        image.onerror = function() {
            image.remove();
            modalAvatar.textContent = initials;
        };

        modalAvatar.appendChild(image);
    } else {
        modalAvatar.textContent = initials;
    }

    document.getElementById("contactModal").style.display = "flex";
}
// CLOSE CONTACT DETAILS
document.getElementById("closeContactModal").addEventListener("click", () => {
    document.getElementById("contactModal").style.display = "none";
});
// TOAST NOTIFICATION
function showToast(message, type = "success") {
    const toast = document.getElementById("toastNotification");
    const toastMessage = document.getElementById("toastMessage");

    toastMessage.textContent = message;

    toast.className = "toast-notification " + type;
    toast.style.display = "block";

    clearTimeout(window.toastTimer);

    window.toastTimer = setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}
// SAVE EDITED CONTACT
document.getElementById("editContactForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    const updatedContact = {
        name: document.getElementById("editName").value.trim(),
        phone: document.getElementById("editPhone").value.trim(),
        email: document.getElementById("editEmail").value.trim(),
        category: document.getElementById("editCategory").value
    };

    try {
        const response = await fetch(
            `${API_URL}/contacts/${currentEditingContactId}`,
            {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify(updatedContact)
            }
        );

        const result = await response.json();

        if (response.status === 401 || response.status === 403) {
            handleUnauthorized();
            return;
        }

        if (!response.ok) {
            showToast(result.message || "Could not update contact.", "error");
            return;
        }

        document.getElementById("editContactModal").style.display = "none";

        showToast("Contact updated successfully!");
        await loadContacts();

    } catch (error) {
        showToast("Could not update contact.", "error");
        console.error(error);
    }
});

// CLOSE EDIT POPUP
function closeEditModal() {
    document.getElementById("editContactModal").style.display = "none";
    currentEditingContactId = null;
}

document.getElementById("closeEditModal").addEventListener("click", closeEditModal);

document.getElementById("cancelEditBtn").addEventListener("click", closeEditModal);
