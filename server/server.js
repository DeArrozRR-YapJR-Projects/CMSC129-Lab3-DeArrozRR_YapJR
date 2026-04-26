require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const chatbotService = require("./chatbot-service");

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend is running!" });
});

// --- Schema ---
const workoutSchema = new mongoose.Schema(
  {
    title:     { type: String, default: "Workout" },
    date:      { type: String, required: true },
    duration:  { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    exercises: [
      {
        id:     { type: String, required: true },
        name:   { type: String, required: true },
        sets:   { type: Number, required: true },
        reps:   { type: Number, required: true },
        weight: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true }
);

// --- State ---
let Workout       = null;
let WorkoutBackup = null;
let primaryConn   = null;
let backupConn    = null;

// Track which DBs were available last poll cycle
let primaryWasUp = false;
let backupWasUp  = false;

// --- SSE ---
const sseClients = new Set();

app.get("/api/sync-status", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

function notifyClients(event, data) {
  for (const client of sseClients) {
    client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

// --- Generic sync: copy all docs from source → target ---
async function syncDatabases(sourceModel, targetModel, direction) {
  try {
    console.log(`🔄 Syncing ${direction}...`);
    notifyClients("sync-start", { message: `Syncing ${direction}...` });

    const sourceDocs = await sourceModel.find({}).lean();
    const targetDocs = await targetModel.find({}).lean();
    const targetIds  = new Set(targetDocs.map((d) => d._id.toString()));

    let synced = 0;
    for (const doc of sourceDocs) {
      const { _id, __v, createdAt, updatedAt, ...rest } = doc;
      try {
        if (!targetIds.has(_id.toString())) {
          await targetModel.create({ _id, ...rest });
        } else {
          await targetModel.findByIdAndUpdate(_id, rest, { new: true });
        }
        synced++;
      } catch (err) {
        console.warn(`⚠️  Could not sync doc ${_id}:`, err.message);
      }
    }

    console.log(`✅ Sync complete (${direction}) — ${synced} documents synced.`);
    notifyClients("sync-complete", {
      message: `Sync complete — ${synced} documents synced (${direction}).`,
      synced,
    });
  } catch (err) {
    console.error(`❌ Sync failed (${direction}):`, err.message);
    notifyClients("sync-error", { message: `Sync failed (${direction}): ${err.message}` });
  }
}

// --- Rate limiting for chat endpoint ---
const rateLimit = require("express-rate-limit");

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { success: false, error: "Too many requests, please slow down." },
});

app.use("/api/chat", chatLimiter);

// --- Poll loop: check connection health every 5s and sync on reconnect ---
async function tryConnect(uri, label) {
  try {
    const conn = await mongoose.createConnection(uri).asPromise();
    console.log(`✅ ${label} connected`);
    return conn;
  } catch (err){
    console.warn(`⚠️  Failed to connect to ${label}:`, err.message);
    return null;
  }
}

async function pollConnections() {
  const primaryUp = Workout !== null;
  const backupUp  = WorkoutBackup !== null;

  // --- Check primary ---
  if (!primaryUp && process.env.MONGO_URI) {
    // Primary is currently down — try to reconnect
    const conn = await tryConnect(process.env.MONGO_URI, "Primary MongoDB");
    if (conn) {
      primaryConn = conn;
      Workout     = conn.model("Workout", workoutSchema);
      console.log("🔌 Primary came back online.");

      // Primary just came back — sync both ways so they're identical
      if (WorkoutBackup) {
        await syncDatabases(WorkoutBackup, Workout,       "backup → primary");
        await syncDatabases(Workout,       WorkoutBackup, "primary → backup");
      }
    }
  } else if (primaryUp && process.env.MONGO_URI) {
    // Primary is up — verify it's still reachable
    try {
      await Workout.findOne().lean();
    } catch {
      console.warn("⚠️  Primary went down — falling back to backup.");
      Workout = null;
      try { await primaryConn.close(); } catch {}
      primaryConn = null;
    }
  }

  // --- Check backup ---
  if (!backupUp && process.env.MONGO_BACKUP_URI) {
    // Backup is currently down — try to reconnect
    const conn = await tryConnect(process.env.MONGO_BACKUP_URI, "Backup MongoDB");
    if (conn) {
      backupConn    = conn;
      WorkoutBackup = conn.model("BackupWorkout", workoutSchema, "backup_workouts");
      console.log("🔌 Backup came back online.");

      // Backup just came back — sync both ways so they're identical
      if (Workout) {
        await syncDatabases(Workout,       WorkoutBackup, "primary → backup");
        await syncDatabases(WorkoutBackup, Workout,       "backup → primary");
      }
    }
  } else if (backupUp && process.env.MONGO_BACKUP_URI) {
    // Backup is up — verify it's still reachable
    try {
      await WorkoutBackup.findOne().lean();
    } catch {
      console.warn("⚠️  Backup went down.");
      WorkoutBackup = null;
      try { await backupConn.close(); } catch {}
      backupConn = null;
    }
  }
}

// --- Read helper: primary first, fallback to backup ---
async function readFromDB(fn) {
  if (Workout) {
    try { return await fn(Workout); }
    catch (err) { console.warn("⚠️  Primary read failed, falling back to backup:", err.message); }
  }
  if (WorkoutBackup) return await fn(WorkoutBackup);
  throw new Error("Both databases are unavailable.");
}

// --- Write helper: write to both ---
async function writeToDB(primaryFn, backupFn) {
  let result = null;

  if (Workout) {
    try { result = await primaryFn(Workout); }
    catch (err) { console.warn("⚠️  Primary write failed:", err.message); }
  }

  if (WorkoutBackup) {
    try { await backupFn(WorkoutBackup); }
    catch (err) { console.warn("⚠️  Backup write failed (non-fatal):", err.message); }
  }

  if (!result && WorkoutBackup) {
    try { result = await backupFn(WorkoutBackup); } catch {}
  }

  if (!result) throw new Error("Both databases failed to write.");
  return result;
}

// --- CRUD routes ---

app.get("/api/workouts", async (req, res) => {
  try {
    const isTrash = req.query.deleted === "true";
    const query   = isTrash ? { isDeleted: true } : { isDeleted: { $ne: true } };
    const docs    = await readFromDB((m) => m.find(query).sort({ createdAt: -1 }));
    res.json({
      workouts: docs.map((d) => ({
        id:        d._id.toString(),
        title:     d.title ?? "Workout",
        date:      d.date,
        duration:  d.duration ?? 0,
        exercises: d.exercises,
      })),
    });
  } catch (err) { res.status(500).send(err.message); }
});

app.post("/api/workouts", async (req, res) => {
  try {
    const { date, title, exercises, duration } = req.body;
    if (!date || !Array.isArray(exercises) || exercises.length === 0)
      return res.status(400).send("Invalid payload");

    const payload = {
      title:    title?.trim() || "Workout",
      date,
      exercises,
      duration: Number(duration) || 0,
    };

    let doc = null;
    if (Workout) {
      try {
        doc = await Workout.create(payload);
        if (WorkoutBackup)
          WorkoutBackup.create({ _id: doc._id, ...payload }).catch((e) =>
            console.warn("⚠️  Backup sync failed:", e.message)
          );
      } catch (err) {
        console.warn("⚠️  Primary create failed, writing to backup:", err.message);
      }
    }
    if (!doc && WorkoutBackup) doc = await WorkoutBackup.create(payload);
    if (!doc) return res.status(500).send("Both databases failed.");

    res.status(201).json({
      workout: {
        id: doc._id.toString(), title: doc.title,
        date: doc.date, duration: doc.duration ?? 0, exercises: doc.exercises,
      },
    });
  } catch (err) { res.status(500).send(err.message); }
});

app.put("/api/workouts/:id", async (req, res) => {
  try {
    const { date, title, exercises, duration } = req.body;
    if (!date || !Array.isArray(exercises)) return res.status(400).send("Invalid payload");

    const update = { title: title?.trim() || "Workout", date, exercises, duration: Number(duration) || 0 };
    const doc = await writeToDB(
      (m) => m.findByIdAndUpdate(req.params.id, update, { new: true }),
      (m) => m.findByIdAndUpdate(req.params.id, update, { new: true })
    );
    if (!doc) return res.status(404).send("Workout not found");

    res.json({
      workout: {
        id: doc._id.toString(), title: doc.title,
        date: doc.date, duration: doc.duration ?? 0, exercises: doc.exercises,
      },
    });
  } catch (err) { res.status(500).send(err.message); }
});

app.delete("/api/workouts/:id", async (req, res) => {
  try {
    const { type } = req.query;
    if (type === "hard") {
      await writeToDB((m) => m.findByIdAndDelete(req.params.id), (m) => m.findByIdAndDelete(req.params.id));
      res.json({ ok: true, message: "Workout permanently purged." });
    } else {
      await writeToDB(
        (m) => m.findByIdAndUpdate(req.params.id, { isDeleted: true }),
        (m) => m.findByIdAndUpdate(req.params.id, { isDeleted: true })
      );
      res.json({ ok: true, message: "Workout moved to trash." });
    }
  } catch (err) { res.status(500).send(err.message); }
});

app.put("/api/workouts/:id/restore", async (req, res) => {
  try {
    await writeToDB(
      (m) => m.findByIdAndUpdate(req.params.id, { isDeleted: false }),
      (m) => m.findByIdAndUpdate(req.params.id, { isDeleted: false })
    );
    res.json({ ok: true, message: "Workout restored from trash." });
  } catch (err) { res.status(500).send(err.message); }
});

// --- AI Chatbot Routes ---

/**
 * POST /api/chat
 * Natural language query endpoint
 * Body: { message: string, sessionId: string }
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, error: "Message is required and must be a string" });
    }
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ success: false, error: "SessionId is required" });
    }

    const workouts = await readFromDB((m) =>
      m.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).lean()
    );

    const workoutContext = workouts.map((w) => ({
      id: w._id.toString(),
      title: w.title ?? "Workout",
      date: w.date,
      duration: w.duration ?? 0,
      exercises: w.exercises || [],
    }));

    // Pass apiBase so chatbot-service can call back into the API
    const apiBase = `http://localhost:${process.env.PORT || 5000}`;
    const response = await chatbotService.queryWorkouts(message, workoutContext, sessionId, apiBase);

    if (response.success) {
      res.json({
        success: true,
        message: response.message,
        sessionId: response.sessionId,
        refresh: response.refresh || false, // tells frontend to reload workouts
      });
    } else {
      res.status(500).json({ success: false, error: response.message });
    }
  } catch (err) {
    console.error("Chat endpoint error:", err);
    res.status(500).json({ success: false, error: "Failed to process chat message" });
  }
});

/**
 * POST /api/chat/clear
 * Clear conversation history for a session
 * Body: { sessionId: string }
 */
app.post("/api/chat/clear", (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({
        success: false,
        error: "SessionId is required",
      });
    }

    chatbotService.clearHistory(sessionId);

    res.json({
      success: true,
      message: "Conversation history cleared",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Failed to clear history",
    });
  }
});

// --- Start ---
async function start() {
  if (!process.env.MONGO_URI && !process.env.MONGO_BACKUP_URI)
    throw new Error("At least one DB URI must be set in .env");

  // Initial connections
  if (process.env.MONGO_URI) {
    primaryConn = await tryConnect(process.env.MONGO_URI, "Primary MongoDB");
    if (primaryConn) Workout = primaryConn.model("Workout", workoutSchema);
  }

  if (process.env.MONGO_BACKUP_URI) {
    backupConn = await tryConnect(process.env.MONGO_BACKUP_URI, "Backup MongoDB");
    if (backupConn) WorkoutBackup = backupConn.model("BackupWorkout", workoutSchema, "backup_workouts");
  }

  if (!Workout && !WorkoutBackup)
    throw new Error("❌ Both databases failed to connect. Cannot start.");

  if (!Workout)       console.warn("⚠️  Running on BACKUP only — primary is down.");
  if (!WorkoutBackup) console.warn("⚠️  Running on PRIMARY only — backup is down.");

  // Initial startup sync — run both directions so both DBs are fully identical
  if (Workout && WorkoutBackup) {
    await syncDatabases(WorkoutBackup, Workout,       "backup → primary (startup)");
    await syncDatabases(Workout,       WorkoutBackup, "primary → backup (startup)");
  }

  // Start polling every 5 seconds to detect reconnects
  setInterval(pollConnections, 5000);

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`✅ API running on http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error("❌ Server failed to start:", err);
  process.exit(1);
});