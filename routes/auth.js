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
            emailRedirectTo: 'https://med24-frontend.vercel.app/login',
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

    if (error) {
        return res.status(400).json({ error: error.message });
    }
    const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, role, avatar_url, full_name")
        .eq("id", data.user.id)
        .single();

    if (profileError) {
        return res.status(400).json({ error: profileError.message });
    }

    const token = jwt.sign(
        {
            id: data.user.id,
            email: data.user.email,
        },
        process.env.JWT_SECRET
    );

    res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
    });

    res.json({
        user: profileData
    });
});

router.post("/logout", (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
    });

    res.json({ success: true });
});

router.get("/me", verifyToken, async (req, res) => {
    try {

        const { data, error } = await supabase
            .from("profiles")
            .select("id, email, role, avatar_url, full_name")
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

    res.json(data)
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

router.post("/upload-avatar", verifyToken, async (req, res) => {
    try {
        if (!req.files || !req.files.avatar) {
            return res.status(400).json({ error: "No se envió archivo" });
        }

        const file = req.files.avatar;
        const userId = req.user.id;

        const fileExt = file.name.split(".").pop();
        const filePath = `${userId}/avatar.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(filePath, file.data, {
                contentType: file.mimetype,
                upsert: true,
                cacheControl: "3600",
            });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from("avatars")
            .getPublicUrl(filePath);

        const avatarUrl = data.publicUrl;

        const { error: dbError } = await supabase
            .from("profiles")
            .update({ avatar_url: avatarUrl })
            .eq("id", userId);

        if (dbError) throw dbError;

        res.json({
            avatar_url: avatarUrl,
            version: Date.now()
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

router.delete("/delete-avatar", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", userId)
            .single();

        if (profileError) throw profileError;

        if (profile.avatar_url) {
            const filePath = `${userId}/avatar.jpg`;

            await supabase.storage
                .from("avatars")
                .remove([filePath]);
        }

        const { error: updateError } = await supabase
            .from("profiles")
            .update({ avatar_url: null })
            .eq("id", userId);

        if (updateError) throw updateError;

        res.json({ success: true });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});



export default router;