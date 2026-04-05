const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

export type RecoveryMilestone = {
  time: string;
  title: string;
  detail: string;
  /** Milliseconds from quit_date when this milestone is reached */
  timeMs: number;
};

/**
 * Canonical recovery timeline — used by Health tab and Home “next milestone”.
 */
export const RECOVERY_MILESTONES: RecoveryMilestone[] = [
  {
    time: "20 minutes",
    title: "Blood pressure drops",
    detail:
      "Your blood pressure and heart rate begin to normalise.",
    timeMs: 20 * minuteMs,
  },
  {
    time: "8 hours",
    title: "Oxygen levels normalise",
    detail: "Carbon monoxide in blood reduces by half.",
    timeMs: 8 * hourMs,
  },
  {
    time: "24 hours",
    title: "Heart attack risk drops",
    detail: "Your risk of a heart attack begins to decrease.",
    timeMs: 24 * hourMs,
  },
  {
    time: "48 hours",
    title: "Senses return",
    detail: "Nerve endings regenerate. Taste and smell improve.",
    timeMs: 48 * hourMs,
  },
  {
    time: "72 hours",
    title: "Nicotine-free body",
    detail: "Nicotine is fully cleared. Breathing becomes easier.",
    timeMs: 72 * hourMs,
  },
  {
    time: "2 weeks",
    title: "Circulation improves",
    detail: "Blood flow significantly improved throughout your body.",
    timeMs: 14 * dayMs,
  },
  {
    time: "1 month",
    title: "Lungs recovering",
    detail: "Coughing reduces. Cilia in lungs begin to recover.",
    timeMs: 30 * dayMs,
  },
  {
    time: "3 months",
    title: "Lung capacity up 10%",
    detail: "Your lungs can now hold significantly more air.",
    timeMs: 90 * dayMs,
  },
  {
    time: "1 year",
    title: "Heart disease risk halved",
    detail: "Heart disease risk is now half that of a smoker.",
    timeMs: 365 * dayMs,
  },
  {
    time: "5 years",
    title: "Stroke risk normalises",
    detail: "Stroke risk equals that of a lifetime non-smoker.",
    timeMs: 5 * 365 * dayMs,
  },
  {
    time: "10 years",
    title: "Lung cancer risk halved",
    detail: "Lung cancer death rate halved vs continuing smokers.",
    timeMs: 10 * 365 * dayMs,
  },
  {
    time: "15 years",
    title: "Heart fully recovered",
    detail: "Heart disease risk equals that of a non-smoker.",
    timeMs: 15 * 365 * dayMs,
  },
];

export function formatRecoveryTimeLabel(time: string) {
  return time.toUpperCase();
}
