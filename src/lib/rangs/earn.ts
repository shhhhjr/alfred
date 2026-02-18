import { prisma } from "@/lib/db/prisma";

const TYPE_WEIGHTS: Record<string, number> = {
  exam: 15,
  assignment: 10,
  work: 8,
  personal: 5,
  errand: 3,
};

export async function awardRangsForTask(
  userId: string,
  taskId: string,
  taskTitle: string,
  importance: number,
  category: string | null,
  dueDate: Date | null,
  completedAt: Date,
): Promise<number | null> {
  const onTime = !dueDate || completedAt <= dueDate;
  if (!onTime) return null;

  const base = 5 + Math.min(importance, 10) * 2;
  const typeBonus = TYPE_WEIGHTS[(category ?? "").toLowerCase()] ?? 5;
  const amount = Math.round(base + typeBonus);

  await prisma.$transaction(async (tx) => {
    await tx.rewardTransaction.create({
      data: {
        userId,
        amount,
        type: "earn",
        sourceRef: taskId,
        description: `Completed on time: ${taskTitle}`,
      },
    });
    const txnSum = await tx.rewardTransaction.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    const spendSum = await tx.purchase.aggregate({
      where: { userId },
      _sum: { cost: true },
    });
    const balance = (txnSum._sum.amount ?? 0) - (spendSum._sum.cost ?? 0);
    await tx.wallet.upsert({
      where: { userId },
      create: { userId, balance },
      update: { balance },
    });
  });

  await prisma.activityLog.create({
    data: {
      userId,
      action: "rangs_earned",
      description: `Earned ${amount} Rangs for completing: ${taskTitle}`,
      metadata: { amount, taskId },
    },
  });

  return amount;
}

export async function getWalletBalance(userId: string): Promise<number> {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
  });
  return wallet?.balance ?? 0;
}
