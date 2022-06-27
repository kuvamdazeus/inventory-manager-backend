import mongoose, { Schema } from "mongoose";

const userSchema = new Schema({
  name: String,
  email: String,
  password: String,
  avatarUrl: String,
});

export default mongoose.model("users", userSchema);
