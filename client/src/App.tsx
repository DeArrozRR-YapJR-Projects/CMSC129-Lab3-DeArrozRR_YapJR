import { useState, useEffect } from "react";
import { Dumbbell } from "lucide-react";
import AddWorkoutForm from "@/components/AddWorkoutForm";
import StatsBar from "@/components/StatsBar";
import WorkoutHistory from "@/components/WorkoutHistory";
import Chatbot from "@/components/Chatbot";
import type { Workout } from "@/types/workout";
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export default function App() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ✅ New State: Toggle between Active History and Trash Bin
  const [showTrash, setShowTrash] = useState(false);

  // READ: load from backend (Updates automatically when showTrash changes)
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // Notice the ?deleted=${showTrash} in the URL!
        const res = await fetch(`${API_BASE}/api/workouts?deleted=${showTrash}`);
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { workouts: Workout[] };
        setWorkouts(data.workouts ?? []);
      } catch (e: any) {
        setError(e.message || "Failed to load workouts");
      } finally {
        setLoading(false);
      }
    })();
  }, [showTrash]); 

  // CREATE
  const handleAddWorkout = async (newWorkout: Workout) => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/workouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWorkout),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { workout: Workout };
      if (!showTrash) setWorkouts([data.workout, ...workouts]);
    } catch (e: any) {
      setError(e.message || "Failed to add workout");
    }
  };

  // UPDATE
  const handleUpdateWorkout = async (id: string, updatedWorkout: Workout) => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/workouts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedWorkout),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { workout: Workout };
      setWorkouts(workouts.map(w => w.id === id ? data.workout : w));
    } catch (e: any) {
      setError(e.message || "Failed to update workout");
    }
  };

  // DELETE (Soft & Hard)
  const handleDeleteWorkout = async (id: string, type: "soft" | "hard") => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/workouts/${id}?type=${type}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setWorkouts(workouts.filter((w) => w.id !== id));
    } catch (e: any) {
      setError(e.message || "Failed to delete workout");
    }
  };

  // ✅ RESTORE (Moves it out of the trash bin)
  const handleRestoreWorkout = async (id: string) => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/workouts/${id}/restore`, { method: "PUT" });
      if (!res.ok) throw new Error(await res.text());
      setWorkouts(workouts.filter((w) => w.id !== id));
    } catch (e: any) {
      setError(e.message || "Failed to restore workout");
    }
  };

  // Stats
  const totalVolume = workouts.reduce((acc, w) => acc + w.exercises.reduce((eAcc, e) => eAcc + e.sets * e.reps * e.weight, 0), 0);
  const thisWeekCount = workouts.filter((w) => new Date(w.date) > new Date(new Date().setDate(new Date().getDate() - 7))).length;

  const calculateStreak = () => {
    if (workouts.length === 0) return 0;
    const uniqueDates = [...new Set(workouts.map(w => new Date(w.date).setHours(0,0,0,0)))].sort((a, b) => b - a);
    const today = new Date().setHours(0,0,0,0);
    const oneDay = 86400000;
    if (uniqueDates[0] < today - oneDay) return 0;
    let streak = 1;
    for (let i = 0; i < uniqueDates.length - 1; i++) {
      if (uniqueDates[i] - uniqueDates[i+1] === oneDay) streak++;
      else break;
    }
    return streak;
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-body p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-primary rounded-xl shadow-glow">
            <Dumbbell className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight">FitTrack</h1>
            <p className="text-muted-foreground">Monitor your progress</p>
          </div>
        </header>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <section>
          <StatsBar totalWorkouts={workouts.length} thisWeek={thisWeekCount} totalVolume={totalVolume} currentStreak={calculateStreak()} />
        </section>

        {/* Hide Add form if we are currently looking at the Trash Bin */}
        {!showTrash && (
          <section>
            <AddWorkoutForm onAdd={handleAddWorkout} />
          </section>
        )}

        <section>
          {/* ✅ The Toggle Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-heading font-bold text-foreground">
              {showTrash ? "Trash Bin" : "History"}
            </h2>
            <Button variant="outline" size="sm" onClick={() => setShowTrash(!showTrash)}>
              {showTrash ? "View Active Workouts" : "View Trash Bin"}
            </Button>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading workouts...</div>
          ) : (
            <WorkoutHistory 
              workouts={workouts} 
              onDelete={handleDeleteWorkout} 
              onUpdate={handleUpdateWorkout} 
              onRestore={handleRestoreWorkout} 
              isTrashView={showTrash} 
            />
          )}
        </section>
      </div>

      {/* AI Chatbot Widget */}
      <Chatbot />
    </div>
  );
}