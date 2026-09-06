document.addEventListener("DOMContentLoaded", () => {
    checkSession();
    loadSchedules();
    loadNews();

    const authModal = document.getElementById("auth-modal");
    const btnLoginOpen = document.getElementById("btn-login-open");
    const btnRegisterOpen = document.getElementById("btn-register-open");
    const closeModal = document.querySelector(".close-modal");
    const authForm = document.getElementById("auth-form");
    const regRole = document.getElementById("reg-role");
    const codeField = document.getElementById("code-field");
    const nameField = document.getElementById("name-field");
    const modalTitle = document.getElementById("modal-title");
    const modalSubmitBtn = document.getElementById("modal-submit-btn");

    let isLoginMode = false;

    // Mostrar/Ocultar campos de código según el rol seleccionado
    regRole.addEventListener("change", (e) => {
        if (e.target.value === "profesor" || e.target.value === "admin") {
            codeField.style.display = "block";
        } else {
            codeField.style.display = "none";
        }
    });

    btnLoginOpen.addEventListener("click", () => {
        isLoginMode = true;
        modalTitle.textContent = "Iniciar Sesión en EduSync";
        nameField.style.display = "none";
        codeField.style.display = "none";
        document.getElementById("reg-role").parentElement.style.display = "none";
        modalSubmitBtn.textContent = "Ingresar";
        authModal.style.display = "block";
    });

    btnRegisterOpen.addEventListener("click", () => {
        isLoginMode = false;
        modalTitle.textContent = "Registro en EduSync";
        nameField.style.display = "block";
        document.getElementById("reg-role").parentElement.style.display = "block";
        if (regRole.value === "profesor" || regRole.value === "admin") {
            codeField.style.display = "block";
        }
        modalSubmitBtn.textContent = "Crear Cuenta";
        authModal.style.display = "block";
    });

    closeModal.addEventListener("click", () => {
        authModal.style.display = "none";
    });

    // Manejar envío de formulario (Login o Registro)
    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("reg-email").value;
        const password = document.getElementById("reg-password").value;

        if (isLoginMode) {
            try {
                const res = await fetch("/api/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (data.success) {
                    window.location.reload();
                } else {
                    alert(data.error || "Error al iniciar sesión");
                }
            } catch (err) {
                alert("Error de conexión con el servidor");
            }
        } else {
            const name = document.getElementById("reg-name").value;
            const role = document.getElementById("reg-role").value;
            const regCode = document.getElementById("reg-code").value;

            try {
                const res = await fetch("/api/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password, role, regCode })
                });
                const data = await res.json();
                if (data.success) {
                    alert("¡Usuario registrado con éxito!");
                    window.location.reload();
                } else {
                    alert(data.error || "Error en el registro");
                }
            } catch (err) {
                alert("Error de conexión con el servidor");
            }
        }
    });

    // Chatbot interactivo
    const btnSendChat = document.getElementById("btn-send-chat");
    const chatInput = document.getElementById("chat-input");
    const chatMessages = document.getElementById("chat-messages");

    btnSendChat.addEventListener("click", async () => {
        const message = chatInput.value.trim();
        if (!message) return;

        appendMessage("Tú", message);
        chatInput.value = "";

        try {
            const res = await fetch("/api/chatbot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message })
            });
            const data = await res.json();
            if (data.answer) {
                appendMessage("Asistente EduSync", data.answer);
            } else {
                appendMessage("Asistente EduSync", data.error || "No se pudo procesar la respuesta.");
            }
        } catch (err) {
            appendMessage("Asistente EduSync", "Error de comunicación con el chatbot.");
        }
    });

    function appendMessage(sender, text) {
        const msgDiv = document.createElement("div");
        msgDiv.innerHTML = `<strong>${sender}:</strong> ${text.replace(/\n/g, '<br>')}`;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});

async function checkSession() {
    try {
        const res = await fetch("/api/me");
        const user = await res.json();
        if (user) {
            const authContainer = document.getElementById("auth-container");
            authContainer.innerHTML = `<span>Hola, ${user.name} (${user.role})</span> <button id="btn-logout">Cerrar Sesión</button>`;
            
            document.getElementById("btn-logout").addEventListener("click", async () => {
                await fetch("/api/logout", { method: "POST" });
                window.location.reload();
            });
        }
    } catch (e) {
        console.error("No se pudo verificar la sesión");
    }
}

async function loadSchedules() {
    try {
        const res = await fetch("/api/schedules");
        const schedules = await res.json();
        const container = document.getElementById("schedule-results");
        
        let html = "<table><tr><th>Día</th><th>Horario</th><th>Materia</th><th>Profesor</th><th>Salón</th></tr>";
        schedules.forEach(s => {
            html += `<tr><td>${s.day}</td><td>${s.start_time} - ${s.end_time}</td><td>${s.subject}</td><td>${s.teacher || 'Sin asignar'}</td><td>${s.room}</td></tr>`;
        });
        html += "</table>";
        container.innerHTML = html;
    } catch (e) {
        console.error("Error al cargar horarios");
    }
}

async function loadNews() {
    try {
        const res = await fetch("/api/news");
        const news = await res.json();
        const container = document.getElementById("news-container");
        
        let html = "";
        news.forEach(n => {
            html += `<div class="news-item"><h3>${n.title}</h3><p>${n.content}</p><small>Por: ${n.author || 'Admin'}</small></div>`;
        });
        container.innerHTML = html || "<p>No hay noticias recientes.</p>";
    } catch (e) {
        console.error("Error al cargar noticias");
    }
}