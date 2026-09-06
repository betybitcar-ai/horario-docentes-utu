const API = "http://localhost:3000/api";
let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
  show('login');
});

async function login() {
  const emailInput = document.getElementById("le");
  const passwordInput = document.getElementById("lp");
  const msg = document.getElementById("lm");
  
  if (!emailInput || !passwordInput) return;

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailInput.value, password: passwordInput.value })
    });
    const data = await res.json();
    if (res.ok) {
      currentUser = data.user;
      loadDashboard();
    } else {
      if (msg) msg.innerText = data.error || "Error al iniciar sesión";
    }
  } catch (err) {
    if (msg) msg.innerText = "Error de conexión con el servidor";
  }
}

async function register() {
  const name = document.getElementById("rn")?.value;
  const email = document.getElementById("re")?.value;
  const password = document.getElementById("rp")?.value;
  const role = document.getElementById("rr")?.value;
  const code = document.getElementById("rc")?.value;
  const msg = document.getElementById("rm");

  try {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role, code })
    });
    const data = await res.json();
    if (res.ok) {
      alert("¡Usuario registrado con éxito! Inicia sesión.");
      show('login');
    } else {
      if (msg) msg.innerText = data.error || "Error al registrarse";
    }
  } catch (err) {
    if (msg) msg.innerText = "Error de conexión con el servidor";
  }
}

function loadDashboard() {
  document.getElementById("login")?.classList.add("hidden");
  document.getElementById("reg")?.classList.add("hidden");
  document.getElementById("app")?.classList.remove("hidden");
  
  const welcome = document.getElementById("welcome");
  if (welcome && currentUser) {
    welcome.innerText = `Bienvenido, ${currentUser.name} (${currentUser.role})`;
  }
  setupNavigation();
}

function setupNavigation() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  nav.innerHTML = `
    <button onclick="showSection('inicio')">INICIO</button>
    <button onclick="showSection('aviso')">AVISO</button>
    <button onclick="showSection('ausencia')">AUSENCIA</button>
    <button onclick="showSection('noticia')">NOTICIA</button>
    <button onclick="logout()">Cerrar sesión</button>
  `;
  showSection('inicio');
}

function showSection(section) {
  const content = document.getElementById("content");
  if (!content) return;
  content.innerHTML = "";
  
  const sections = {
    inicio: { title: "Inicio", text: "Bienvenido al panel principal de EduSync." },
    aviso: { title: "Avisos", text: "Consulta los avisos institucionales recientes." },
    ausencia: { title: "Ausencias", text: "Gestión y control de asistencias y ausencias." },
    noticia: { title: "Noticias", text: "Entérate de las últimas novedades de la institución." }
  };

  const current = sections[section] || sections.inicio;
  content.innerHTML = `
    <div class="card" style="max-width: 100%;">
      <h3>${current.title}</h3>
      <p>${current.text}</p>
    </div>`;
}

function logout() {
  currentUser = null;
  document.getElementById("app")?.classList.add("hidden");
  document.getElementById("login")?.classList.remove("hidden");
  const le = document.getElementById("le");
  const lp = document.getElementById("lp");
  if (le) le.value = "";
  if (lp) lp.value = "";
}

function show(id) {
  ["login", "reg", "app"].forEach(sec => {
    document.getElementById(sec)?.classList.add("hidden");
  });
  document.getElementById(id)?.classList.remove("hidden");
}

function code() {
  const role = document.getElementById("rr")?.value;
  const codeInput = document.getElementById("rc");
  if (!codeInput) return;
  if (role === "admin" || role === "profesor") {
    codeInput.classList.remove("hidden");
  } else {
    codeInput.classList.add("hidden");
  }
}