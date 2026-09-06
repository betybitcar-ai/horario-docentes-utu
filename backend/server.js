const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, "data.json");

const TEACHER_CODE = process.env.TEACHER_CODE || "PROFE-2026";
const ADMIN_CODE = process.env.ADMIN_CODE || "ADMIN-2026";

function loadDB() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      users: [], schedules: [], availability: [], news: [], opinions: [], violations: []
    }, null, 2), "utf8");
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}
function saveDB(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}
function nextId(list) {
  return list.reduce((max, x) => Math.max(max, Number(x.id) || 0), 0) + 1;
}
function now() { return new Date().toISOString(); }
function me(req) { return req.session.user || null; }

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || "cambia-esta-clave",
  resave:false,
  saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:"lax"}
}));
app.use(express.static(path.join(__dirname,"..","frontend")));

function loginRequired(req,res,next) {
  if (!me(req)) return res.status(401).json({error:"Debes iniciar sesión."});
  next();
}
function roleRequired(...roles) {
  return (req,res,next) => {
    if (!me(req) || !roles.includes(me(req).role))
      return res.status(403).json({error:"No tienes permisos para esta acción."});
    next();
  };
}

app.get("/api/me",(req,res)=>res.json(me(req)));

app.post("/api/register",(req,res)=>{
  const {name,email,password,role,code}=req.body;
  if(!name||!email||!password||!role)
    return res.status(400).json({error:"Completa todos los campos."});
  if(!["alumno","profesor","admin"].includes(role))
    return res.status(400).json({error:"Rol inválido."});
  if(role==="profesor" && code!==TEACHER_CODE)
    return res.status(403).json({error:"Código especial de profesor incorrecto."});
  if(role==="admin" && code!==ADMIN_CODE)
    return res.status(403).json({error:"Código especial de administrador incorrecto."});

  const db=loadDB();
  const clean=email.toLowerCase().trim();
  if(db.users.some(u=>u.email===clean))
    return res.status(400).json({error:"Ese correo ya está registrado."});

  const u={
    id:nextId(db.users),
    name:name.trim(),
    email:clean,
    password:bcrypt.hashSync(password,10),
    role,
    created_at:now()
  };
  db.users.push(u);
  saveDB(db);
  req.session.user={id:u.id,name:u.name,email:u.email,role:u.role};
  res.json(req.session.user);
});

app.post("/api/login",(req,res)=>{
  const db=loadDB();
  const email=(req.body.email||"").toLowerCase().trim();
  const u=db.users.find(x=>x.email===email);
  if(!u || !bcrypt.compareSync(req.body.password||"",u.password))
    return res.status(401).json({error:"Correo o contraseña incorrectos."});
  req.session.user={id:u.id,name:u.name,email:u.email,role:u.role};
  res.json(req.session.user);
});

app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.get("/api/schedules",loginRequired,(req,res)=>{
  const days={Lunes:1,Martes:2,"Miércoles":3,Jueves:4,Viernes:5};
  const data=loadDB().schedules.sort((a,b)=>
    (days[a.day]||99)-(days[b.day]||99) || a.start_time.localeCompare(b.start_time)
  );
  res.json(data);
});

app.post("/api/schedules",roleRequired("admin"),(req,res)=>{
  const {teacher,subject,day,start_time,end_time,room}=req.body;
  if(!teacher||!subject||!day||!start_time||!end_time)
    return res.status(400).json({error:"Completa los datos."});
  if(start_time>=end_time)
    return res.status(400).json({error:"La hora final debe ser posterior a la inicial."});

  const db=loadDB();
  const conflict=db.schedules.some(x =>
    x.day===day && x.start_time<end_time && x.end_time>start_time
  );
  if(conflict)
    return res.status(409).json({error:"Existe un horario que se cruza en ese intervalo."});

  db.schedules.push({
    id:nextId(db.schedules),teacher,subject,day,start_time,end_time,
    room:room||"",created_by:me(req).id,created_at:now()
  });
  saveDB(db);
  res.json({ok:true});
});

app.delete("/api/schedules/:id",roleRequired("admin"),(req,res)=>{
  const db=loadDB();
  db.schedules=db.schedules.filter(x=>x.id!=req.params.id);
  saveDB(db);
  res.json({ok:true});
});

