const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos de la carpeta frontend (subiendo un nivel desde backend)
app.use(express.static(path.join(__dirname, '../frontend')));

// Ruta POST para el Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  try {
    // Ruta al archivo data.json dentro de la misma carpeta backend
    const dataPath = path.join(__dirname, 'data.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);

    // Buscar el usuario que coincida con el email y la contraseña
    const usuarioEncontrado = data.usuarios.find(
      (u) => u.email === email && u.password === password
    );

    if (usuarioEncontrado) {
      return res.json({ 
        success: true, 
        message: '¡Inicio de sesión exitoso!', 
        usuario: { nombre: usuarioEncontrado.nombre, rol: usuarioEncontrado.rol } 
      });
    } else {
      return res.status(401).json({ 
        success: false, 
        message: 'Correo o contraseña incorrectos.' 
      });
    }
  } catch (error) {
    console.error('Error al procesar el login:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor.' 
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});