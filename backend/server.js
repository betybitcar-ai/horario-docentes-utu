const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());
app.use(session({
  secret: 'edusync_secret_key_2026',
  resave: false,
  saveUninitialized: false
}));

// Configuración de la base de datos SQLite
const db = new sqlite3.Database('./edusync.db', (err) => {
  if (err) console.error("Error al conectar con la base de datos", err);
  else console.log("Conectado a la base de datos SQLite.");
});

// Crear tablas necesarias y poblar datos iniciales
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher TEXT,
    subject TEXT,
    day TEXT,
    start_time TEXT,
    end_time TEXT,
    room TEXT,
    status TEXT DEFAULT 'ocupado'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS absences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher TEXT,
    date TEXT,
    reason TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT,
    author TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT,
    receiver TEXT,
    content TEXT,
    date TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    subsyst TEXT,
    entry_profile TEXT,
    duration TEXT,
    description TEXT
  )`);

  // Insertar el curso de Tecnologías de la Información si no existe
  db.get(`SELECT COUNT(*) as count FROM courses WHERE name LIKE ?`, ['%Tecnologías de la Información%'], (err, row) => {
    if (row && row.count === 0) {
      db.run(`INSERT INTO courses (name, subsyst, entry_profile, duration, description) VALUES (?, ?, ?, ?, ?)`, [
        "Bachillerato Tecnológico (BT) en Tecnologías de la Información - 3º MF",
        "Dirección Técnica de Gestión Académica (DGETP - UTU)",
        "Egresados de la Educación Media Básica en sus diversas modalidades",
        "3 años",
        "Enfocada en áreas de innovación tecnológica, desarrollo de software, aplicaciones web interactivas, bases de datos, redes, ciberseguridad e inteligencia artificial, promoviendo la solución de problemas reales del sector productivo digital."
      ]);
    }
  });

  // Poblar la tabla schedules con el horario exacto del curso 3º MF si está vacía
  db.get(`SELECT COUNT(*) as count FROM schedules`, [], (err, row) => {
    if (row && row.count === 0) {
      const scheduleData = [
        // LUNES
        ['PRATS MONICA', 'EMPREDEDURISMO', 'LUNES', '07:30', '08:15', 'Salón 1'],
        ['PRATS MONICA', 'EMPREDEDURISMO', 'LUNES', '08:15', '09:00', 'Salón 1'],
        ['MANASSI, MARIA', 'INGLÉS', 'LUNES', '09:05', '09:50', 'Salón 1'],
        ['MANASSI, MARIA', 'INGLÉS', 'LUNES', '09:50', '10:35', 'Salón 1'],
        ['DEL RIO ANTONELLA', 'FILOSOFÍA', 'LUNES', '10:40', '11:25', 'Salón 1'],
        ['BRUNO, CORNELUS', 'PROGRAMACIÓN', 'LUNES', '11:25', '12:10', 'Salón 1'],
        ['BRUNO, CORNELUS', 'PROGRAMACIÓN', 'LUNES', '12:15', '13:00', 'Salón 1'],
        
        // MARTES
        ['BRUNO, CORNELUS', 'PROGRAMACIÓN', 'MARTES', '07:30', '08:15', 'Salón 1'],
        ['PEREIRA SAUL', 'MATEMATICA CTS', 'MARTES', '08:15', '09:00', 'Salón 1'],
        ['PEREIRA SAUL', 'CALCULO', 'MARTES', '09:05', '09:50', 'Salón 1'],
        ['PEREIRA SAUL', 'CALCULO', 'MARTES', '09:50', '10:35', 'Salón 1'],
        ['MANASSI, MARIA', 'INGLÉS', 'MARTES', '10:40', '11:25', 'Salón 1'],
        ['MANASSI, MARIA', 'INGLÉS', 'MARTES', '11:25', '12:10', 'Salón 1'],
        ['MESINGUER ANA', 'SOCIOLOGÍA', 'MARTES', '12:15', '13:00', 'Salón 1'],
        ['MESINGUER ANA', 'SOCIOLOGÍA', 'MARTES', '13:05', '13:50', 'Salón 1'],

        // MIÉRCOLES
        ['MARTÍN TULIPANO', 'FÍSICA', 'MIÉRCOLES', '07:30', '08:15', 'Salón 1'],
        ['PEREIRA SAUL', 'MATEMATICA CTS', 'MIÉRCOLES', '08:15', '09:00', 'Salón 1'],
        ['PEREIRA SAUL', 'MATEMATICA CTS', 'MIÉRCOLES', '09:05', '09:50', 'Salón 1'],
        ['KAISER MARCOS', 'TUTORIAS UTULAB', 'MIÉRCOLES', '09:50', '10:35', 'UTULAB'],
        ['KAISER MARCOS', 'TUTORIAS UTULAB', 'MIÉRCOLES', '10:40', '11:25', 'UTULAB'],
        ['BRUNO, CORNELUS', 'PROGRAMACIÓN', 'MIÉRCOLES', '11:25', '12:10', 'Salón 1'],
        ['BRUNO, CORNELUS', 'PROGRAMACIÓN', 'MIÉRCOLES', '12:15', '13:00', 'Salón 1'],

        // JUEVES
        ['MARTÍN TULIPANO', 'FÍSICA', 'JUEVES', '07:30', '08:15', 'Salón 1'],
        ['MARTÍN TULIPANO', 'FÍSICA', 'JUEVES', '08:15', '09:00', 'Salón 1'],
        ['DEL RIO ANTONELLA', 'FILOSOFÍA', 'JUEVES', '09:05', '09:50', 'Salón 1'],
        ['DEL RIO ANTONELLA', 'FILOSOFÍA', 'JUEVES', '09:50', '10:35', 'Salón 1'],
        ['SILVIO, FAGUNDEZ', 'SOFTWARE', 'JUEVES', '10:40', '11:25', 'Salón 1'],
        ['SILVIO, FAGUNDEZ', 'SOFTWARE', 'JUEVES', '11:25', '12:10', 'Salón 1'],

        // VIERNES
        ['BRUNO, CORNELUS', 'INTELIGENCIA ARTIFICIAL', 'VIERNES', '07:30', '08:15', 'Salón 1'],
        ['BRUNO, CORNELUS', 'INTELIGENCIA ARTIFICIAL', 'VIERNES', '08:15', '09:00', 'Salón 1'],
        ['KAISER MARCOS', 'ADM SISTEMAS', 'VIERNES', '09:05', '09:50', 'Salón 1'],
        ['SILVIO, FAGUNDEZ', 'SOFTWARE', 'VIERNES', '09:50', '10:35', 'Salón 1'],
        ['SILVIO, FAGUNDEZ', 'SOFTWARE', 'VIERNES', '10:40', '11:25', 'Salón 1'],
        ['MESINGUER ANA', 'SOCIOLOGÍA', 'VIERNES', '11:25', '12:10', 'Salón 1'],
        ['BRUNO, CORNELUS', 'INTELIGENCIA ARTIFICIAL', 'VIERNES', '12:15', '13:00', 'Salón 1'],
        ['BRUNO, CORNELUS', 'INTELIGENCIA ARTIFICIAL', 'VIERNES', '13:05', '13:50', 'Salón 1']
      ];

      const stmt = db.prepare(`INSERT INTO schedules (teacher, subject, day, start_time, end_time, room, status) VALUES (?, ?, ?, ?, ?, ?, 'ocupado')`);
      scheduleData.forEach(row => stmt.run(row));
      stmt.finalize();
    }
  });
});

// ----------------- ENDPOINTS DE AUTENTICACIÓN -----------------
app.post("/api/register", (req, res) => {
  const { name, email, password, role, code } = req.body;
  const userRole = role || 'alumno';

  if ((userRole === 'profesor' && code !== 'PROFE-2026') || (userRole === 'admin' && code !== 'ADMIN-2026')) {
    return res.status(400).json({ error: "Código de acceso especial incorrecto para el rol seleccionado." });
  }

  db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`, [name, email, password, userRole], function(err) {
    if (err) return res.status(400).json({ error: "El correo ya está registrado o faltan datos." });
    req.session.userId = this.lastID;
    req.session.role = userRole;
    req.session.name = name;
    res.json({ success: true, message: "Usuario registrado con éxito" });
  });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, user) => {
    if (!user) return res.status(401).json({ error: "Credenciales inválidas." });
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.name = user.name;
    res.json({ success: true, user });
  });
});

