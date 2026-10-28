// Laundry Pickup Request App
// Connects the frontend to the Node.js + Express backend.

const API_URL = "http://localhost:3000/api/requests";

const pickupForm = document.getElementById("pickupForm");
const requestsList = document.getElementById("requestsList");
const requestCount = document.getElementById("requestCount");
const formMessage = document.getElementById("formMessage");
const submitButton = document.getElementById("submitButton");

const customerName = document.getElementById("customerName");
const phone = document.getElementById("phone");
const pickupAddress = document.getElementById("pickupAddress");
const pickupDate = document.getElementById("pickupDate");
const pickupTime = document.getElementById("pickupTime");
const laundryType = document.getElementById("laundryType");
const quantity = document.getElementById("quantity");
const instructions = document.getElementById("instructions");

let requests = [];
let editingId = null;
let isSubmitting = false;

// Set the minimum pickup date to today.
function getTodayDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

pickupDate.min = getTodayDate();

// Display messages.
function showMessage(message, type = "success") {
    formMessage.textContent = message;
    formMessage.className =
        type === "error" ? "error-message" : "success-message";
}

// Format a date for display.
function formatDate(dateString) {
    const [year, month, day] = dateString.split("-");

    return new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
    ).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

// Format a time for display.
function formatTime(timeString) {
    const [hours, minutes] = timeString.split(":");
    const date = new Date();

    date.setHours(Number(hours), Number(minutes), 0, 0);

    return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}

// Safely create an HTML element with text.
function createElement(tag, text, className = "") {
    const element = document.createElement(tag);
    element.textContent = text;

    if (className) {
        element.className = className;
    }

    return element;
}

// Handle API requests and server errors.
async function apiRequest(url, options = {}) {
    let response;

    try {
        response = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers
            }
        });
    } catch (error) {
        throw new Error(
            "Cannot connect to the backend. Make sure the server is running."
        );
    }

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("The server returned an invalid response.");
    }

    if (!response.ok) {
        throw new Error(result.error || "Something went wrong.");
    }

    return result;
}

// Load all requests from the backend.
async function loadRequests() {
    requestsList.replaceChildren();
    requestsList.appendChild(createElement("p", "Loading requests..."));

    try {
        requests = await apiRequest(API_URL);
        renderRequests();
    } catch (error) {
        requests = [];
        requestCount.textContent = "Total Requests: unavailable";
        requestsList.replaceChildren();

        requestsList.appendChild(
            createElement("p", error.message)
        );

        showMessage(error.message, "error");
    }
}

// Render requests on the page.
function renderRequests() {
    requestsList.replaceChildren();

    requestCount.textContent = `Total Requests: ${requests.length}`;

    if (requests.length === 0) {
        requestsList.appendChild(
            createElement(
                "p",
                "No pickup requests yet. Submit your first request above!"
            )
        );
        return;
    }

    requests.forEach((request) => {
        const card = document.createElement("article");
        card.className = "request-card";

        card.appendChild(
            createElement(
                "h3",
                `${request.customer_name} — Request #${request.id}`
            )
        );

        card.appendChild(
            createElement("span", request.status, "status")
        );

        const details = [
            `Phone: ${request.phone}`,
            `Address: ${request.pickup_address}`,
            `Pickup Date: ${formatDate(request.pickup_date)}`,
            `Pickup Time: ${formatTime(request.pickup_time)}`,
            `Laundry Type: ${request.laundry_type}`,
            `Quantity: ${request.quantity} items`,
            `Instructions: ${request.instructions || "None"}`
        ];

        details.forEach((detail) => {
            card.appendChild(createElement("p", detail));
        });

        const actions = document.createElement("div");
        actions.className = "request-actions";

        const editButton = createElement("button", "Edit");
        editButton.type = "button";
        editButton.addEventListener("click", () => {
            editRequest(request.id);
        });

        const statusButton = createElement("button", "Update Status");
        statusButton.type = "button";
        statusButton.addEventListener("click", () => {
            updateStatus(request.id, request.status);
        });

        const deleteButton = createElement(
            "button",
            "Delete",
            "delete-button"
        );
        deleteButton.type = "button";
        deleteButton.addEventListener("click", () => {
            deleteRequest(request.id);
        });

        actions.append(editButton, statusButton, deleteButton);
        card.appendChild(actions);
        requestsList.appendChild(card);
    });
}

