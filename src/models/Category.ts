import mongoose, { Schema } from "mongoose";

const categorySchema = new Schema({
  _id: String,
});

export default mongoose.model("categories", categorySchema);
