import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, Shield, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface ChatbotProps {
  apiUrl?: string;
  onRefresh?: () => void;
}

const Chatbot: React.FC<ChatbotProps> = ({ apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000", onRefresh }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"inquiry" | "crud">("inquiry");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Add welcome message on first open (no emojis in buttons, but assistant messages are allowed to have emojis)
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            `👋 Hi! I'm your Workout Tracker assistant.\n\n` +
            `**Current mode:** ${mode === "inquiry" ? "Inquiry (read-only)" : "Full Access (can modify workouts)"}\n\n` +
            `Use the toggle in the header to switch modes.\n\n` +
            `**Inquiry mode** – I can only answer questions.\n` +
            `**Full Access mode** – I can create, update, delete, and restore workouts (with confirmations).\n\n` +
            `Try asking me things like:\n` +
            `• "What's my most intense workout?"\n` +
            `• "How many exercises did I do this week?"\n` +
            `• "Show me all leg days"\n` +
            `• "Delete yesterday's workout" (only in full access mode)`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, mode]);

  // Add system message when mode changes (no emojis)
  useEffect(() => {
    if (messages.length > 0) {
      const systemMsg: Message = {
        id: `mode_${Date.now()}`,
        role: "system",
        content: `Switched to ${mode === "inquiry" ? "Inquiry (read-only) mode" : "Full Access (CRUD) mode"}.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, systemMsg]);
    }
  }, [mode]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: inputValue,
          sessionId,
          mode,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response from AI");

      const data = await response.json();
      if (data.success) {
        const assistantMessage: Message = {
          id: `assistant_${Date.now()}`,
          role: "assistant",
          content: data.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        if (data.refresh && onRefresh) onRefresh();
      } else {
        setError(data.error || "Failed to process your message");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      console.error("Chat error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    try {
      await fetch(`${apiUrl}/api/chat/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            `Chat cleared! Currently in **${mode === "inquiry" ? "Inquiry (read‑only)" : "Full Access (CRUD)"}** mode.\n\n` +
            (mode === "inquiry"
              ? "I can only answer questions. Switch to Full Access to modify workouts."
              : "I can create, update, delete, and restore workouts. Always with confirmations."),
          timestamp: new Date(),
        },
      ]);
      setError(null);
    } catch (err) {
      console.error("Failed to clear chat:", err);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "inquiry" ? "crud" : "inquiry"));
  };

  return (
    <>
      {/* Floating Chat Button (icons only, no emoji) */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-primary/20 hover:shadow-primary/20 transition-shadow p-4"
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open chat"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MessageCircle className="h-6 w-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-6 z-40 w-96 max-w-[calc(100vw-2rem)] bg-background border border-border/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col h-[600px] overflow-hidden backdrop-blur-sm"
          >
            {/* Header with mode badge and toggle buttons */}
            <div className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground p-5 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-primary-foreground/10 p-2 rounded-xl">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold tracking-tight">FitTrack AI</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    <p className="text-[10px] uppercase font-bold opacity-80 tracking-wider">Online</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Toggle Button (Modern Switch Style) */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleMode}
                  className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full px-3 py-1.5 transition-all shadow-sm ${
                    mode === "inquiry"
                      ? "bg-blue-500/20 text-blue-100 border border-blue-400/30"
                      : "bg-green-500/20 text-green-100 border border-green-400/30"
                  }`}
                  title={mode === "inquiry" ? "Switch to full access (CRUD)" : "Switch to read-only (inquiry)"}
                >
                  {mode === "inquiry" ? (
                    <>
                      <Shield className="h-3 w-3" />
                      <span>Inquiry</span>
                    </>
                  ) : (
                    <>
                      <Edit className="h-3 w-3" />
                      <span>Full Access</span>
                    </>
                  )}
                </motion.button>
                {/* Clear button */}
                {messages.length > 1 && (
                  <motion.button
                    whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.25)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClearChat}
                    className="text-[10px] font-bold uppercase tracking-wider bg-primary-foreground/15 border border-primary-foreground/20 rounded-full px-3 py-1.5 transition-colors shadow-sm"
                    title="Clear chat history"
                  >
                    Clear
                  </motion.button>
                )}
              </div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20 custom-scrollbar">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${
                    msg.role === "user"
                      ? "justify-end"
                      : msg.role === "system"
                      ? "justify-center"
                      : "justify-start"
                  }`}
                >
                  {msg.role === "system" ? (
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 bg-muted/50 border border-border/50 px-4 py-1.5 rounded-full max-w-xs text-center shadow-sm">
                      {msg.content}
                    </div>
                  ) : (
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl shadow-sm relative group ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-card border border-border/50 text-card-foreground rounded-tl-none"
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-[9px] font-medium mt-2 opacity-50 ${
                        msg.role === "user" ? "text-right" : "text-left"
                      }`}>
                        {msg.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-card border border-border/50 text-muted-foreground px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-3 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs font-medium tracking-tight">AI is thinking...</span>
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-destructive/5 border border-destructive/20 text-destructive px-4 py-3 rounded-2xl rounded-tl-none text-xs font-medium flex items-center gap-2 shadow-sm">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                    {error}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <div className="p-4 bg-background border-t border-border/50 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
              <form onSubmit={handleSendMessage} className="flex gap-2 bg-muted/50 p-1.5 rounded-2xl border border-border/50 focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/10 transition-all">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    mode === "inquiry"
                      ? "Ask FitTrack AI anything..."
                      : "Command (e.g., delete Leg Day)..."
                  }
                  disabled={isLoading}
                  className="bg-transparent border-0 focus-visible:ring-0 shadow-none text-sm placeholder:text-muted-foreground/60 h-10"
                />
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    type="submit"
                    disabled={isLoading || !inputValue.trim()}
                    size="sm"
                    className="h-10 w-10 rounded-xl bg-primary hover:bg-primary shadow-md hover:shadow-primary/20 transition-all p-0 flex items-center justify-center shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </motion.div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Chatbot;