const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");

require("dotenv").config();

const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

const allowedCategories = [
    "Personal",
    "Friends",
    "Work",
    "Family"
];

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb" }));
// Profile Image Storage
const fs = require("fs");

const uploadFolder = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadFolder);
    },
    filename: (req, file, cb) => {
        const uniqueName =
            Date.now() + "-" + Math.round(Math.random() * 1E9);

        cb(null, uniqueName + path.extname(file.originalname).toLowerCase());
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, PNG and WEBP images are allowed."));
        }
    }
});

app.use("/uploads", express.static(uploadFolder));
// Handle profile image upload errors
function handleProfileUpload(req, res, next) {
    upload.single("profileImage")(req, res, function(error) {
        if (error) {
            return res.status(400).json({
                message: error.message || "Image upload failed."
            });
        }

        next();
    });
}

// Generate JWT token
function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            message: "Invalid or expired token."
        });
    }
}

// Validate contact
function validateContact(req, res, next) {
    const { name, phone, email, category } = req.body || {};

    if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100
    ) {
        return res.status(400).json({
            message: "Please enter a valid name."
        });
    }

    if (
        typeof phone !== "string" ||
        !/^[0-9+\-\s()]{7,20}$/.test(phone.trim())
    ) {
        return res.status(400).json({
            message: "Please enter a valid phone number."
        });
    }

    if (email !== undefined && email !== null && email !== "") {
        if (
            typeof email !== "string" ||
            email.length > 100 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return res.status(400).json({
                message: "Please enter a valid email address."
            });
        }
    }

    if (!allowedCategories.includes(category)) {
        return res.status(400).json({
            message: "Please select a valid category."
        });
    }

    next();
}

// Serve ConnectBook frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// REGISTER
app.post("/api/auth/register", async (req, res) => {
    try {
        const { name, email, password } = req.body || {};

        if (
            typeof name !== "string" ||
            !name.trim() ||
            name.trim().length > 100
        ) {
            return res.status(400).json({
                message: "Please enter a valid name."
            });
        }

        if (
            typeof email !== "string" ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
            email.length > 100
        ) {
            return res.status(400).json({
                message: "Please enter a valid email."
            });
        }

        if (
            typeof password !== "string" ||
            password.length < 8 ||
            password.length > 72
        ) {
            return res.status(400).json({
                message: "Password must contain 8 to 72 characters."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        db.query(
            "INSERT INTO Users (name, email, password) VALUES (?, ?, ?)",
            [name.trim(), email.trim().toLowerCase(), hashedPassword],
            (err, result) => {
                if (err) {
                    if (err.code === "ER_DUP_ENTRY") {
                        return res.status(409).json({
                            message: "This email is already registered."
                        });
                    }

                    return res.status(500).json({
                        message: "Registration failed."
                    });
                }

                const user = {
                    id: result.insertId,
                    name: name.trim(),
                    email: email.trim().toLowerCase()
                };

                const token = generateToken(user);

                // Attach previously unassigned contacts to the first account.
                db.query(
                    "UPDATE Contacts SET user_id = ? WHERE user_id IS NULL",
                    [user.id],
                    (updateError) => {
                        if (updateError) {
                            console.error(
                                "Could not assign existing contacts:",
                                updateError.message
                            );
                        }

                        res.status(201).json({
                            message: "Registration successful!",
                            token,
                            user
                        });
                    }
                );
            }
        );
    } catch (error) {
        res.status(500).json({
            message: "Registration failed."
        });
    }
});

// LOGIN
app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body || {};

    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
    ) {
        return res.status(400).json({
            message: "Please enter email and password."
        });
    }

    db.query(
        "SELECT * FROM Users WHERE email = ?",
        [email.trim().toLowerCase()],
        async (err, results) => {
            if (err) {
                return res.status(500).json({
                    message: "Login failed."
                });
            }

            if (results.length === 0) {
                return res.status(401).json({
                    message: "Invalid email or password."
                });
            }

            const user = results[0];

            const passwordMatch = await bcrypt.compare(
                password,
                user.password
            );

            if (!passwordMatch) {
                return res.status(401).json({
                    message: "Invalid email or password."
                });
            }

            const token = generateToken(user);

            res.json({
                message: "Login successful!",
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email
                }
            });
        }
    );
});
// GET LOGGED-IN USER
app.get("/api/auth/me", authenticateToken, (req, res) => {
    db.query(
        "SELECT id, name, email FROM Users WHERE id = ?",
        [req.user.id],
        (err, results) => {
            if (err) {
                return res.status(500).json({
                    message: "Failed to fetch user."
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    message: "User not found."
                });
            }

            res.json({
                user: results[0]
            });
        }
    );
});
// GET CONTACTS
app.get("/api/contacts", authenticateToken, (req, res) => {
    db.query(
        "SELECT * FROM Contacts WHERE user_id = ? ORDER BY id DESC",
        [req.user.id],
        (err, results) => {
            if (err) {
                return res.status(500).json({
                    message: "Failed to fetch contacts."
                });
            }

            res.json(results);
        }
    );
});