// Validate form data.
function validateForm(data) {
    if (data.customer_name.length < 2) {
        return "Please enter your full name.";
    }

    if (!/^[6-9]\d{9}$/.test(data.phone)) {
        return "Enter a valid 10-digit Indian mobile number.";
    }

    if (data.pickup_address.length < 5) {
        return "Please enter your complete pickup address.";
    }

    if (!data.pickup_date || data.pickup_date < getTodayDate()) {
        return "Please select today or a future pickup date.";
    }

    if (!data.pickup_time) {
        return "Please select a pickup time.";
    }

    if (
        !["Regular Clothes", "Delicate Clothes", "Bedding"].includes(
            data.laundry_type
        )
    ) {
        return "Please select a valid laundry type.";
    }

    if (
        !Number.isInteger(data.quantity) ||
        data.quantity < 1 ||
        data.quantity > 500
    ) {
        return "Quantity must be between 1 and 500 items.";
    }

    if (data.instructions.length > 1000) {
        return "Instructions cannot exceed 1000 characters.";
    }

    return null;
}

// Reset the form.
function resetForm() {
    pickupForm.reset();
    pickupDate.min = getTodayDate();

    editingId = null;
    submitButton.textContent = "Submit Pickup Request";
    submitButton.disabled = false;
    isSubmitting = false;
}

// Create or update a request.
pickupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting) {
        return;
    }

    const data = {
        customer_name: customerName.value.trim(),
        phone: phone.value.trim(),
        pickup_address: pickupAddress.value.trim(),
        pickup_date: pickupDate.value,
        pickup_time: pickupTime.value,
        laundry_type: laundryType.value,
        quantity: Number(quantity.value),
        instructions: instructions.value.trim()
    };

    const error = validateForm(data);

    if (error) {
        showMessage(error, "error");
        return;
    }

    isSubmitting = true;
    submitButton.disabled = true;
    submitButton.textContent = editingId ? "Saving..." : "Submitting...";

    try {
        if (editingId !== null) {
            await apiRequest(`${API_URL}/${editingId}`, {
                method: "PUT",
                body: JSON.stringify(data)
            });

            showMessage("Pickup request updated successfully!");
        } else {
            await apiRequest(API_URL, {
                method: "POST",
                body: JSON.stringify(data)
            });

            showMessage("Pickup request submitted successfully!");
        }

        resetForm();
        await loadRequests();
    } catch (error) {
        showMessage(error.message, "error");
        submitButton.disabled = false;
        submitButton.textContent =
            editingId !== null ? "Save Changes" : "Submit Pickup Request";
        isSubmitting = false;
    }
});

// Load a request into the form for editing.
function editRequest(id) {
    const request = requests.find(
        (item) => String(item.id) === String(id)
    );

    if (!request) {
        showMessage("Pickup request not found.", "error");
        return;
    }

    editingId = request.id;

    customerName.value = request.customer_name;
    phone.value = request.phone;
    pickupAddress.value = request.pickup_address;
    pickupDate.value = request.pickup_date;
    pickupTime.value = request.pickup_time.slice(0, 5);
    laundryType.value = request.laundry_type;
    quantity.value = request.quantity;
    instructions.value = request.instructions || "";

    submitButton.textContent = "Save Changes";

    showMessage(`Editing request #${id}.`);

    pickupForm.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// Update request status in Supabase through the backend.
async function updateStatus(id, currentStatus) {
    const statuses = [
        "Pending",
        "Confirmed",
        "Picked Up",
        "Completed"
    ];

    const currentIndex = statuses.indexOf(currentStatus);

    const nextStatus = statuses[
        (currentIndex + 1) % statuses.length
    ];

    try {
        await apiRequest(`${API_URL}/${id}/status`, {
            method: "PATCH",
            body: JSON.stringify({
                status: nextStatus
            })
        });

        showMessage(`Request status updated to ${nextStatus}.`);
        await loadRequests();
    } catch (error) {
        showMessage(error.message, "error");
    }
}

// Delete a request from the database.
async function deleteRequest(id) {
    const confirmed = window.confirm(
        `Are you sure you want to delete request #${id}?`
    );

    if (!confirmed) {
        return;
    }

    try {
        await apiRequest(`${API_URL}/${id}`, {
            method: "DELETE"
        });

        if (String(editingId) === String(id)) {
            resetForm();
        }

        showMessage("Pickup request deleted successfully.");
        await loadRequests();
    } catch (error) {
        showMessage(error.message, "error");
    }
}

// Load requests when the page opens.
loadRequests();