import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {

  const token = req.cookies.token;

  if (!token) return res.status(401).json({ error: "No autenticado" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Error al verificar token:", err);
    res.status(401).json({ error: "Token inválido" });
  }
};