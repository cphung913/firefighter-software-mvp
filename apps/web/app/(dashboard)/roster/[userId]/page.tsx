import { redirect } from "next/navigation";

export default function MemberPage({
  params,
}: {
  params: { userId: string };
}) {
  redirect(`/roster?member=${params.userId}`);
}
