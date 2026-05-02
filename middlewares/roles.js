import { supabase } from "../supabase.js";

export const isDoctor = async (req, res, next) => {
    const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", req.user.id)
        .single();

    if (error || data.role !== "doctor") {
        return res.status(403).json({ error: "acceso solo para medicos" });
    }

    next();
};