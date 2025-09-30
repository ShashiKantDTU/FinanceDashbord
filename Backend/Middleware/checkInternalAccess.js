module.exports = function(req, res, next) {
  const key = req.headers["x-internal-secret"];
  if (!key || key !== process.env.INTERNAL_API_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};