import { CustomerJoinClient } from "@/components/session/customer-join-client";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function CustomerJoinPage({ params }: Props) {
  const { sessionId } = await params;
  return <CustomerJoinClient shareToken={sessionId} />;
}
