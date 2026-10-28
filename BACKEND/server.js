require("dotenv").config();

const express = require("express");
const cors = require("cors");
const supabase = require("./supabase");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "20kb" }));

const allowedLaundryTypes = [
    "Regular Clothes",
    "Delicate Clothes",
    "Bedding"
];

const allowedStatuses = [
    "Pending",
    "Confirmed",
    "Picked Up",
    "Completed"
];

function validateRequest(data, isUpdate = false) {
    const requiredFields = [
        "customer_name",
        "phone",
        "pickup_address",
        "pickup_date",
        "pickup_time",
        "laundry_type",
        "quantity"
    ];

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return "A valid request body is required.";
    }

    if (!isUpdate) {
        for (const field of requiredFields) {
            if (data[field] === undefined || data[field] === null) {
                return `${field} is required.`;
            }
        }
    }

    const fieldsToValidate = isUpdate
        ? Object.keys(data)
        : requiredFields;

    const allowedFields = [
        ...requiredFields,
        "instructions"
    ];

    if (isUpdate && Object.keys(data).length === 0) {
        return "Provide at least one field to update.";
    }

    for (const field of fieldsToValidate) {
        if (!allowedFields.includes(field)) {
            return `Field '${field}' cannot be updated.`;
        }
    }

    if (
        data.customer_name !== undefined &&
        (
            typeof data.customer_name !== "string" ||
            data.customer_name.trim().length < 2 ||
            data.customer_name.trim().length > 100
        )
    ) {
        return "Customer name must contain 2 to 100 characters.";
    }

    if (
        data.phone !== undefined &&
        (
            typeof data.phone !== "string" ||
            !/^[6-9]\d{9}$/.test(data.phone.trim())
        )
    ) {
        return "Enter a valid 10-digit Indian mobile number.";
    }

    if (
        data.pickup_address !== undefined &&
        (
            typeof data.pickup_address !== "string" ||
            data.pickup_address.trim().length < 5 ||
            data.pickup_address.trim().length > 500
        )
    ) {
        return "Pickup address must contain 5 to 500 characters.";
    }

    if (data.pickup_date !== undefined) {
        if (
            typeof data.pickup_date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(data.pickup_date)
        ) {
            return "Pickup date must be in YYYY-MM-DD format.";
        }

        const parsedDate = new Date(
            `${data.pickup_date}T00:00:00Z`
        );

        if (
            Number.isNaN(parsedDate.getTime()) ||
            parsedDate.toISOString().slice(0, 10) !== data.pickup_date
        ) {
            return "Enter a valid pickup date.";
        }

        const today = new Date().toISOString().slice(0, 10);

        if (data.pickup_date < today) {
            return "Pickup date cannot be in the past.";
        }
    }

    if (data.pickup_time !== undefined) {
        if (
            typeof data.pickup_time !== "string" ||
            !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(
                data.pickup_time
            )
        ) {
            return "Enter a valid pickup time.";
        }
    }

    if (
        data.laundry_type !== undefined &&
        !allowedLaundryTypes.includes(data.laundry_type)
    ) {
        return "Select a valid laundry type.";
    }

    if (
        data.quantity !== undefined &&
        (
            !Number.isInteger(data.quantity) ||
            data.quantity < 1 ||
            data.quantity > 500
        )
    ) {
        return "Quantity must be between 1 and 500.";
    }

    if (
        data.instructions !== undefined &&
        (
            typeof data.instructions !== "string" ||
            data.instructions.length > 1000
        )
    ) {
        return "Instructions must not exceed 1000 characters.";
    }

    return null;
}

// Health check
app.get("/", (req, res) => {
    res.json({
        message: "Laundry Pickup Request API is running."
    });
});

// GET: Retrieve all pickup requests
app.get("/api/requests", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("pickup_requests")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Fetch error:", error.message);
            return res.status(500).json({
                error: "Unable to retrieve pickup requests."
            });
        }

        res.json(data);
    } catch (error) {
        console.error("Server error:", error.message);
        res.status(500).json({
            error: "An unexpected server error occurred."
        });
    }
});

// GET: Retrieve one pickup request
app.get("/api/requests/:id", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("pickup_requests")
            .select("*")
            .eq("id", req.params.id)
            .maybeSingle();

        if (error) {
            console.error("Fetch error:", error.message);
            return res.status(500).json({
                error: "Unable to retrieve the pickup request."
            });
        }

        if (!data) {
            return res.status(404).json({
                error: "Pickup request not found."
            });
        }

        res.json(data);
    } catch (error) {
        console.error("Server error:", error.message);
        res.status(500).json({
            error: "An unexpected server error occurred."
        });
    }
});

