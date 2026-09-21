import type { View } from "../../shared/domain.ts";

type IdentityLookup = (id: string) => Promise<{ id: string; email?: string }>;

// Enrich only the authorised response, never the stored workspace or audit log.
// Looking up existing member IDs also covers profiles created before this feature.
export async function withMemberEmails(
  view: View,
  lookup: IdentityLookup,
): Promise<View> {
  if (view.me.role !== "manager") return view;
  const members = await Promise.all(
    view.members.map(async (member) => {
      const { email: _previousEmail, ...profile } = member;
      try {
        const user = await lookup(member.id);
        if (user.id === member.id && user.email?.trim())
          return { ...profile, email: user.email.trim() };
      } catch {
        // A missing Identity account or lookup failure must not block planning
        // or make a successfully committed edit appear to have failed.
      }
      return profile;
    }),
  );
  return { ...view, members, me: members.find((m) => m.id === view.me.id)! };
}
