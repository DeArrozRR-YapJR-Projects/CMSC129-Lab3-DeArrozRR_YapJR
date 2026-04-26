const Groq = require("groq-sdk");

let client = null;

if (process.env.GROQ_API_KEY) {
  client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  console.log("✅ GROQ client initialized for ChatbotService.");
} else {
  console.warn("⚠️  GROQ_API_KEY not set. Chatbot will not be available.");
}

const SYSTEM_PROMPT = `You are a helpful AI assistant for a Workout Tracker application. Your role is to help users understand their workout data through natural language conversations.

When answering queries about workouts:
1. Be concise and friendly
2. Provide specific numbers and data when available
3. Ask clarifying questions if the query is ambiguous
4. Suggest related queries the user might find helpful
5. Maintain context from the conversation history

You have access to user's workout data including:
- Workout titles, dates, and exercises
- Exercise details: name, sets, reps, and weight
- Statistics: total workouts, weekly activity, volume calculations

Never make up data - only use the information provided in the context.`;

class ChatbotService {
  constructor() {
    this.conversationHistories = new Map();
  }

  async queryWorkouts(userMessage, workoutContext, sessionId) {
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
      const contextString = this.formatWorkoutContext(workoutContext);

      const response = await client.chat.completions.create({
        model: process.env.AI_MODEL || "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...conversationHistory,
          {
            role: "user",
            content: `${userMessage}\n\n---\nHere is the current workout data:\n${contextString}`,
          },
        ],
        temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
        max_tokens: 1000,
      });

      const assistantMessage = response.choices[0].message.content;

      conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: assistantMessage }
      );

      if (conversationHistory.length > 10) {
        conversationHistory.splice(0, conversationHistory.length - 10);
      }

      return { success: true, message: assistantMessage, sessionId };
    } catch (error) {
      console.error("❌ Chatbot error:", error);
      return {
        success: false,
        message: "I'm having trouble processing that request. Please try again.",
        error: error.message,
      };
    }
  }

  clearHistory(sessionId) {
    this.conversationHistories.delete(sessionId);
  }

  formatWorkoutContext(workouts) {
    if (!workouts || workouts.length === 0) return "No workouts found.";

    let context = `Total Workouts: ${workouts.length}\n\n`;
    const totalExercises = workouts.reduce((sum, w) => sum + (w.exercises?.length || 0), 0);
    context += `Total Exercises: ${totalExercises}\n\n`;

    context += "Recent Workouts:\n";
    workouts.slice(0, 5).forEach((workout) => {
      context += `- ${workout.date}: "${workout.title}" (${workout.duration}min, ${workout.exercises?.length || 0} exercises)\n`;
      workout.exercises?.forEach((ex) => {
        context += `  • ${ex.name}: ${ex.sets}x${ex.reps} @ ${ex.weight}lbs\n`;
      });
    });

    return context;
  }
}

module.exports = new ChatbotService();