// POST: Create a pickup request
app.post("/api/requests", async (req, res) => {
    const validationError = validateRequest(req.body);

    if (validationError) {
        return res.status(400).json({
            error: validationError
        });
    }

    try {
        const newRequest = {
            customer_name: req.body.customer_name.trim(),
            phone: req.body.phone.trim(),
            pickup_address: req.body.pickup_address.trim(),
            pickup_date: req.body.pickup_date,
            pickup_time: req.body.pickup_time,
            laundry_type: req.body.laundry_type,
            quantity: req.body.quantity,
            instructions: (req.body.instructions || "").trim(),
            status: "Pending"
        };

        const { data, error } = await supabase
            .from("pickup_requests")
            .insert(newRequest)
            .select()
            .single();

        if (error) {
            console.error("Insert error:", error.message);
            return res.status(500).json({
                error: "Unable to create the pickup request."
            });
        }

        res.status(201).json(data);
    } catch (error) {
        console.error("Server error:", error.message);
        res.status(500).json({
            error: "An unexpected server error occurred."
        });
    }
});

// PUT: Update a pickup request
app.put("/api/requests/:id", async (req, res) => {
    const validationError = validateRequest(req.body, true);

    if (validationError) {
        return res.status(400).json({
            error: validationError
        });
    }

    try {
        const updates = { ...req.body };

        if (updates.customer_name !== undefined) {
            updates.customer_name = updates.customer_name.trim();
        }

        if (updates.phone !== undefined) {
            updates.phone = updates.phone.trim();
        }

        if (updates.pickup_address !== undefined) {
            updates.pickup_address = updates.pickup_address.trim();
        }

        if (updates.instructions !== undefined) {
            updates.instructions = updates.instructions.trim();
        }

        const { data, error } = await supabase
            .from("pickup_requests")
            .update(updates)
            .eq("id", req.params.id)
            .select()
            .maybeSingle();

        if (error) {
            console.error("Update error:", error.message);
            return res.status(500).json({
                error: "Unable to update the pickup request."
            });
        }

        if (!data) {
            return res.status(404).json({
                error: "Pickup request not found."
            });
        }

        res.json(data);
    } catch (error) {
        console.error("Server error:", error.message);
        res.status(500).json({
            error: "An unexpected server error occurred."
        });
    }
});

// PATCH: Update request status
app.patch("/api/requests/:id/status", async (req, res) => {
    const { status } = req.body || {};

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            error: "Select a valid request status."
        });
    }

    try {
        const { data, error } = await supabase
            .from("pickup_requests")
            .update({ status })
            .eq("id", req.params.id)
            .select()
            .maybeSingle();

        if (error) {
            console.error("Status update error:", error.message);
            return res.status(500).json({
                error: "Unable to update request status."
            });
        }

        if (!data) {
            return res.status(404).json({
                error: "Pickup request not found."
            });
        }

        res.json(data);
    } catch (error) {
        console.error("Server error:", error.message);
        res.status(500).json({
            error: "An unexpected server error occurred."
        });
    }
});

// DELETE: Delete a pickup request
app.delete("/api/requests/:id", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("pickup_requests")
            .delete()
            .eq("id", req.params.id)
            .select("id")
            .maybeSingle();

        if (error) {
            console.error("Delete error:", error.message);
            return res.status(500).json({
                error: "Unable to delete the pickup request."
            });
        }

        if (!data) {
            return res.status(404).json({
                error: "Pickup request not found."
            });
        }

        res.json({
            message: "Pickup request deleted successfully.",
            id: data.id
        });
    } catch (error) {
        console.error("Server error:", error.message);
        res.status(500).json({
            error: "An unexpected server error occurred."
        });
    }
});

// Handle unknown routes
app.use((req, res) => {
    res.status(404).json({
        error: "API endpoint not found."
    });
});

// Handle invalid JSON and other Express errors
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof SyntaxError && "body" in err) {
        return res.status(400).json({
            error: "Invalid JSON request body."
        });
    }

    console.error("Unexpected error:", err.message);

    res.status(500).json({
        error: "An unexpected server error occurred."
    });
});

app.listen(PORT, () => {
    console.log(`Laundry Pickup API running at http://localhost:${PORT}`);
});