app.get("/api/me", (req, res) => {
  if (!req.session.userId) return res.json(null);
  res.json({ id: req.session.userId, name: req.session.name, role: req.session.role });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ----------------- ENDPOINTS DE BÚSQUEDA -----------------
app.get("/api/search/courses", (req, res) => {
  const query = req.query.q ? `%${req.query.q}%` : "%%";
  db.all(`SELECT * FROM courses WHERE name LIKE ? OR description LIKE ?`, [query, query], (err, rows) => {
    if (err) return res.status(500).json({ error: "Error al realizar la búsqueda" });
    res.json(rows || []);
  });
});

// ----------------- ENDPOINTS DE HORARIOS -----------------
app.get("/api/schedules", (req, res) => {
  db.all(`SELECT * FROM schedules`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Error al obtener horarios" });
    res.json(rows);
  });
});

app.post("/api/admin/schedules", (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: "No autorizado. Solo administradores." });
  const { subject, day, start_time, end_time, room } = req.body;
  db.run(`INSERT INTO schedules (teacher, subject, day, start_time, end_time, room, status) VALUES (NULL, ?, ?, ?, ?, ?, 'disponible')`,
    [subject, day, start_time, end_time, room], function(err) {
      if (err) return res.status(500).json({ error: "Error al crear el espacio de horario" });
      res.json({ success: true, id: this.lastID, message: "Horario disponible creado con éxito." });
    });
});

