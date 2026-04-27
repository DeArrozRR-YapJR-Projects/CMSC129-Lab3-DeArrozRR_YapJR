const Groq = require("groq-sdk");

let client = null;

if (process.env.GROQ_API_KEY) {
  client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  console.log("GROQ client initialized for ChatbotService.");
} else {
  console.warn("GROQ_API_KEY not set. Chatbot will not be available.");
}

// --- System prompts (separate) ---
const INQUIRY_SYSTEM_PROMPT = `You are FitTrack AI, a smart assistant for a Workout Tracker app.

CURRENT MODE: INQUIRY (Read-Only)
In this mode, you can ONLY answer questions and analyze workout data. You CANNOT change, add, or delete any workout.

Your capabilities:
- Answer questions like: "What's my most intense workout?" (total volume: sets × reps × weight)
- "How many workouts did I do this week/month?"
- "What's my longest/shortest workout?"
- "Show me all workouts with bench press"
- "What's my total volume lifted?"
- "What's my current streak?"
- "How has my bench press weight progressed?"

RULES:
- Never suggest creating, updating, deleting, or restoring workouts.
- If the user asks you to change data, politely explain that you are currently in "Inquiry Mode" (read-only) and they need to toggle the "Full Access" switch in the chat header to allow you to make changes.
- Be conversational and helpful.
- Use the provided workout data context to answer accurately.
- If data is insufficient, explain what's missing.`;

const CRUD_SYSTEM_PROMPT = `You are FitTrack AI, a smart assistant for a Workout Tracker app.

CURRENT MODE: FULL ACCESS (CRUD)
In this mode, you have FULL ACCESS to the user's workout data. You can answer questions, analyze data, and perform CRUD operations using tools.

CAPABILITIES:
1. ANALYSIS: Answer questions about volume, streaks, exercise progression, and intensity.
2. CRUD OPERATIONS:
    - create_workout: Add a new workout
    - update_workout: Modify an existing workout
    - delete_workout: Delete a workout
    - restore_workout: Move a workout from Trash back to active list.

MODE TRANSITION (IMPORTANT):
If you notice you've just been switched from "Inquiry" to "Full Access", acknowledge it if relevant to the user's next request. For example, if they previously asked to delete something and you refused, you can now say "I'm now in Full Access mode! I can help you with that deletion now."

WORKOUT CREATION PROCESS:
When a user wants to "create", "add", or "make" a workout:
1. FIRST, check if you have:
    - A specific title (e.g., "Leg Day", "Push A")
    - At least one exercise with name, sets, reps, and weight.
2. DATE: DO NOT ask for a date. ALWAYS default the date to today's date in YYYY-MM-DD format (use the current date from context).
3. If title or exercises are missing, ASK for them.
4. Only call create_workout once details are provided.

IMPORTANT DELETE RULE (TWO-STEP PROCESS):
1. For ACTIVE workouts (not in Trash), ALWAYS use soft delete (delete_type='soft').
2. For TRASHED workouts, use hard delete (delete_type='hard') for permanent removal if they ask to delete it again.
- Identify trashed workouts by "(TRASHED)" in the context.
- "Permanently delete", "purge", "hard delete" → ALWAYS use hard delete.

RESTORE RULES:
- Only call restore_workout if the user explicitly asks to "restore", "recover", "undelete", or "get back" a specific workout.
- If the user is just asking what is in the trash, listing trashed items, or inquiring about the trash bin (e.g., "what's in my trash?"), DO NOT call restore_workout. Instead, simply list the items marked as (TRASHED) in the workout context.
- Always ask for confirmation before restoring.

CONFIRMATION MESSAGES (plain text, no emojis):
- Soft delete: "Move "[workout name]" to trash? You can restore it later from the Trash Bin. Reply 'yes' to confirm or 'no' to cancel."
- Hard delete: "Permanently delete "[workout name]"? This cannot be undone. Reply 'yes' to confirm or 'no' to cancel."
- Restore: "Restore "[workout name]" from trash? Reply 'yes' to confirm or 'no' to cancel."
- Update: "Update "[workout name]" with the changes you requested? Reply 'yes' to confirm or 'no' to cancel."

CRUD RULES:
- For DELETE, RESTORE, and UPDATE: Call the tool immediately when the intent is clear. DO NOT send a text confirmation yourself; the system will automatically intercept the tool call and handle the confirmation dialogue with the user.
- Response: After success (when user has confirmed and tool executes), confirm the final result (e.g. "Moved to trash", "Permanently deleted", "Restored").
- Response: After cancellation, confirm nothing was changed.
`;

// ... (tools array remains unchanged) ...

