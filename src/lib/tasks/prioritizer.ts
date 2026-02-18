type Task = {
  dueDate: Date | null;
  estimatedTime?: number | null;
  importance?: number;
  category?: string | null;
};

export function calculatePriority(task: Task): number {
  const now = new Date();
  const hoursUntilDue = task.dueDate
    ? (task.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    : 9999;
  const hoursNeeded = (task.estimatedTime || 60) / 60;

  // Urgency: higher when less time remains relative to work needed
  const urgencyRatio = hoursNeeded / Math.max(hoursUntilDue, 1);
  const urgencyScore = Math.min(urgencyRatio * 50, 50); // max 50 points

  // Importance: direct scale
  const importanceScore = (task.importance || 5) * 3; // max 30 points

  // Type weight: exams > assignments > work > personal > errands
  const typeWeights: Record<string, number> = {
    exam: 20,
    assignment: 15,
    work: 10,
    personal: 5,
    errand: 3,
  };
  const typeScore = typeWeights[(task.category || "personal").toLowerCase()] ?? 5; // max 20 points

  return urgencyScore + importanceScore + typeScore;
}

// Alias for backward compatibility with existing API
export const calculateTaskPriority = calculatePriority;
