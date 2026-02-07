const jwt = require('jsonwebtoken');

module.exports = {
    verifyToken: (req, res, next) => {
        // Handle "Bearer token" or just "token"
        let token = req.headers['authorization'];
        if (!token) return res.status(403).json({ error: "No token provided" });
        
        if (token.startsWith('Bearer ')) {
            token = token.slice(7, token.length);
        }

        // Use the same secret 'secret' defined in index.js
        jwt.verify(token, 'secret', (err, decoded) => {
            if (err) return res.status(401).json({ error: "Invalid Token" });
            req.user = decoded;
            next();
        });
    }
};