// --- Tools for CRUD only (inquiry uses none) ---
const tools = [
  {
    type: "function",
    function: {
      name: "create_workout",
      description: "Create a new workout with exercises",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Workout title e.g. 'Chest Day'" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          exercises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                sets: { type: "number" },
                reps: { type: "number" },
                weight: { type: "number", description: "Weight in lbs" },
              },
              required: ["name", "sets", "reps", "weight"],
            },
          },
        },
        required: ["title", "date", "exercises"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_workout",
      description: "Update an existing workout. Only call this AFTER user has confirmed.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Workout ID" },
          title: { type: "string" },
          date: { type: "string" },
          exercises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                sets: { type: "number" },
                reps: { type: "number" },
                weight: { type: "number" },
              },
              required: ["name", "sets", "reps", "weight"],
            },
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_workout",
      description: "Delete a workout. Use delete_type='soft' to move to trash (recoverable). Use delete_type='hard' to permanently remove (irreversible). Only call this AFTER user has confirmed deletion.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Workout ID to delete" },
          title: { type: "string", description: "Workout title for confirmation message" },
          delete_type: {
            type: "string",
            enum: ["soft", "hard"],
            description: "soft = move to trash (recoverable). hard = permanently delete (irreversible).",
          },
        },
        required: ["id", "delete_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "restore_workout",
      description: "Restore a specific soft-deleted workout from the Trash Bin back to active workouts. Use this ONLY when the user explicitly asks to restore/recover a workout. Do NOT use this for listing or asking about trash contents.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Workout ID to restore" },
          title: { type: "string", description: "Workout title for confirmation message" },
        },
        required: ["id"],
      },
    },
  },
];

class ChatbotService {
  constructor() {
    this.conversationHistories = new Map();
    this.pendingConfirmations = new Map();
    this.sessionModes = new Map();
  }

  // --- Intent detection ---
  _isCrudIntent(message) {
    const crudKeywords = [
      "create", "add", "new workout", "new entry",
      "update", "modify", "change", "edit",
      "delete", "remove", "trash", "permanently delete", "hard delete", "purge",
      "restore", "recover", "retrieve", "get back"
    ];
    const lowerMsg = message.toLowerCase();
    // If any keyword appears, it's likely CRUD
    return crudKeywords.some(keyword => lowerMsg.includes(keyword));
  }

  // --- Main public method (keeps compatibility) ---
  async queryWorkouts(userMessage, workoutContext, sessionId, apiBase, mode = "inquiry") {
  try {
    if (!client) {
      return {
        success: false,
        message: "AI Chatbot is not available. Please configure GROQ_API_KEY.",
        error: "GROQ_API_KEY not configured",
      };
    }

    // Validate and sanitize mode
    let effectiveMode = mode;
    if (effectiveMode !== "crud" && effectiveMode !== "inquiry") {
      console.warn(`Unknown mode "${effectiveMode}" provided. Defaulting to "inquiry".`);
      effectiveMode = "inquiry";
    }

    if (!this.conversationHistories.has(sessionId)) {
      this.conversationHistories.set(sessionId, []);
    }
    const conversationHistory = this.conversationHistories.get(sessionId);

    // --- Mode Switch Detection ---
    const lastMode = this.sessionModes.get(sessionId);
    if (lastMode && lastMode !== effectiveMode) {
      const switchNotice = effectiveMode === "crud" 
        ? "SYSTEM NOTICE: User has granted you FULL ACCESS (CRUD). You can now create, update, delete, and restore workouts using tools."
        : "SYSTEM NOTICE: User has switched you to INQUIRY mode (Read-only). You can no longer make any changes.";
      
      conversationHistory.push({ role: "system", content: switchNotice });
    }
    this.sessionModes.set(sessionId, effectiveMode);

    // Check pending confirmation first (only if CRUD mode)
    const pending = this.pendingConfirmations.get(sessionId);
    if (pending) {
      if (effectiveMode !== "crud") {
        this.pendingConfirmations.delete(sessionId);
        const msg = "You are in read-only mode. Switch to full access mode to confirm deletion, updates, or restores.";
        conversationHistory.push(
          { role: "user", content: userMessage },
          { role: "assistant", content: msg }
        );
        this.trimHistory(conversationHistory);
        return { success: true, message: msg, sessionId, refresh: false };
      }
      return await this._handlePendingConfirmation(userMessage, pending, conversationHistory, sessionId, apiBase, workoutContext, effectiveMode);
    }

    // Use CRUD handler for ALL messages when mode is 'crud' to maintain consistent personality/capabilities
    if (effectiveMode === "crud") {
      return await this._handleCrud(userMessage, workoutContext, conversationHistory, sessionId, apiBase);
    } else {
      return await this._handleInquiry(userMessage, workoutContext, conversationHistory, sessionId);
    }
  } catch (error) {
    console.error("Chatbot error:", error);
    return {
      success: false,
      message: "I'm having trouble processing that request. Please try again.",
      error: error.message,
    };
  }
}

