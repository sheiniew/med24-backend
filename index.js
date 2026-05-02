import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";
import doctorsRoutes from "./routes/doctors.js";
import cookieParser from "cookie-parser";
dotenv.config();



const app = express();
app.use(cors({
  origin: "https://med24-frontend.vercel.app", 
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(cookieParser());
app.use(express.json());


app.use("/auth", authRoutes);
app.use("/doctors", doctorsRoutes);
app.use("/chat", chatRoutes);

app.listen(process.env.PORT, () => {
  console.log("Servidor corriendo en puerto", process.env.PORT);
});
