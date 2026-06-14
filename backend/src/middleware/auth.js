// src/middleware/auth.js
// Attaches req.user = { id, name, email } if the JWT is valid.
// Any route that needs a logged-in user should use this middleware.

const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  // Token comes in the Authorization header as: "Bearer <token>"
  const header = req.headers['authorization'];
  if (!header) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.split(' ')[1]; // grab the part after "Bearer "
  if (!token) {
    return res.status(401).json({ error: 'Malformed authorization header' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = auth;