  // --- Handle pure inquiry (no tools) ---
  async _handleInquiry(userMessage, workoutContext, conversationHistory, sessionId) {
    const contextString = this.formatWorkoutContext(workoutContext);
    const messages = [
      ...conversationHistory,
      {
        role: "user",
        content: `${userMessage}\n\n---\nCurrent workout data:\n${contextString}`,
      },
    ];

    const response = await client.chat.completions.create({
      model: process.env.AI_MODEL || "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: INQUIRY_SYSTEM_PROMPT }, ...messages],
      tool_choice: "none",  // No tools allowed
      temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
      max_tokens: 1000,
    });

    const assistantMessage = response.choices[0].message.content || "I couldn't process that question.";

    conversationHistory.push(
      { role: "user", content: userMessage },
      { role: "assistant", content: assistantMessage }
    );
    this.trimHistory(conversationHistory);

    return { success: true, message: assistantMessage, sessionId, refresh: false };
  }

  // --- Handle CRUD commands (with tools) ---
  async _handleCrud(userMessage, workoutContext, conversationHistory, sessionId, apiBase) {
    const contextString = this.formatWorkoutContext(workoutContext);
    const messages = [
      ...conversationHistory,
      {
        role: "user",
        content: `${userMessage}\n\n---\nCurrent workout data:\n${contextString}`,
      },
    ];

    const response = await client.chat.completions.create({
      model: process.env.AI_MODEL || "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: CRUD_SYSTEM_PROMPT }, ...messages],
      tools,
      tool_choice: "auto",
      temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
      max_tokens: 1000,
    });

    const choice = response.choices[0];
    let assistantMessage = "";
    let refresh = false;

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      const toolCall = choice.message.tool_calls[0];
      const toolName = toolCall.function.name;

      let toolArgs;
      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        assistantMessage = "I had trouble understanding the action. Could you rephrase that?";
        conversationHistory.push(
          { role: "user", content: userMessage },
          { role: "assistant", content: assistantMessage }
        );
        this.trimHistory(conversationHistory);
        return { success: true, message: assistantMessage, sessionId, refresh: false };
      }

