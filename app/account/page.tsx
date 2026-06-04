import { AccountPage } from "@/components/AccountPage";
import { safeCallbackUrl } from "@/lib/redirect";
import { getServerSession } from "@/lib/session";

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function AccountRoute({ searchParams }: Props) {
  const session = await getServerSession();
  const { callbackUrl } = await searchParams;

  return <AccountPage callbackUrl={safeCallbackUrl(callbackUrl)} initialUser={session?.user ?? null} />;
}
