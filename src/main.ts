import express from "express";
import { config } from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import cors from "cors";
import { createHash } from "crypto";
import { IUser } from "./types";
import User from "./models/User";
import Category from "./models/Category";
import Product from "./models/Product";
import nodemailer from "nodemailer";

// parse and add env variables to `process.env`
config();

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

mongoose
  .connect(process.env.DB_URL as string)
  .then(() => console.log("Connected to database cluster"))
  .catch((err) => console.error("Error connecting to db cluster\n\n", err));

app.post("/register", async (req, res) => {
  const newUser = req.body as IUser;
  newUser.password = createHash("sha256").update(newUser.password).digest("hex");

  const userExists = !!(await User.findOne({ email: newUser.email }));
  if (userExists) return res.status(400).json({ message: "user already exists" });

  const user = await User.create(newUser);
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET as string);

  return res.status(201).json({ message: "user successfully created", token });
});

app.post("/login", async (req, res) => {
  const loginUser = req.body as { email: string; password: string };

  const dbUser = await User.findOne({ email: loginUser.email });

  if (!!dbUser && dbUser.password === createHash("sha256").update(loginUser.password).digest("hex")) {
    const token = jwt.sign({ _id: dbUser._id }, process.env.JWT_SECRET as string);
    return res.status(201).json({ message: "user successfully logged in", token });
  }

  return res.status(401).json({ message: "invalid email or password" });
});

app.get("/verify-session", async (req, res) => {
  const { token } = req.query;

  let _id: string;
  try {
    const sessionData = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
    _id = sessionData._id;
  } catch (err) {
    return res.status(401).json({ message: "invalid token!" });
  }

  const dbUser = await User.findOne({ _id });
  if (!!dbUser) return res.status(200).json(dbUser);
  return res.status(404).json({ message: "invalid" });
});

app.get("/categories", async (_, res) => {
  const categories = await Category.find();
  res.status(200).json(categories);
});

app.post("/create-product", async (req, res) => {
  // user verification for creating product
  const { token } = req.headers;

  try {
    jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
  } catch (err) {
    return res.status(401).json({ message: "invalid token!" });
  }

  await Product.create(req.body);
  return res.status(201).json({ message: "product created successfully!" });
});

app.post("/create-category", async (req, res) => {
  // user verification for creating category
  const { token } = req.headers;

  try {
    jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
  } catch (err) {
    return res.status(401).json({ message: "invalid token!" });
  }

  await Category.create(req.body);
  return res.status(201).json({ message: "category created successfully!" });
});

app.get("/products", async (req, res) => {
  const products = await Product.aggregate([
    {
      $sort: { categoryId: 1 },
    },
  ]);

  return res.status(200).json(products);
});

app.post("/update-profile", async (req, res) => {
  const { token } = req.headers;
  let _id: string;

  try {
    const sessionData = jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
    _id = sessionData._id;
  } catch (err) {
    return res.status(401).json({ message: "invalid token!" });
  }

  const oldUser = await User.findOne({ _id });
  const updatedUserDetails: IUser = {
    name: req.body.name,
    email: req.body.email,
    avatarUrl: req.body.avatarUrl,
    password: !!req.body.password
      ? createHash("sha256").update(req.body.password).digest("hex")
      : (oldUser?.password as string),
  };

  if (oldUser?.password === createHash("sha256").update(req.body.password).digest("hex")) {
    return res.status(400).json({ message: "new password can't be same as previous one!" });
  }

  await User.updateOne({ _id }, updatedUserDetails);
  return res.status(201).json({ message: "user profile updated successfully!" });
});

app.post("/update-category", async (req, res) => {
  const { token } = req.headers;
  const { _id, update } = req.body;

  try {
    jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
  } catch (err) {
    return res.status(401).json({ message: "invalid token!" });
  }

  await Product.updateMany({ categoryId: _id }, { categoryId: update });
  await Category.deleteOne({ _id });
  await Category.create({ _id: update });
  return res.status(201).json({ message: "updated category successfully!" });
});

app.post("/delete-category", async (req, res) => {
  const { token } = req.headers;
  const { _id } = req.body;

  try {
    jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
  } catch (err) {
    return res.status(401).json({ message: "invalid token!" });
  }

  await Product.deleteMany({ categoryId: _id });
  await Category.deleteOne({ _id });
  return res.status(201).json({ message: "category deleted successfully!" });
});

app.post("/update-product", async (req, res) => {
  const { token } = req.headers;
  const { _id, update } = req.body;

  try {
    jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
  } catch (err) {
    return res.status(401).json({ message: "invalid token!" });
  }

  await Product.updateOne({ _id }, update);
  return res.status(201).json({ message: "updated product successfully!" });
});

app.post("/delete-product", async (req, res) => {
  const { token } = req.headers;
  const { _id } = req.body;

  try {
    jwt.verify(token as string, process.env.JWT_SECRET as string) as any;
  } catch (err) {
    return res.status(401).json({ message: "invalid token!" });
  }

  await Product.deleteOne({ _id });
  return res.status(201).json({ message: "product deleted successfully!" });
});

app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  const dbUser = await User.findOne({ email });
  if (!dbUser) {
    return res.status(404).json({ message: "user not found with that email" });
  }

  const verificationUrl = `${process.env.FE_BASE_URL}/verify?token=${jwt.sign(
    { _id: dbUser._id },
    process.env.JWT_SECRET as string
  )}`;

  try {
    const transport = nodemailer.createTransport({
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
  } catch (err) {
    return res.status(500).json({ message: "well, thats sad! Error in sending email" });
  }

  return res.status(201).json({ message: "link sent to email" });
});

app.get("/verify-link", (req, res) => {
  const { token } = req.query;
  try {
    jwt.verify(token as string, process.env.JWT_SECRET as string);
    return res.status(200).json({ message: "valid link" });
  } catch (err) {
    return res.status(401).json({ message: "invalid link" });
  }
});

app.listen(process.env.PORT || 3001, () => console.log("listening!"));