// ADD CONTACT
// ADD CONTACT
app.post(
    "/api/contacts",
    authenticateToken,
    handleProfileUpload,
    validateContact,
    (req, res) => {
        const { name, phone, email, category } = req.body;

        const profileImage = req.file
            ? "/uploads/" + req.file.filename
            : null;

        const sql = `
            INSERT INTO Contacts
            (name, phone, email, category, user_id, profile_image)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [
                name.trim(),
                phone.trim(),
                email ? email.trim() : null,
                category,
                req.user.id,
                profileImage
            ],
            (err, result) => {
                if (err) {
                    return res.status(500).json({
                        message: "Failed to add contact."
                    });
                }

                res.status(201).json({
                    message: "Contact added successfully!",
                    id: result.insertId
                });
            }
        );
    }
);


// UPDATE CONTACT
app.put(
    "/api/contacts/:id",
    authenticateToken,
    handleProfileUpload,
    validateContact,
    (req, res) => {
        const id = req.params.id;

        if (!/^[1-9][0-9]*$/.test(id)) {
            return res.status(400).json({
                message: "Invalid contact ID."
            });
        }

        const { name, phone, email, category } = req.body;

        const profileImage = req.file
            ? "/uploads/" + req.file.filename
            : null;

        const sql = `
            UPDATE Contacts
            SET name = ?, phone = ?, email = ?, category = ?,
                profile_image = COALESCE(?, profile_image)
            WHERE id = ? AND user_id = ?
        `;

        db.query(
            sql,
            [
                name.trim(),
                phone.trim(),
                email ? email.trim() : null,
                category,
                profileImage,
                id,
                req.user.id
            ],
            (err, result) => {
                if (err) {
                    return res.status(500).json({
                        message: "Failed to update contact."
                    });
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        message: "Contact not found."
                    });
                }

                res.json({
                    message: "Contact updated successfully!"
                });
            }
        );
    }
);

// DELETE CONTACT
app.delete("/api/contacts/:id", authenticateToken, (req, res) => {
    const id = req.params.id;

    if (!/^[1-9][0-9]*$/.test(id)) {
        return res.status(400).json({
            message: "Invalid contact ID."
        });
    }

    db.query(
        "DELETE FROM Contacts WHERE id = ? AND user_id = ?",
        [id, req.user.id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: "Failed to delete contact."
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Contact not found."
                });
            }

            res.json({
                message: "Contact deleted successfully!"
            });
        }
    );
});

// TOGGLE FAVORITE
app.patch(
    "/api/contacts/:id/favorite",
    authenticateToken,
    (req, res) => {
        const id = req.params.id;

        if (!/^[1-9][0-9]*$/.test(id)) {
            return res.status(400).json({
                message: "Invalid contact ID."
            });
        }

        db.query(
            `UPDATE Contacts
             SET is_favorite = NOT is_favorite
             WHERE id = ? AND user_id = ?`,
            [id, req.user.id],
            (err, result) => {
                if (err) {
                    return res.status(500).json({
                        message: "Failed to update favorite."
                    });
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        message: "Contact not found."
                    });
                }

                res.json({
                    message: "Favorite status updated successfully!"
                });
            }
        );
    }
);

// Unknown routes
app.use((req, res) => {
    res.status(404).json({
        message: "API route not found."
    });
});

// Start server
app.listen(PORT, () => {
    console.log(
        `ConnectBook server running at http://localhost:${PORT}`
    );
});