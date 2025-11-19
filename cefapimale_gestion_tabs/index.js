// ----------------- CEFAPIMALE GESTIÓN - Backend -----------------

const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "cefapimale-gestion-secret",
    resave: false,
    saveUninitialized: false,
  })
);

// ---------------------- Datos en memoria ----------------------

let users = [
  { id: 1, username: "admin", password: "admin123", role: "admin" },
  { id: 2, username: "usuario1", password: "user123", role: "usuario" },
];

let nextUserId = 3;
let tasks = [];
let nextTaskId = 1;
const VALID_STATUSES = ["asignado", "en_proceso", "completado"];

// ------------------- Middlewares -------------------

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "No autenticado" });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin")
    return res.status(403).json({ error: "Solo admin" });
  next();
}

// ------------------- Login / Logout -------------------

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const u = users.find((x) => x.username === username && x.password === password);
  if (!u) return res.status(401).json({ error: "Credenciales incorrectas" });
  req.session.user = { id: u.id, username: u.username, role: u.role };
  res.json({ user: req.session.user });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ message: "Logout" }));
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "No autenticado" });
  res.json({ user: req.session.user });
});

// ------------------- Usuarios -------------------

app.get("/api/users", requireAdmin, (req, res) => {
  res.json(users.map((u) => ({ id: u.id, username: u.username, role: u.role })));
});

app.post("/api/users", requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: "Faltan datos" });
  if (role !== "admin" && role !== "usuario") return res.status(400).json({ error: "Rol inválido" });
  if (users.some((u) => u.username === username)) return res.status(400).json({ error: "Ya existe" });

  const newUser = { id: nextUserId++, username, password, role };
  users.push(newUser);

  res.json({ message: "Usuario creado", user: newUser });
});

// ------------------- Tareas -------------------

app.post("/api/tasks", requireAdmin, (req, res) => {
  const { text, assigneeId, date } = req.body;
  if (!text || !assigneeId) return res.status(400).json({ error: "Faltan datos" });

  const user = users.find((u) => u.id === Number(assigneeId));
  if (!user) return res.status(404).json({ error: "Usuario no existe" });

  const task = {
    id: nextTaskId++,
    text,
    assigneeId: user.id,
    assigneeName: user.username,
    date: date || new Date().toISOString().slice(0, 10),
    status: "asignado",
    observations: [],
    createdAt: new Date().toISOString(),
  };

  tasks.push(task);
  res.json({ message: "Tarea creada", task });
});

app.get("/api/tasks", requireAuth, (req, res) => {
  const u = req.session.user;
  if (u.role === "admin") return res.json(tasks);
  res.json(tasks.filter((t) => t.assigneeId === u.id));
});

app.put("/api/tasks/:id/status", requireAuth, (req, res) => {
  const { status } = req.body;
  const t = tasks.find((x) => x.id === Number(req.params.id));
  if (!t) return res.status(404).json({ error: "No existe" });
  if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: "Estado inválido" });
  const u = req.session.user;
  if (u.role !== "admin" && u.id !== t.assigneeId) return res.status(403).json({ error: "Sin permiso" });

  t.status = status;
  res.json({ message: "Actualizado", task: t });
});

app.post("/api/tasks/:id/observations", requireAuth, (req, res) => {
  const { text } = req.body;
  if (!text || text.trim() === "") return res.status(400).json({ error: "Vacío" });
  const t = tasks.find((x) => x.id === Number(req.params.id));
  if (!t) return res.status(404).json({ error: "No existe" });

  t.observations.push({
    userId: req.session.user.id,
    username: req.session.user.username,
    text,
    createdAt: new Date().toISOString(),
  });

  res.json({ message: "Observación añadida", task: t });
});

// ------------------- Frontend -------------------

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => console.log("Servidor en puerto", PORT));
