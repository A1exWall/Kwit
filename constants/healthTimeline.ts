import { RECOVERY_MILESTONES } from "./recoveryTimeline";

export type HealthMilestone = {
  name: string;
  timeMs: number;
};

/** Same milestones as the Health tab timeline — for Home “next milestone” card */
export const healthTimelineMilestones: HealthMilestone[] = RECOVERY_MILESTONES.map(
  (m) => ({
    name: m.title,
    timeMs: m.timeMs,
  })
);