      // Handle tools that need confirmation
      if (toolName === "delete_workout") {
        const isHard = toolArgs.delete_type === "hard";
        this.pendingConfirmations.set(sessionId, { tool: toolName, args: toolArgs });
        if (isHard) {
          assistantMessage = `Permanently delete "${toolArgs.title || "this workout"}"? This cannot be undone. Reply 'yes' to confirm or 'no' to cancel.`;
        } else {
          assistantMessage = `Move "${toolArgs.title || "this workout"}" to trash? You can restore it later from the Trash Bin. Reply 'yes' to confirm or 'no' to cancel.`;
        }
      } else if (toolName === "restore_workout") {
        this.pendingConfirmations.set(sessionId, { tool: toolName, args: toolArgs });
        assistantMessage = `Restore "${toolArgs.title || "this workout"}" from trash? Reply 'yes' to confirm or 'no' to cancel.`;
      } else if (toolName === "update_workout") {
        this.pendingConfirmations.set(sessionId, { tool: toolName, args: toolArgs });
        assistantMessage = `Update "${toolArgs.title || "this workout"}" with the changes you requested? Reply 'yes' to confirm or 'no' to cancel.`;
      } else {
        // create_workout (no confirmation needed)
        const result = await this.executeTool(toolName, toolArgs, apiBase);
        assistantMessage = result.success ? result.message : `Failed: ${result.message}`;
        refresh = result.success;
      }
    } else {
      assistantMessage = choice.message.content || "I couldn't process that request.";
    }

    conversationHistory.push(
      { role: "user", content: userMessage },
      { role: "assistant", content: assistantMessage }
    );
    this.trimHistory(conversationHistory);

    return { success: true, message: assistantMessage, sessionId, refresh };
  }

  // --- Handle user's yes/no response to a pending confirmation ---
  async _handlePendingConfirmation(userMessage, pending, conversationHistory, sessionId, apiBase, workoutContext, mode) {
    const reply = userMessage.trim().toLowerCase();
    if (["yes", "y", "confirm", "yeah", "yep"].includes(reply)) {
      this.pendingConfirmations.delete(sessionId);
      const result = await this.executeTool(pending.tool, pending.args, apiBase);

      let msg;
      if (result.success) {
        if (pending.tool === "delete_workout") {
          msg = pending.args.delete_type === "hard"
            ? `Confirmed. "${pending.args.title || pending.args.id}" has been permanently deleted and cannot be recovered.`
            : `Confirmed. "${pending.args.title || pending.args.id}" has been moved to the Trash Bin. You can restore it anytime from the Trash Bin.`;
        } else if (pending.tool === "restore_workout") {
          msg = `Confirmed. "${pending.args.title || pending.args.id}" has been restored from trash.`;
        } else if (pending.tool === "update_workout") {
          msg = `Done. ${result.message}`;
        } else {
          msg = `Done. ${result.message}`;
        }
      } else {
        msg = `Failed: ${result.message}`;
      }

      conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: msg }
      );
      this.trimHistory(conversationHistory);
      return { success: true, message: msg, sessionId, refresh: result.success };
    } else if (["no", "n", "cancel", "nope", "nah"].includes(reply)) {
      this.pendingConfirmations.delete(sessionId);
      const msg = "Cancelled. Nothing was changed.";
      conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: msg }
      );
      this.trimHistory(conversationHistory);
      return { success: true, message: msg, sessionId, refresh: false };
    }
    // Not a clear yes/no – treat as a new message and re-route
    this.pendingConfirmations.delete(sessionId);
    // Re-route to normal processing (will detect intent again)
    // FIX: Pass workoutContext and mode to prevent context loss and mode reset
    return await this.queryWorkouts(userMessage, workoutContext, sessionId, apiBase, mode);
  }

  // --- Tool execution (unchanged from original) ---
  async executeTool(toolName, args, apiBase) {
    const base = apiBase || `http://localhost:${process.env.PORT || 5000}`;
    const fetchFn = (typeof fetch === 'function') ? fetch : globalThis.fetch;
    
    if (!fetchFn) {
       return { success: false, message: "Fetch is not available in this environment. Please upgrade Node.js or install node-fetch." };
    }

    try {
      if (toolName === "create_workout") {
        const exercises = (args.exercises || []).map((ex) => ({
          ...ex,
          id: `ex_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        }));
        const res = await fetchFn(`${base}/api/workouts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...args, exercises }),
        });
        const data = await res.json();
        return {
          success: res.ok,
          message: res.ok
            ? `Created workout "${data.workout.title}" on ${data.workout.date} with ${exercises.length} exercise(s).`
            : "Failed to create workout.",
        };
      }

      if (toolName === "update_workout") {
        const res = await fetchFn(`${base}/api/workouts/${args.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args),
        });
        const data = await res.json();
        return {
          success: res.ok,
          message: res.ok
            ? `Updated workout "${data.workout.title}" successfully.`
            : "Failed to update workout.",
        };
      }

      if (toolName === "delete_workout") {
        const deleteType = args.delete_type === "hard" ? "hard" : "soft";
        const res = await fetchFn(`${base}/api/workouts/${args.id}?type=${deleteType}`, {
          method: "DELETE",
        });
        return {
          success: res.ok,
          message: res.ok
            ? deleteType === "hard"
              ? `Permanently deleted "${args.title || args.id}".`
              : `Moved "${args.title || args.id}" to trash.`
            : "Failed to delete workout.",
        };
      }

      if (toolName === "restore_workout") {
        const res = await fetchFn(`${base}/api/workouts/${args.id}/restore`, {
          method: "PUT",
        });
        return {
          success: res.ok,
          message: res.ok ? `Restored "${args.title || args.id}" from trash.` : "Failed to restore workout.",
        };
      }

      return { success: false, message: "Unknown tool." };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  trimHistory(history) {
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
  }

  clearHistory(sessionId) {
    this.conversationHistories.delete(sessionId);
    this.pendingConfirmations.delete(sessionId);
    this.sessionModes.delete(sessionId);
  }

  formatWorkoutContext(workouts) {
    if (!workouts || workouts.length === 0) return "No workouts found.";

    let context = `Total Workouts: ${workouts.length}\n\n`;
    const totalExercises = workouts.reduce((sum, w) => sum + (w.exercises?.length || 0), 0);
    context += `Total Exercises: ${totalExercises}\n\n`;

    context += "All Workouts:\n";
    workouts.forEach((workout) => {
      const trashedMarker = (workout.isTrashed || workout.deletedAt) ? " (TRASHED)" : "";
      context += `- [ID: ${workout.id}] ${workout.date}: "${workout.title}"${trashedMarker}\n`;
      workout.exercises?.forEach((ex) => {
        context += `  • ${ex.name}: ${ex.sets}x${ex.reps} @ ${ex.weight}lbs\n`;
      });
    });

    return context;
  }
}

module.exports = new ChatbotService();