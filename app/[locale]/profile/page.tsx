import ProfileClientPage from "./ProfileClientPage";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

export default async function ProfilePage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  return <ProfileClientPage />;
}

