import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";
import doctorsRoutes from "./routes/doctors.js";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";

dotenv.config();



const app = express();
app.use(cors({
  origin: "https://med24-frontend.vercel.app",
  credentials: true,
}));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://med24-frontend.vercel.app");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(cookieParser());
app.use(express.json());
app.use(fileUpload());


app.use("/auth", authRoutes);
app.use("/doctors", doctorsRoutes);
app.use("/chat", chatRoutes);

app.listen(process.env.PORT, () => {
  console.log("Servidor corriendo en puerto", process.env.PORT);
});