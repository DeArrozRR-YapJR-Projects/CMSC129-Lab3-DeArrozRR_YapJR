import { motion } from "framer-motion";
import { Dumbbell, Calendar, TrendingUp, Zap } from "lucide-react";

interface StatsBarProps {
  totalWorkouts: number;
  thisWeek: number;
  totalVolume: number;
  currentStreak: number;
  isTrashView?: boolean;
}

const StatCard = ({
  icon: Icon,
  label,
  value,
  delay,
  highlight = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  delay: number;
  highlight?: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className={`flex items-center gap-3 rounded-lg border bg-card p-4 ${highlight ? 'border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'border-border'}`}
  >
    <div className={`flex h-10 w-10 items-center justify-center rounded-md ${highlight ? 'bg-orange-500/10' : 'bg-primary/10'}`}>
      <Icon className={`h-5 w-5 ${highlight ? 'text-orange-500' : 'text-primary'}`} />
    </div>
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-bold font-heading text-foreground">{value}</p>
    </div>
  </motion.div>
);

const StatsBar = ({ totalWorkouts, thisWeek, totalVolume, currentStreak, isTrashView = false }: StatsBarProps) => {
  const formatVolume = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toString();
  };

  return (
    <div className={`grid gap-3 ${isTrashView ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
      {!isTrashView && (
        <StatCard icon={Zap} label="Current Streak" value={`${currentStreak} Days`} delay={0} highlight={currentStreak > 0} />
      )}
      <StatCard icon={Dumbbell} label="Total Workouts" value={totalWorkouts.toString()} delay={0.1} />
      <StatCard icon={Calendar} label="This Week" value={thisWeek.toString()} delay={0.2} />
      <StatCard icon={TrendingUp} label="Total Volume" value={`${formatVolume(totalVolume)} lbs`} delay={0.3} />
    </div>
  );
};

export default StatsBar;