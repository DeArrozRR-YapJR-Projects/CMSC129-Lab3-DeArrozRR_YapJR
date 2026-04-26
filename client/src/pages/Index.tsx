import { motion } from "framer-motion";
import { Dumbbell } from "lucide-react";
import StatsBar from "@/components/StatsBar";
import AddWorkoutForm from "@/components/AddWorkoutForm";
import WorkoutHistory from "@/components/WorkoutHistory";
import Chatbot from "@/components/Chatbot";
import { useWorkouts } from "@/hooks/useWorkouts";

const Index = () => {
  const { workouts, addWorkout, deleteWorkout, totalWorkouts, totalVolume, thisWeek } =
    useWorkouts();

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

        {/* Stats */}
        <div className="mb-6">
          <StatsBar totalWorkouts={totalWorkouts} thisWeek={thisWeek} totalVolume={totalVolume} />
        </div>

        {/* Add Workout */}
        <div className="mb-6">
          <AddWorkoutForm onAdd={addWorkout} />
        </div>

        {/* History */}
        <WorkoutHistory workouts={workouts} onDelete={deleteWorkout} />
      </div>

      {/* AI Chatbot Widget */}
      <Chatbot />
    </div>
  );
};

export default Index;
