import { useEffect } from "react";
import { motion } from "framer-motion";
import { Dumbbell, Loader2 } from "lucide-react";
import StatsBar from "@/components/StatsBar";
import AddWorkoutForm from "@/components/AddWorkoutForm";
import WorkoutHistory from "@/components/WorkoutHistory";
import Chatbot from "@/components/Chatbot";
import { useWorkouts } from "@/hooks/useWorkouts";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Index = () => {
  const { 
    workouts, 
    addWorkout, 
    updateWorkout,
    deleteWorkout, 
    restoreWorkout,
    refresh,
    totalWorkouts, 
    totalVolume, 
    thisWeek,
    currentStreak,
    isTrashView,
    toggleTrashView,
    isLoading,
    error 
  } = useWorkouts();

  // Listen for real-time updates via SSE
  useEffect(() => {
    const eventSource = new EventSource(`${API_URL}/api/sync-status`);
    
    eventSource.addEventListener("refresh", () => {
      console.log("🔄 SSE Refresh triggered");
      refresh();
    });

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [refresh]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center gap-3"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary">
            <Dumbbell className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">
              Workout Tracker
            </h1>
            <p className="text-sm text-muted-foreground">Track your gains, crush your goals</p>
          </div>
        </motion.div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg text-sm border border-destructive/20">
            ⚠️ {error}
          </div>
        )}

        {/* Stats */}
        <div className="mb-6">
          <StatsBar 
            totalWorkouts={totalWorkouts} 
            thisWeek={thisWeek} 
            totalVolume={totalVolume} 
            currentStreak={currentStreak}
            isTrashView={isTrashView}
          />
        </div>

        {/* Add Workout / View Toggle */}
        <div className="mb-6 flex flex-col gap-4">
          {!isTrashView && <AddWorkoutForm onAdd={addWorkout} />}
          
          <div className="flex justify-end">
            <button
              onClick={toggleTrashView}
              className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
            >
              {isTrashView ? "← Back to Workouts" : "View Trash"}
            </button>
          </div>
        </div>

        {/* History */}
        {isLoading && workouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-2" />
            <p>Loading {isTrashView ? "trash" : "your workouts"}...</p>
          </div>
        ) : (
          <WorkoutHistory 
            workouts={workouts} 
            onDelete={deleteWorkout} 
            onUpdate={updateWorkout}
            onRestore={restoreWorkout}
            isTrashView={isTrashView}
          />
        )}
      </div>

      {/* AI Chatbot Widget */}
      <Chatbot onRefresh={refresh} />
    </div>
  );
};

export default Index;