app.get("/api/news",loginRequired,(req,res)=>{
  const db=loadDB();
  const data=db.news.map(n=>({
    ...n,
    author:(db.users.find(u=>u.id===n.created_by)||{}).name||""
  })).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  res.json(data);
});

app.post("/api/news",roleRequired("admin"),(req,res)=>{
  const {title,content,type}=req.body;
  if(!title||!content)
    return res.status(400).json({error:"Completa título y contenido."});
  const db=loadDB();
  db.news.push({
    id:nextId(db.news),title,content,type:type||"General",
    created_by:me(req).id,created_at:now()
  });
  saveDB(db);
  res.json({ok:true});
});

app.delete("/api/news/:id",roleRequired("admin"),(req,res)=>{
  const db=loadDB();
  db.news=db.news.filter(x=>x.id!=req.params.id);
  saveDB(db);
  res.json({ok:true});
});

app.post("/api/availability",roleRequired("profesor","admin"),(req,res)=>{
  const {start_date,end_date,reason}=req.body;
  if(!start_date||!end_date)
    return res.status(400).json({error:"Indica las fechas."});
  const db=loadDB();
  db.availability.push({
    id:nextId(db.availability),teacher_id:me(req).id,
    start_date,end_date,reason:reason||"",created_at:now()
  });
  saveDB(db);
  res.json({ok:true});
});

app.get("/api/availability",loginRequired,(req,res)=>{
  const db=loadDB();
  res.json(db.availability.map(a=>({
    ...a,
    teacher:(db.users.find(u=>u.id===a.teacher_id)||{}).name||"Profesor"
  })));
});

app.post("/api/opinions",roleRequired("alumno"),(req,res)=>{
  const {teacher,content}=req.body;
  if(!teacher||!content)
    return res.status(400).json({error:"Completa profesor y opinión."});
  const db=loadDB();
  db.opinions.push({
    id:nextId(db.opinions),teacher,content,student_id:me(req).id,
    status:"pendiente",created_at:now()
  });
  saveDB(db);
  res.json({ok:true});
});

app.get("/api/opinions",roleRequired("admin"),(req,res)=>{
  const db=loadDB();
  res.json(db.opinions.map(o=>({
    ...o,
    student:(db.users.find(u=>u.id===o.student_id)||{}).name||"Alumno"
  })));
});

app.delete("/api/opinions/:id",roleRequired("admin"),(req,res)=>{
  const db=loadDB();
  db.opinions=db.opinions.filter(x=>x.id!=req.params.id);
  saveDB(db);
  res.json({ok:true});
});

app.get("/api/violations",roleRequired("admin"),(req,res)=>{
  res.json(loadDB().violations);
});

app.post("/api/violations",roleRequired("admin"),(req,res)=>{
  const {teacher,description,status}=req.body;
  if(!teacher||!description)
    return res.status(400).json({error:"Completa los datos."});
  const db=loadDB();
  db.violations.push({
    id:nextId(db.violations),teacher,description,
    status:status||"registrado",created_by:me(req).id,created_at:now()
  });
  saveDB(db);
  res.json({ok:true});
});

app.delete("/api/violations/:id",roleRequired("admin"),(req,res)=>{
  const db=loadDB();
  db.violations=db.violations.filter(x=>x.id!=req.params.id);
  saveDB(db);
  res.json({ok:true});
});

app.get("/api/users",roleRequired("admin"),(req,res)=>{
  res.json(loadDB().users.map(({password,...u})=>u));
});

app.post("/api/chatbot",loginRequired,(req,res)=>{
  const q=(req.body.message||"").toLowerCase();
  const db=loadDB();
  let answer;
  if(q.includes("dispon")||q.includes("libre")) {
    answer=db.schedules.length
      ?"Hay horarios registrados."
      :"Todavía no hay horarios registrados.";
  } else if(q.includes("cuadrilla")||q.includes("horario")) {
    answer="Puedes consultar los horarios en la sección correspondiente.";
  } else if(q.includes("noticia")||q.includes("aviso")) {
    answer="Las noticias y avisos se encuentran en sus respectivas secciones.";
  } else {
    answer="Puedo ayudarte a consultar información sobre horarios, noticias y avisos.";
  }
  res.json({answer});
});

app.get("/*path",(req,res)=>
  res.sendFile(path.join(__dirname,"..","frontend","index.html"))
);

app.listen(PORT,()=>console.log(`Servidor iniciado: http://localhost:${PORT}`));