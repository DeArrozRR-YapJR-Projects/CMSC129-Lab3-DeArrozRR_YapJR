const { OpenAI } = require("openai");

let client = null;

// Initialize OpenAI client only if API key is available
if (process.env.OPENAI_API_KEY) {
  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
} else {
  console.warn("⚠️  OPENAI_API_KEY not set. Chatbot will not be available.");
}

// System prompt that instructs the AI on how to handle workout queries
const SYSTEM_PROMPT = `You are a helpful AI assistant for a Workout Tracker application. Your role is to help users understand their workout data through natural language conversations.

When answering queries about workouts:
1. Be concise and friendly
2. Provide specific numbers and data when available
3. Ask clarifying questions if the query is ambiguous
4. Suggest related queries the user might find helpful
5. Maintain context from the conversation history

You have access to user's workout data including:
- Workout titles, dates, duration, and exercises
- Exercise details: name, sets, reps, and weight
- Statistics: total workouts, weekly activity, volume calculations

Never make up data - only use the information provided in the context.`;

class ChatbotService {
  constructor() {
    this.conversationHistories = new Map(); // Store conversation history per user/session
  }

  /**
   * Query the AI with workout context
   * @param {string} userMessage - The user's natural language query
   * @param {Array} workoutContext - Array of workout objects with full details
   * @param {string} sessionId - Unique session identifier for conversation history
   * @returns {Promise<string>} - AI response
   */
  async queryWorkouts(userMessage, workoutContext, sessionId) {
    try {
      // Check if OpenAI is configured
      if (!client) {
        return {
          success: false,
          message: "AI Chatbot is not available. Please configure OPENAI_API_KEY in the server environment.",
          error: "OPENAI_API_KEY not configured",
        };
      }

      // Get or initialize conversation history for this session
      if (!this.conversationHistories.has(sessionId)) {
        this.conversationHistories.set(sessionId, []);
      }

      const conversationHistory = this.conversationHistories.get(sessionId);

      // Create context string from workout data
      const contextString = this.formatWorkoutContext(workoutContext);

      // Build messages for the API call
      const messages = [
        ...conversationHistory,
        {
          role: "user",
          content: `${userMessage}\n\n---\nHere is the current workout data:\n${contextString}`,
        },
      ];

      // Call OpenAI API
      const response = await client.chat.completions.create({
        model: process.env.AI_MODEL || "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          ...messages,
        ],
        temperature: parseFloat(process.env.AI_TEMPERATURE || 0.7),
        max_tokens: 1000,
      });

      const assistantMessage = response.choices[0].message.content;

      // Store both messages in conversation history (keep last 5 messages = 10 entries max)
      conversationHistory.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: assistantMessage }
      );

      // Keep only last 5 exchanges (10 messages)
      if (conversationHistory.length > 10) {
        conversationHistory.splice(0, conversationHistory.length - 10);
      }

      return {
        success: true,
        message: assistantMessage,
        sessionId,
      };
    } catch (error) {
      console.error("❌ Chatbot error:", error);
      return {
        success: false,
        message: "I'm having trouble processing that request. Please try again.",
        error: error.message,
      };
    }
  }

  /**
   * Clear conversation history for a session
   * @param {string} sessionId - Session to clear
   */
  clearHistory(sessionId) {
    this.conversationHistories.delete(sessionId);
  }

  /**
   * Format workout data for context
   * @private
   */
  formatWorkoutContext(workouts) {
    if (!workouts || workouts.length === 0) {
      return "No workouts found.";
    }

    let context = `Total Workouts: ${workouts.length}\n\n`;

    // Add summary stats
    const totalDuration = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);
    const totalExercises = workouts.reduce((sum, w) => sum + (w.exercises?.length || 0), 0);
    context += `Total Duration: ${totalDuration} minutes\n`;
    context += `Total Exercises: ${totalExercises}\n\n`;

    // Add recent workouts (limit to last 5 for context)
    context += "Recent Workouts:\n";
    workouts.slice(0, 5).forEach((workout) => {
      context += `- ${workout.date}: "${workout.title}" (${workout.duration}min, ${
        workout.exercises?.length || 0
      } exercises)\n`;

      // Add exercise details
      if (workout.exercises && workout.exercises.length > 0) {
        workout.exercises.forEach((ex) => {
          context += `  • ${ex.name}: ${ex.sets}x${ex.reps} @ ${ex.weight}lbs\n`;
        });
      }
    });

    return context;
  }
}

module.exports = new ChatbotService();
