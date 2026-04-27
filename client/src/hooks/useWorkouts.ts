import { useState, useCallback, useEffect } from "react";
import type { Workout } from "@/types/workout";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const useWorkouts = () => {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [activeWorkoutsForStats, setActiveWorkoutsForStats] = useState<Workout[]>([]);
  const [isTrashView, setIsTrashView] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkouts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/workouts?deleted=${isTrashView}`);
      if (!response.ok) throw new Error("Failed to fetch workouts");
      const data = await response.json();
      setWorkouts(data.workouts);
      
      if (!isTrashView) {
        setActiveWorkoutsForStats(data.workouts);
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workouts");
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isTrashView]);

  useEffect(() => {
    if (isTrashView) {
      const fetchActive = async () => {
        try {
          const response = await fetch(`${API_URL}/api/workouts?deleted=false`);
          if (response.ok) {
            const data = await response.json();
            setActiveWorkoutsForStats(data.workouts);
          }
        } catch (err) {
          console.error("Failed to fetch active workouts for stats:", err);
        }
      };
      fetchActive();
    }
  }, [isTrashView]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  const addWorkout = useCallback(async (workout: Omit<Workout, "id">) => {
    try {
      const response = await fetch(`${API_URL}/api/workouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workout),
      });
      if (!response.ok) throw new Error("Failed to add workout");
      await fetchWorkouts();
    } catch (err) {
      console.error("Add error:", err);
      throw err;
    }
  }, [fetchWorkouts]);

  const updateWorkout = useCallback(async (id: string, updated: Workout) => {
    try {
      const response = await fetch(`${API_URL}/api/workouts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!response.ok) throw new Error("Failed to update workout");
      await fetchWorkouts();
    } catch (err) {
      console.error("Update error:", err);
      throw err;
    }
  }, [fetchWorkouts]);

  const deleteWorkout = useCallback(async (id: string, type: "soft" | "hard" = "soft") => {
    try {
      const response = await fetch(`${API_URL}/api/workouts/${id}?type=${type}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete workout");
      await fetchWorkouts();
    } catch (err) {
      console.error("Delete error:", err);
      throw err;
    }
  }, [fetchWorkouts]);

  const restoreWorkout = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/workouts/${id}/restore`, {
        method: "PUT",
      });
      if (!response.ok) throw new Error("Failed to restore workout");
      await fetchWorkouts();
    } catch (err) {
      console.error("Restore error:", err);
      throw err;
    }
  }, [fetchWorkouts]);

  const toggleTrashView = () => setIsTrashView(prev => !prev);

  // Stats calculations (always use active workouts for stats, or whatever is loaded?)
  // Usually stats are based on all history, but let's assume active workouts.
  // Actually, if we are in trash view, stats might be weird if we only use `workouts`.
  // Let's fetch active workouts separately for stats if needed, or just use what we have.
  // The requirement seems to be showing stats on the main page.

  const totalWorkouts = activeWorkoutsForStats.length;
  const totalVolume = activeWorkoutsForStats.reduce(
    (acc, w) => acc + w.exercises.reduce((a, e) => a + e.sets * e.reps * e.weight, 0),
    0
  );

  const thisWeek = activeWorkoutsForStats.filter((w) => {
    const d = new Date(w.date);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  }).length;

  const calculateStreak = (workoutList: Workout[]) => {
    if (workoutList.length === 0) return 0;

    // Sort unique dates descending
    const dates = Array.from(new Set(workoutList.map(w => new Date(w.date).toDateString())))
      .map(d => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime());

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let lastDate = dates[0];
    lastDate.setHours(0, 0, 0, 0);

    // If latest workout is not today or yesterday, streak is 0
    if (lastDate.getTime() !== today.getTime() && lastDate.getTime() !== yesterday.getTime()) {
      return 0;
    }

    streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const currentDate = new Date(dates[i]);
      currentDate.setHours(0, 0, 0, 0);

      const prevDate = new Date(dates[i-1]);
      prevDate.setHours(0, 0, 0, 0);

      const diffDays = (prevDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  const currentStreak = calculateStreak(activeWorkoutsForStats);

  return { 
    workouts, 
    addWorkout, 
    updateWorkout,
    deleteWorkout, 
    restoreWorkout,
    refresh: fetchWorkouts,
    totalWorkouts, 
    totalVolume, 
    thisWeek,
    currentStreak,
    isTrashView,
    toggleTrashView,
    isLoading,
    error
  };
};

