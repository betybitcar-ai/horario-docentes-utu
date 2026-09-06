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

// Crear tablas necesarias si no existen
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
    status TEXT DEFAULT 'disponible'
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
});

// ----------------- ENDPOINTS DE AUTENTICACIÓN -----------------
app.post("/api/register", (req, res) => {
  const { name, email, password, role, code } = req.body;
  if ((role === 'profesor' && code !== 'PROFE-2026') || (role === 'admin' && code !== 'ADMIN-2026')) {
    return res.status(400).json({ error: "Código de acceso especial incorrecto para el rol seleccionado." });
  }
  db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`, [name, email, password, role || 'alumno'], function(err) {
    if (err) return res.status(400).json({ error: "El correo ya está registrado." });
    req.session.userId = this.lastID;
    req.session.role = role || 'alumno';
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

// ----------------- ENDPOINTS DE HORARIOS (Lectura libre, Escritura restringida) -----------------
app.get("/api/schedules", (req, res) => {
  db.all(`SELECT * FROM schedules`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Error al obtener horarios" });
    res.json(rows);
  });
});

// Admin crea un espacio de horario disponible
app.post("/api/admin/schedules", (req, res) => {
  if (req.session.role !== 'admin') return res.status(403).json({ error: "No autorizado. Solo administradores." });
  const { subject, day, start_time, end_time, room } = req.body;
  db.run(`INSERT INTO schedules (teacher, subject, day, start_time, end_time, room, status) VALUES (NULL, ?, ?, ?, ?, ?, 'disponible')`,
    [subject, day, start_time, end_time, room], function(err) {
      if (err) return res.status(500).json({ error: "Error al crear el espacio de horario" });
      res.json({ success: true, id: this.lastID, message: "Horario disponible creado con éxito." });
    });
});

// Profesor toma un horario disponible
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

// ----------------- ENDPOINTS DE AUSENCIAS -----------------
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
    // Los alumnos no pueden ver faltas o ausencias detalladas de profesores por privacidad
    res.status(403).json({ error: "No autorizado para ver ausencias." });
  }
});

app.post("/api/absences", (req, res) => {
  if (req.session.role !== 'profesor' && req.session.role !== 'admin') {
    return res.status(403).json({ error: "Los alumnos no pueden registrar ausencias." });
  }
  const { date, reason } = req.body;
  const teacher = req.session.name;
  db.run(`INSERT INTO absences (teacher, date, reason) VALUES (?, ?, ?)`, [teacher, date, reason], function(err) {
    if (err) return res.status(500).json({ error: "Error al registrar ausencia" });
    res.json({ success: true, message: "Ausencia registrada correctamente." });
  });
});

// Endpoint de Lista Negra (Exclusivo Admin)
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

// ----------------- ENDPOINTS DE NOTICIAS Y AVISOS (Lectura libre) -----------------
app.get("/api/news", (req, res) => {
  db.all(`SELECT * FROM news`, [], (err, rows) => {
    res.json(rows || []);
  });
});

app.post("/api/news", (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: "Solo los administradores pueden crear o editar noticias." });
  }
  const { title, content } = req.body;
  const author = req.session.name;
  db.run(`INSERT INTO news (title, content, author) VALUES (?, ?, ?)`, [title, content, author], function(err) {
    if (err) return res.status(500).json({ error: "Error al crear la noticia." });
    res.json({ success: true, message: "Noticia publicada con éxito." });
  });
});

// ----------------- CHATBOT INTELIGENTE Y AVANZADO -----------------
app.post("/api/chatbot", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const { message } = req.body;
  const query = message ? message.toLowerCase() : "";
  const currentRole = req.session.role;
  const currentTeacherName = req.session.name;

  try {
    // 1. GENERAR IMAGEN MEDIANTE DALL-E (Solo Admin o Profesor por costo/recurso, o general)
    if (query.includes("imagen") || query.includes("genera una imagen") || query.includes("foto") || query.includes("crear imagen")) {
      if (currentRole === 'alumno') {
        return res.json({ answer: "⛔ Los alumnos no tienen permisos para generar imágenes mediante IA en este sistema." });
      }
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
    // 2. CONSULTAR LISTA NEGRA (EXCLUSIVO ADMIN)
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
    // 3. CONSULTAR AVISOS / NOTICIAS (Disponible para todos, incluidos alumnos)
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
    // 4. CONSULTAR DISPONIBILIDAD DE HORARIOS (Disponible para alumnos y todos)
    else if (query.includes("disponible") || query.includes("ocupado") || query.includes("estado de horarios") || query.includes("horarios")) {
      db.all("SELECT * FROM schedules", [], (err, rows) => {
        if (err || rows.length === 0) return res.json({ answer: "No hay horarios registrados en el sistema." });
        
        let txt = "📊 **Estado actual de los horarios:**\n\n";
        rows.forEach(r => {
          const estadoIcono = r.status === 'disponible' ? '🟢 Disponible' : `🔴 Ocupado por ${r.teacher}`;
          txt += `- **[${r.day}] ${r.start_time} - ${r.end_time}** | Materia: ${r.subject} | Salón: ${r.room || 'N/A'} -> ${estadoIcono}\n`;
        });
        res.json({ answer: txt });
      });
    }
    // 5. GENERAR CUADRILLA EN TABLA MARKDOWN (Disponible para lectura de alumnos)
    else if (query.includes("generar cuadrilla") || query.includes("ver horario") || query.includes("horario escolar")) {
      db.all("SELECT * FROM schedules", [], (err, rows) => {
        if (err || rows.length === 0) {
          return res.json({ answer: "No hay datos de horarios disponibles para mostrar." });
        }
        let markdownTable = "Aquí tienes la cuadrilla de horarios de la institución:\n\n";
        markdownTable += "| Día | Horario | Materia | Profesor | Salón | Estado |\n";
        markdownTable += "|---|---|---|---|---|---|\n";
        rows.forEach(r => {
          markdownTable += `| ${r.day} | ${r.start_time} - ${r.end_time} | ${r.subject} | ${r.teacher || 'Sin asignar'} | ${r.room || 'N/A'} | ${r.status} |\n`;
        });
        res.json({ answer: markdownTable });
      });
    }
    // 6. GESTIÓN DE REEMPLAZOS (Solo profesores)
    else if (query.includes("no puedo") || query.includes("cubrir") || query.includes("reemplazo")) {
      if (currentRole === 'alumno') {
        return res.json({ answer: "⛔ Los alumnos no pueden solicitar reemplazos de clases." });
      }
      // Lógica de reemplazos para profesores...
      res.json({ answer: "Función de reemplazos procesada para el profesor." });
    }
    // 7. RESPUESTA GENERAL O AYUDA SEGÚN ROL
    else {
      let helpText = "Hola, soy el asistente de EduSync. Como **alumno**, puedes:\n" +
                     "1. **Ver los avisos y noticias** (escribe: 'ver noticias' o 'avisos').\n" +
                     "2. **Consultar los horarios y clases** (escribe: 'generar cuadrilla' o 'estado de horarios').\n";
      if (currentRole !== 'alumno') {
        helpText += "3. Tienes permisos adicionales según tu rol (profesor/administrador).";
      }
      res.json({ answer: helpText });
    }

  } catch (e) {
    res.status(500).json({ error: "Error en el asistente inteligente." });
  }
});

// Iniciar servidor en el puerto 3000
app.listen(3000, () => {
  console.log("Servidor EduSync corriendo en http://localhost:3000");
});