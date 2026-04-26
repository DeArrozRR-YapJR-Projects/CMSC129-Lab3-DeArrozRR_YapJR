const Groq = require("groq-sdk");

let client = null;

if (process.env.GROQ_API_KEY) {
  client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  console.log("✅ GROQ client initialized for ChatbotService.");
} else {
  console.warn("⚠️  GROQ_API_KEY not set. Chatbot will not be available.");
}

const SYSTEM_PROMPT = `You are FitTrack AI, a smart assistant for a Workout Tracker app.

You can answer questions AND perform CRUD operations on workout data using tools.

TOOLS AVAILABLE:
- create_workout: Add a new workout
- update_workout: Modify an existing workout
- delete_workout: Delete a workout (ALWAYS requires confirmation first)

CONTEXT RULES:
- Maintain full conversation context. Remember what was discussed.
- Handle pronouns: if user says "delete it" or "update that one", refer back to the last mentioned workout.
- Handle follow-up filters: if user says "which ones are over 60 minutes?" after listing workouts, filter from those results.
- Remember the last workout(s) mentioned in conversation.

CRUD RULES:
- For CREATE: extract title, date, duration, exercises (name, sets, reps, weight). If info is missing, ask for it.
- For UPDATE: identify the workout by title or date, confirm what changes to make.
- For DELETE: ALWAYS respond with a confirmation request BEFORE calling delete_workout. Say exactly: "⚠️ Are you sure you want to delete [workout name]? Reply 'yes' to confirm or 'no' to cancel."
- For destructive batch operations (delete multiple, update all): list what will be affected and ask for confirmation.

RESPONSE RULES:
- After successful CRUD, describe what was done and show the result.
- Never make up workout data. Only use provided context.
- Be conversational and helpful.

You can answer questions like:
1. "What's my most intense workout?" (highest total volume: sets x reps x weight)
2. "How many workouts did I do this week/month?"
3. "What's my longest/shortest workout?"
4. "Show me all workouts with bench press"
5. "What's my total volume lifted?"
6. "What's my current streak?"
7. "Add a new chest workout for today"
8. "Delete last Tuesday's workout"
9. "Update my leg day to add squats"
10. "How has my bench press weight progressed?"`;

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
          duration: { type: "number", description: "Duration in minutes" },
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
      description: "Update an existing workout",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Workout ID" },
          title: { type: "string" },
          date: { type: "string" },
          duration: { type: "number" },
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
      description: "Delete a workout by ID. Only call this AFTER user has confirmed.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Workout ID to delete" },
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
  }

  async queryWorkouts(userMessage, workoutContext, sessionId, apiBase) {
    try {
      if (!client) {
        return {
          success: false,
          message: "AI Chatbot is not available. Please configure GROQ_API_KEY.",
          error: "GROQ_API_KEY not configured",
        };
      }

      if (!this.conversationHistories.has(sessionId)) {
        this.conversationHistories.set(sessionId, []);
      }

      const conversationHistory = this.conversationHistories.get(sessionId);

      // Check if user is responding to a pending confirmation
      const pending = this.pendingConfirmations.get(sessionId);
      if (pending) {
        const reply = userMessage.trim().toLowerCase();
        if (["yes", "y", "confirm", "yeah", "yep"].includes(reply)) {
          this.pendingConfirmations.delete(sessionId);
          const result = await this.executeTool(pending.tool, pending.args, apiBase);
          const msg = result.success
            ? `✅ Done! ${result.message}`
            : `❌ Failed: ${result.message}`;
          conversationHistory.push(
            { role: "user", content: userMessage },
            { role: "assistant", content: msg }
          );
          this.trimHistory(conversationHistory);
          return { success: true, message: msg, sessionId, refresh: result.success };
        } else if (["no", "n", "cancel", "nope", "nah"].includes(reply)) {
          this.pendingConfirmations.delete(sessionId);
          const msg = "❌ Operation cancelled. Nothing was changed.";
          conversationHistory.push(
            { role: "user", content: userMessage },
            { role: "assistant", content: msg }
          );
          this.trimHistory(conversationHistory);
          return { success: true, message: msg, sessionId, refresh: false };
        }
        // If not a clear yes/no, fall through to normal AI processing
        this.pendingConfirmations.delete(sessionId);
      }

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
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
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
        const toolArgs = JSON.parse(toolCall.function.arguments);

        if (toolName === "delete_workout") {
          this.pendingConfirmations.set(sessionId, { tool: toolName, args: toolArgs });
          assistantMessage = `⚠️ Are you sure you want to delete **"${toolArgs.title || "this workout"}"**? Reply **'yes'** to confirm or **'no'** to cancel.`;
        } else if (toolName === "update_workout") {
          this.pendingConfirmations.set(sessionId, { tool: toolName, args: toolArgs });
          assistantMessage = `⚠️ I'm about to update **"${toolArgs.title || "this workout"}"** with the changes you requested. Reply **'yes'** to confirm or **'no'** to cancel.`;
        } else {
          // create_workout — execute immediately
          const result = await this.executeTool(toolName, toolArgs, apiBase);
          assistantMessage = result.success
            ? `✅ ${result.message}`
            : `❌ Failed: ${result.message}`;
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
    } catch (error) {
      console.error("❌ Chatbot error:", error);
      return {
        success: false,
        message: "I'm having trouble processing that request. Please try again.",
        error: error.message,
      };
    }
  }

  async executeTool(toolName, args, apiBase) {
    const base = apiBase || `http://localhost:${process.env.PORT || 5000}`;
    try {
      if (toolName === "create_workout") {
        const exercises = (args.exercises || []).map((ex) => ({
          ...ex,
          id: `ex_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        }));
        const res = await fetch(`${base}/api/workouts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...args, exercises }),
        });
        const data = await res.json();
        return {
          success: res.ok,
          message: res.ok
            ? `Created workout **"${data.workout.title}"** on ${data.workout.date} with ${exercises.length} exercise(s).`
            : "Failed to create workout.",
        };
      }

      if (toolName === "update_workout") {
        const res = await fetch(`${base}/api/workouts/${args.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args),
        });
        const data = await res.json();
        return {
          success: res.ok,
          message: res.ok
            ? `Updated workout **"${data.workout.title}"** successfully.`
            : "Failed to update workout.",
        };
      }

      if (toolName === "delete_workout") {
        const res = await fetch(`${base}/api/workouts/${args.id}?type=soft`, {
          method: "DELETE",
        });
        return {
          success: res.ok,
          message: res.ok
            ? `Deleted workout **"${args.title || args.id}"** successfully.`
            : "Failed to delete workout.",
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
  }

  formatWorkoutContext(workouts) {
    if (!workouts || workouts.length === 0) return "No workouts found.";

    let context = `Total Workouts: ${workouts.length}\n\n`;
    const totalDuration = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);
    const totalExercises = workouts.reduce((sum, w) => sum + (w.exercises?.length || 0), 0);
    context += `Total Duration: ${totalDuration} minutes\n`;
    context += `Total Exercises: ${totalExercises}\n\n`;

    context += "All Workouts:\n";
    workouts.forEach((workout) => {
      context += `- [ID: ${workout.id}] ${workout.date}: "${workout.title}" (${workout.duration}min)\n`;
      workout.exercises?.forEach((ex) => {
        context += `  • ${ex.name}: ${ex.sets}x${ex.reps} @ ${ex.weight}lbs\n`;
      });
    });

    return context;
  }
}

module.exports = new ChatbotService();