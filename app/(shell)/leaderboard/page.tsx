import { auth } from "@clerk/nextjs/server";

import { LeaderboardScreen } from "@/features/leaderboard/leaderboard-screen";
import { getLeaderboardStandings } from "@/features/leaderboard/leaderboard-standings";
import { findAppUserId } from "@/infrastructure/current-user";
import { hasClerkConfigured } from "@/infrastructure/env";

/**
 * "Just me" cannot exist without an account, same reasoning as feature 7's
 * thread list: it fetches nothing and shows a sign-in invitation instead.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly view?: string }>;
}) {
  const { view: rawView } = await searchParams;
  const view = rawView === "me" ? "me" : "everyone";

  const clerkAuth = await auth().catch(() => ({ userId: null }));
  const clerkId = clerkAuth?.userId ?? (hasClerkConfigured() ? null : "guest_preview_user");
  const viewerId = clerkId ? await findAppUserId(clerkId) : null;

  const needsSignIn = view === "me" && viewerId === null;
  const rows = needsSignIn
    ? []
    : await getLeaderboardStandings(view === "me" ? viewerId : null);

  return <LeaderboardScreen rows={rows} view={view} needsSignIn={needsSignIn} />;
}
