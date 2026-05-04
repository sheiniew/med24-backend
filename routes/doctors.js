import express from "express";
import { supabase } from "../supabase.js";
import { verifyToken } from "../middlewares/auth.js";
import { isDoctor } from "../middlewares/roles.js";

const router = express.Router();

router.get("/guides", async (req, res) => {
    const { data, error } = await supabase
        .from("medical_guides")
        .select(`
      *,
      doctors (
        specialty,
        profiles (
          full_name
        )
      )
    `);

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
});

router.get("/guides/:id", async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from("medical_guides")
        .select(`
            *,
            doctors (
                specialty,
                profiles (full_name)
            )
        `)
        .eq("id", id)
        .single();

    if (error) return res.status(404).json({ error: "Guía no encontrada" });

    res.json(data);
});

router.get("/doctor/:doctorId", async (req, res) => {
    const { doctorId } = req.params;

    const { data, error } = await supabase
        .from("medical_guides")
        .select("*")
        .eq("doctor_id", doctorId);

    if (error) return res.status(400).json({ error: error.message });

    res.json(data);
});

router.get("/me", verifyToken, isDoctor, async (req, res) => {
    const { data, error } = await supabase
        .from("doctors")
        .select("*")
        .eq("id", req.user.id)
        .single();

    if (error) return res.status(400).json({ error: error.message });

    res.json(data);
});

router.put("/me", verifyToken, isDoctor, async (req, res) => {
    const updates = req.body;

    const { data, error } = await supabase
        .from("doctors")
        .update(updates)
        .eq("id", req.user.id)
        .select()
        .single();

    if (error) return res.status(400).json({ error: error.message });

    res.json(data);
});

router.post("/become-doctor", verifyToken, async (req, res) => {
    const userId = req.user.id;
    const form = req.body;

    await supabase
        .from("profiles")
        .update({ role: "doctor" })
        .eq("id", userId);

    // insertar doctor
    const { data, error } = await supabase
        .from("doctors")
        .insert([{ id: userId, ...form }])
        .select()
        .single();

    if (error) return res.status(400).json({ error: error.message });

    res.json(data);
});

router.get("/:id", async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from("doctors")
        .select(`
      *,
      profiles (
        full_name,
        email
      )
    `)
        .eq("id", id)
        .single();

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.json(data);
});

router.get("/", async (req, res) => {
    try {
        const { data: doctors, error: drError } = await supabase
            .from("doctors")
            .select(`
                *,
                profiles(full_name, email)
            `);

        if (drError) throw drError;

        const { data: ratings, error: rtError } = await supabase
            .from("ratings")
            .select("target_id, rating")
            .eq("target_type", "doctor");

        if (rtError) throw rtError;

        const doctorsWithRating = doctors.map(doc => {
            const docRatings = ratings.filter(r => r.target_id === doc.id);

            const avg = docRatings.length > 0
                ? docRatings.reduce((acc, curr) => acc + curr.rating, 0) / docRatings.length
                : 0;

            return {
                ...doc,
                avg_rating: avg,
                ratings_count: docRatings.length
            };
        });

        res.json(doctorsWithRating);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post("/guides", verifyToken, isDoctor, async (req, res) => {
    const {
        title,
        category,
        urgency,
        description,
        content,
        read_time
    } = req.body;

    const { data, error } = await supabase
        .from("medical_guides")
        .insert([{
            doctor_id: req.user.id,
            title,
            category,
            urgency,
            description,
            content,
            read_time,
            verified: false
        }])
        .select()
        .single();

    if (error) return res.status(400).json({ error: error.message });

    res.json(data);
});

router.put("/guides/:id", verifyToken, isDoctor, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const {
        title,
        category,
        urgency,
        description,
        content,
        read_time
    } = req.body;

    const { data, error } = await supabase
        .from("medical_guides")
        .update({
            title,
            category,
            urgency,
            description,
            content,
            read_time,
            verified: false
        })
        .eq("id", id)
        .eq("doctor_id", userId)
        .select()
        .single();

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    if (!data) {
        return res.status(404).json({ error: "Guía no encontrada o no tienes permiso" });
    }

    res.json(data);
});

router.delete("/guides/:id", verifyToken, isDoctor, async (req, res) => {
    const guideId = req.params.id;
    const userId = req.user.id;

    const { data, error } = await supabase
        .from("medical_guides")
        .delete()
        .eq("id", guideId)
        .eq("doctor_id", userId);

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.json({ message: "Guía eliminada correctamente" });
});

router.get("/rating/:type/:id", async (req, res) => {
    const { type, id } = req.params;

    const { data, error } = await supabase
        .from("ratings")
        .select("rating")
        .eq("target_id", id)
        .eq("target_type", type);

    if (error) return res.status(400).json({ error: error.message });

    const average = data.length > 0
        ? data.reduce((acc, curr) => acc + curr.rating, 0) / data.length
        : 0;

    res.json({ average, count: data.length });
});

router.post("/rate", verifyToken, async (req, res) => {
    const { target_id, target_type, rating } = req.body;
    const user_id = req.user.id;

    const { data, error } = await supabase
        .from("ratings")
        .upsert({ user_id, target_id, target_type, rating }, { onConflict: 'user_id, target_id' })
        .select()
        .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

router.get("/favorites/ids", verifyToken, async (req, res) => {
    const { data, error } = await supabase
        .from("favorite_guides")
        .select("guide_id")
        .eq("user_id", req.user.id);

    if (error) return res.status(400).json({ error: error.message });
    res.json(data.map(f => f.guide_id));
});

router.post("/favorites/toggle", verifyToken, async (req, res) => {
    const { guide_id } = req.body;
    const user_id = req.user.id;

    const { data: existing } = await supabase
        .from("favorite_guides")
        .select("*")
        .eq("user_id", user_id)
        .eq("guide_id", guide_id)
        .single();

    if (existing) {
        await supabase.from("favorite_guides").delete().eq("id", existing.id);
        return res.json({ active: false });
    } else {
        await supabase.from("favorite_guides").insert([{ user_id, guide_id }]);
        return res.json({ active: true });
    }
});

router.get("/favorites/details", verifyToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("favorite_guides")
            .select(`
                guide_id,
                medical_guides (*) 
            `)
            .eq("user_id", req.user.id);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;