import { AboutSettingsManager } from "@/components/admin/about-settings-manager";
import { prisma } from "@/lib/prisma";

export default async function AdminAboutSettingsPage(): Promise<React.ReactElement> {
  const [about, systemSettings] = await Promise.all([
    prisma.aboutSettings.findUnique({ where: { id: 1 } }),
    prisma.systemSetting.findUnique({ where: { id: 1 } })
  ]);

  return (
    <AboutSettingsManager
      about={{
        centerNameEn: about?.centerNameEn ?? "",
        centerNameAr: about?.centerNameAr ?? "",
        descriptionEn: about?.descriptionEn ?? "",
        descriptionAr: about?.descriptionAr ?? "",
        mapEmbedUrl: about?.mapEmbedUrl ?? "",
        phone: about?.phone ?? "",
        whatsapp: about?.whatsapp ?? "",
        instagramUrl: about?.instagramUrl ?? "",
        facebookUrl: about?.facebookUrl ?? "",
        xUrl: about?.xUrl ?? ""
      }}
      settings={{
        cancellationPolicyHours: systemSettings?.cancellationPolicyHours ?? 24,
        lateCancellationHours: systemSettings?.lateCancellationHours ?? 2,
        defaultCurrency: systemSettings?.defaultCurrency ?? "JOD",
        timezone: systemSettings?.timezone ?? "UTC"
      }}
    />
  );
}
