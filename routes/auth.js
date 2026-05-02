import express from "express";
import jwt from "jsonwebtoken";
import { supabase } from "../supabase.js";
import { verifyToken } from "../middlewares/auth.js";

const router = express.Router();

router.post("/register", async (req, res) => {
    const { email, password } = req.body;
    const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: 'https://localhost:5173/login',
        }
    });

    if (authError) {
        return res.status(400).json({ error: authError.message });
    }

    res.json({
        message: "Usuario registrado. Por favor, confirma tu correo electrónico.",
        needsConfirmation: true
    });
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) return res.status(400).json({ error: error.message });

    const token = jwt.sign(
        { id: data.user.id, email },
        process.env.JWT_SECRET
    );

    res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
    });

    res.json({ user: { id: data.user.id, email } });
});

router.post("/logout", (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
    });

    res.json({ success: true });
});

router.get("/me", verifyToken, async (req, res) => {
    try {

        const { data, error } = await supabase
            .from("profiles")
            .select("id, email, role")
            .eq("id", req.user.id)
            .maybeSingle();

        if (error || !data) {
            console.log("Error en Supabase o perfil no encontrado:", error);
            return res.json({ user: null });
        }

        res.json({ user: data });
    } catch (err) {
        res.status(500).json({ user: null });
    }
});

router.get("/profile", verifyToken, async (req, res) => {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", req.user.id)
        .single();

    if (error) return res.status(400).json({ error: error.message });

    res.json(data);
});

router.put("/profile", verifyToken, async (req, res) => {
    const updates = req.body;

    const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", req.user.id)
        .select()
        .single();

    if (error) return res.status(400).json({ error: error.message });

    res.json(data);
});


export default router;