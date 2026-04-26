# FitTrack 🏋️

A full-stack workout tracking app built with React, TypeScript, and Express + MongoDB. Log workouts, track volume, and monitor your streak — all from a clean, minimal UI.

---

## Features

- **Log workouts** with a custom title, exercises, sets, reps, and weight
- **Inline editing** — edit any exercise in place without deleting and re-entering
- **Workout history** — view past workouts with date, total volume, and exercise breakdown
- **Stats bar** — tracks total workouts, this week's count, total volume lifted, and current streak
- **Persistent storage** — all data saved to MongoDB via a REST API
- **🤖 AI Chatbot** — natural language queries to ask questions about your workouts
  - Maintain conversation context for follow-up questions
  - Get insights about your training patterns
  - Ask complex questions in plain English

## Tech Stack

**Frontend**
- React + TypeScript (Vite)
- Tailwind CSS + shadcn/ui
- Framer Motion

**Backend**
- Node.js + Express
- MongoDB + Mongoose
- OpenAI API for natural language processing

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas URI)

### Installation

```bash
# Clone the repo
git clone https://github.com/your-username/fittrack.git
cd fittrack
```

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install
```

### Environment Variables

Create a `.env` file inside the `server/` directory:

```env
# MongoDB Configuration
MONGO_URI=your_mongodb_connection_string
MONGO_BACKUP_URI=your_backup_mongodb_connection_string  # Optional

# Server Configuration
PORT=5000
CLIENT_ORIGIN=http://localhost:5173

# AI Chatbot Configuration (Required for AI features)
# Get your API key from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-api-key-here

# AI Model Settings
AI_MODEL=gpt-3.5-turbo  # Options: gpt-3.5-turbo, gpt-4, gpt-4-turbo-preview
AIInstall backend dependencies
cd server && npm install && cd ..

# Install frontend dependencies  
npm install

# (Optional) Seed the database with sample workouts
cd server && npm run seed && cd ..

# Start the development server (runs both frontend and backendt for the frontend:

```env
VITE_API_URL=http://localhost:5000
```

### Getting Your OpenAI API Key

1. Visit [OpenAI's API Keys page](https://platform.openai.com/api-keys)
2. Sign up or log in with your OpenAI account
3. Click "Create new secret key"
4. Copy the key and paste it into your `.env` file
5. **Important**: Never commit your `.env` file to GitHub! Use `.env.example` instead.

### Running the App

```bash
# Start the backend (from /server)
node server.js

# Start the frontend (from root)
npm run dev
```

The app will be available at `http://localhost:5173`.

## Project Structure

```
fittrack/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AddWorkoutForm.tsx   # Form to log a new workout
│   │   │   ├── WorkoutHistory.tsx   # List of past workouts with inline editing
│   │   │   ├── StatsBar.tsx         # Summary stats (volume, streak, etc.)
│   │   │   └── Chatbot.tsx          # 🤖 AI Chatbot widget component
│   │   ├── pages/
│   │   │   └── Index.tsx            # Main page with chatbot integration
│   │   ├── types/
│   │   │   └── workout.ts           # TypeScript interfaces
│   │   └── App.tsx                  # Root component
│   └── package.json
└── server/
    ├── server.js                    # Express API + MongoDB
    ├── chatbot-service.js           # 🤖 AI chat logic & context management
    ├── seed.js                      # Database seeding script
    └── package.json
```

## 🤖 AI Chatbot Features

The integrated AI chatbot allows you to query your workout data using natural language. It's available as a floating widget on the main page.

### Example Queries

Try asking the chatbot these types of questions:

**Data Analysis**
- "How many workouts have I done this month?"
- "What's my average workout duration?"
- "Which exercise have I done the most?"

**Specific Lookups**
- "Show me all my chest workouts"
- "What exercises do I do with deadlifts?"
- "Tell me about my leg days"

**Statistics & Insights**
- "What's my heaviest lift?"
- "Which workout had the most volume?"
- "What's the longest workout I've recorded?"
- "How many different exercises do I do?"

**Follow-up Questions**
- (After asking about leg workouts) "How long were they?"
- (After mentioning heaviest lift) "Which exercise was that?"
- (After workout summary) "Tell me more details"

### How It Works

1. **Floating Widget** — Click the chat button in the bottom-right corner
2. **Natural Language** — Type your question in plain English
3. **Context-Aware** — The AI analyzes your entire workout history
4. **Conversation Memory** — Ask follow-up questions that reference previous answers
5. **Clear History** — Use the "Clear" button to start a fresh conversation

### Backend API Endpoints

The chatbot communicates with the backend through these endpoints:

#### POST `/api/chat`
Send a message to the AI chatbot.

**Request:**
```json
{
  "message": "What's my average workout duration?",
  "sessionId": "unique_session_identifier"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Your average workout duration is about 65 minutes...",
  "sessionId": "unique_session_identifier"
}
```

#### POST `/api/chat/clear`
Clear conversation history for a session.

**Request:**
```json
{
  "sessionId": "unique_session_identifier"
}
```

### Security Notes

- ✅ **API keys are never exposed** — All AI calls go through your backend
- ✅ **Environment variables** — Use `.env` for sensitive configuration
- ✅ **No direct frontend API calls** — Frontend only talks to your Express server
- ✅ **Conversation isolation** — Each session maintains separate history

## Troubleshooting

### AI Chatbot Issues

**"I'm having trouble processing that request"**
- Ensure your `OPENAI_API_KEY` is set correctly in `.env`
- Check that the OpenAI API account has available credits
- Verify the backend is running on port 5000 (or your configured port)

**"Chatbot widget not appearing"**
- Make sure the frontend `.env` has `VITE_API_URL` set correctly
- Check browser console for any errors (F12 → Console tab)
- Refresh the page and try again

**"Backend not responding to chat requests"**
- Verify the backend server is running: `npm run server`
- Check that MongoDB is connected (look for ✅ connection message)
- Ensure `OPENAI_API_KEY` is configured in `.server/.env`

### Database Issues

**"No workouts found in chatbot context"**
- Run the seed script: `cd server && npm run seed`
- Add at least one workout manually through the app
- Check that MongoDB is running and connected

**"Both databases failed to connect"**
- Ensure MongoDB is running locally or your Atlas URI is correct
- Check the `.env` file for `MONGO_URI` configuration
- Verify network connectivity to MongoDB

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.
