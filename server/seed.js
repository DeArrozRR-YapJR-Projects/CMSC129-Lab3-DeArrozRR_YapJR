const mongoose = require("mongoose");
require("dotenv").config();

const workoutSchema = new mongoose.Schema(
  {
    title:     { type: String, default: "Workout" },
    date:      { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
    exercises: [
      {
        id:     { type: String, required: true },
        name:   { type: String, required: true },
        sets:   { type: Number, required: true },
        reps:   { type: Number, required: true },
        weight: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true }
);

const seedData = [
  {
    title: "Chest & Triceps",
    date: "2024-04-24",
    exercises: [
      { id: "1", name: "Bench Press", sets: 4, reps: 8, weight: 225 },
      { id: "2", name: "Incline Dumbbell Press", sets: 3, reps: 10, weight: 85 },
      { id: "3", name: "Cable Flyes", sets: 3, reps: 12, weight: 50 },
      { id: "4", name: "Tricep Dips", sets: 3, reps: 10, weight: 0 },
      { id: "5", name: "Rope Pushdowns", sets: 3, reps: 12, weight: 60 },
    ],
  },
  {
    title: "Back & Biceps",
    date: "2024-04-23",
    exercises: [
      { id: "1", name: "Deadlifts", sets: 3, reps: 5, weight: 315 },
      { id: "2", name: "Barbell Rows", sets: 4, reps: 8, weight: 245 },
      { id: "3", name: "Pull-ups", sets: 3, reps: 8, weight: 0 },
      { id: "4", name: "Barbell Curls", sets: 3, reps: 10, weight: 115 },
      { id: "5", name: "Hammer Curls", sets: 3, reps: 12, weight: 50 },
    ],
  },
  {
    title: "Legs",
    date: "2024-04-22",
    exercises: [
      { id: "1", name: "Squats", sets: 4, reps: 6, weight: 315 },
      { id: "2", name: "Romanian Deadlifts", sets: 4, reps: 8, weight: 275 },
      { id: "3", name: "Leg Press", sets: 3, reps: 10, weight: 495 },
      { id: "4", name: "Leg Curls", sets: 3, reps: 12, weight: 180 },
      { id: "5", name: "Leg Extensions", sets: 3, reps: 12, weight: 190 },
      { id: "6", name: "Calf Raises", sets: 4, reps: 15, weight: 405 },
    ],
  },
  {
    title: "Shoulders",
    date: "2024-04-21",
    exercises: [
      { id: "1", name: "Military Press", sets: 4, reps: 8, weight: 165 },
      { id: "2", name: "Lateral Raises", sets: 3, reps: 12, weight: 35 },
      { id: "3", name: "Reverse Flyes", sets: 3, reps: 12, weight: 25 },
      { id: "4", name: "Shrugs", sets: 3, reps: 10, weight: 315 },
    ],
  },
  {
    title: "Cardio & Core",
    date: "2024-04-20",
    exercises: [
      { id: "1", name: "Treadmill Running", sets: 1, reps: 20, weight: 0 },
      { id: "2", name: "Ab Wheel Rollouts", sets: 3, reps: 15, weight: 0 },
      { id: "3", name: "Planks", sets: 3, reps: 60, weight: 0 },
      { id: "4", name: "Cable Crunches", sets: 3, reps: 15, weight: 100 },
    ],
  },
  {
    title: "Full Body",
    date: "2024-04-19",
    exercises: [
      { id: "1", name: "Squats", sets: 3, reps: 8, weight: 275 },
      { id: "2", name: "Bench Press", sets: 3, reps: 8, weight: 205 },
      { id: "3", name: "Rows", sets: 3, reps: 8, weight: 225 },
      { id: "4", name: "Overhead Press", sets: 3, reps: 8, weight: 155 },
    ],
  },
  {
    title: "Chest & Triceps",
    date: "2024-04-18",
    exercises: [
      { id: "1", name: "Barbell Bench Press", sets: 4, reps: 8, weight: 225 },
      { id: "2", name: "Dumbbell Flyes", sets: 3, reps: 12, weight: 75 },
      { id: "3", name: "Decline Push-ups", sets: 3, reps: 15, weight: 0 },
      { id: "4", name: "Tricep Dips", sets: 3, reps: 12, weight: 0 },
      { id: "5", name: "Overhead Extensions", sets: 3, reps: 12, weight: 90 },
    ],
  },
  {
    title: "Back & Biceps",
    date: "2024-04-17",
    exercises: [
      { id: "1", name: "Deadlifts", sets: 3, reps: 5, weight: 305 },
      { id: "2", name: "Bent Over Rows", sets: 4, reps: 8, weight: 235 },
      { id: "3", name: "Lat Pulldowns", sets: 3, reps: 10, weight: 210 },
      { id: "4", name: "Dumbbell Curls", sets: 3, reps: 10, weight: 45 },
      { id: "5", name: "Cable Curls", sets: 3, reps: 12, weight: 70 },
    ],
  },
  {
    title: "Legs",
    date: "2024-04-16",
    exercises: [
      { id: "1", name: "Squats", sets: 4, reps: 6, weight: 305 },
      { id: "2", name: "Leg Press", sets: 3, reps: 10, weight: 485 },
      { id: "3", name: "Hamstring Curls", sets: 3, reps: 12, weight: 170 },
      { id: "4", name: "Leg Extensions", sets: 3, reps: 12, weight: 185 },
      { id: "5", name: "Seated Calf Raises", sets: 3, reps: 15, weight: 225 },
    ],
  },
  {
    title: "Shoulders",
    date: "2024-04-15",
    exercises: [
      { id: "1", name: "Overhead Press", sets: 4, reps: 8, weight: 155 },
      { id: "2", name: "Machine Lateral Raises", sets: 3, reps: 15, weight: 80 },
      { id: "3", name: "Rear Delt Flyes", sets: 3, reps: 12, weight: 65 },
      { id: "4", name: "Barbell Shrugs", sets: 3, reps: 10, weight: 295 },
    ],
  },
  {
    title: "Arms Focus",
    date: "2024-04-14",
    exercises: [
      { id: "1", name: "Barbell Curls", sets: 4, reps: 8, weight: 125 },
      { id: "2", name: "Tricep Rope Extensions", sets: 3, reps: 12, weight: 70 },
      { id: "3", name: "Dumbbell Hammer Curls", sets: 3, reps: 10, weight: 55 },
      { id: "4", name: "V-Bar Pushdowns", sets: 3, reps: 12, weight: 110 },
    ],
  },
  {
    title: "Back & Lats",
    date: "2024-04-13",
    exercises: [
      { id: "1", name: "Wide Grip Pull-ups", sets: 4, reps: 8, weight: 0 },
      { id: "2", name: "T-Bar Rows", sets: 3, reps: 8, weight: 275 },
      { id: "3", name: "Chest Supported Rows", sets: 3, reps: 10, weight: 185 },
      { id: "4", name: "Lat Pulldowns", sets: 3, reps: 12, weight: 230 },
    ],
  },
  {
    title: "Leg Day",
    date: "2024-04-12",
    exercises: [
      { id: "1", name: "Front Squats", sets: 4, reps: 6, weight: 245 },
      { id: "2", name: "Bulgarian Split Squats", sets: 3, reps: 8, weight: 95 },
      { id: "3", name: "Leg Curls", sets: 3, reps: 12, weight: 190 },
      { id: "4", name: "Leg Extensions", sets: 3, reps: 15, weight: 200 },
      { id: "5", name: "Standing Calf Raises", sets: 4, reps: 12, weight: 495 },
    ],
  },
  {
    title: "Push Day",
    date: "2024-04-11",
    exercises: [
      { id: "1", name: "Incline Bench Press", sets: 4, reps: 8, weight: 205 },
      { id: "2", name: "Flat Bench Press", sets: 3, reps: 10, weight: 185 },
      { id: "3", name: "Machine Chest Press", sets: 3, reps: 12, weight: 315 },
      { id: "4", name: "Dips", sets: 3, reps: 10, weight: 0 },
    ],
  },
  {
    title: "Pull Day",
    date: "2024-04-10",
    exercises: [
      { id: "1", name: "Deadlifts", sets: 3, reps: 5, weight: 325 },
      { id: "2", name: "Rows", sets: 4, reps: 6, weight: 255 },
      { id: "3", name: "Pull-ups", sets: 3, reps: 10, weight: 0 },
      { id: "4", name: "Barbell Curls", sets: 3, reps: 10, weight: 120 },
    ],
  },
  {
    title: "Conditioning",
    date: "2024-04-09",
    exercises: [
      { id: "1", name: "Rowing Machine", sets: 1, reps: 30, weight: 0 },
      { id: "2", name: "Battle Ropes", sets: 3, reps: 40, weight: 0 },
      { id: "3", name: "Box Jumps", sets: 3, reps: 10, weight: 0 },
      { id: "4", name: "Burpees", sets: 3, reps: 15, weight: 0 },
    ],
  },
  {
    title: "Chest & Triceps",
    date: "2024-04-08",
    exercises: [
      { id: "1", name: "Barbell Bench Press", sets: 4, reps: 8, weight: 225 },
      { id: "2", name: "Incline Dumbbell Press", sets: 3, reps: 10, weight: 85 },
      { id: "3", name: "Pec Deck Flyes", sets: 3, reps: 12, weight: 120 },
      { id: "4", name: "Dips", sets: 3, reps: 12, weight: 0 },
      { id: "5", name: "Tricep Rope Extensions", sets: 3, reps: 12, weight: 65 },
    ],
  },
];

async function seed() {
  try {
    console.log("🌱 Starting database seed...");

    const conn = await mongoose.connect(process.env.MONGO_URI);
    const Workout = conn.model("Workout", workoutSchema);

    await Workout.deleteMany({});
    console.log("🗑️  Cleared existing workouts");

    const result = await Workout.insertMany(seedData);
    console.log(`✅ Successfully seeded ${result.length} workouts`);

    const stats = await Workout.aggregate([
      {
        $facet: {
          totalWorkouts: [{ $count: "count" }],
          dateRange: [
            { $group: { _id: null, minDate: { $min: "$date" }, maxDate: { $max: "$date" } } },
          ],
        },
      },
    ]);

    console.log("\n📊 Seed Summary:");
    console.log(JSON.stringify(stats[0], null, 2));

    await conn.connection.close();
    console.log("\n✨ Seeding complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();