app.post("/api/profesor/claim-schedule/:id", (req, res) => {
  if (req.session.role !== 'profesor') return res.status(403).json({ error: "Solo los profesores pueden tomar horarios." });
  const scheduleId = req.params.id;
  const teacherName = req.session.name;

  db.get(`SELECT * FROM schedules WHERE id = ? AND status = 'disponible'`, [scheduleId], (err, row) => {
    if (!row) return res.status(400).json({ error: "El horario no existe o ya está ocupado." });

    db.run(`UPDATE schedules SET teacher = ?, status = 'ocupado' WHERE id = ?`, [teacherName, scheduleId], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: "Error al reclamar el horario." });
      res.json({ success: true, message: `Has tomado exitosamente el horario de ${row.subject} (${row.day} ${row.start_time}).` });
    });
  });
});

app.delete("/api/schedules/:id", (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: "No autorizado" });
  db.run(`DELETE FROM schedules WHERE id = ?`, [req.params.id], (err) => {
    res.json({ success: true });
  });
});

// ----------------- ENDPOINTS DE AUSENCIAS Y LISTA NEGRA -----------------
app.get("/api/absences", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "No autorizado" });

  if (req.session.role === 'profesor') {
    db.all(`SELECT * FROM absences WHERE teacher = ? ORDER BY date DESC`, [req.session.name], (err, rows) => {
      res.json(rows || []);
    });
  } else if (req.session.role === 'admin') {
    db.all(`SELECT * FROM absences ORDER BY date DESC`, [], (err, rows) => {
      res.json(rows || []);
    });
  } else {
    res.status(403).json({ error: "No autorizado." });
  }
});

app.post("/api/absences", (req, res) => {
  if (req.session.role !== 'profesor' && req.session.role !== 'admin') {
    return res.status(403).json({ error: "Acceso denegado." });
  }
  const { date, reason } = req.body;
  const teacher = req.session.name;
  db.run(`INSERT INTO absences (teacher, date, reason) VALUES (?, ?, ?)`, [teacher, date, reason], function(err) {
    if (err) return res.status(500).json({ error: "Error al registrar ausencia" });
    res.json({ success: true, message: "Ausencia registrada correctamente." });
  });
});

app.get("/api/admin/blacklist", (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: "Acceso denegado. Solo para administradores." });

  db.all(`SELECT teacher, COUNT(*) as total_absences FROM absences GROUP BY teacher HAVING total_absences >= 3`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Error al generar la lista negra." });
    res.json({ 
      success: true, 
      description: "Profesores con acumulación excesiva de ausencias (3 o más)",
      blacklist: rows || [] 
    });
  });
});

// ----------------- ENDPOINTS DE NOTICIAS Y AVISOS -----------------
app.get("/api/news", (req, res) => {
  db.all(`SELECT * FROM news`, [], (err, rows) => {
    res.json(rows || []);
  });
});

app.post("/api/news", (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: "Solo los administradores pueden publicar noticias o avisos." });
  }
  const { title, content } = req.body;
  const author = req.session.name;
  db.run(`INSERT INTO news (title, content, author) VALUES (?, ?, ?)`, [title, content, author], function(err) {
    if (err) return res.status(500).json({ error: "Error al crear la noticia." });
    res.json({ success: true, message: "Noticia publicada con éxito." });
  });
});

