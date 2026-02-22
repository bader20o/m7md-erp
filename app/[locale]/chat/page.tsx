import { redirect } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { getSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export default async function ChatPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const dict = getDictionary(locale);

  return (
    <ChatPanel
      locale={locale}
      labels={{
        title: dict.chatTitle,
        threadsLabel: dict.chatThreadsLabel,
        noThreads: dict.chatNoThreads,
        selectThread: dict.chatSelectThread,
        loadOlder: dict.chatLoadOlder,
        messagePlaceholder: dict.chatMessagePlaceholder,
        send: dict.chatSend,
        sending: dict.chatSending,
        loadingThreads: dict.chatLoadingThreads,
        loadingMessages: dict.chatLoadingMessages,
        unread: dict.chatUnread,
        newConversation: dict.chatNewConversation,
        recipients: dict.chatRecipients,
        searchUsers: dict.chatSearchUsers,
        subjectOptional: dict.chatSubjectOptional,
        createConversation: dict.chatCreateConversation,
        creatingConversation: dict.chatCreatingConversation,
        noUsersFound: dict.chatNoUsersFound,
        customerDetails: dict.chatCustomerDetails,
        lastBooking: dict.chatLastBooking,
        noBooking: dict.chatNoBooking,
        bookingDate: dict.chatBookingDate,
        bookingStatus: dict.chatBookingStatus,
        bookingService: dict.chatBookingService,
        bookingPrice: dict.chatBookingPrice
      }}
    />
  );
}
