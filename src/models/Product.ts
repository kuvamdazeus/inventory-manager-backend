import mongoose, { Schema } from "mongoose";

const productSchema = new Schema({
  name: String,
  categoryId: String,
  price: Number,
});

export default mongoose.model("products", productSchema);