// ----------------- CHATBOT (EXCLUSIVO PROFESORES Y ADMINS) -----------------
app.post("/api/chatbot", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "No autorizado" });
  }

  if (req.session.role === 'alumno') {
    return res.status(403).json({ error: "El asistente virtual (chatbot) es exclusivo para profesores y administradores." });
  }

  const { message } = req.body;
  const query = message ? message.toLowerCase() : "";
  const currentRole = req.session.role;
  const currentTeacherName = req.session.name;

  try {
    if (query.includes("imagen") || query.includes("genera una imagen") || query.includes("foto") || query.includes("crear imagen")) {
      try {
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: "Un diseño gráfico moderno, profesional y claro de una cuadrilla de horarios escolares y materias académicas, estilo minimalista y ordenado.",
          n: 1,
          size: "1024x1024",
        });
        const imageUrl = response.data[0].url;
        return res.json({ answer: `Aquí tienes la imagen generada:\n\n![Cuadrilla](${imageUrl})` });
      } catch (imgError) {
        return res.json({ answer: "No se pudo generar la imagen. Revisa la clave de API de OpenAI." });
      }
    }
    else if (query.includes("tecnologías de la información") || query.includes("bachillerato tecnológico") || query.includes("curso") || query.includes("horario") || query.includes("cuadrilla")) {
      db.all("SELECT * FROM schedules", [], (err, rows) => {
        if (err || rows.length === 0) return res.json({ answer: "No hay horarios registrados." });
        let markdownTable = "📚 **Curso: 3º MF. Tec. de la Información - BT**\n\n";
        markdownTable += "| Día | Horario | Materia | Profesor | Salón |\n";
        markdownTable += "|---|---|---|---|---|\n";
        rows.forEach(r => {
          markdownTable += `| ${r.day} | ${r.start_time} - ${r.end_time} | ${r.subject} | ${r.teacher} | ${r.room} |\n`;
        });
        res.json({ answer: markdownTable });
      });
    }
    else if (query.includes("lista negra") || query.includes("profesores sancionados") || query.includes("muchas faltas")) {
      if (currentRole !== 'admin') {
        return res.json({ answer: "⛔ Lo siento, este comando es estrictamente confidencial y solo está disponible para los **administradores**." });
      }
      db.all(`SELECT teacher, COUNT(*) as total_absences FROM absences GROUP BY teacher HAVING total_absences >= 3`, [], (err, rows) => {
        if (err || rows.length === 0) return res.json({ answer: "📋 No hay profesores en la lista negra actualmente." });
        let txt = "🚨 **Lista Negra de Profesores (Exceso de Inasistencias):**\n\n";
        rows.forEach(r => {
          txt += `- **Prof. ${r.teacher}**: ${r.total_absences} faltas registradas.\n`;
        });
        res.json({ answer: txt });
      });
    }
    else if (query.includes("noticia") || query.includes("aviso") || query.includes("novedad")) {
      db.all("SELECT * FROM news ORDER BY id DESC LIMIT 5", [], (err, rows) => {
        if (err || rows.length === 0) return res.json({ answer: "📰 No hay avisos o noticias publicadas por el momento." });
        let txt = "📰 **Últimos Avisos y Noticias Institucionales:**\n\n";
        rows.forEach(n => {
          txt += `🔹 **${n.title}** (Por: ${n.author || 'Administración'})\n${n.content}\n\n`;
        });
        res.json({ answer: txt });
      });
    }
    else if (query.includes("no puedo") || query.includes("cubrir") || query.includes("reemplazo")) {
      db.all("SELECT DISTINCT name FROM users WHERE role = 'profesor' AND name != ?", [currentTeacherName], (err, professors) => {
        if (err || professors.length === 0) {
          return res.json({ answer: "Lo siento, no encontré a otros profesores registrados en el sistema para realizar un relevo." });
        }
        const substitute = professors[Math.floor(Math.random() * professors.length)].name;
        db.run(`INSERT INTO messages (sender, receiver, content, date) VALUES (?, ?, ?, datetime('now'))`,
          [currentTeacherName, substitute, `El profesor ${currentTeacherName} solicita cobertura de clase.`], () => {});

        res.json({ answer: `¡Entendido! He notificado al profesor **${substitute}** para ver si puede cubrir tu clase.` });
      });
    }
    else {
      res.json({ 
        answer: `Hola, ${currentTeacherName}. Como **${currentRole}**, puedes pedirme la cuadrilla del curso escribiendo 'horario' o 'curso'.` 
      });
    }

  } catch (e) {
    res.status(500).json({ error: "Error en el asistente inteligente." });
  }
});

// Exportación para Vercel o ejecución local
if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => {
    console.log("Servidor EduSync corriendo en http://localhost:3000");
  });
}

module.exports = app;