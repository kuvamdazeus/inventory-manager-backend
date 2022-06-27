"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = require("dotenv");
const mongoose_1 = __importDefault(require("mongoose"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const cors_1 = __importDefault(require("cors"));
const crypto_1 = require("crypto");
const User_1 = __importDefault(require("./models/User"));
const Category_1 = __importDefault(require("./models/Category"));
const Product_1 = __importDefault(require("./models/Product"));
const nodemailer_1 = __importDefault(require("nodemailer"));
(0, dotenv_1.config)();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
mongoose_1.default
    .connect(process.env.DB_URL)
    .then(() => console.log("Connected to database cluster"))
    .catch((err) => console.error("Error connecting to db cluster\n\n", err));
app.post("/register", async (req, res) => {
    const newUser = req.body;
    newUser.password = (0, crypto_1.createHash)("sha256").update(newUser.password).digest("hex");
    const userExists = !!(await User_1.default.findOne({ email: newUser.email }));
    if (userExists)
        return res.status(400).json({ message: "user already exists" });
    const user = await User_1.default.create(newUser);
    const token = jsonwebtoken_1.default.sign({ _id: user._id }, process.env.JWT_SECRET);
    return res.status(201).json({ message: "user successfully created", token });
});
app.post("/login", async (req, res) => {
    const loginUser = req.body;
    const dbUser = await User_1.default.findOne({ email: loginUser.email });
    if (!!dbUser && dbUser.password === (0, crypto_1.createHash)("sha256").update(loginUser.password).digest("hex")) {
        const token = jsonwebtoken_1.default.sign({ _id: dbUser._id }, process.env.JWT_SECRET);
        return res.status(201).json({ message: "user successfully logged in", token });
    }
    return res.status(401).json({ message: "invalid email or password" });
});
app.get("/verify-session", async (req, res) => {
    const { token } = req.query;
    let _id;
    try {
        const sessionData = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        _id = sessionData._id;
    }
    catch (err) {
        return res.status(401).json({ message: "invalid token!" });
    }
    const dbUser = await User_1.default.findOne({ _id });
    if (!!dbUser)
        return res.status(200).json(dbUser);
    return res.status(404).json({ message: "invalid" });
});
app.get("/categories", async (_, res) => {
    const categories = await Category_1.default.find();
    res.status(200).json(categories);
});
app.post("/create-product", async (req, res) => {
    const { token } = req.headers;
    try {
        jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
    }
    catch (err) {
        return res.status(401).json({ message: "invalid token!" });
    }
    await Product_1.default.create(req.body);
    return res.status(201).json({ message: "product created successfully!" });
});
app.post("/create-category", async (req, res) => {
    const { token } = req.headers;
    try {
        jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
    }
    catch (err) {
        return res.status(401).json({ message: "invalid token!" });
    }
    await Category_1.default.create(req.body);
    return res.status(201).json({ message: "category created successfully!" });
});
app.get("/products", async (req, res) => {
    const products = await Product_1.default.aggregate([
        {
            $sort: { categoryId: 1 },
        },
    ]);
    return res.status(200).json(products);
});
app.post("/update-profile", async (req, res) => {
    const { token } = req.headers;
    let _id;
    try {
        const sessionData = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        _id = sessionData._id;
    }
    catch (err) {
        return res.status(401).json({ message: "invalid token!" });
    }
    const oldUser = await User_1.default.findOne({ _id });
    const updatedUserDetails = {
        name: req.body.name,
        email: req.body.email,
        avatarUrl: req.body.avatarUrl,
        password: !!req.body.password
            ? (0, crypto_1.createHash)("sha256").update(req.body.password).digest("hex")
            : oldUser === null || oldUser === void 0 ? void 0 : oldUser.password,
    };
    if ((oldUser === null || oldUser === void 0 ? void 0 : oldUser.password) === (0, crypto_1.createHash)("sha256").update(req.body.password).digest("hex")) {
        return res.status(400).json({ message: "new password can't be same as previous one!" });
    }
    await User_1.default.updateOne({ _id }, updatedUserDetails);
    return res.status(201).json({ message: "user profile updated successfully!" });
});
app.post("/update-category", async (req, res) => {
    const { token } = req.headers;
    const { _id, update } = req.body;
    try {
        jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
    }
    catch (err) {
        return res.status(401).json({ message: "invalid token!" });
    }
    await Product_1.default.updateMany({ categoryId: _id }, { categoryId: update });
    await Category_1.default.deleteOne({ _id });
    await Category_1.default.create({ _id: update });
    return res.status(201).json({ message: "updated category successfully!" });
});
app.post("/delete-category", async (req, res) => {
    const { token } = req.headers;
    const { _id } = req.body;
    try {
        jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
    }
    catch (err) {
        return res.status(401).json({ message: "invalid token!" });
    }
    await Product_1.default.deleteMany({ categoryId: _id });
    await Category_1.default.deleteOne({ _id });
    return res.status(201).json({ message: "category deleted successfully!" });
});
app.post("/update-product", async (req, res) => {
    const { token } = req.headers;
    const { _id, update } = req.body;
    try {
        jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
    }
    catch (err) {
        return res.status(401).json({ message: "invalid token!" });
    }
    await Product_1.default.updateOne({ _id }, update);
    return res.status(201).json({ message: "updated product successfully!" });
});
app.post("/delete-product", async (req, res) => {
    const { token } = req.headers;
    const { _id } = req.body;
    try {
        jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
    }
    catch (err) {
        return res.status(401).json({ message: "invalid token!" });
    }
    await Product_1.default.deleteOne({ _id });
    return res.status(201).json({ message: "product deleted successfully!" });
});
app.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    const dbUser = await User_1.default.findOne({ email });
    if (!dbUser) {
        return res.status(404).json({ message: "user not found with that email" });
    }
    const verificationUrl = `${process.env.FE_BASE_URL}/verify?token=${jsonwebtoken_1.default.sign({ _id: dbUser._id }, process.env.JWT_SECRET)}`;
    const transport = nodemailer_1.default.createTransport({
        host: "smtp-relay.sendinblue.com",
        port: 587,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
    await transport.sendMail({
        from: "Inventory Manager <kuvambhardwaj0529@gmail.com>",
        to: dbUser.email,
        subject: "A Reset Password Request Was Recieved For Your Account",
        html: `<h2>Click on this link to reset your password:</h2><br><br><a href='${verificationUrl}'>${verificationUrl}</a>`,
    });
    return res.status(201).json({ message: "link sent to email" });
});
app.get("/verify-link", (req, res) => {
    const { token } = req.query;
    try {
        jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        return res.status(200).json({ message: "valid link" });
    }
    catch (err) {
        return res.status(401).json({ message: "invalid link" });
    }
});
app.listen(process.env.PORT || 3001, () => console.log("listening!"));
